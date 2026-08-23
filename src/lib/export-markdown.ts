import { SITE_URL } from './site.js';

/**
 * AI等にそのまま渡せる「エクスポート用Markdown」を生成する。
 *
 * 生ソースの [[wikilink]] はこのサイトの外では解決できずリンクが切れるため、
 * ビルド時に絶対URLの通常Markdownリンク [タイトル](https://.../slug/) へ解決する。
 * 先頭には出典が分かるよう source/created/updated の frontmatter を付ける。
 * #tag・mermaid・数式・X のURLはプレーンな記法のまま残す (テキストとして意味が通るため)。
 *
 * preprocess.ts と同様、コードフェンス・インラインコード内の [[...]] は変換しない。
 */
const CODE_SEGMENT = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/;
const WIKILINK = /\[\[([\w-]+)(?:\|([^\]]+))?\]\]/g;

export function noteUrl(slug: string): string {
  return `${SITE_URL}/${slug}/`;
}

export interface ExportNoteInput {
  slug: string;
  title: string;
  created: string;
  updated: string;
  /** frontmatter を除いた本文 (1行目が `# タイトル`) */
  body: string;
}

export function toExportMarkdown(
  note: ExportNoteInput,
  titleBySlug: ReadonlyMap<string, string>,
): string {
  const body = note.body
    .split(CODE_SEGMENT)
    .map((seg, i) =>
      i % 2 === 1
        ? seg
        : seg.replace(WIKILINK, (_, target: string, label: string | undefined) => {
            const title = titleBySlug.get(target);
            // 未解決の wikilink はリンクにできないのでプレーンテキストに落とす
            if (title === undefined) return label ?? target;
            return `[${label ?? title}](${noteUrl(target)})`;
          }),
    )
    .join('');
  const frontmatter = [
    '---',
    `source: ${noteUrl(note.slug)}`,
    `created: ${note.created}`,
    `updated: ${note.updated}`,
    '---',
  ].join('\n');
  return `${frontmatter}\n${body.replace(/\s*$/, '')}\n`;
}
