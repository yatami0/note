---
created: 2026-08-18 14:03
updated: 2026-08-18 14:03
---
# Next.jsのRSC/Server Actionsとトークン露出

「[[bff-pattern|BFF]]にすれば自動的に安全」は誤り。「Server Actions/Componentsを正しく使えばトークンはブラウザに出ない」は成立するが、**無条件ではなく実装規律付き**で成立する。破れ方はすべて「特定の実装ミス」に分類でき、リンター・レビュー・taint APIで機械的に防げる。

なおこの露出問題は「サーバが握っている秘密が、クロージャやpropsに乗って境界を越えるか」という問題であり、越えるものがセッションIDだろうがJWTだろうが同じ。**認証方式の選択とは独立した、Next.js実装規律の問題**。

## シリアライズ境界の正確な挙動

### Server Actionsの関数本体はクライアントに含まれない

`"use server"`の関数本体はクライアントJSバンドルに含まれない。クライアントに渡るのは暗号化されたアクションID（参照）のみ。未使用のServer Functionはバンドルから除去されエンドポイント自体が消える。

### ⚠️ ただし「クロージャに掴んだ変数」はクライアントに送られる

最大の落とし穴。コンポーネント内にインラインで定義したServer Actionが外側の変数を閉じ込めた場合、その値は**シリアライズされてクライアントに送信され、フォーム送信時にサーバへ送り返される**。

```tsx
// ❌ 危険パターン: token がクロージャに掴まれ、(暗号化されて)クライアントに送られる
export default async function Page() {
  const token = await getAccessToken();
  async function save(formData: FormData) {
    "use server";
    await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
  }
  return <form action={save}>...</form>;
}
```

Next.jsはクロージャ変数を**ビルドごとの秘密鍵で暗号化**してから送るため平文では漏れないが、公式ドキュメント自身が「暗号化だけに依存するな」と明言している。鍵はビルド成果物と同じ場所に存在し、マルチインスタンス運用では`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`の共有＝鍵管理の問題に転化する。

### RSCペイロードに載るのは「結果」だけ、ただしpropsは全部載る

Server Component内で`fetch(url, { headers: { Authorization: token } })`しても、HTML/RSCペイロードに載るのはレンダリングに使われたデータであり、リクエストヘッダのトークン自体は載らない。**ただし**:

- **Client Component（`"use client"`）のpropsに渡したものすべて**がRSCペイロードとしてブラウザに届く
- **画面に表示していなくても、propsに渡した「オブジェクト丸ごと」**が載る。`<Profile user={user} />`の`user`に機微フィールドが含まれていればペイロードに入る。米政府サイトがRSCペイロード経由で非表示の個人情報を漏らした実例が報告されている

### cookies()経由ならトークン本体はサーバに留まる

セッションIDをHttpOnly Cookieで持ち、`cookies()`で読み、ストアを引いてトークンを取得し、サーバ内fetchに使う経路では、トークンは**サーバのメモリ内にしか存在しない**。

## 守るべき実装規律（5ルール）

1. **R1**: トークンは常に`cookies()`→セッションストア経由で取得。モジュールスコープ・環境変数・propsで引き回さない
2. **R2**: Server Actionは別ファイル（`actions.ts`）のトップレベルに定義。クロージャに秘匿値を掴まない
3. **R3**: Client Componentへはドメインオブジェクト丸ごとではなく**表示に必要なフィールドだけのDTO**を渡す（データアクセス層で剥がす）
4. **R4**: `next.config.js`で`experimental.taint`を有効化し、`experimental_taintUniqueValue` / `experimental_taintObjectReference`でトークン・セッションオブジェクトに汚染マークを付ける——Client Component境界を越えようとした瞬間にエラーで落ちる。ただし加工した値（base64化・文字列連結・コピー）は追跡されないので、**唯一の防壁ではなく最後の網**
5. **R5**: サーバ専用モジュールに`import 'server-only'`を入れ、誤importをビルドエラー化

テスト観点: taintが例外を投げることの確認テスト、主要画面のRSCペイロードに秘匿フィールドが含まれないことの自動チェック（E2Eでレスポンスbodyをgrep）。

## [[web-auth-moc|Webアプリ認証認可MOC]]の中での位置づけ

BFFパターンをNext.jsで実装するときの「規律側」の各論。[[browser-token-tradeoff]]の観点A（トークン非露出を規律をもって維持できるか）に対応する。

## 出典

- [Next.js: How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions)
- [Next.js: Data Security ガイド](https://nextjs.org/docs/app/guides/data-security)
- [next.config.js: taint](https://nextjs.org/docs/app/api-reference/config/next-config-js/taint)
- [React: experimental_taintUniqueValue](https://react.dev/reference/react/experimental_taintUniqueValue) / [experimental_taintObjectReference](https://react.dev/reference/react/experimental_taintObjectReference)
- [Government Website Leaks Information in Next.js RSC Payload](https://www.bswanson.dev/blog/nextjs-hydration-payload/)

#nextjs #セキュリティ #認証認可 #react
