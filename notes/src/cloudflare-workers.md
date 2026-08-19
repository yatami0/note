---
created: 2026-08-19 02:32
updated: 2026-08-19 05:55
---
# Cloudflare Workers

Cloudflareのエッジで動くサーバレス実行環境。世界300超のデータセンターの**どこでも同じコードが動き**、リクエストはユーザーに近い拠点で処理される。

## コンテナではなくV8 isolate

WorkersはLambdaのようなコンテナ/VM起動型ではなく、**V8エンジンのisolate**（Chromeがタブを隔離するのと同じ仕組み）でコードを動かす。

- 1プロセス内に多数のisolateを同居させられるため、起動が数ミリ秒——**コールドスタートが実質ない**
- 代わりに実行モデルに制約がある: 任意のネイティブバイナリは動かない（JS/TS/Wasm）、CPU時間制限、Node.js APIは互換レイヤーでの部分対応
- ランタイム（workerd）はオープンソースで、ローカル開発は`wrangler dev`で同じ環境を再現できる

コードはfetchハンドラが基本形:

```js
export default {
  async fetch(request, env, ctx) {
    return new Response("Hello from the edge");
  },
};
```

## Bindings: エッジから使えるストレージ群

Workersは環境変数的な「binding」経由でCloudflareのデータサービスに繋がる。エッジには従来型の「近くのRedis/RDB」が置けないので、これらが代替になる:

| サービス | 何か | 向く用途 |
|---|---|---|
| **KV** | 結果整合のキー値ストア（読み取り特化） | 設定・キャッシュ・セッション参照 |
| **D1** | SQLite互換のSQL DB | 小〜中規模のリレーショナルデータ |
| **R2** | S3互換オブジェクトストレージ（**egress無料**） | 画像・ファイル配信 |
| **[[durable-objects|Durable Objects]]** | 単一インスタンス保証の強整合ステートフルオブジェクト | WebSocket・カウンタ・調整役 |
| **Queues** / **Cron Triggers** | 非同期ジョブ・定期実行 | バッチ処理 |

エッジ環境では共有ストアへの低レイテンシアクセスが難しいという性質は認証設計にも波及する——[[stateless-session|ステートレスセッション]]（署名検証だけで各エッジが独立に認証できる）がエッジで支配的になる理由がこれ。

## Pagesとの違い（2026年時点の答え: 新規はWorkersでよい）

歴史的経緯で2製品あるが、現在は統合方向:

| | Pages | Workers |
|---|---|---|
| 出自 | Gitリポジトリ連携の**静的サイトホスティング**（Netlify/Vercel対抗）。push→自動ビルド→プレビューURL | サーバレス**コンピュート** |
| 動的処理 | Pages Functions（`functions/`ディレクトリ）——**実体はWorkersにコンパイルされる** | 本体 |
| 静的配信 | 本体 | **Workers Static Assetsで対応済み**（ここで差が消えた） |
| Durable Objects・Cron等 | 使えない/制限あり | フル対応 |

- もともと「静的サイトはPages、APIはWorkers」という棲み分けだったが、**Workersが静的アセット配信を取り込んだ**ことで、1つのWorkerでフロントエンドとバックエンドを両方持てるようになった
- Cloudflare自身が**新規プロジェクトにはWorkersを推奨**しており、新機能はWorkers側にだけ入る。Next.jsをCloudflareに載せる公式ルートも`@opennextjs/cloudflare`でWorkersにデプロイする形
- Pagesが今も適するのは「純粋な静的サイトをGit pushだけで運用したい」ケース。既存Pagesプロジェクトを慌てて移行する必要はないが、育てるつもりのアプリはWorkersで始めるのが無難

個人開発での使い分けの目安: 自宅マシンやVPSで動くものを公開したいなら[[cloudflare-zero-trust|Tunnel]]（コードはそのまま、入口だけCloudflare）、コード自体をCloudflareに置いてしまうならWorkers。Workersのアプリに認証を外付けしたい場合もAccessが前段に置ける。

## 出典

- [Cloudflare Docs: Workers — How Workers works（isolateモデル）](https://developers.cloudflare.com/workers/reference/how-workers-works/)
- [Cloudflare Docs: Static assets on Workers](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Docs: Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [OpenNext: Cloudflare adapter](https://opennext.js.org/cloudflare)

#cloudflare #serverless #edge #個人開発
