/**
 * /connections/ (概念のつながり) のビュー。
 * ビルド時 (connections.astro) とクライアント (レンズ・選択・折りたたみの再描画) の
 * 両方から同じ関数を使い、マークアップの二重実装を避ける。DOM API には依存しない。
 */

export interface GraphNote {
  slug: string;
  title: string;
  tags: string[];
  /** wikilink の参照先 slug (解決済みのみ) */
  out: string[];
}

export interface ViewState {
  /** タグレンズ (null = すべて) */
  lens: string | null;
  /** 選択中ノートの slug */
  selected: string | null;
  /** 折りたたみを解除した層の key */
  expanded: string[];
}

export const INITIAL_STATE: ViewState = { lens: null, selected: null, expanded: [] };

/** 1層に折りたたみなしで表示する最大カード数 */
export const TIER_LIMIT = 12;

/** レンズに出すタグの最小ノート数 */
const LENS_MIN_NOTES = 3;

interface Tier {
  key: string;
  label: string;
  range: string;
  hint: string;
  min: number;
  max: number;
}

/** 被リンク数(←)による層。上ほど多くの概念の前提になっている = 抽象・中心 */
export const TIERS: Tier[] = [
  { key: 'core', label: '中心', range: '← 10本以上', hint: '多くの概念の前提になっている。ここが知識の背骨。', min: 10, max: Infinity },
  { key: 'trunk', label: '幹', range: '← 5〜9本', hint: '領域の中で何度も呼び出される概念。', min: 5, max: 9 },
  { key: 'branch', label: '枝', range: '← 2〜4本', hint: '', min: 2, max: 4 },
  { key: 'leaf', label: '末端', range: '← 1本', hint: '', min: 1, max: 1 },
  { key: 'seed', label: '苗床', range: '← 0本', hint: 'まだ誰の前提にもなっていない。ここから伸ばす。', min: 0, max: 0 },
];

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Graph {
  /** レンズ適用後に表示するノート */
  visible: GraphNote[];
  /** slug → 被リンク元 (レンズ内で再計算) */
  inMap: Map<string, string[]>;
  /** slug → 参照先 (レンズ内で再計算) */
  outMap: Map<string, string[]>;
}

/**
 * レンズ適用後のグラフ。レンズ選択中は被リンク数もその領域内のサブグラフで
 * 再計算する (抽象度は領域相対 — 全体では「枝」でも #認証認可 の中では「幹」になりうる)。
 */
export function computeGraph(notes: GraphNote[], lens: string | null): Graph {
  const visible = lens === null ? notes : notes.filter((n) => n.tags.includes(lens));
  const scope = new Set(visible.map((n) => n.slug));
  const inMap = new Map<string, string[]>();
  const outMap = new Map<string, string[]>();
  for (const n of visible) {
    inMap.set(n.slug, []);
    outMap.set(n.slug, []);
  }
  for (const n of visible) {
    for (const target of n.out) {
      if (!scope.has(target)) continue;
      outMap.get(n.slug)!.push(target);
      inMap.get(target)!.push(n.slug);
    }
  }
  return { visible, inMap, outMap };
}

export function tierOf(inCount: number): Tier {
  return TIERS.find((t) => inCount >= t.min && inCount <= t.max)!;
}

function tagCounts(notes: GraphNote[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const n of notes) for (const tag of n.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ja'));
}

function renderLens(notes: GraphNote[], state: ViewState): string {
  const chips = tagCounts(notes).filter((t) => t.count >= LENS_MIN_NOTES);
  const chip = (label: string, tag: string | null, count: number): string => {
    const on = state.lens === tag;
    return `<button type="button" class="cx-chip${on ? ' on' : ''}" data-act="lens"${tag === null ? '' : ` data-tag="${esc(tag)}"`}>${esc(label)} <span class="cnt">${count}</span></button>`;
  };
  return `<div class="cx-lens"><span class="cx-lens-label">レンズ</span>${chip('すべて', null, notes.length)}${chips.map((t) => chip(`#${t.tag}`, t.tag, t.count)).join('')}</div>`;
}

function renderCard(n: GraphNote, g: Graph, state: ViewState, maxIn: number): string {
  const inCount = g.inMap.get(n.slug)!.length;
  const outCount = g.outMap.get(n.slug)!.length;
  const sel = state.selected;
  const isSel = sel === n.slug;
  let rel = '';
  let dim = false;
  if (sel !== null && !isSel) {
    if (g.inMap.get(sel)?.includes(n.slug)) rel = '←';
    else if (g.outMap.get(sel)?.includes(n.slug)) rel = '→';
    else dim = true;
  }
  const cls = ['cx-card'];
  if (isSel) cls.push('selected');
  if (dim) cls.push('dim');
  if (n.tags.includes('moc')) cls.push('moc');
  const barPct = Math.round((inCount / Math.max(maxIn, 1)) * 100);
  return `<a class="${cls.join(' ')}" href="/${esc(n.slug)}/" data-act="select" data-slug="${esc(n.slug)}">
    <span class="cx-card-head"><span class="cx-card-title">${esc(n.title)}</span>${rel !== '' || isSel ? `<span class="cx-card-rel">${isSel ? '●' : rel}</span>` : ''}</span>
    <span class="cx-bar"><span class="cx-bar-fill" style="width:${barPct}%"></span></span>
    <span class="cx-card-meta"><span>← ${inCount}</span><span>→ ${outCount}</span><span class="cx-card-tags">${esc(n.tags.map((t) => `#${t}`).join(' '))}</span></span>
  </a>`;
}

function renderTiers(g: Graph, state: ViewState): string {
  const maxIn = Math.max(...g.visible.map((n) => g.inMap.get(n.slug)!.length), 1);
  return TIERS.map((tier) => {
    const members = g.visible
      .filter((n) => {
        const c = g.inMap.get(n.slug)!.length;
        return c >= tier.min && c <= tier.max;
      })
      .sort(
        (a, b) =>
          g.inMap.get(b.slug)!.length - g.inMap.get(a.slug)!.length ||
          g.outMap.get(b.slug)!.length - g.outMap.get(a.slug)!.length ||
          a.title.localeCompare(b.title, 'ja'),
      );
    if (members.length === 0) return '';
    const open = state.expanded.includes(tier.key);
    const shown = open ? members : members.slice(0, TIER_LIMIT);
    const hidden = members.length - shown.length;
    const toggle =
      hidden > 0
        ? `<button type="button" class="cx-more" data-act="expand" data-tier="${tier.key}">残り ${hidden} 件を表示</button>`
        : open && members.length > TIER_LIMIT
          ? `<button type="button" class="cx-more" data-act="collapse" data-tier="${tier.key}">折りたたむ</button>`
          : '';
    return `<section class="cx-tier cx-tier-${tier.key}">
      <div class="cx-tier-head">
        <h2>${tier.label}</h2>
        <div class="cx-tier-range">${tier.range}</div>
        <div class="cx-tier-count">${members.length}ノート</div>
      </div>
      <div class="cx-tier-body">
        ${tier.hint !== '' ? `<p class="cx-tier-hint">${tier.hint}</p>` : ''}
        <div class="cx-cards">${shown.map((n) => renderCard(n, g, state, maxIn)).join('')}</div>
        ${toggle}
      </div>
    </section>`;
  }).join('');
}

function renderSidebar(notes: GraphNote[], g: Graph, state: ViewState): string {
  const titleOf = new Map(notes.map((n) => [n.slug, n.title]));
  const linkItem = (slug: string): string =>
    `<a class="cx-side-item" href="/${esc(slug)}/" data-act="select" data-slug="${esc(slug)}"><span>${esc(titleOf.get(slug) ?? slug)}</span><span class="cnt">←${g.inMap.get(slug)!.length}</span></a>`;
  const byInDesc = (a: string, b: string): number =>
    g.inMap.get(b)!.length - g.inMap.get(a)!.length;

  let main: string;
  const sel = state.selected === null ? null : g.visible.find((n) => n.slug === state.selected);
  if (sel !== undefined && sel !== null) {
    const inbound = [...g.inMap.get(sel.slug)!].sort(byInDesc);
    const outbound = [...g.outMap.get(sel.slug)!].sort(byInDesc);
    const tier = tierOf(inbound.length);
    main = `<div class="cx-panel cx-focus">
      <div class="cx-focus-head">
        <div class="cx-focus-title-row"><h2>${esc(sel.title)}</h2><button type="button" class="cx-close" data-act="clear">閉じる</button></div>
        <div class="cx-focus-meta">${esc(sel.tags.map((t) => `#${t}`).join(' '))}　·　${tier.label}（${tier.range}）</div>
      </div>
      <div class="cx-focus-section">
        <h3>← このノートを前提にしている <span class="cnt">${inbound.length}</span></h3>
        ${inbound.length > 0 ? inbound.map(linkItem).join('') : '<p class="cx-empty">まだどこからも参照されていない。ここを参照するノートを書くと、この概念が前提として立ち上がる。</p>'}
      </div>
      <div class="cx-focus-section">
        <h3>→ このノートが前提にしている <span class="cnt">${outbound.length}</span></h3>
        ${outbound.length > 0 ? outbound.map(linkItem).join('') : '<p class="cx-empty">リンク先がない。前提にしている概念を書き足せる。</p>'}
      </div>
      <a class="cx-open" href="/${esc(sel.slug)}/">ノートを開く →</a>
    </div>`;
  } else {
    const density = tagCounts(notes).slice(0, 8);
    const maxTag = density[0]?.count ?? 1;
    main = `<div class="cx-panel">
      <h2 class="cx-panel-title">領域の厚み</h2>
      ${density
        .map(
          (d) => `<button type="button" class="cx-density" data-act="lens" data-tag="${esc(d.tag)}">
        <span class="cx-density-row"><span>#${esc(d.tag)}</span><span class="cnt">${d.count}</span></span>
        <span class="cx-bar"><span class="cx-bar-fill" style="width:${Math.round((d.count / maxTag) * 100)}%"></span></span>
      </button>`,
        )
        .join('')}
      <p class="cx-panel-hint">ノートを選ぶと、← と → の依存だけが残り、他は淡くなる。</p>
    </div>`;
  }

  const growth = g.visible
    .map((n) => ({ n, total: g.inMap.get(n.slug)!.length + g.outMap.get(n.slug)!.length }))
    .filter((x) => x.total <= 2)
    .sort((a, b) => a.total - b.total || a.n.title.localeCompare(b.n.title, 'ja'))
    .slice(0, 6);
  const growthHtml = `<div class="cx-panel cx-growth">
    <h2 class="cx-panel-title">次に育てる場所</h2>
    <p class="cx-panel-hint">リンクが細いノート。どちらかに1本足すだけで階層のどこかに繋がる。</p>
    ${
      growth.length > 0
        ? growth
            .map(
              (x) =>
                `<a class="cx-side-item" href="/${esc(x.n.slug)}/" data-act="select" data-slug="${esc(x.n.slug)}"><span>${esc(x.n.title)}</span><span class="cnt">←${g.inMap.get(x.n.slug)!.length} →${g.outMap.get(x.n.slug)!.length}</span></a>`,
            )
            .join('')
        : '<p class="cx-empty">いまはどのノートもよく繋がっている。</p>'
    }
  </div>`;

  return `<aside class="cx-sidebar">${main}${growthHtml}</aside>`;
}

/** レンズ行 + 層 + サイドパネルの全体を描画する。#connections-app の innerHTML になる。 */
export function renderApp(notes: GraphNote[], state: ViewState): string {
  const g = computeGraph(notes, state.lens);
  return `${renderLens(notes, state)}
<div class="cx-main">
  <div class="cx-tiers">${renderTiers(g, state)}</div>
  ${renderSidebar(notes, g, state)}
</div>`;
}
