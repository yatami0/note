import fs from 'node:fs/promises';
import path from 'node:path';
import { createProcessor, renderNote } from './pipeline.js';

/** 関連ノートのリンク関係。mutual = 相互リンク, out = 参照先, in = 被参照 */
export type RelatedRelation = 'mutual' | 'out' | 'in';

export interface RelatedNote {
  slug: string;
  title: string;
  updated: string;
  /** リンク関係 (タグ共有のみの関連なら null) */
  relation: RelatedRelation | null;
  /** 共有しているタグ */
  sharedTags: string[];
  /** mutual=3, out/in=2, +共有タグ数。降順で related に並ぶ */
  score: number;
}

export interface Note {
  slug: string;
  title: string;
  /** "YYYY-MM-DD HH:MM" (pre-commit フックが frontmatter に刻印) */
  created: string;
  updated: string;
  html: string;
  tags: string[];
  headings: { depth: number; id: string; text: string }[];
  backlinks: { slug: string; title: string }[];
  /** このノートが wikilink で参照しているノート (解決済み・自己リンク除外・重複排除) */
  links: { slug: string; title: string }[];
  /** リンク関係・タグ共有から算出した関連ノート (スコア降順・上位 RELATED_LIMIT 件) */
  related: RelatedNote[];
  /** 一覧カード用の本文抜粋 (プレーンテキスト) */
  excerpt: string;
  hasMermaid: boolean;
  hasMath: boolean;
  hasTweet: boolean;
}

export interface NoteCollection {
  /** updated 降順 */
  notes: Note[];
  /** タグ → そのタグを持つノート (updated 降順)。件数降順・同数ならタグ名昇順 */
  tags: { tag: string; notes: Note[] }[];
  /** 解決できなかった wikilink (from → target) */
  broken: { from: string; target: string }[];
}

// astro dev / build はプロジェクトルートで実行される前提 (import.meta.url は
// ビルド時にバンドル先 dist/ を指してしまうため使えない)
const DEFAULT_SRC_DIR = path.resolve(process.cwd(), 'notes/src');

/** 関連ノートとして各ノートに持たせる最大件数 */
export const RELATED_LIMIT = 8;

interface RawNote {
  slug: string;
  title: string;
  created: string;
  updated: string;
  body: string;
}

function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** build.py の parse_note と同じ規約: frontmatter (created/updated) + 1行目 `# タイトル` */
async function parseNote(filePath: string): Promise<RawNote> {
  let text = await fs.readFile(filePath, 'utf8');
  let created: string | undefined;
  let updated: string | undefined;
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    text = text.slice(fm[0].length);
    created = fm[1]!.match(/^created:\s*(.+?)\s*$/m)?.[1];
    updated = fm[1]!.match(/^updated:\s*(.+?)\s*$/m)?.[1];
  }
  if (created === undefined || updated === undefined) {
    // frontmatter が無いノート (初コミット前のプレビュー等) は mtime で代用
    const fallback = fmtDate((await fs.stat(filePath)).mtime);
    created ??= fallback;
    updated ??= fallback;
  }
  const title = text.match(/^\s*#?\s*(.+?)\n/)?.[1]?.trim() ?? path.parse(filePath).name;
  return { slug: path.parse(filePath).name, title, created, updated, body: text };
}

/** カード表示用の抜粋。タイトル行・コードフェンス・記法を落としたプレーンテキスト先頭。 */
function makeExcerpt(body: string, maxLen = 160): string {
  const text = body
    .replace(/^\s*#\s.+\n/, '') // タイトル行
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[\[[\w-]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([\w-]+)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/(?<![\p{L}\p{N}_])#[\p{L}][\p{L}\p{N}_-]*/gu, ' ')
    .replace(/[#*`>|]|---+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

async function build(srcDir: string): Promise<NoteCollection> {
  const files = (await fs.readdir(srcDir)).filter((f) => f.endsWith('.md')).sort();
  const raws = await Promise.all(files.map((f) => parseNote(path.join(srcDir, f))));
  const titleBySlug = new Map(raws.map((r) => [r.slug, r.title]));
  const processor = createProcessor(titleBySlug);

  const linkedFrom = new Map<string, Set<string>>(); // target slug → from slugs
  const tagNotes = new Map<string, Set<string>>(); // tag → slugs
  const broken: { from: string; target: string }[] = [];

  const notes: Note[] = [];
  for (const raw of raws) {
    const r = await renderNote(processor, raw.body);
    for (const target of r.links) {
      if (target === raw.slug) continue; // 自己リンクはバックリンクに数えない
      let set = linkedFrom.get(target);
      if (set === undefined) linkedFrom.set(target, (set = new Set()));
      set.add(raw.slug);
    }
    for (const tag of r.tags) {
      let set = tagNotes.get(tag);
      if (set === undefined) tagNotes.set(tag, (set = new Set()));
      set.add(raw.slug);
    }
    for (const target of r.broken) {
      broken.push({ from: raw.slug, target });
      console.warn(`[notes] ${raw.slug}.md: broken wikilink [[${target}]]`);
    }
    notes.push({
      slug: raw.slug,
      title: raw.title,
      created: raw.created,
      updated: raw.updated,
      html: r.html,
      tags: r.tags,
      headings: r.headings,
      backlinks: [], // 全ノート処理後に確定
      related: [], // 全ノート処理後に確定
      links: [...new Set(r.links)]
        .filter((slug) => slug !== raw.slug)
        .map((slug) => ({ slug, title: titleBySlug.get(slug)! })),
      excerpt: makeExcerpt(raw.body),
      hasMermaid: r.hasMermaid,
      hasMath: r.hasMath,
      hasTweet: r.hasTweet,
    });
  }

  for (const note of notes) {
    note.backlinks = [...(linkedFrom.get(note.slug) ?? [])]
      .map((slug) => ({ slug, title: titleBySlug.get(slug)! }))
      .sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  }

  // 関連ノート: リンク関係 (相互3 / 片方向2) + 共有タグ数でスコアリングして上位を持たせる
  for (const note of notes) {
    const out = new Set(note.links.map((l) => l.slug));
    const back = new Set(note.backlinks.map((b) => b.slug));
    note.related = notes
      .filter((other) => other.slug !== note.slug)
      .map((other): RelatedNote => {
        const linked = out.has(other.slug);
        const backed = back.has(other.slug);
        const relation: RelatedRelation | null =
          linked && backed ? 'mutual' : linked ? 'out' : backed ? 'in' : null;
        const sharedTags = note.tags.filter((t) => other.tags.includes(t));
        return {
          slug: other.slug,
          title: other.title,
          updated: other.updated,
          relation,
          sharedTags,
          score: (relation === 'mutual' ? 3 : relation !== null ? 2 : 0) + sharedTags.length,
        };
      })
      .filter((r) => r.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.updated.localeCompare(a.updated) ||
          a.title.localeCompare(b.title, 'ja'),
      )
      .slice(0, RELATED_LIMIT);
  }

  notes.sort((a, b) => b.updated.localeCompare(a.updated));

  const tags = [...tagNotes.entries()]
    .map(([tag, slugs]) => ({
      tag,
      notes: notes.filter((n) => slugs.has(n.slug)), // notes は updated 降順ソート済み
    }))
    .sort((a, b) => b.notes.length - a.notes.length || a.tag.localeCompare(b.tag));

  return { notes, tags, broken };
}

let cache: Promise<NoteCollection> | undefined;

/**
 * 全ノートを読み込み・変換して返す。本番ビルド中はプロセス内でキャッシュし、
 * dev サーバでは毎リクエスト再構築する (mdの編集がリロードで反映されるように)。
 */
export function getNotes(srcDir: string = DEFAULT_SRC_DIR): Promise<NoteCollection> {
  const isDev = typeof import.meta.env !== 'undefined' && import.meta.env.DEV === true;
  if (srcDir !== DEFAULT_SRC_DIR) return build(srcDir);
  if (isDev || cache === undefined) cache = build(srcDir);
  return cache;
}
