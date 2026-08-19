---
created: 2026-08-19 07:07
updated: 2026-08-19 07:07
---
# Cloudflare D1

SQLiteをベースにした[[cloudflare-workers|Workers]]向けのサーバレスSQLデータベース。「組み込みDBであるSQLiteを、マネージドなアプリDBとしてサービス化したもの」で、接続プールもサーバ管理もなくbinding経由でクエリする。

```js
const { results } = await env.DB
  .prepare("SELECT * FROM posts WHERE author = ?")
  .bind("yatami0")
  .all();
```

- 実装的には[[durable-objects|Durable Objects]]のSQLiteストレージの上に構築されている（1データベース＝1つの書き込み点）
- SQLite方言なのでローカル開発は`wrangler dev`で実ファイルのSQLiteがそのまま動く。マイグレーションは`wrangler d1 migrations`
- egress課金がなく、課金軸は`rows_read`/`rows_written`（スキャンした行数ベース——**インデックスの有無がそのまま料金に効く**のが面白い性質）

## 読み取りレプリケーションとSessions API

書き込みは単一のプライマリに集まるが、**読み取りレプリカを複数リージョンに追加費用なしで置ける**。ただの非同期レプリカだと「自分が書いた直後に古いデータを読む」事故が起きるので、**Sessions API**で逐次整合性（sequential consistency）を保証する:

- セッション開始時からの「ブックマーク」（どこまで反映済みかの印）をクライアントが持ち回り、レプリカがそこに追いついていなければ待つ/プライマリに回す
- 「read-your-own-writes」が保証され、レプリカの存在をアプリロジックからほぼ隠蔽できる

## 使い分けの目安

| | D1 | [[durable-objects|Durable Objects]] |
|---|---|---|
| モデル | **1個のアプリDB**（普通のRDB的発想） | エンティティごとに分割された多数の小さな状態 |
| 書き込み | 単一プライマリ | インスタンスごとに独立（水平に増える） |
| 向く | 読み多めの一般的なCRUDアプリ、ブログ、管理画面 | リアルタイム協調・調整・WebSocket |

無料枠は1日500万行読み取り・5GBストレージ（2026年8月時点）で、個人開発の規模なら実質無料で回る。

## [[cloudflare-moc|Cloudflare MOC]]の中での位置づけ

Workersスタックの「普通のSQL DB」担当。強整合な調整が要る部分は[[durable-objects]]、ファイルは[[cloudflare-r2|R2]]と役割分担する。

## 出典

- [Cloudflare Docs: D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Docs: D1 read replication（Sessions API）](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Cloudflare Docs: D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)

#cloudflare #database #serverless #個人開発
