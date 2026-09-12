---
created: 2026-09-11 12:04
updated: 2026-09-11 12:04
---
# Strands Agents

AWS が2025年5月16日にオープンソース（Apache 2.0）で公開したAIエージェント構築SDK。Python と TypeScript がある。名前の由来は DNA の「鎖 (strand)」で、モデルとツールという2本の鎖を繋ぐという意味。AWS 社内では Amazon Q Developer、AWS Glue、VPC Reachability Analyzer などのエージェントに本番利用されていると公開時のブログにある。

## モデル駆動アプローチ

売りにしているのは **model-driven** という考え方。起こりうるシナリオを開発者が予測してワークフローをコードで書くのではなく、モデル自身に計画・思考の連鎖・ツール呼び出し・振り返りをさせる。開発者が用意するのは「プロンプト」と「ツールのリスト」だけで、あとはエージェントループ（モデルを呼ぶ → ツール呼び出しがあれば実行して結果を返す → 最終応答が出るまで繰り返す）が SDK 側で回る。

```python
from strands import Agent, tool
from strands_tools import calculator

@tool
def get_weather(city: str) -> str:
    """指定した都市の天気を返す"""
    return f"{city}は晴れ"

agent = Agent(tools=[calculator, get_weather])
agent("東京の天気と1764の平方根を教えて")
```

Python は `@tool` デコレータと型ヒント・docstring から入力スキーマを生成する。TypeScript は Zod スキーマで型付きツールを定義する。

```typescript
import { Agent, tool } from '@strands-agents/sdk'
import { z } from 'zod'

const weather = tool({
  name: 'get_weather',
  description: '天気を取得',
  inputSchema: z.object({ city: z.string() }),
  callback: ({ city }) => `${city}は晴れ`,
})
const agent = new Agent({ tools: [weather] })
await agent.invoke('東京の天気は？')
```

## 主な機能

- **モデルプロバイダ** — デフォルトは Amazon Bedrock。Anthropic、OpenAI、Gemini を第一級対応、Ollama や LiteLLM 経由、カスタムプロバイダも可
- **[[mcp|MCP]] ネイティブ対応** — MCP サーバーのツールをそのままエージェントのツールとして使える
- **マルチエージェント** — 1.0（2025年7月）で Agents as Tools / Swarm / Graph / Workflow の4つのプリミティブと、A2A（Agent-to-Agent）プロトコルによる他エージェントとの相互運用が入った
- **セッション管理** — リモートのデータストア（S3 など）からエージェントの状態を復元するセッションマネージャ
- **ライフサイクル制御** — ターン数の上限、トークン予算、キャンセル
- **構造化出力** — スキーマを指定してモデルの出力を検証
- **観測性** — OpenTelemetry ベースのトレーシングで、すべての判断を既定で記録
- **双方向ストリーミング**

## リポジトリの再編と「harness」

2026年6月に `sdk-typescript` リポジトリはアーカイブされ、`strands-agents/harness-sdk` というモノレポ（`strands-py/`、`strands-ts/`、`site/`）に統合された。README の掲げるコンセプトは「エージェントハーネスを自分で作り、完全に制御する」で、「ホストされたコントロールプレーンを持たず、プロセス内で動く」ことを強調している。

この「ハーネス」を AWS 側でマネージドに提供するのが [[amazon-bedrock-agentcore|Amazon Bedrock AgentCore]] の Harness（Strands で駆動されるマネージドなエージェントループ）で、SDK と AgentCore は「自分でループを回す」か「AWS にループを回してもらう」かの関係にある。

2026年9月時点の最新は Python 1.55 系、TypeScript 1.17 系（Node.js 22 以上）。

## [[nx-plugin-for-aws|Nx Plugin for AWS]] との関係

`ts#agent` / `py#agent` ジェネレータが生成するエージェントのデフォルトフレームワーク。生成されたエージェントは AgentCore Runtime にデプロイされる。

## 出典

- [Introducing Strands Agents, an Open Source AI Agents SDK (AWS Open Source Blog)](https://aws.amazon.com/blogs/opensource/introducing-strands-agents-an-open-source-ai-agents-sdk/)
- [Strands Agents and the Model-Driven Approach (AWS Open Source Blog)](https://aws.amazon.com/blogs/opensource/strands-agents-and-the-model-driven-approach/)
- [Introducing Strands Agents 1.0 (AWS Open Source Blog)](https://aws.amazon.com/blogs/opensource/introducing-strands-agents-1-0-production-ready-multi-agent-orchestration-made-simple/)
- [strands-agents/harness-sdk (GitHub)](https://github.com/strands-agents/harness-sdk) — 現行のモノレポ
- [strands-agents/sdk-python (GitHub)](https://github.com/strands-agents/sdk-python) / [sdk-typescript（アーカイブ済み）](https://github.com/strands-agents/sdk-typescript)
- [AWS open-sources Strands Agents SDK (SiliconANGLE, 2025-05-16)](https://siliconangle.com/2025/05/16/aws-open-sources-strands-agents-sdk-ease-ai-agent-development/)

#aws #ai-agent #アーキテクチャ
