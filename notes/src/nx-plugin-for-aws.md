---
created: 2026-09-11 12:04
updated: 2026-09-11 12:04
---
# Nx Plugin for AWS

AWS Labs が公開しているコードジェネレータ集。npmパッケージ名は `@aws/nx-plugin`。Nx（モノレポ向けビルドシステム）の generator として動き、API・Webサイト・認証・AIエージェント・DB・インフラといった部品を1つずつ追加していくと、アプリコードと、それをデプロイするインフラ（AWS CDK または Terraform）がセットで生成される。2026年9月7日に v1.0.0 がリリースされ、同月に AWS の What's New でも発表された。

ドキュメントは英語と日本語（`/jp/`）がある。

## 設計方針

コンセプトページに書かれている方針は次の通り。

- **独自の抽象化層を作らない** — React、tRPC、FastAPI、[[strands-agents|Strands Agents]]、AWS CDK など既存OSSの素のコードを生成する。習得済みの知識がそのまま使える
- **生成後はプラグインに依存しない** — 「ビルド時のツールであって、実行時の依存ではない」。生成されたコードは自分の資産として自由に書き換えてよい
- **マイグレーションで生成済みコードを追従させる** — `nx migrate @aws/nx-plugin` でプラグインを上げると、過去に生成したコードも自動で改善される。ユーザーが改変した箇所は保護され、安全に扱えない変更だけ手動対応を促す。v1.0.0 時点で37個のマイグレーションが同梱
- **ジェネレータはべき等** — 何度再実行しても既存コードを上書きしない
- **必須依存は最小限** — TypeScript は Node、Python は uv だけ
- **型はフロントとAPIで共有される** — 契約の変更は本番バグではなくコンパイルエラーとして現れる

## ジェネレータ一覧

`nx g @aws/nx-plugin:<name>` で呼ぶ。`ts#api --framework=trpc` のように `framework` オプションで実装を選ぶ形に v1.0.0 で統一された。

| 種別 | ジェネレータ | 生成物 |
|---|---|---|
| TypeScript | `ts#project` | ライブラリ |
| | `ts#api` | tRPC または Smithy のAPI。API Gateway + Lambda + Powertools |
| | `ts#website` | React (Vite) のSPA |
| | `ts#website#auth` | Cognito 認証をWebサイトに追加 |
| | `ts#lambda-function` | 型付きイベントソース付きのLambda |
| | `ts#mcp-server` | [[mcp|MCP]]サーバー |
| | `ts#agent` | Strands Agents のエージェント |
| | `ts#dynamodb` / `ts#rdb` | DynamoDB（シングルテーブル設計）/ Aurora |
| | `ts#infra` | CDK のインフラプロジェクト |
| | `ts#nx-generator` | 自前のNxジェネレータの雛形 |
| Python | `py#project` | uv ベースのプロジェクト |
| | `py#api` | FastAPI のAPI。API Gateway + Lambda + Powertools |
| | `py#lambda-function` / `py#mcp-server` / `py#agent` / `py#dynamodb` / `py#rdb` | TypeScript側と同等 |
| 横断 | `connection` | プロジェクト間の配線（後述） |
| | `agentcore-gateway` | [[amazon-bedrock-agentcore|AgentCore]] Gateway |
| | `agentcore-harness` | AgentCore Harness（マネージドなエージェントループ） |
| | `terraform#project` | Terraform プロジェクト |
| | `smithy#project` | Smithy のモデル定義プロジェクト |
| | `license` | LICENSEファイルとソースヘッダの管理 |

## connection ジェネレータ

このプラグインの特徴的な部分。`--sourceProject` と `--targetProject` を指定すると、両者を繋ぐ統合コードと設定を生成する。対応する組み合わせは次の通り。

- **フロントエンド → API**: React → tRPC / FastAPI / Smithy / Python Agent / TypeScript Agent / AG-UI Agent
- **API → DB**: tRPC / Smithy / Agent → Aurora または DynamoDB
- **エージェント間**: Agent ↔ MCPサーバー、Agent ↔ A2A エージェント（リモート）
- **Gateway**: Agent ↔ AgentCore Gateway、Gateway ↔ Gateway、React ↔ Gateway

配線に必要な「デプロイしてみないと決まらない値」（APIのURL、Cognitoの設定、Agent Runtime の ARN など）は **Runtime Configuration** という仕組みで受け渡す。CDK/Terraform 側が `connection` / `agentcore` / `dynamodb` / `database` の4つの名前空間に値を書き込み、AWS AppConfig に格納する。`connection` 名前空間だけは S3 に `runtime-config.json` として配置され、フロントエンドがクライアント側で読み込む。サーバー側（Lambda やエージェント）は Powertools 経由で AppConfig から取得する。

## AIエージェント周りが v1.0 の主軸

- `ts#agent` / `py#agent` は Strands Agents ベース（Python は LangChain/LangGraph も選択可）で、デフォルトで **Amazon Bedrock AgentCore Runtime** にデプロイされる。サーバープロトコルは HTTP（TypeScript 側は tRPC over WebSocket、Python 側は FastAPI）、A2A、AG-UI（CopilotKit 向けの SSE over POST）から選ぶ。セッションは S3 に保持し、`<name>-dev` でローカル起動、`<name>-chat` で対話できる
- `agentcore-gateway` は MCP モード（複数MCPサーバーを1エンドポイントに集約し、Cedar ポリシーで default-deny のツール呼び出し制御）と HTTP モード（AgentCore Runtime 上のエージェントへのパスベースルーティング）がある。認証は IAM（SigV4）か Cognito（JWT）
- `agentcore-harness` は `PROMPT.md`（システムプロンプト）と `chat.ts`、IAM ロール・Harness リソースのインフラ定義を生成する

## AIアシスタントから使う前提の作り

プラグイン自身が MCP サーバー（`@aws/nx-plugin-mcp`）と Claude Code プラグインとしても配布されている。`pnpm create @aws/nx-workspace` で作ったワークスペースには Claude Code / Cursor / Kiro / Gemini CLI / GitHub Copilot / Codex 向けのプロジェクトレベル MCP 設定が同梱されていて、「tRPC APIとReactサイトを作ってCognito認証を付けてインフラも作って」と指示するとエージェントがジェネレータを依存順に実行する。

Claude Code へのグローバル導入は次の通り。

```
/plugin marketplace add awslabs/nx-plugin-for-aws
/plugin install nx-plugin-for-aws@nx-plugin-for-aws
```

## クイックスタート

```sh
pnpm create @aws/nx-workspace my-project && cd my-project
pnpm nx g @aws/nx-plugin:ts#api --framework=trpc
pnpm nx g @aws/nx-plugin:ts#website --framework=react
pnpm nx g @aws/nx-plugin:ts#website#auth
pnpm nx g @aws/nx-plugin:connection   # website → api
pnpm nx g @aws/nx-plugin:ts#infra     # CDK（Terraform も選べる）

pnpm nx run-many -t build
pnpm nx bootstrap infra
pnpm nx deploy-sandbox infra          # CloudFormation の高速モードで開発用にデプロイ
pnpm nx load-runtime-config demo-website && pnpm nx serve demo-website
pnpm nx destroy-sandbox infra         # 片付け
```

ローカルは `dev` ターゲット1つでフロント・API・エージェントをまとめて起動できる。

## v1.0.0 のその他のハイライト

- `init` ジェネレータで既存の Nx リポジトリや Nx でないリポジトリにも導入できる
- Terraform が CDK と同等にサポートされた
- デフォルトで WAF、Cognito 脅威保護、CSP、API アクセスログ、Trivy によるイメージスキャン、ライセンス許可リスト、git-secrets が有効
- Nx 23.2、ESM、Biome（ESLint + Prettier の置き換え）、pnpm catalog 対応のプロジェクト単位 `package.json` に移行

## 位置づけ

Nx 公式のプラグインレジストリにも掲載されている。AWS PDK（projen ベースのモノレポ管理ツール）とは別プロジェクトで、後継と明言した記述は見つからなかった。リポジトリは Apache 2.0、2026年9月時点でスター約120、コミット約1,000。

## 出典

- [awslabs/nx-plugin-for-aws (GitHub)](https://github.com/awslabs/nx-plugin-for-aws) — README、`docs/src/content/docs/en/` 配下の concepts / quick-start / building-with-ai / guides（connection, runtime-config, ts-agent, py-agent, agentcore-gateway, agentcore-harness, nx-migration）
- [v1.0.0 リリースノート](https://github.com/awslabs/nx-plugin-for-aws/releases/tag/v1.0.0)
- [AWS announces Nx Plugin for AWS for scaffolding full-stack applications (What's New, 2026-09)](https://aws.amazon.com/about-aws/whats-new/2026/09/nx-plugin-for-aws/)
- [公式ドキュメント（日本語）](https://awslabs.github.io/nx-plugin-for-aws/jp/)
- [Nx Plugin Registry](https://nx.dev/docs/plugin-registry)

#aws #ai-agent #serverless #アーキテクチャ
