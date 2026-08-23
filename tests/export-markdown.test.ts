// エクスポートMarkdown (コピーボタン・/<slug>.md 配信) の仕様テスト。
// wikilink は絶対URLの通常Markdownリンクに解決し、コード内は保護する。
import { describe, expect, it } from 'vitest';
import { toExportMarkdown } from '../src/lib/export-markdown.js';

const TITLES = new Map([
  ['jwt-bff-pattern', 'JWTとBFFパターン'],
  ['oidc', 'OIDC (OpenID Connect)'],
]);

function convert(body: string): string {
  return toExportMarkdown(
    { slug: 'sample', title: 'サンプル', created: '2026-08-23 10:00', updated: '2026-08-23 11:00', body },
    TITLES,
  );
}

describe('toExportMarkdown', () => {
  it('先頭に source/created/updated の frontmatter が付く', () => {
    const md = convert('# サンプル\n\n本文\n');
    expect(md.startsWith(
      [
        '---',
        'source: https://konohachi.com/sample/',
        'created: 2026-08-23 10:00',
        'updated: 2026-08-23 11:00',
        '---',
        '# サンプル',
      ].join('\n'),
    )).toBe(true);
  });

  it('[[slug]] はタイトルを表示テキストにした絶対URLリンクになる', () => {
    const md = convert('本文 [[jwt-bff-pattern]] 参照\n');
    expect(md).toContain('本文 [JWTとBFFパターン](https://konohachi.com/jwt-bff-pattern/) 参照');
  });

  it('[[slug|表示テキスト]] は表示テキストが優先される', () => {
    const md = convert('[[jwt-bff-pattern|BFFパターンの話]]\n');
    expect(md).toContain('[BFFパターンの話](https://konohachi.com/jwt-bff-pattern/)');
  });

  it('存在しない slug はプレーンテキストに落ちる', () => {
    const md = convert('[[no-such-note]] と [[no-such-note|別名]]\n');
    expect(md).toContain('no-such-note と 別名');
    expect(md).not.toContain('[[no-such-note]]');
  });

  it('テーブルセル内の [[slug|label]] もリンクになり | が残らない', () => {
    const md = convert('| 構成 | 種別 |\n|---|---|\n| [[jwt-bff-pattern|BFF]]+Redis | reference |\n');
    expect(md).toContain('| [BFF](https://konohachi.com/jwt-bff-pattern/)+Redis | reference |');
  });

  it('コードブロック・インラインコード内の [[...]] は変換されない', () => {
    const md = convert('```\n[[jwt-bff-pattern]]\n```\n\nそして `[[oidc]]` はコード。\n');
    expect(md).toContain('```\n[[jwt-bff-pattern]]\n```');
    expect(md).toContain('`[[oidc]]`');
  });

  it('#tag や数式・mermaid はプレーンな記法のまま残る', () => {
    const md = convert('$$e = mc^2$$\n\n```mermaid\ngraph TD; A-->B\n```\n\n#認証認可 #ai\n');
    expect(md).toContain('$$e = mc^2$$');
    expect(md).toContain('```mermaid\ngraph TD; A-->B\n```');
    expect(md).toContain('#認証認可 #ai');
  });

  it('末尾は改行1つに正規化される', () => {
    expect(convert('# サンプル\n\n本文\n\n\n')).toMatch(/本文\n$/);
  });
});
