// loadNotes (getNotes) の集約ロジックのテスト: バックリンク・タグ索引・ソート・frontmatter。
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getNotes, type NoteCollection } from '../src/lib/notes.js';

let dir: string;
let col: NoteCollection;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'notes-test-'));
  const write = (name: string, content: string) =>
    fs.writeFile(path.join(dir, name), content, 'utf8');
  await write(
    'alpha.md',
    '---\ncreated: 2026-01-01 10:00\nupdated: 2026-01-03 10:00\n---\n# アルファ\n\n[[beta]] を参照。#taga #shared\n',
  );
  await write(
    'beta.md',
    '---\ncreated: 2026-01-02 10:00\nupdated: 2026-01-02 10:00\n---\n# ベータ\n\n[[alpha|アルファの話]] と [[missing]]。#shared\n',
  );
  await write('gamma.md', '# ガンマ\n\nfrontmatter が無いノート。[[alpha]]\n');
  col = await getNotes(dir);
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('getNotes', () => {
  it('updated 降順でソートされる', () => {
    const slugs = col.notes.map((n) => n.slug);
    // gamma は mtime フォールバック (今日) なので先頭
    expect(slugs[0]).toBe('gamma');
    expect(slugs.slice(1)).toEqual(['alpha', 'beta']);
  });

  it('タイトルは1行目の # 見出しから取れる', () => {
    const alpha = col.notes.find((n) => n.slug === 'alpha')!;
    expect(alpha.title).toBe('アルファ');
  });

  it('バックリンクが双方向に集約される', () => {
    const alpha = col.notes.find((n) => n.slug === 'alpha')!;
    const beta = col.notes.find((n) => n.slug === 'beta')!;
    expect(alpha.backlinks.map((b) => b.slug).sort()).toEqual(['beta', 'gamma']);
    expect(beta.backlinks.map((b) => b.slug)).toEqual(['alpha']);
  });

  it('発リンクは解決済みのみ・タイトル付きで取れる', () => {
    const beta = col.notes.find((n) => n.slug === 'beta')!;
    // missing は解決できないので links に入らない
    expect(beta.links).toEqual([{ slug: 'alpha', title: 'アルファ' }]);
    const alpha = col.notes.find((n) => n.slug === 'alpha')!;
    expect(alpha.links.map((l) => l.slug)).toEqual(['beta']);
  });

  it('壊れた wikilink が from 付きで報告される', () => {
    expect(col.broken).toEqual([{ from: 'beta', target: 'missing' }]);
  });

  it('タグ索引: 件数降順・タグページのノートは updated 降順', () => {
    expect(col.tags[0]!.tag).toBe('shared');
    expect(col.tags[0]!.notes.map((n) => n.slug)).toEqual(['alpha', 'beta']);
    expect(col.tags.map((t) => t.tag)).toEqual(['shared', 'taga']);
  });

  it('frontmatter が無いノートは mtime にフォールバックする', () => {
    const gamma = col.notes.find((n) => n.slug === 'gamma')!;
    expect(gamma.created).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('excerpt はタイトル・記法抜きのプレーンテキスト', () => {
    const beta = col.notes.find((n) => n.slug === 'beta')!;
    expect(beta.excerpt).not.toContain('[[');
    expect(beta.excerpt).not.toContain('#');
    expect(beta.excerpt).toContain('アルファの話');
  });
});
