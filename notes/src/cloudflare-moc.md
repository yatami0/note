---
created: 2026-08-19 07:07
updated: 2026-08-20 00:21
---
# Cloudflare開発プラットフォームの見取り図（MOC）

Cloudflare関連の原子ノートの見取り図。個人開発の文脈では「入口を守る（Zero Trust系）」と「コードとデータを置く（Workers系）」の2系統に分かれる。

## 入口を守る（Zero Trust系）

- [[cloudflare-zero-trust]] — Access（認証プロキシ）+ Tunnel（ポートを開けないコネクタ）。自宅サーバ・開発環境を認証付きで公開する定石
- [[zero-trust]] / [[beyondcorp]] — その背後にある概念と元祖実装
- [[mtls]] — Authenticated Origin Pulls（オリジンをCloudflare経由専用にする）の仕組み

## コードとデータを置く（Workers系）

- [[cloudflare-workers]] — エッジのサーバレス実行環境。V8 isolate。Pagesとの関係と使い分けもここ
- [[durable-objects]] — 単一インスタンス保証のステートフルオブジェクト。WebSocket・調整役（設計思想は[[actor-model]]）
- [[cloudflare-d1]] — SQLiteベースのサーバレスSQL DB。普通のアプリDB担当
- [[cloudflare-r2]] — S3互換オブジェクトストレージ。egress無料

## エージェントを動かす層

この層は製品軸を越えて広がったので、別途[[ai-agent-moc]]に「権限をどう渡し、どこで実行させるか」の軸で地図を作ってある。

- [[cloudflare-os]] — Cloudflare社内発のAIエージェント作業環境（2026年8月にApache 2.0で公開）。以下の要素技術を全部使って組み上げたアプリで、「Workersでここまで作れる」のリファレンス実装として読める
- [[dynamic-workers]] — 実行時に決まったコードをisolateで隔離実行する。Worker Loader / Durable Object Facets
- [[code-mode]] — ツール呼び出しの代わりにコードを書かせるエージェントの作り方
- [[capnweb]] — スキーマ不要のobject-capability RPC。promise pipeliningで往復を潰す
- [[capability-security]] — 上3つに共通する背景。渡された参照だけが権限になる

## 使い分けの早見

| やりたいこと | 使うもの |
|---|---|
| 自宅/VPSのアプリを公開したい（コードはそのまま） | Tunnel + Access |
| コードごとCloudflareに置きたい | Workers |
| リアルタイム協調・WebSocket | Durable Objects |
| リレーショナルデータ | D1 |
| 画像・ファイル | R2 |
| 社内向けのAIエージェント環境が欲しい | Cloudflare OS（Workersの上に載るアプリ） |

#moc #cloudflare #個人開発
