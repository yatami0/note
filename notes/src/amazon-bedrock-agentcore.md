---
created: 2026-09-11 12:04
updated: 2026-09-11 12:04
---
# Amazon Bedrock AgentCore

AIエージェントを本番運用するためのAWSのマネージド基盤群。2025年7月にプレビュー、2025年10月13日にGA。「どのフレームワーク・モデル・プロトコルでも使える」ことを掲げていて、[[strands-agents|Strands Agents]]、LangGraph、CrewAI、AutoGen などで書いたエージェントをそのまま持ち込める。Bedrock という名前が付いているが、モデルは Bedrock 以外（OpenAI、Gemini など）も使える。

1つのサービスではなく、以下の構成サービスの集合になっている。

| サービス | 役割 |
|---|---|
| **Runtime** | エージェント・ツールをデプロイするサーバーレス実行環境。セッション単位で隔離 |
| **Gateway** | API・Lambda・既存の[[mcp|MCP]]サーバーを MCP 互換ツールとして1つのエンドポイントに束ねる |
| **Policy** | Gateway の境界で Cedar ポリシーによりツール呼び出しを認可する（2026年3月 GA） |
| **Identity** | エージェントの認証・認可。ユーザーの代理として外部サービスにアクセスするための OAuth 連携とトークン保管 |
| **Memory** | セッション内の短期記憶と、会話をまたぐ長期記憶のマネージドな保存 |
| **Observability** | OpenTelemetry ベースのトレース。ステップごとの実行可視化 |
| **Code Interpreter** | サンドボックスでのコード実行ツール |
| **Browser Tool** | クラウド上のブラウザ実行環境 |
| **Evaluations** | オンデマンド・継続的なエージェント評価（2026年3月 GA） |
| **Harness** | Strands で駆動されるマネージドなエージェントループ（2026年6月 GA） |

GA 時点で全サービスが VPC、PrivateLink、CloudFormation、リソースタグに対応した。

## Runtime

エージェントをコンテナとしてデプロイし、HTTP で呼び出す。契約は単純で、ポート 8080 で `POST /invocations`（SSE で応答を流せる）と `GET /ping`（ヘルスチェック）を出せばよい。`/ws` による WebSocket もある。Python SDK（`bedrock-agentcore`）だと次のようになる。

```python
from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent

app = BedrockAgentCoreApp()
agent = Agent()

@app.entrypoint
def invoke(payload):
    return agent(payload["prompt"]).message

app.run()
```

セッション ID はリクエストヘッダで渡し、セッションごとに隔離された実行環境が割り当てられる。1セッションの上限は8時間で、長時間・マルチモーダルなワークロードも対象にしている。A2A プロトコルにも対応する。

## Gateway と Policy

Gateway はエージェントから見た「ツールの単一の入口」。ターゲットとして Lambda 関数、OpenAPI / Smithy で定義した既存 API、既存の MCP サーバーを登録すると、それらが MCP ツールとして公開される。

- **インバウンド認証**（エージェント → Gateway）: IAM（SigV4）または OAuth（JWT）
- **アウトバウンド認証**（Gateway → ターゲット）: Identity と連携し、API キーや OAuth トークンを Gateway 側で保持する

Policy は Gateway に組み込まれる認可レイヤーで、Amazon Verified Permissions と同じ **Cedar** で書く。すべてのツール呼び出しが、引数まで含めてポリシーに照らして評価され、マッチしなければ拒否される（default-deny）。さらに `list tools` の応答時に Cedar の部分評価で「現在のポリシーでは常に拒否される」ツールを除外するので、そもそもモデルの目に触れさせない。2026年7月には Bedrock Guardrails を Cedar ポリシー内から参照できるようになった。

[[ai-agent-moc]]の「権限をどう渡すか」という問いに対して、MCP のツール境界に決定論的なポリシーエンジンを置くという答え方をしている。[[capability-security|capability]] ではなく ACL 側のアプローチだが、「モデルに見せるツール一覧自体を絞る」点は [[cloudflare-os]] の Gatekeeper と発想が近い。

## Harness

「モデルが脳なら、ハーネスは体」という説明がされている。オーケストレーションのループ、ツール実行、コンテキストウィンドウの管理、ターンをまたぐ状態の永続化、失敗からの回復、セッションの隔離を AWS 側が受け持つ。`CreateHarness` でエージェントを定義し `InvokeHarness` で実行する2つの API だけで動く。セッションごとに microVM が割り当てられ、エージェントは自前のファイルシステムとシェルを持つのでコードを書いて実行できる。モデルは Bedrock、OpenAI、Gemini、LiteLLM 互換プロバイダから選べ、セッション途中で切り替えてもコンテキストが失われない。

## [[nx-plugin-for-aws|Nx Plugin for AWS]] との関係

`ts#agent` / `py#agent` / `ts#mcp-server` / `py#mcp-server` の生成物はデフォルトで Runtime にデプロイされる。`agentcore-gateway` ジェネレータは Gateway + Cedar ポリシー + WAF を、`agentcore-harness` ジェネレータは Harness を CDK / Terraform で組み立てる。

## 出典

- [Amazon Bedrock AgentCore is now generally available (What's New, 2025-10)](https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-available)
- [Amazon Bedrock AgentCore now available in preview (What's New, 2025-07)](https://aws.amazon.com/about-aws/whats-new/2025/07/amazon-bedrock-agentcore-preview/)
- [awslabs/amazon-bedrock-agentcore-samples (GitHub)](https://github.com/awslabs/amazon-bedrock-agentcore-samples) — 構成サービスの一覧
- [aws/bedrock-agentcore-sdk-python (GitHub)](https://github.com/aws/bedrock-agentcore-sdk-python) — Runtime の HTTP 契約
- [Govern AI agent tool access with Amazon Bedrock AgentCore Gateway (AWS ML Blog)](https://aws.amazon.com/blogs/machine-learning/govern-ai-agent-tool-access-with-amazon-bedrock-agentcore-gateway/)
- [Why Policy in Amazon Bedrock AgentCore chose Cedar (AWS Security Blog)](https://aws.amazon.com/blogs/security/why-policy-in-amazon-bedrock-agentcore-chose-cedar-for-securing-agentic-workflows/)
- [AgentCore harness is now generally available (What's New, 2026-06)](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-agentcore-harness-generally-available/)
- [Amazon Bedrock AgentCore Evaluations is now generally available (What's New, 2026-03)](https://aws.amazon.com/about-aws/whats-new/2026/03/agentcore-evaluations-generally-available)

#aws #ai-agent #serverless #セキュリティ #アーキテクチャ
