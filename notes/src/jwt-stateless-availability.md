---
created: 2026-08-18 14:03
updated: 2026-08-19 02:25
---
# JWTのステートレス性と可用性

「JWTは署名検証のみだからステートレスで可用性が高い」の原理の整理。

## ステートフル（セッションID）: 毎リクエストでストアI/O

セッションIDはただの乱数で、それ自体は何も証明しない（[[session-id-vs-jwt]]）。「このIDは有効か？誰のものか？」に答えるには、**毎リクエスト、サーバがストアに問い合わせる**しかない。

```mermaid
sequenceDiagram
    participant C as クライアント
    participant S as APIサーバ（何台あってもよい）
    participant R as Redis（セッションストア）

    C->>S: リクエスト + sid=a8f3...
    Note over S: sidは乱数。単体では何も分からない
    S->>R: GET session:a8f3...
    R-->>S: { user: "tanaka", roles: [...] }
    Note over S,R: 毎リクエストで必ずI/Oが発生<br/>Redisが死ぬ＝全認証が死ぬ
    S-->>C: レスポンス
```

## ステートレス（JWT）: 検証時に外部I/Oゼロ

JWTは「ペイロード（誰で、何の権限で、いつまで有効か）＋発行者の署名」が一体。検証に必要なのは**発行者の公開鍵だけ**で、公開鍵（[[jwks-key-rotation|JWKS]]）は事前に取得してメモリにキャッシュできる。

```mermaid
sequenceDiagram
    participant C as クライアント
    participant S as APIサーバ（何台あってもよい）
    participant AS as 認可サーバ

    Note over S,AS: 起動時に1回だけ: 公開鍵(JWKS)を取得しキャッシュ
    S->>AS: GET /.well-known/jwks.json
    AS-->>S: 公開鍵

    C->>S: リクエスト + JWT (eyJ...)
    Note over S: ローカルで完結:<br/>① 署名を公開鍵で検証<br/>② exp（期限）確認<br/>③ ペイロードからuser/roles読取<br/>外部I/Oゼロ
    S-->>C: レスポンス
    Note over C,AS: 以後、認可サーバが落ちていても<br/>発行済みJWTの検証は続行できる
```

## 「可用性が高くなる」の正確な意味

絶対的に可用性が上がるのではなく、**認証経路から依存コンポーネントが消える**ということ:

- ステートフル: `認証の可用性 = APIサーバ × セッションストア`（Redisが可用性の掛け算に入る）
- ステートレス: `認証の可用性 = APIサーバ`（検証時は認可サーバの生死すら関係ない）

スケール面でも、サーバを何台に増やしてもストアの共有・整合を考えなくてよい（各サーバが公開鍵だけ持てば独立に検証できる）。

## 対価は「即時失効の喪失」

署名検証だけで通す＝**発行済みトークンを止める手段がexp（期限切れ）しかない**。失効させたければdenylistを全サーバが参照することになるが、それは毎リクエストのストア参照の復活＝ステートレス性の放棄に他ならない。**ステートレス性と即時失効性は原理的にトレードオフ**。詳細は[[token-revocation]]。

## 層ごとに最適解が違う

- **人間のブラウザセッション**: 失効要件が支配的 → ステートフル（[[bff-pattern|BFF]]+Redis）。リクエスト頻度も人間の操作速度なのでストア参照コストは無視できる
- **サービス間API呼び出し**: 組織をまたいでストアを共有できない／呼び出し頻度が高い／クライアントは「アプリ」なので退職者失効のような要件が薄い → **ステートレスJWT（短命AT）が最適**（[[oauth-resource-server]]）

「Web UIはセッション、API層はJWT」は矛盾ではなく、この原理に従って層ごとに使い分けた結果。

## [[web-auth-moc|Webアプリ認証認可MOC]]の中での位置づけ

「なぜAPI層はJWTでWeb層はセッションなのか」に答える原理ノート。裏面のトレードオフは[[token-revocation]]。

## 出典

- [RFC 7519: JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
- [OAuth 2.0 for Browser-Based Applications draft-26](https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-26.html)

#認証認可 #jwt #可用性
