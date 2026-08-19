// 変換パイプラインの仕様テスト。ケースは CLAUDE.md に文書化された
// wikilink / #tag / mermaid / 数式 / X埋め込みの認識ルールをそのまま写したもの。
import { beforeAll, describe, expect, it } from 'vitest';
import { createProcessor, renderNote, type NoteProcessor, type RenderResult } from '../src/lib/pipeline.js';

const TITLES = new Map([
  ['jwt-bff-pattern', 'JWTとBFFパターン'],
  ['oidc', 'OIDC (OpenID Connect)'],
]);

let processor: NoteProcessor;
beforeAll(() => {
  processor = createProcessor(TITLES);
});

async function render(src: string): Promise<RenderResult> {
  return renderNote(processor, src);
}

describe('wikilinks', () => {
  it('[[slug]] はタイトルを表示テキストにしたリンクになる', async () => {
    const r = await render('本文 [[jwt-bff-pattern]] 参照');
    expect(r.html).toContain('<a href="/jwt-bff-pattern/">JWTとBFFパターン</a>');
    expect(r.links).toEqual(['jwt-bff-pattern']);
    expect(r.broken).toEqual([]);
  });

  it('[[slug|表示テキスト]] は表示テキストが優先される', async () => {
    const r = await render('[[jwt-bff-pattern|BFFパターンの話]]');
    expect(r.html).toContain('<a href="/jwt-bff-pattern/">BFFパターンの話</a>');
  });

  it('存在しない slug は太字フォールバック + broken 記録', async () => {
    const r = await render('[[no-such-note]] と [[no-such-note|別名]]');
    expect(r.html).toContain('<strong>no-such-note</strong>');
    expect(r.html).toContain('<strong>別名</strong>');
    expect(r.broken).toEqual(['no-such-note', 'no-such-note']);
    expect(r.links).toEqual([]);
  });

  it('テーブルセル内の [[slug|label]] も | で分断されずリンクになる', async () => {
    const r = await render(
      '| 構成 | 種別 |\n|---|---|\n| [[jwt-bff-pattern|BFF]]+Redis | reference |\n| [[oidc]] | concept |',
    );
    expect(r.html).toContain('<a href="/jwt-bff-pattern/">BFF</a>');
    expect(r.html).toContain('<a href="/oidc/">OIDC (OpenID Connect)</a>');
    expect(r.links.sort()).toEqual(['jwt-bff-pattern', 'oidc']);
    expect(r.html).toContain('<table>');
  });

  it('コードブロック内の [[slug|label]] はエスケープも変換もされない', async () => {
    const r = await render('```\n[[jwt-bff-pattern|BFF]]\n```');
    expect(r.html).toContain('[[jwt-bff-pattern|BFF]]');
    expect(r.links).toEqual([]);
  });

  it('コードブロック・インラインコード内の [[...]] は変換されない', async () => {
    const r = await render('```\n[[jwt-bff-pattern]]\n```\n\nそして `[[oidc]]` はコード。');
    expect(r.html).not.toContain('<a href="/jwt-bff-pattern/"');
    expect(r.html).not.toContain('<a href="/oidc/"');
    expect(r.links).toEqual([]);
  });
});

describe('#tag', () => {
  it('英字・日本語・ハイフン混じりのタグを認識する', async () => {
    const r = await render('本文。\n\n#認証認可 #ai-agent #claude_code');
    expect(r.tags).toEqual(['認証認可', 'ai-agent', 'claude_code']);
    expect(r.html).toContain('href="/tags/ai-agent/"');
    expect(r.html).toContain('class="note-tag"');
  });

  it('英字タグは小文字に正規化される', async () => {
    const r = await render('#AI について');
    expect(r.tags).toEqual(['ai']);
    expect(r.html).toContain('>#ai</a>');
  });

  it('数字・アンダースコア始まりはタグではない', async () => {
    const r = await render('Issue #1234 と #_private は違う');
    expect(r.tags).toEqual([]);
  });

  it('直前が英数字だと認識しない (foo#bar / C#)', async () => {
    const r = await render('foo#bar は無視。C#csharp も無視。');
    expect(r.tags).toEqual([]);
  });

  it('句読点・括弧の直後は認識する', async () => {
    const r = await render('文末。#tag1 (括弧)#tag2');
    expect(r.tags).toEqual(['tag1', 'tag2']);
  });

  it('URL 内の #fragment はタグにならない', async () => {
    const r = await render('参照: https://example.com/page/#section を見る');
    expect(r.tags).toEqual([]);
    expect(r.html).toContain('https://example.com/page/#section');
  });

  it('markdownリンクのURL内 #fragment もタグにならない', async () => {
    const r = await render('[リンク](https://example.com/#sec) 参照');
    expect(r.tags).toEqual([]);
  });

  it('見出し行はタグにならない', async () => {
    const r = await render('# タイトル\n\n## 見出し2\n\n本文 #real-tag');
    expect(r.tags).toEqual(['real-tag']);
  });

  it('コードブロック内の #include や #!/usr/bin/env は誤爆しない', async () => {
    const r = await render('```c\n#include <stdio.h>\n```\n\n`#moc` もコード。\n\n#速度 は本物。');
    expect(r.tags).toEqual(['速度']);
  });
});

describe('mermaid', () => {
  it('```mermaid フェンスは div.mermaid になり、内部の記法は保護される', async () => {
    const r = await render('```mermaid\ngraph TD\n  A[[jwt-bff-pattern]] --> B\n  C --> D\n```');
    expect(r.hasMermaid).toBe(true);
    expect(r.html).toContain('<div class="mermaid">');
    expect(r.html).toContain('A[[jwt-bff-pattern]] --');
    expect(r.links).toEqual([]);
  });

  it('通常のコードフェンスは Shiki でハイライトされる', async () => {
    const r = await render('```python\nprint("hi")\n```');
    expect(r.hasMermaid).toBe(false);
    expect(r.html).toContain('shiki');
    expect(r.html).toContain('--shiki-dark');
  });

  it('言語指定なし・未知言語でもビルドが落ちない', async () => {
    const r = await render('```\nplain\n```\n\n```unknownlang123\nfoo\n```');
    expect(r.html).toContain('plain');
    expect(r.html).toContain('foo');
  });
});

describe('数式', () => {
  it('$$...$$ ブロックは KaTeX でビルド時レンダリングされる', async () => {
    const r = await render('$$\nE = mc^2\n$$');
    expect(r.hasMath).toBe(true);
    expect(r.html).toContain('katex');
  });

  it('\\(...\\) インライン数式もレンダリングされる', async () => {
    const r = await render('質量 \\(m\\) とエネルギー');
    expect(r.hasMath).toBe(true);
    expect(r.html).toContain('katex');
  });

  it('コードブロック内の $$ や \\(...\\) は数式にならない', async () => {
    const r = await render('```sh\necho $$\n```\n\n`\\(x\\)` はコード。');
    expect(r.hasMath).toBe(false);
    expect(r.html).not.toContain('katex');
  });

  it('単独の $ は数式にならない (シェル変数や価格表記)', async () => {
    const r = await render('価格は $5 で、変数は $HOME と $PATH。');
    expect(r.hasMath).toBe(false);
  });
});

describe('X(Twitter) 埋め込み', () => {
  it('単独行のステータスURLはウィジェット埋め込みになる', async () => {
    const r = await render('前段。\n\nhttps://x.com/i/status/12345\n\n## 考えたこと');
    expect(r.hasTweet).toBe(true);
    expect(r.html).toContain('twitter-tweet');
    expect(r.html).toContain('https://x.com/i/status/12345');
  });

  it('文中のステータスURLは埋め込みにならない', async () => {
    const r = await render('この https://x.com/i/status/12345 という投稿が');
    expect(r.hasTweet).toBe(false);
    expect(r.html).not.toContain('twitter-tweet');
  });
});

describe('GFM・見出し', () => {
  it('テーブルがレンダリングされる', async () => {
    const r = await render('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(r.html).toContain('<table>');
  });

  it('h2-h4 に id が振られ headings に収集される', async () => {
    const r = await render('# タイトル\n\n## 概要\n\n### 詳細\n\n本文');
    expect(r.headings).toEqual([
      { depth: 2, id: '概要', text: '概要' },
      { depth: 3, id: '詳細', text: '詳細' },
    ]);
    expect(r.html).toContain('id="概要"');
  });
});
