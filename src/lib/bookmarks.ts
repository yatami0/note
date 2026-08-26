import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * ブックマーク1件分のデータ。bookmarks/*.json として1件1ファイルで保存され、
 * 日次の GitHub Actions (scripts/process-bookmarks.mjs) が生成する。
 */
export interface Bookmark {
  /** ファイル名にも使う一意ID (例: "20260826-a1b2c3d4") */
  id: string;
  url: string;
  /** 表示用のドメイン (例: "zenn.dev") */
  domain: string;
  title: string;
  /** AIが生成した日本語の要約 */
  summary: string;
  tags: string[];
  /** 登録日時 "YYYY-MM-DD HH:MM" (Issue作成日時) */
  added: string;
  /** 登録に使った GitHub Issue 番号 */
  issue?: number;
}

const DEFAULT_DIR = path.resolve(process.cwd(), 'bookmarks');

function isValid(b: unknown): b is Bookmark {
  if (typeof b !== 'object' || b === null) return false;
  const r = b as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.url === 'string' &&
    typeof r.domain === 'string' &&
    typeof r.title === 'string' &&
    typeof r.summary === 'string' &&
    typeof r.added === 'string' &&
    Array.isArray(r.tags) &&
    r.tags.every((t) => typeof t === 'string')
  );
}

async function load(dir: string): Promise<Bookmark[]> {
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return []; // bookmarks/ 未作成でもビルドは通す
  }
  const bookmarks: Bookmark[] = [];
  for (const file of files) {
    const raw = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    if (!isValid(raw)) {
      throw new Error(`[bookmarks] ${file}: 必須フィールドが欠けているか型が不正`);
    }
    bookmarks.push(raw);
  }
  // 登録日時の新しい順。同時刻は id 降順で安定させる
  bookmarks.sort((a, b) => b.added.localeCompare(a.added) || b.id.localeCompare(a.id));
  return bookmarks;
}

let cache: Promise<Bookmark[]> | undefined;

/** 全ブックマークを登録日時の新しい順で返す (本番ビルド中はキャッシュ)。 */
export function getBookmarks(dir: string = DEFAULT_DIR): Promise<Bookmark[]> {
  const isDev = typeof import.meta.env !== 'undefined' && import.meta.env.DEV === true;
  if (dir !== DEFAULT_DIR) return load(dir);
  if (isDev || cache === undefined) cache = load(dir);
  return cache;
}
