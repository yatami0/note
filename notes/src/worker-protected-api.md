---
created: 2026-08-20 00:16
updated: 2026-08-20 00:16
---
# 静的アセット配信Workerに保護されたAPIを生やす

[[cloudflare-workers|Workers]]のStatic Assetsで配信している静的サイトに、**認証付きのAPIエンドポイントだけを足したい**ときの構成メモ。SSGで作った読み物サイトにサーバ側の処理を1つだけ持たせる、という状況。

## フレームワークのアダプタを入れずに済ませる

素直に思いつくのは「フレームワークのCloudflareアダプタを入れてハイブリッドレンダリングにする」だが、これはビルド全体をSSR前提に切り替える変更になる。APIが1本欲しいだけなら重い。

Workersの静的アセット配信は、**アセットとWorkerスクリプトを同居させられる**。`main`にWorkerを指定し、`run_worker_first`で「このパスだけWorkerを先に通す」と書けば、既存のビルド出力を一切変えずにAPIが生える。

```jsonc
{
  "main": "src/worker.ts",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page",
    "run_worker_first": ["/api/*"]
  }
}
```

`run_worker_first`は配列でルートパターンを取れる（`!`による除外も書ける。Wrangler v4.20以降）。静的アセットにマッチしないリクエストだけWorkerへ落とす既定の挙動と違い、**アセットより先にWorkerを通す**指定になる点が肝。

## 入口は Cloudflare Access で塞ぐ

自分だけが使うAPIなら、認証を自前で書かずに[[cloudflare-zero-trust|Cloudflare Access]]を前段に置くのが早い。`/api/*`にアプリケーションを定義し、IdPログインを通った本人だけ通す。ブラウザからの`fetch`は同一オリジンなので`CF_Authorization` Cookieが自動で乗り、クライアント側に認証コードはほぼ要らない。無料枠は50ユーザーまでなので個人利用なら費用も出ない。

[[beyondcorp|BeyondCorp]]系の「ネットワーク境界ではなくリクエストごとに検証する」考え方を、そのままAPIの前段に適用した形。

## 踏みやすい罠

### 1. 未認証の`fetch`には302が返る

Accessは未認証リクエストをIdPのログイン画面へ**リダイレクト**する。ブラウザで直接開くなら自然だが、`fetch`から見ると「JSONを期待したらHTMLが返ってきた」という分かりにくい失敗になる。セッション切れは日常的に起きるので、後付けだと必ず踏む。

対処は2つ。

- Accessアプリで**Managed OAuth**を有効にする。非ブラウザクライアントには302ではなく401＋`WWW-Authenticate`が返るようになる
- クライアント側で「認証切れを検出したらログインへ誘導する」ハンドリングを最初から入れておく

### 2. プレビューURLはAccessの外側

Accessのポリシーは**ホスト名に紐づく**。`wrangler versions upload`が発行する`*.workers.dev`のプレビューURLは、独自ドメインに付けたAccessアプリの外側にいる。CIがPRごとにプレビューURLを発行してコメントする運用だと、**そのURL経由でAPIが無認証で叩ける**。

だからAccessを置いても、Worker内で`Cf-Access-Jwt-Assertion`ヘッダのJWTを自前検証する（無ければ403）ところまでやる。Accessが発行するJWTはチームごとの公開鍵で検証でき、エッジで共有ストアを引かずに検証だけで完結する点は[[stateless-session|ステートレスセッション]]がエッジで支配的になる理由と同じ。

「前段のプロキシが必ず通る」という前提は、**プロキシを迂回する経路が1つでもあると崩れる**。リポジトリを非公開にしてもURLが消えるわけではないので、これは可視性とは別の対策が要る。

## この構成を使う例

[[note-llm-chat-design]]では、静的生成したノートサイトに`/api/chat`だけを生やし、Accessで自分に限定してLLM APIへ中継する。

## [[cloudflare-moc|Cloudflare MOC]]の中での位置づけ

Workers系（コードとデータを置く）とZero Trust系（入口を守る）を1つの構成の中で組み合わせる例。静的配信・API・認証が全部Cloudflareの中で完結する。

## 出典

- [Cloudflare Docs: Static assets — Worker script](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Cloudflare Changelog: Control which routes invoke your Worker script](https://developers.cloudflare.com/changelog/post/2025-06-17-advanced-routing/)
- [Cloudflare One Docs: Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/)
- [Cloudflare: Access (ZTNA) — 無料枠50ユーザー](https://www.cloudflare.com/sase/products/access/)

#cloudflare #ゼロトラスト #個人開発 #セキュリティ #静的サイト
