---
created: 2026-08-20 00:22
updated: 2026-08-20 00:22
---
# Server-Sent Events (SSE)

HTTPレスポンスを閉じないまま、サーバからクライアントへテキストのイベントを流し続ける**片方向**のストリーミング。`Content-Type: text/event-stream`を返し、あとは通常のHTTPレスポンスボディを少しずつ書き続けるだけ。LLMの応答を1トークンずつ表示する用途で事実上の標準になっている。

## ワイヤフォーマット

行指向のテキストで、**空行が1イベントの区切り**。

```
event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"こん"}}

: これはコメント（keep-alive用）

data: 複数行の
data: データは行を分けて書く
```

- `data:` — 本体。複数行書くと改行で連結される
- `event:` — イベント名（省略時は`message`）
- `id:` — イベントID。クライアントが最後に受け取ったIDを覚える
- `retry:` — 再接続までのミリ秒
- `:`で始まる行はコメント。何も送るものがない時間帯に接続を維持する目的で使う

エンコーディングはUTF-8。JSONを`data:`に載せるのが通例だが、SSE自体はただのテキスト行なのでJSONは必須ではない。

## EventSourceはチャットには使いにくい

ブラウザには`EventSource`という専用APIがあり、自動再接続と`Last-Event-ID`ヘッダによる再開まで面倒を見てくれる。ただし制約が強い。

- **GETしか投げられない**（リクエストボディが無い）
- **カスタムヘッダを付けられない**

チャットは「会話履歴をPOSTして、その応答をストリームで受け取る」形なので、この時点で`EventSource`は使えない。URLに詰め込む手もあるが長さの上限に当たる。

そこで実際には **`fetch` + `ReadableStream`でレスポンスボディを読み、SSEを自前でパースする**のが定番になる。代わりに`EventSource`が持っていた自動再接続・`Last-Event-ID`の管理・イベントのパースを全部自分で書くことになる。この落差を理解しておかないと「SSEなら再接続は勝手にやってくれる」と誤解する。

認証については、Cookieならブラウザが勝手に付けるので`EventSource`でも通る（[[worker-protected-api|Cloudflare Accessで保護したAPI]]はまさにCookieベース）。「認証ヘッダが付けられない」問題はCookieで回避できるが、**POSTできない制約は残る**。

## WebSocketとの使い分け

サーバからの一方通行で足りるならSSEでよい。SSEはただのHTTPレスポンスなので、既存の認証・プロキシ・リバースプロキシ・HTTPキャッシュ制御がそのまま効く。双方向の低遅延通信（共同編集、ゲーム）が要るならWebSocketで、その場合の状態の置き場は[[durable-objects|Durable Objects]]の領分になる。

チャットUIは、見た目に反して**送信は普通のリクエスト・受信だけがストリーム**なので、SSEで足りることがほとんど。

## エッジで中継するときの性質

[[cloudflare-workers|Workers]]のようなエッジランタイムでLLM APIを中継する場合、上流のレスポンスボディをそのまま返せば中継になる（バッファせずに素通しできる）。

ここで効いてくるのが**CPU時間とウォールクロックの区別**。Workersの制限はCPU時間で、`fetch`の応答を待っている時間は計上されない。LLMの応答を数十秒待つような処理でも、待ちの間はCPUを使っていないので制限に当たりにくい。クライアントが繋がっている限りレスポンスボディを流し続けられる。

逆に、届いたチャンクを毎回JSONパースして加工するような中継はCPU時間を食う。素通しで済むなら素通しにする。

## 踏みやすい罠

- **HTTP 200でもストリームの途中でエラーが来る。** Anthropic の Messages API は、混雑時に`event: error`＋`overloaded_error`をストリーム内で送ってくる（非ストリーミングなら529相当）。「ステータス200が返った＝成功」ではないので、ストリームの中身まで見てエラー処理する。
- **中間プロキシのバッファリング。** どこかがレスポンスをバッファすると、全部終わってから一気に届く（＝ストリーミングの意味が消える）。動かないときはまずここを疑う。
- **ハートビートを送らないと切られる。** 無通信が続くとアイドルタイムアウトで切断されうるので、コメント行（`: ping`）を定期的に流す。Messages APIのストリームにも`ping`イベントが混ざる。

## Claude Messages APIのイベント列

参考までに、実際に流れてくる順番。

```
message_start → content_block_start → content_block_delta（多数）
→ content_block_stop → message_delta → message_stop
```

テキストは`content_block_delta`の`text_delta`に少しずつ乗る。思考は`thinking_delta`、ツール入力は`input_json_delta`と、デルタの型で流れが分かれる。間に`ping`が挟まる。

## このサイトでの使いどころ

[[note-llm-chat-design]]のチャットは、`/api/chat`（Worker）が上流のSSEをそのまま中継し、ブラウザは`fetch`+`ReadableStream`で読む形になる。

## 出典

- [Anthropic Docs: Streaming Messages](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Cloudflare Docs: Workers limits（CPU時間とウォールクロック）](https://developers.cloudflare.com/workers/platform/limits)

#llm #フロントエンド #http
