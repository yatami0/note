---
created: 2026-08-19 20:19
updated: 2026-08-19 20:19
---
# Astro

コンテンツ主体のWebサイト向けフレームワーク。**サーバファースト**（描画をできる限りサーバ側で済ませる）・**デフォルトでクライアントJSゼロ**・**UIフレームワーク非依存**の3つが設計の柱。ブログ・ドキュメント・個人サイトのように「読み物が主、インタラクションが従」の領域を狙っている。

Reactを使ってきた人間から見たときの違いは、コンポーネントAPIの差ではなく**コンポーネントがいつ実行されるか**の差に集約される。

## `.astro`コンポーネントはサーバでしか動かない

Reactのコンポーネント関数はブラウザで何度も呼ばれ、stateが変わるたびに再レンダリングされる。対して`.astro`ファイルのフロントマター（`---`で挟んだ部分）は**ビルド時（またはリクエスト時）に1回だけ**実行され、ブラウザに届くのは出力されたHTMLだけ。実行に使ったJSは配信されない。

```astro
---
// ここはサーバでのみ、1回だけ動く
const { notes } = await getNotes();   // トップレベルawait、fsアクセスもDBアクセスもOK
---
<ul>{notes.map((note) => <NoteCard note={note} />)}</ul>
```

Reactで同じことをするには`useEffect`＋fetch＋loading stateか、[[react-server-components|React Server Components]]が要る。裏返すと`.astro`には`useState`・`useEffect`・イベントハンドラが**存在しない**。再レンダリングという概念自体がない。

この非対称性の帰結:

- **秘密情報が漏れにくい** — フロントマターのコードもそこで触った値も、明示的にHTMLへ出力しない限りクライアントに渡らない（Next.jsのRSCペイロードに機微情報が載る事故（[[nextjs-token-exposure]]）と同種の穴が構造的に生まれにくい）
- **データ取得にライブラリが要らない** — SWRやTanStack Queryが埋めていた「非同期・キャッシュ・loading状態」の問題が、そもそも発生しない
- **動的なUIは別の手段が要る** — 状態を持つUIは後述のアイランドとして切り出す

## デフォルトでクライアントJSゼロ

Reactは「ページ全体が1つのJSアプリ」で、初回ロードで全コンポーネントのJSを配る。Astroは静的HTMLを基本とし、**インタラクティブにしたい箇所だけを明示的に「島」として切り出す**（[[islands-architecture|アイランドアーキテクチャ]]）。

```astro
<SearchBox client:load />      <!-- ここだけJSが配信・hydrateされる -->
<StaticCard />                 <!-- ディレクティブなし = HTMLのみ、JS 0KB -->
```

Astro公式は「Reactベースの同等サイトに対しJS 90%減・ロード40%高速」を掲げている（自社ベンチマークなので数字自体は割り引くとして、**JSを配らないのがデフォルト**という方向性は正しく表している）。

## SPAではなくMPA

- **ファイルベースルーティング** — `src/pages/`配下のファイルがそのままURLになる。`[slug].astro`が動的ルート、`rss.xml.ts`や`search-index.json.ts`のようなHTML以外のエンドポイントも同じ場所に置ける
- **ページ遷移は通常のフルページロード** — クライアントルータを常駐させない。ソフトナビゲーション風の挙動が欲しい場合のみ`<ClientRouter />`（Astro 4系の`<ViewTransitions />`が5でリネームされ、6で旧名は削除）を入れる
- **ページをまたぐグローバルstateを持てない** — ReduxやContextでアプリ全体の状態を持つ発想が使えない。URLクエリ・localStorage・nanostoresなど、ページを跨いでも生き残る場所に置く設計になる

## テンプレ構文はJSXに似ているがHTMLのスーパーセット

見た目はJSXだが、あくまでHTMLの拡張という立て付けなので細部が違う。

| | React (JSX) | Astro |
| --- | --- | --- |
| クラス指定 | `className` | `class`（HTMLのまま） |
| label | `htmlFor` | `for` |
| 子要素 | `props.children` | `<slot />` |
| props受け取り | 関数の引数 | `Astro.props`、型は`interface Props` |
| CSS | CSS Modules等を別途導入 | `<style>`を書くと**自動でそのコンポーネントにスコープされる** |

## Reactの代替ではなく土台

Astro自体はUIフレームワークを持たず、島の中身としてReact・Vue・Svelte・Solidなどを（同一ページ上で混在させても）使える。つまり選択は「AstroかReactか」ではなく「**Astroの上で、どこをReactにするか**」になる。既存のReactコンポーネント資産をそのまま島として持ち込める。

## 向く／向かない

| | 例 |
| --- | --- |
| 向く | ブログ・ドキュメント・マーケティングサイト・ポートフォリオ・ECの商品ページ。コンテンツが主でインタラクションが局所的 |
| 向かない | ダッシュボード・エディタ・チャット・管理画面。アプリ全体が状態を共有し続け、画面遷移のたびにその状態を捨てたくないもの |

後者はNext.jsなどReactベースのフレームワークの領分。境界が曖昧な場合は「**ページをリロードしたら壊れる状態がどれだけあるか**」で判断するとよい。

## このノートサイト自体の構成

[[cloudflare-workers|Cloudflare Workers]]の静的アセット配信に載せている（`https://konohachi.com/`）。Markdownをremark/rehypeパイプラインでHTML化し、Astroが全ページを静的生成する構成で、`client:*`ディレクティブは1つも使っていない＝**UIフレームワークのランタイムを1バイトも配信していない**。テーマ切替・mermaidの遅延読み込み・X埋め込みなど、クライアントJSが要る数箇所は素の`<script>`で書いている。

これは「Astroだと素のJSに退化する」のではなく、**必要な量に応じて素のscript → 島 → フル機能のフレームワークと段階的に上げられる**（[[progressive-enhancement|プログレッシブエンハンスメント]]）というAstroの設計思想通りの帰結。

## [[frontend-rendering-moc|レンダリング境界MOC]]の中での位置づけ

境界を**言語で切る**流派。`.astro`という「サーバでしか動かないファイル形式」を用意することで、境界がファイル単位で目に見える。RSCが型（コンポーネント種別）で切るのに対し、こちらはファイルの拡張子で切る。

## 出典

- [Why Astro? — Astro Docs](https://docs.astro.build/en/concepts/why-astro/)
- [Astro components — Astro Docs](https://docs.astro.build/en/basics/astro-components/)
- [View transitions — Astro Docs](https://docs.astro.build/en/guides/view-transitions/)
- [Upgrade to Astro v5 — Astro Docs](https://docs.astro.build/en/guides/upgrade-to/v5/)

#astro #フロントエンド #react #静的サイト #個人開発
