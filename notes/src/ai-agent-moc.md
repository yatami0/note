---
created: 2026-08-20 00:21
updated: 2026-08-20 00:21
---
# AIエージェント基盤の見取り図（MOC）

「AIエージェントに仕事をさせる基盤をどう設計するか」に関する原子ノートの見取り図。発端は[[cloudflare-os|Cloudflare OS]]の調査で、そこから要素技術を切り出していったら1つの領域になった。

この領域の問いは2つしかない。

1. **権限をどう渡すか** — エージェントは事前に何をするか列挙できない主体なので、「必要なものを必要な分だけ」を表現する手段が要る
2. **どこで実行させるか** — エージェントが書いたコードを、こちらのデータを壊さずに動かす場所が要る

用語（MCP、ツール呼び出し、サンドボックス、capability）は多いが、どれもこの2問のどちらかへの答え。

## 権限をどう渡すか

- [[capability-security]] — 土台の考え方。「指定と権限を分離しない」。confused deputy、POLA、Unixのfd／Capsicum／seL4という系譜。**ACLではなくcapabilityがエージェント向きだ**という主張の中身はここ
- [[mcp]] — 現在の事実上の標準プロトコル。host/client/serverの3者構造と3プリミティブ。ただし**起動時に全サーバを繋ぐ**という一般的な使い方はambient authorityそのもので、権限モデルとしては上の原則と逆を向く
- [[sandstorm]] — 10年前に同じ問題を解いていた実例。powerboxは「許可しますか？」ではなく「どれを使いますか？」と聞くことで、選択とcapability付与を1つのUIに統合した
- [[capnweb]] — 参照を渡すことがそのまま権限を渡すことになるRPC。`authenticate()`が別のオブジェクト参照を返す設計にすれば、権限の境界がAPIの形として現れる

## どこで実行させるか

- [[dynamic-workers]] — 実行時に決まったコードをV8 isolateで隔離実行する。既定でインターネットを遮断し、渡したbinding経由でしか外に出られない。Durable Object Facetsで「永続ストレージは与えるがこちらのDBは見せない」も作れる
- [[code-mode]] — そもそもエージェントに**ツールを呼ばせるのをやめてコードを書かせる**方式。中間データがLLMを通らなくなる代わりに、そのコードを動かす隔離環境が必須になる（だから上とセットで出てくる）

## 全部使って組んだ実例

- [[cloudflare-os]] — gadget（1ユーザー1インスタンスのアプリ）、Gatekeeper（capabilityベースの仲介役）、Blueprint（コードの配布単位）。上記5ノートの技術を全部使ってCloudflareが社内向けに作り、OSSで公開したもの

## 見たいものからの早見

| 知りたいこと | 見るノート |
|---|---|
| なぜ事前設定のMCPだと権限が広すぎるのか | [[capability-security]] → [[mcp]] |
| 「必要な分だけ渡す」のUIはどう作るのか | [[sandstorm]] |
| エージェントが書いたコードを安全に動かすには | [[dynamic-workers]] |
| ツール呼び出しのトークンを減らしたい | [[code-mode]] |
| 作ったアプリをエージェントから操作させたい | [[capnweb]] |
| 全部入りの実装を読みたい | [[cloudflare-os]] |

## 隣接する見取り図

- [[cloudflare-moc]] — 製品軸の地図。[[dynamic-workers]]と[[cloudflare-os]]はそちらにも属する。土台の[[cloudflare-workers]]・[[durable-objects]]はそちら側
- [[web-auth-moc]] — 「持っているだけで行使できる資格情報をどこまで配るか」という問いは共通。[[session-id-vs-jwt]]のreference vs capabilityの議論が[[capability-security]]と直結する

#moc #ai-agent #セキュリティ #アーキテクチャ
