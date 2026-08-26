// ブックマーク機能のテスト: bookmarks/*.json の読み込み (src/lib/bookmarks.ts) と
// 日次バッチのURL・HTML処理ユーティリティ (scripts/process-bookmarks.mjs)。
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bookmarkId,
  extractHtmlTitle,
  extractUrl,
  htmlToText,
  isTweetUrl,
  normalizeUrl,
  sanitizeTag,
} from '../scripts/process-bookmarks.mjs';
import { type Bookmark, getBookmarks } from '../src/lib/bookmarks.js';

function entry(over: Partial<Bookmark>): Bookmark {
  return {
    id: '20260801-00000000',
    url: 'https://example.com/a',
    domain: 'example.com',
    title: 'タイトル',
    summary: '要約',
    tags: ['tag'],
    added: '2026-08-01 10:00',
    ...over,
  };
}

describe('getBookmarks', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookmarks-test-'));
    const write = (name: string, b: Bookmark) =>
      fs.writeFile(path.join(dir, name), JSON.stringify(b), 'utf8');
    await write('a.json', entry({ id: 'a', added: '2026-08-01 10:00' }));
    await write('b.json', entry({ id: 'b', added: '2026-08-03 09:00' }));
    await write('c.json', entry({ id: 'c', added: '2026-08-02 12:00' }));
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('added の新しい順でソートされる', async () => {
    const ids = (await getBookmarks(dir)).map((b) => b.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('ディレクトリが無ければ空配列 (ビルドを止めない)', async () => {
    expect(await getBookmarks(path.join(dir, 'missing'))).toEqual([]);
  });

  it('必須フィールドが欠けた JSON はエラーにする', async () => {
    const broken = await fs.mkdtemp(path.join(os.tmpdir(), 'bookmarks-broken-'));
    await fs.writeFile(path.join(broken, 'x.json'), '{"id":"x"}', 'utf8');
    await expect(getBookmarks(broken)).rejects.toThrow(/x\.json/);
    await fs.rm(broken, { recursive: true, force: true });
  });
});

describe('extractUrl', () => {
  it('テキスト中の最初の URL を取り出す', () => {
    expect(extractUrl('これ読む https://example.com/post?a=1 あとで')).toBe(
      'https://example.com/post?a=1',
    );
  });

  it('末尾の句読点・閉じ括弧を落とす', () => {
    expect(extractUrl('(https://example.com/post)')).toBe('https://example.com/post');
    expect(extractUrl('https://example.com/post。')).toBe('https://example.com/post');
  });

  it('URL が無ければ undefined', () => {
    expect(extractUrl('ただのメモ')).toBeUndefined();
    expect(extractUrl('')).toBeUndefined();
  });
});

describe('normalizeUrl', () => {
  it('fragment と utm 系パラメータを除去する', () => {
    expect(normalizeUrl('https://example.com/a?utm_source=x&q=1#sec')).toBe(
      'https://example.com/a?q=1',
    );
  });

  it('末尾スラッシュ・ホストの大文字小文字を揃える', () => {
    expect(normalizeUrl('https://Example.com/a/')).toBe(normalizeUrl('https://example.com/a'));
  });
});

describe('isTweetUrl', () => {
  it('x.com / twitter.com のステータス URL を判定する', () => {
    expect(isTweetUrl('https://x.com/i/status/12345')).toBe(true);
    expect(isTweetUrl('https://twitter.com/user/status/12345')).toBe(true);
    expect(isTweetUrl('https://x.com/user')).toBe(false);
    expect(isTweetUrl('https://example.com/status/1')).toBe(false);
  });
});

describe('htmlToText / extractHtmlTitle', () => {
  const html = `<html><head><title>記事タイトル - サイト名</title>
    <meta property="og:title" content="記事タイトル" />
    <style>body { color: red }</style></head>
    <body><script>var x = 1;</script><h1>見出し</h1><p>本文 &amp; テキスト</p></body></html>`;

  it('script/style を除きテキストだけ取り出す', () => {
    const text = htmlToText(html);
    expect(text).toContain('見出し');
    expect(text).toContain('本文 & テキスト');
    expect(text).not.toContain('var x');
    expect(text).not.toContain('color: red');
  });

  it('og:title を優先し、無ければ <title>', () => {
    expect(extractHtmlTitle(html)).toBe('記事タイトル');
    expect(extractHtmlTitle('<title>素のタイトル</title>')).toBe('素のタイトル');
    expect(extractHtmlTitle('<p>タイトルなし</p>')).toBeUndefined();
  });
});

describe('sanitizeTag', () => {
  it('サイトの #tag 仕様に合わせて整える (小文字化・記号除去・先頭は文字)', () => {
    expect(sanitizeTag('AI-Agent')).toBe('ai-agent');
    expect(sanitizeTag('#認証認可')).toBe('認証認可');
    expect(sanitizeTag('C++')).toBe('c');
    expect(sanitizeTag('1234')).toBe(''); // 数字始まりのタグは認識されないため空になる
  });
});

describe('bookmarkId', () => {
  it('登録日 + URL ハッシュで決まり、同一 URL なら安定する', () => {
    const a = bookmarkId('https://example.com/a', '2026-08-26 09:00');
    expect(a).toMatch(/^20260826-[0-9a-f]{8}$/);
    expect(bookmarkId('https://example.com/a/', '2026-08-26 21:00')).toBe(a);
    expect(bookmarkId('https://example.com/b', '2026-08-26 09:00')).not.toBe(a);
  });
});
