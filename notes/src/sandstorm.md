---
created: 2026-08-20 00:14
updated: 2026-08-20 00:14
---
# Sandstorm

セルフホスト型のWeb生産性スイート。自己紹介は「security-hardened web app package manager（セキュリティを固めたWebアプリのパッケージマネージャ）」で、文書・表計算・ブログ・gitリポジトリ・タスクリストなどのアプリを、スマホにアプリを入れるような手軽さで自分のサーバに入れて使う、というもの。x86-64のLinux上で動くOSS。

Kenton VardaとJade Wangが2014年にクラウドファンディングで立ち上げた。企業としては2017年に終了し、以降はコミュニティプロジェクトとして継続、2024年1月に`sandstorm.org`ドメインへ移った（`sandstorm.io`は歴史的な資料として残されている）。

このノートを書いているのは、**[[cloudflare-os|Cloudflare OS]]がこのSandstormの作り直しだと作者自身が言っているから**。10年前の設計思想がそのまま現在のAIエージェント基盤の土台になっている。

## grain: コンテナ化するのは「サービス」ではなく「データ」

Sandstormの中心概念。アプリのインスタンス1つを**grain**と呼び、その粒度が「1ドキュメント」になっている。

> with Etherpad (a document editor), Sandstorm creates a new Etherpad instance in its own isolated container for every Etherpad document you create.

Etherpad（共同編集エディタ）を入れると、**ドキュメントを1つ作るたびに独立したコンテナのEtherpadインスタンスが1つ立つ**。grainは既定で作成者だけのprivate。

この粒度にする狙いは、アクセス制御を**アプリのコードからプラットフォーム側に移す**こと。

- プラットフォームが強制するのは「アクセスできる／できない」の二値だけ。コンテナ境界がそのまま権限境界になる
- read/write のような細かい権限はアプリ側が実装する
- アプリ開発者は権限管理の大半を書かなくて済み、ユーザー向けの機能に集中できる。アプリ同士の協調も考えやすくなる

「1つのサービスに全ユーザーのデータが入っていて、アプリのコードが正しく権限判定することを祈る」という通常のWebアプリの構図を、そもそも成立させない設計。

## powerbox: 「許可しますか？」ではなく「どれを使いますか？」

> Grains begin life completely isolated from the outside world. To gain access to external capabilities (or to each other), they need to go through the *powerbox*.

grainは生まれた時点で外界から完全に隔離されている。外部リソースや他のgrainに触るには**powerbox**を通す。

powerboxのUIが面白いのは、質問の形が違うところ。「カレンダーへのアクセスを許可しますか？ はい／いいえ」ではなく、「**どのカレンダーを使いますか？**」と聞く。ユーザーがピッカーから選んだ瞬間に、そのリソースへのcapabilityがアプリに渡る。

- アプリはインストール時に「自分がどのAPI（Cap'n Protoのインターフェース）を実装しているか」をプラットフォームに申告する
- あるアプリが「インターフェースFooを実装したcapabilityが欲しい」と要求すると、プラットフォームは**Fooを実装している手持ちのアプリ**からピッカーを描く
- ユーザーが選ぶと、要求元にそのAPIへのcapabilityが渡る

「リソースを指名する操作」と「その権限を与える操作」が1つのUIに統合されている。[[capability-security|capabilityベースのセキュリティ]]の標語「指定と権限を分離するな」を、そのままユーザーインターフェースに落としたもの。ユーザーはホスト名も認証情報も知らなくてよい。

## Cap'n Protoはこのために作られた

Sandstormのcapabilityは、**実装上そのままCap'n Protoのcapability**。Cap'n ProtoのRPCは完全なobject-capabilityプロトコルで、その設計はE言語のネットワークプロトコルCapTP（現代のobject-capabilityモデルを切り拓いた実装）を強く下敷きにしている。

Kenton VardaはGoogleでProtocol Buffersを作った後、その後継としてCap'n Protoを作り、それがSandstormの基盤になった、という順番。つまり**Cap'n Protoは元々「capabilityベースのアプリホスティング基盤を作るため」のRPC**であって、単なる高速シリアライザではない。

[[capnweb|Cap'n Web]]はその系譜のWeb版で、[[cloudflare-os|Cloudflare OS]]のgadgetが使っているのはこちら。

## 隔離の実装

- **サーバ側**: アプリはLinuxのサンドボックス内で動く。seccomp-bpfで不要なシステムコールを潰し、見えるデバイスは`/dev/zero` `/dev/null` `/dev/urandom`だけ。カーネルの攻撃面を大きく削っている
- **クライアント側**: grainごとに**セッション固有のランダムなホスト名**で配信する。オリジンが分かれるのでアプリ同士がブラウザ上でも隔離され、XSRF・reflected XSS・クリックジャッキングの緩和にもなる

「ユーザーが直感的に使えば、望ましいセキュリティ特性が既定で得られる」——セキュリティのことを考えなくて済むようにするのが目標だ、とドキュメントに書かれている。

## Cloudflare OSとの連続性

Kenton Vardaは2017年3月にCloudflareに入社し、[[cloudflare-workers|Workers]]を立ち上げた。Sandstormが企業として終了したのと同じ年。そして2026年8月、Cloudflare OSの公開に際して本人がこう書いている。

https://x.com/KentonVarda/status/2084990137180590572

> Today we are releasing Cloudflare OS, a chatbot with connectors, just like every other tech company is doing. Except actually, it's different. This is a remake of Sandstorm[.]io, my startup from 10 years ago, except this time built on Cloudflare Workers

対応関係を並べるとこうなる。

| Sandstorm (2014–) | [[cloudflare-os|Cloudflare OS]] (2026) |
|---|---|
| **grain** — 1ドキュメント1インスタンス、既定でprivate | **gadget** — 1ユーザー1インスタンス、既定でprivate |
| **powerbox** — 「どのリソースを使うか」をユーザーに選ばせてcapabilityを渡す | **introduction（紹介）** — 使わせたいリソースを都度エージェントに渡す |
| **Cap'n Proto** — intra-system通信の全部 | **[[capnweb|Cap'n Web]]** — gadgetのクライアント／サーバ間通信 |
| アプリパッケージ（`sandstorm-pkgdef.capnp`） | **Blueprint** — コードのスナップショットを配り、各自が自分のコピーを作る |
| Linuxコンテナ + seccomp-bpf | **[[dynamic-workers|Dynamic Worker]]** + サンドボックス化iframe |
| ユーザーが自分のサーバにインストールする | 会社が自分のCloudflareアカウント（またはworkerd）にデプロイする |

10年前と変わった前提は「アプリを誰が書くか」で、Sandstormでは開発者がパッケージを作って配っていたところが、Cloudflare OSでは**利用者がエージェントに書かせる**。1ユーザー1インスタンスという構造は、その変化と噛み合ってむしろ効くようになった——「自分のコピーだから自由に改造してよい」が成立する。

## 出典

- [sandstorm-io/sandstorm README](https://github.com/sandstorm-io/sandstorm)
- [Sandstorm docs: Security practices](https://github.com/sandstorm-io/sandstorm/blob/master/docs/using/security-practices.md) — grain隔離・powerbox・sandboxingの実装
- [Sandstorm docs: Powerbox](https://github.com/sandstorm-io/sandstorm/blob/master/docs/developing/powerbox.md)
- [Sandstorm now belongs to Sandstorm.org](https://sandstorm.io/news/2024-01-14-move-to-sandstorm-org) — コミュニティ運営への移行
- [Kenton Vardaの投稿](https://x.com/KentonVarda/status/2084990137180590572) — Cloudflare OSがSandstormのremakeであること

#セキュリティ #アーキテクチャ #個人開発
