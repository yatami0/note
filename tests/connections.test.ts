// /connections/ のビュー仕様: 層の割り当て・レンズ内での被リンク再計算・折りたたみ。
import { describe, expect, it } from 'vitest';
import {
  computeGraph,
  renderApp,
  TIER_LIMIT,
  tierOf,
  type GraphNote,
} from '../src/lib/connections-view.js';

const note = (slug: string, out: string[] = [], tags: string[] = []): GraphNote => ({
  slug,
  title: slug,
  tags,
  out,
});

describe('tierOf', () => {
  it('被リンク数で 中心/幹/枝/末端/苗床 に割り当てる', () => {
    expect(tierOf(0).key).toBe('seed');
    expect(tierOf(1).key).toBe('leaf');
    expect(tierOf(2).key).toBe('branch');
    expect(tierOf(4).key).toBe('branch');
    expect(tierOf(5).key).toBe('trunk');
    expect(tierOf(9).key).toBe('trunk');
    expect(tierOf(10).key).toBe('core');
    expect(tierOf(30).key).toBe('core');
  });
});

describe('computeGraph', () => {
  const notes = [
    note('hub', ['a'], ['x']),
    note('a', ['hub'], ['x']),
    note('b', ['hub'], ['y']), // レンズ #x の外から hub を参照
  ];

  it('全体では全リンクを数える', () => {
    const g = computeGraph(notes, null);
    expect(g.inMap.get('hub')).toEqual(['a', 'b']);
  });

  it('レンズ選択中は被リンクもその領域内で再計算する', () => {
    const g = computeGraph(notes, 'x');
    expect(g.visible.map((n) => n.slug)).toEqual(['hub', 'a']);
    expect(g.inMap.get('hub')).toEqual(['a']); // b (#y) からの被リンクは数えない
    expect(g.inMap.has('b')).toBe(false);
  });
});

describe('renderApp', () => {
  it('TIER_LIMIT を超える層は折りたたまれ、展開ボタンが出る', () => {
    // 全ノート被リンク0 → 全員「苗床」で TIER_LIMIT+3 件
    const notes = Array.from({ length: TIER_LIMIT + 3 }, (_, i) => note(`n${i}`));
    // 苗床はタイトル昇順なので n12 は13件目以降 (n0, n1, n10, n11, ... の辞書順)
    const collapsed = renderApp(notes, { lens: null, selected: null, expanded: [] });
    expect(collapsed).toContain('残り 3 件を表示');
    expect(collapsed).not.toContain('class="cx-card" href="/n9/'); // 辞書順で最後 = 隠れる

    const expanded = renderApp(notes, { lens: null, selected: null, expanded: ['seed'] });
    expect(expanded).toContain('class="cx-card" href="/n9/');
    expect(expanded).toContain('折りたたむ');
  });

  it('選択中は直接つながらないカードが dim になり、← / → マークが付く', () => {
    const notes = [note('sel', ['dep']), note('dep'), note('user', ['sel']), note('other')];
    const html = renderApp(notes, { lens: null, selected: 'sel', expanded: [] });
    expect(html).toMatch(/data-slug="other"[\s\S]*?/);
    expect(html).toContain('cx-card dim'); // other が減光
    expect(html).toContain('cx-card selected');
    expect(html).toContain('<span class="cx-card-rel">←</span>'); // user
    expect(html).toContain('<span class="cx-card-rel">→</span>'); // dep
  });

  it('タイトルの HTML はエスケープされる', () => {
    const notes = [{ slug: 'x', title: '<img src=x>', tags: [], out: [] }];
    const html = renderApp(notes, { lens: null, selected: null, expanded: [] });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
