---
created: 2026-08-19 05:55
updated: 2026-08-19 07:07
---
# Durable Objects

[[cloudflare-workers|Cloudflare Workers]]のステートフル版プリミティブ。あるIDに対して**世界でただ1つのインスタンス**が起動し、そのIDへのリクエストはどの拠点から来ても全て同じインスタンスにルーティングされる。「エッジのどこでも動く」Workersに対して、「**1箇所に集めて調整する**」役割を担う。

## なぜ必要か: エッジでは「集める」ことが逆に難しい

エッジ環境は分散が前提で、同じアプリが世界中で同時に動く。KVは結果整合（書き込みが全拠点に伝播するまでラグがある）なので、**複数クライアントが同じ状態を同時に触る処理**——カウンタ、チャットルーム、共同編集、レートリミット——が正しく書けない。Durable Objectsは「この状態の正はここ」という単一の合流点を作る仕組み。

| | KV | Durable Objects |
|---|---|---|
| 整合性 | 結果整合（読み取り特化） | **強整合** |
| 実行モデル | なし（ただのストア） | ストレージ＋**コード**が一体 |
| 同時アクセス | 各拠点で並行 | **単一インスタンス・実質シングルスレッド** |
| 向く用途 | 設定・キャッシュ | 調整・リアルタイム協調 |

シングルスレッドで直列に処理されるため、ロックや競合状態を考えずに「読んで・判断して・書く」が書ける（[[actor-model|アクターモデル]]。特にOrleansのvirtual actorの系譜）。

## 使い方の骨格

クラスとして定義し、名前やIDからstubを取ってメソッドを呼ぶ:

```js
// ルーム名 → そのルーム専用のインスタンス
const id = env.CHAT_ROOM.idFromName("room-42");
const stub = env.CHAT_ROOM.get(id);
const res = await stub.fetch(request);
```

- 「エンティティ1つにつきインスタンス1つ」が設計単位（ルームごと・ユーザーごと・ドキュメントごと）。1個のDOに全トラフィックを集めるとそこがボトルネックになるので、**細かく分割してスケールさせる**
- 各インスタンスは**組み込みのSQLiteデータベース**を持つ（現在推奨のストレージバックエンド。SQL APIとポイントインタイムリカバリが使える）。インスタンスは休止・再起動してもストレージは永続
- **Alarms**: 自分自身を将来の時刻に起こす予約ができる（外部cronなしのリマインダ・遅延処理）

## WebSocket Hibernation

リアルタイムアプリの定番機能。DOはWebSocket接続の終端になれるが、素朴にやると接続維持中ずっと課金される。Hibernation APIを使うと**クライアントの接続は張ったままDO本体はスリープ**し、メッセージ到着時に起こされる。チャット・共同編集（Yjsのバックエンド等）・ゲームロビーがこれで安価に組める。

## 個人開発での位置づけ

- 無料プランでも使える（SQLiteバックエンド。ストレージは無料枠合計5GBまで、課金は2026年1月から有効化された）
- 「WebSocketサーバを立てたいがVPSを管理したくない」に対する現実解。Workersだけでは詰まる「状態の置き場」問題（[[cloudflare-workers]]参照）の答えがこれ
- 対比: 認証のような「各エッジが独立に検証できる」処理は[[stateless-session|ステートレス]]に寄せ、「合流が必要な状態」だけDOに寄せる、という使い分けになる

## [[cloudflare-moc|Cloudflare MOC]]の中での位置づけ

Workersスタックの「調整役」。一般的なリレーショナルデータは[[cloudflare-d1|D1]]（実装的にはDOの上に載っている）、ファイルは[[cloudflare-r2|R2]]。

## 出典

- [Cloudflare Docs: Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Docs: Durable Objects — Use WebSockets（Hibernation）](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare Docs: Durable Objects — Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

#cloudflare #serverless #分散システム #個人開発
