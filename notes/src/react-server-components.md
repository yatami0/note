---
created: 2026-08-19 20:19
updated: 2026-08-19 20:19
---
# React Server Components

クライアントとは**別の環境で、バンドル前に**実行されるReactコンポーネント。実行タイミングはビルド時（CIでのバンドル時）かリクエスト時（サーバ）で、**コンポーネントのコード自体はブラウザに届かない**。ブラウザが受け取るのはその実行結果だけ。

Reactの中に「サーバでしか動かないコンポーネント」という種別を持ち込んだもので、[[astro|Astro]]が`.astro`ファイルという別言語でやっていることを、Reactが同じJSXの中で型（コンポーネント種別）として区別することで実現している。

## SSRとの違い

最も混同しやすいところ。**SSRはRSCの代替ではなく、直交する別の仕組み**。

| | Server Components | 従来のSSR |
| --- | --- | --- |
| 実行時期 | バンドル**前**（ビルド時 or リクエスト時） | リクエスト時 |
| コンポーネントのコード | ブラウザに送られない | ブラウザに送られる |
| クライアントでの再実行 | されない | される（[[hydration]]） |
| データ取得 | DBを直接叩ける（API層が要らない） | 別途API/getServerSidePropsが要る |
| バンドルサイズ | サーバ専用ライブラリは含まれない | 依存が全部入る |

従来のSSRは「同じコンポーネントをサーバでも1回描いておく」最適化にすぎず、JSは結局全部配信される。RSCは「そもそもクライアントに配らないコンポーネントがある」という**種別の追加**。

バンドル削減が効く典型例が、Markdownレンダリング。`marked` + `sanitize-html` の 75KB (gzip) をサーバだけで使い、ブラウザには変換済みHTMLだけ届ける。

## `'use client'`境界

Server Componentは`useState`などのインタラクティブなAPIを使えない。状態が要る部分は`'use client'`を付けたClient Componentに切り出し、Server Componentから合成する。

```jsx
// Server Component（デフォルト）
async function Notes() {
  const notes = await db.notes.getAll();   // DBを直接叩ける
  return (
    <div>
      {notes.map(note => (
        <Expandable key={note.id}><p>{note.text}</p></Expandable>
      ))}
    </div>
  );
}
```

```jsx
'use client';
// Client Component: ここから下がブラウザに配信される
export default function Expandable({ children }) {
  const [expanded, setExpanded] = useState(false);
  return <div><button onClick={() => setExpanded(!expanded)}>Toggle</button>{expanded && children}</div>;
}
```

`'use client'`は「クライアントで動かす」という指定であると同時に、**そこから先の依存が全部バンドルに入る**という宣言でもある。だから境界はできるだけ葉の側（末端）に置く。逆に、`children`としてServer Componentの描画結果をClient Componentに**渡す**ことはできるので、「Client Componentの中にServer Componentがある」構造自体は作れる。

なお、Server Componentを示す`'use server'`ディレクティブは**存在しない**（`'use server'`はServer Functions用の別物）。サーバがデフォルトで、クライアント側を明示する非対称な設計になっている。

## 境界を越えられるもの・越えられないもの

Server → Client のpropsは**直列化される**ため、渡せるものに制約がある。

- 渡せる: プリミティブ、プレーンなオブジェクト・配列、JSX（描画結果）、Promise（クライアント側で`use()`でawaitできる）
- 渡せない: 関数・コールバック、クラスインスタンス、その他直列化できないもの

Promiseを渡せる性質を使うと、サーバで取得を**開始**だけしてawaitせずクライアントに渡し、`<Suspense>`で待つ、という書き方ができる。

```jsx
async function Page({ id }) {
  const note = await db.notes.get(id);            // これは待つ
  const commentsPromise = db.comments.get(note.id); // 開始だけして渡す
  return (
    <div>{note.text}
      <Suspense fallback={<p>Loading…</p>}>
        <Comments commentsPromise={commentsPromise} />
      </Suspense>
    </div>
  );
}
```

## RSCペイロードという落とし穴

「直列化される」ということは、その内容が**ネットワークを流れてブラウザに届く**ということ。Server Componentのコードは届かなくても、Client Componentに渡したpropsはRSCペイロードとして届く。ここに機微情報を載せてしまう事故が実際に起きている（[[nextjs-token-exposure]]）。

「サーバコンポーネントだから安全」ではなく、**安全なのはクライアントに渡さなかった値だけ**。この点、`.astro`のように言語レベルでサーバ側が分離されている方が、境界が目で見て分かるぶん事故りにくい面はある。

## [[islands-architecture|アイランド]]との違い

どちらも「クライアントJSを減らす」目的は同じだが、レイヤが違う。

- **RSC** — Reactの中で完結する。ツリー全体がReactのままで、`'use client'`が境界。Suspenseによるストリーミングと組み合わさり、サーバ→クライアントの境界を跨いだ1つのツリーとして設計できる
- **アイランド** — フレームワークの外側で切る。島の中身はReactでもVueでもよく、島同士は互いに独立（共通の親が存在しない）

RSCは「1つの大きなツリーの一部をサーバに寄せる」、アイランドは「静的HTMLに独立した小さなツリーを埋める」。**アプリ的なもの**にはRSCが、**コンテンツ的なもの**にはアイランドが噛み合いやすい。

## [[frontend-rendering-moc|レンダリング境界MOC]]の中での位置づけ

境界を**Reactの型（コンポーネント種別）で切る**流派。Astroが言語で、アイランドがフレームワークの外側で切るのに対し、Reactのツリーの中に境界を持ち込むのが特徴。境界を跨ぐデータが直列化される性質が、そのままセキュリティ上の注意点にも繋がる。

## 出典

- [Server Components — React](https://react.dev/reference/rsc/server-components)
- [Server Functions — React](https://react.dev/reference/rsc/server-functions)

#react #フロントエンド #nextjs #レンダリング
