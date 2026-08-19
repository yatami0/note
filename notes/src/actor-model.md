---
created: 2026-08-19 07:07
updated: 2026-08-19 07:07
---
# アクターモデル

並行計算の数学的モデル（Hewitt, Bishop, Steiger, 1973）。「**アクター**」＝自分だけの状態＋メールボックス＋振る舞いを持つ計算主体を最小単位とし、アクター同士は**非同期メッセージの送信でしか相互作用できない**。

アクターはメッセージを1通受け取ったとき、次の3つだけができる:

1. 自分のローカル状態を変える
2. 他のアクター（有限個）へメッセージを送る
3. 新しいアクターを（有限個）生成する

## なぜロックが消えるのか

スレッド＋共有メモリの並行処理では、複数スレッドが同じデータを触るためロック・競合状態・デッドロックとの戦いになる。アクターモデルは前提を逆にする:

- **状態は共有しない**。ある状態を触れるのはそれを持つアクター1人だけ
- **1つのアクター内の処理は直列**。メールボックスから1通ずつ取り出して処理するので、アクター内のコードは並行性を一切考えなくてよい
- 並行性はアクターを**多数**動かすことで得る（1つ1つは直列、全体は並行）

「読んで・判断して・書く」の間に他者が割り込まないことが構造的に保証される。共有メモリモデルで一番難しい部分が、モデルの定義によって消えている。

## 主な実装

- **Erlang/OTP**: 事実上の元祖の産業実装。軽量プロセス（＝アクター）を数百万個動かす。「**Let it crash**」——アクター内でエラーを防御的に握り潰さず、クラッシュさせて**スーパーバイザ**（監視アクター）が再起動する、という障害設計の哲学が有名。電話交換機由来で、ElixirやWhatsAppの基盤
- **Akka** (JVM) / **Akka.NET**: Scala/Java向けツールキット。分散クラスタ化まで含む
- **Orleans** (.NET): Microsoftの「**virtual actor**」モデル。アクターは「常に存在する」ように見え、参照すると必要に応じて活性化され、使われなければ勝手に休眠する。開発者はアクターのライフサイクル管理と配置から解放される。Halo のバックエンドで実証された
- **[[durable-objects|Durable Objects]]**: virtual actorの系譜のエッジ版。「IDで引くと存在し、単一インスタンスで直列処理され、使われなければ休眠する」はOrleansの発想そのもの＋永続ストレージ

## 向き・不向き

- **向く**: 独立したエンティティが多数あって、それぞれの内部で整合性が要る問題——チャットルーム、ゲームのセッション、IoTデバイスの影（digital twin）、ユーザーごとのワークフロー
- **不向き**: 全体を横断する集計・大規模なジョイン（1アクターに集めるとそこが直列ボトルネックになる）、厳密な順序が複数アクターにまたがる処理（メッセージは非同期で、順序保証は同一ペア間程度）

## 出典

- [Hewitt, Bishop, Steiger: A Universal Modular ACTOR Formalism for Artificial Intelligence (IJCAI 1973)](https://www.ijcai.org/Proceedings/73/Papers/027B.pdf)
- [Erlang: Supervision Principles](https://www.erlang.org/doc/system/sup_princ.html)
- [Orleans: Distributed Virtual Actors for Programmability and Scalability (MSR)](https://www.microsoft.com/en-us/research/publication/orleans-distributed-virtual-actors-for-programmability-and-scalability/)

#並行処理 #分散システム #プログラミングモデル
