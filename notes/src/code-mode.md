---
created: 2026-08-19 23:48
updated: 2026-08-20 00:14
---
# Code Mode

LLMにツールを直接呼ばせるのではなく、**ツール群をTypeScript APIとして提示して、それを呼ぶコードを書かせ、サンドボックスで実行する**というエージェントの作り方。Cloudflareが2025年9月の "Code Mode: the better way to use [[mcp|MCP]]" で提唱し、`@cloudflare/codemode`パッケージと[[dynamic-workers|Dynamic Workers]]で実装している。[[cloudflare-os|Cloudflare OS]]のエージェントもこの方式。

## なぜコードのほうが上手いのか

主張の中心はシンプルで、**LLMはツール呼び出しよりコードを書くほうが得意**だから。学習データには実世界のオープンソースコードが何百万行も入っている一方、合成的なツール呼び出し形式の例は相対的に乏しい。ならば得意な形式で書かせればよい、という理屈。

```js
// LLMが書くのはこういうコード
async () => {
  const weather = await codemode.getWeather({ location: "London" });
  if (weather.includes("sunny")) {
    await codemode.sendEmail({
      to: "team@example.com",
      subject: "Nice day!",
      body: `It's ${weather}`
    });
  }
  return { weather, notified: true };
};
```

従来のツール呼び出しだと、この「天気を取る → 内容を判定する → 条件次第でメールする」を**LLMとの往復3回**でやることになる。しかも中間結果（天気の生データ）は必ずLLMのコンテキストを経由する。Code Modeでは分岐もループもフィルタもサンドボックス内で完結し、**最終結果だけが戻る**。

## トークンの効きかた

Cloudflareのブログによると、MCPサーバをTypeScript APIに変換するだけでトークン使用量が81%削減できたケースがあり、Cloudflare API全体を公開する新しいMCPサーバは**2つのツール・1,000トークン未満**で済んでいる。効いている要素は2つ。

1. **ツール定義をプロンプトに全部載せない** — 型定義に圧縮する、あるいは検索で必要な分だけ引く
2. **中間データをLLMに通さない** — 100件取ってきて3件に絞る処理は、サンドボックス内のコードでやればLLMは3件しか見ない

## 2つのパターン

Cloudflareのドキュメントは、MCPサーバ側の実装として2つの型を挙げている。

| | single code tool | search and execute |
|---|---|---|
| API | `codeMcpServer()` | `openApiMcpServer()` |
| 露出するツール | `code` 1つ | `search` と `execute` の2つ |
| ツール定義の置き場所 | `code`ツールのdescriptionに全上流ツールのTypeScript定義を埋め込む | OpenAPIドキュメント**丸ごとをサンドボックス内**に置き、検索でヒットした分だけがモデルのコンテキストに入る |
| 向く相手 | 手に負えるサイズの既存MCPサーバ | 巨大なAPIカタログ |

## 実装の流れ

`@cloudflare/codemode`の場合、`createCodeTool`にツール群とExecutorを渡すと、LLMに見せる単一のツールが返る。

```ts
import { createCodeTool } from "@cloudflare/codemode/ai";
import { DynamicWorkerExecutor } from "@cloudflare/codemode";

const executor = new DynamicWorkerExecutor({ loader: env.LOADER });
const codemode = createCodeTool({ tools, executor });

const result = streamText({ model, messages, tools: { codemode } });
```

内部で起きていること:

1. ツール定義からTypeScriptの型定義を生成し、LLMが読める説明文を組み立てる
2. LLMが`codemode.toolName(args)`を呼ぶasync arrow functionを書く
3. コードをAST（acorn）で正規化する。markdownのコードフェンスを剥がしたり、関数の形を整えたりもここ
4. `DynamicWorkerExecutor`がWorker Loaderで隔離Workerを立ち上げ、名前空間ごとに`ToolDispatcher`を置く
5. サンドボックス内では名前空間ごとの`Proxy`が呼び出しを横取りし、Workers RPC経由でホスト側に戻す
6. コンソール出力も捕捉して結果と一緒に返す

Executorは`execute(code, providers)`だけの最小インターフェースなので、Dynamic Workerの代わりにNode VM・QuickJS・コンテナ・ブラウザのiframe（`IframeSandboxExecutor`）でも実装できる。

## ネットワークは既定で遮断

`DynamicWorkerExecutor`の既定は`globalOutbound: null`で、サンドボックス内の`fetch()`と`connect()`はランタイムレベルで塞がれている。外の世界に触る唯一の経路は、渡された名前空間のツール呼び出しだけ。[[capability-security|capabilityベースのセキュリティ]]の形をそのまま取っている。

`Fetcher`を渡せば、ホスト側のWorkerを経由した制御付きの外向き通信を許すこともできる（[[dynamic-workers]]のegress control）。

## 名前空間・コネクタ・スニペット

- **ToolProvider** — ツール群に名前空間を与えて合成する仕組み。`codemode.*`に加えて`state.*`（ファイルシステム）、`db.*`のように並べられ、LLMは1つのコードブロックの中で全部使える
- **Connector** — 外部サービスをサンドボックスに橋渡しするクラス。`McpConnector`はMCPサーバをラップして各ツールをメソッドにし、`OpenApiConnector`はOpenAPI仕様を**ホスト側で1回だけ**読んでオペレーションごとの型付きツールを導出する（ホスト側で導出するのでプロンプトのトークンを消費しない）
- **承認とロールバック** — ツール定義に`requiresApproval: true`を付けると実行が一時停止し、`runtime.approve()` / `reject()` / `rollback()`で解決する。`revert`を書いておけば取り消しもできる
- **Snippet** — 実行したスクリプトのうち有用なものをホスト側が`saveSnippet`で永続化し、以降モデルが`codemode.run("list-open-prs")`と名前で呼べる。スニペットはconnectorの組み合わせから導かれるfacet上に置かれるので、**書かれた時と同じconnector群に対してしか実行されない**

## 制約

- 実行できるのはJavaScriptのみ
- `DynamicWorkerExecutor`はCloudflare Workers環境が前提
- ブラウザiframe実行のタイムアウトは`while (true) {}`のような同期の無限ループを止められない（イベントループが塞がるため）
- パッケージ自体がexperimental扱いで、破壊的変更がありうる

## MCPとの関係

Code ModeはMCPを否定するものではなく、**MCPの上に被せる使い方**。MCPサーバは「LLMに直接見せるツールのカタログ」ではなく「サンドボックスから呼べるAPIの供給源」になる。逆にCode Mode自体をMCPサーバとして公開することもでき、その場合クライアントから見えるツールは`code`だけ（あるいは`search`/`execute`の2つだけ）になる。

## 出典

- [Code Mode: the better way to use MCP（Cloudflare Blog）](https://blog.cloudflare.com/code-mode/)
- [Code Mode: give agents an entire API in 1,000 tokens（Cloudflare Blog）](https://blog.cloudflare.com/code-mode-mcp/)
- [Cloudflare Docs: Code Mode MCP server patterns](https://developers.cloudflare.com/agents/model-context-protocol/codemode/)
- [`@cloudflare/codemode` README](https://github.com/cloudflare/agents/tree/main/packages/codemode)

#ai-agent #アーキテクチャ #cloudflare
