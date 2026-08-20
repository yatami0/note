---
created: 2026-08-19 23:48
updated: 2026-08-20 00:21
---
# Cap'n Web

JavaScriptネイティブのRPCシステム。Cap'n Protoと同じ作者（Kenton Varda）による「精神的な兄弟」で、Webスタックに合わせて作り直したもの。Cap'n Protoはもともと[[sandstorm|Sandstorm]]というcapabilityベースのアプリホスティング基盤のために作られたRPCで、その系譜がここまで繋がっている。[[cloudflare-os|Cloudflare OS]]ではgadgetのクライアント／サーバ間通信に**必須の通信手段**として使われている。

## 何が違うのか

Cap'n Protoとの主な差:

- **スキーマ不要** — `.capnp`のようなIDLを書かない。Workers組み込みのJavaScriptネイティブRPCと同じ感覚で使える
- **人間が読めるシリアライズ** — バイナリではなく、JSONに軽い前処理・後処理を掛けたもの
- **トランスポートを選ばない** — HTTP、WebSocket、`postMessage()`の上で動き、独自トランスポートも足せる
- **小さい** — minify+gzipで10kB未満、依存ゼロ。ブラウザ・Workers・Node.js・Bun・Denoで動く

TypeScriptのスキーマ推論とは統合されているので、スキーマレスでも型は効く。

## 基本形

サーバ側は`RpcTarget`を継承したクラスを公開する。

```js
import { RpcTarget, newWorkersRpcResponse } from "capnweb";

class MyApiServer extends RpcTarget {
  hello(name) {
    return `Hello, ${name}!`;
  }
}

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api") {
      return newWorkersRpcResponse(request, new MyApiServer());
    }
    return new Response("Not found", { status: 404 });
  }
};
```

クライアント側はローカル関数を呼ぶのとほぼ同じ。

```js
import { newWebSocketRpcSession } from "capnweb";

const api = newWebSocketRpcSession("wss://example.com/api");
const result = await api.hello("World");
```

## object-capabilityプロトコルであること

ここがこのライブラリの本質で、単なるRPCではなく[[capability-security|object-capabilityモデル]]の実装になっている。

- **参照渡し** — `RpcTarget`を継承したクラスのインスタンスは、値ではなく**参照**として相手に渡る。受け取った側はプロトタイプのメソッドとgetterしか触れない（インスタンスプロパティは見えない）
- **関数もcapability** — 関数をRPCで渡すと相手にはstubが渡り、呼ぶと元の場所にコールバックが飛ぶ。サーバがクライアントのコールバックを保持して後から呼ぶ、といったことができる
- **双方向** — クライアントがサーバを呼ぶだけでなく、サーバがクライアントを呼べる
- **権限は参照の受け渡しで制御する** — `authenticate()`が`AuthedApi`という**別のオブジェクト参照**を返す設計にすれば、認証済みでしかできない操作はその参照を持っている側にしか露出しない

```ts
class ApiServer extends RpcTarget {
  authenticate(apiToken: string): AuthedApi {
    return new AuthedApiServer(apiToken);   // 権限そのものを参照として返す
  }
}
```

`stub`はグローバルな識別子を持たず偽造できない、という性質が[[dynamic-workers|Dynamic Workers]]のbindingでもそのまま効いている。

## promise pipelining

分散システム的に一番効く機能。RPCの戻り値（`RpcPromise`）を**awaitせずに次の呼び出しの引数に渡せる**ので、依存関係のある複数の呼び出しが**1往復**で済む。

```ts
const api = newHttpBatchRpcSession<PublicApi>("https://example.com/api");

// awaitしない
const authedApi = api.authenticate(apiToken);
const userIdPromise = authedApi.getUserId();
const profilePromise = api.getUserProfile(userIdPromise);
const friendsPromise = authedApi.getFriendIds();

const friendProfilesPromise = friendsPromise.map((id) => {
  return { id, profile: api.getUserProfile(id) };
});

// ここで初めて往復が発生する（バッチ全体で1回）
const [profile, friendProfiles] =
  await Promise.all([profilePromise, friendProfilesPromise]);
```

「認証 → ユーザーID取得 → プロフィール取得 → 友達一覧 → 各友達のプロフィール」を素朴なRESTで書けばN+1往復になるところが1往復になる。RESTやGraphQLで「まとめて取るためのエンドポイントを設計する」問題を、プロトコル側で解いている形。

## リソース管理と注意点

- **stubの破棄は呼び出し側の責任**。分散環境でのライフサイクル管理があるので、JavaScriptのリソース管理構文（`using`）を使う前提の設計になっている。コールバック等を呼び出しの寿命を超えて保持したい場合は`dup()`する
- 認証はcookieではなく**RPCメソッドによるin-band認証**を推奨（WebSocketではcookieの扱いに制限があるため）
- 高コストな操作にはレートリミットを掛ける
- 信頼できない入力の検証にはZodのような実行時型チェックを併用する

## なぜCloudflare OSがこれを強制するのか

[[cloudflare-os]]では、gadgetのクライアントとサーバの通信をCap'n Web RPCに限定している。理由は2つあるとREADMEに書かれている。

1. ボイラープレートが極端に少ないので、**エージェントが書きやすい**（サーバにメソッドを定義してクライアントから呼ぶだけ）
2. その結果、サーバ側は必然的に**理解しやすいAPIを露出する**ことになる。エージェントはそのAPIをそのまま叩けるので、[[mcp|MCP]]サーバを別途書かなくても「作ったアプリの中でAIと共同作業する」が成立する

[[code-mode|Code Mode]]でツール呼び出しの代わりにコードを書かせる方式と噛み合っていて、gadgetのAPIはそのままサンドボックス内から呼べる対象になる。

## [[ai-agent-moc]]の中での位置づけ

「権限をどう渡すか」の通信層。参照を渡すことがそのまま権限の委譲になるので、[[capability-security]]の原則がAPIの形として現れる。

## 出典

- [cloudflare/capnweb README](https://github.com/cloudflare/capnweb)
- [cloudflare/cloudflare-os README](https://github.com/cloudflare/cloudflare-os) — gadgetがCap'n Webを必須とする理由

#cloudflare #アーキテクチャ #ai-agent #分散システム
