---
created: 2026-08-20 00:14
updated: 2026-08-20 00:21
---
# MCP (Model Context Protocol)

LLMアプリケーションと外部のデータソース・ツールを繋ぐためのオープンなプロトコル。Anthropicが2024年11月に公開し、2025年12月にLinux Foundation傘下の**Agentic AI Foundation (AAIF)** へ寄贈された（Anthropic・Block・OpenAIが共同設立、Google・Microsoft・AWS・Cloudflare・Bloombergが支援。goose、AGENTS.mdと並ぶ創設プロジェクト）。

通信はJSON-RPC 2.0。仕様はTypeScriptのスキーマを正としていて、日付版（`2024-11-05`、`2025-03-26`、`2025-06-18`、`2025-11-25`、`2026-07-28`…）で改訂されていく。

## host / client / server

仕様は3者を明確に分ける。

| 役割 | 何をするか |
|---|---|
| **Host** | 接続を開始するLLMアプリ本体。clientインスタンスを作り、**セキュリティポリシーと認可の判断を担う** |
| **Client** | host内のコネクタ。1つのserverと**1対1**で対応し、server同士の隔離を保つ |
| **Server** | リソース・ツール・プロンプトを提供する。ローカルプロセスでもリモートサービスでもよい |

設計原則として挙がっているのは4つ。

1. **サーバは実装が簡単であるべき**
2. **複数のサーバが共通プロトコルの上で合成できる**
3. **サーバに渡る情報は意図的に制限される** — 「サーバが受け取るのは必要な文脈情報だけ」で、**会話の全履歴はhostに留まる**
4. **段階的な機能追加**が後方互換を保ったままできる

3番目が地味に重要で、MCPサーバは自分に来たツール呼び出ししか見えない。ユーザーとLLMの会話全体を覗くことはできない。

## サーバが提供する3つのプリミティブ

| プリミティブ | 何か | **誰が制御するか** |
|---|---|---|
| **Prompts** | やり取りを誘導する定型のテンプレート・指示 | **ユーザー**（スラッシュコマンドやメニューとして出す） |
| **Resources** | モデルに文脈を与える構造化データ・コンテンツ | **アプリケーション**（ファイルの中身、git履歴など） |
| **Tools** | 実行可能な関数 | **モデル**（API呼び出し、ファイル操作など） |

「誰が制御するか」の列が仕様の肝で、3つは技術的に似ていても**発火の主体が違う**。世間でMCPと言うとほぼtoolsの話になりがちだが、仕様上はプロンプトとリソースが対等に並んでいる。

## トランスポート

標準で2つ。

- **stdio** — クライアントが起動した子プロセスの標準入出力に、改行区切りでメッセージを流す。ローカルのサーバはこれ
- **Streamable HTTP** — 単一のMCPエンドポイントへのHTTP POST。応答はJSONオブジェクトか、リクエストスコープのSSEストリーム。中間のプロキシがボディをパースせずにルーティングできるよう、一部のメタデータをHTTPヘッダにミラーする

どちらもメッセージはUTF-8のJSON-RPC。プロトコルのメタデータは全てメッセージ本文の`_meta.io.modelcontextprotocol/*`に載る。

## 2026-07-28版での大きな変更

現行仕様はかなり作りが変わっていて、古い記事の記述と食い違うので注意が要る。

- **プロトコルレベルのセッションを廃止** — `Mcp-Session-Id`ヘッダも削除され、「MCPはステートレスなプロトコル。全てのリクエストは自己完結し、自身のプロトコルバージョンと能力を持ち運ぶ」という設計になった。呼び出しをまたいで状態が要る場合は、サーバがハンドルをツール引数として返す形にする
- **initializeハンドシェイクの代わりに毎リクエストで名乗る** — クライアントは`_meta.io.modelcontextprotocol/clientCapabilities`で能力を申告し、サーバは各結果の`_meta`で自分を名乗る
- **`server/discover`** — サーバが対応機能を広告するエンドポイント
- **`subscriptions/listen`** — サーバ→クライアント通知を長寿命のPOSTレスポンスストリームに一本化（`resources/subscribe`などを統合）
- **Multi round-trip requests** — サーバが処理の途中で追加情報を要求できるパターン。結果には完了状態を示す`resultType`が必須になった
- **deprecated**: Roots、Sampling、Logging、そしてHTTP+SSEトランスポート

拡張として**Tasks**（長時間処理の非同期実行）と**MCP Apps**（会話の中にインラインで対話的なUIを描く）がある。

## セキュリティ原則

仕様が掲げるのは3つ。**明示的なユーザー同意**（データアクセスと操作の実行の両方について）、**データプライバシー**（サーバに晒す前に同意を取る）、**ツールの安全性**（コード実行として相応に慎重に扱う）。実装者には堅牢な同意・認可フローと、セキュリティ上の含意の明文化が求められている。

ただしこれは「実装者がやること」として書かれていて、プロトコル自体が権限を絞る機構を持っているわけではない。

## 権限モデルとしての弱点

一般的なMCPの使い方では、**起動時に全サーバを繋いでおく**。結果として、どのチャットでも全サービスへの広いアクセスが常時ambientに効いてしまう——[[capability-security|capabilityベースのセキュリティ]]で言うambient authorityそのもの。「このタスクにはGitHubのこのリポジトリだけ」を表現する手段が標準にはない。

これに対する具体的な代案が2つ出ている。

- **[[cloudflare-os]]のGatekeeper** — 自称「supercharged MCP servers」。事前設定ではなく、使わせたいリソースを都度「紹介」する。アクセスは意図した特定リソースに絞られ、全アクションがログに残り、副作用のある操作は人間の承認を通る
- **[[sandstorm]]のpowerbox** — 10年前の同じ発想。「許可しますか？」ではなく「どれを使いますか？」と聞くことで、指定と権限を一体にする

## Code Modeとの関係

もう1つの流れが、MCPを**LLMに直接見せるのをやめる**という方向。[[code-mode|Code Mode]]では、MCPサーバのツール定義をTypeScript APIに変換し、LLMにはそのAPIを呼ぶコードを書かせる。MCPサーバは「モデルに見せるツールのカタログ」ではなく「サンドボックスから呼べるAPIの供給源」になる。

MCPを否定するものではなく、MCPの資産（既に1万を超えるサーバが公開されている）をそのまま使いながら、モデルに見せる面だけを差し替える構図。

## [[ai-agent-moc]]の中での位置づけ

「権限をどう渡すか」の現行標準。プロトコルとしての機能は揃っているが、権限を絞る機構は持たず実装者任せになっている。その空白を埋めにいっているのが[[capability-security]]の原則であり、[[cloudflare-os]]のGatekeeperと[[sandstorm]]のpowerboxはその具体案。

## 出典

- [MCP仕様 2026-07-28](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/docs/specification/2026-07-28) — 概要・アーキテクチャ・サーバプリミティブ・トランスポート・changelog
- [Donating the Model Context Protocol and establishing the Agentic AI Foundation（Anthropic）](https://anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation)
- [Linux Foundation: Agentic AI Foundation (AAIF) の設立](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
- [cloudflare/cloudflare-os README](https://github.com/cloudflare/cloudflare-os) — Gatekeeperを「supercharged MCP servers」と位置づける記述

#ai-agent #アーキテクチャ #セキュリティ
