---
created: 2026-08-19 02:25
updated: 2026-08-19 02:25
---
# OIDC (OpenID Connect)

OAuth 2.0の上に載る**認証（Authentication）のレイヤー**。OAuth自体は「認可（Authorization）＝リソースへのアクセス権の委譲」のフレームワークであって、「いま操作しているのが誰か」を証明する仕組みを持たない。その穴を標準化して埋めたのがOIDC。

## OAuthを「ログイン」に流用してはいけない理由

OIDC以前、「アクセストークンが取れた＝ログイン成功」とみなす自己流ソーシャルログインが横行したが、これは脆弱:

- アクセストークンは「**このAPIを叩いてよい**」の証明であって「**この人が本人である**」の証明ではない
- アクセストークンには宛先（クライアント）の概念が薄く、**別のアプリに発行されたトークンを持ち込まれても区別できない**（token substitution）。悪性アプリが自分のユーザーのトークンを他サイトのログインに流用できてしまう

OIDCはこれを**IDトークン**という専用の証明書で解決した。

## IDトークン vs アクセストークン

| | IDトークン | アクセストークン |
|---|---|---|
| 目的 | **認証イベントの証明**（誰が・いつ・どうやってログインしたか） | APIアクセスの認可 |
| 宛先（aud） | **クライアント**（RP） | API（リソースサーバ） |
| 検証する者 | クライアント自身（署名・iss・aud・exp・nonce） | API側（[[oauth-resource-server]]） |
| 形式 | 必ずJWT | 実装依存（JWTが多いが不透明トークンもある） |
| APIに送ってよいか | **送らない**（audが違う） | 送る（本来の用途） |

`sub`（ユーザー識別子）・`iss`・`aud`・`exp`・`iat`・`nonce`に加え、`email`や`name`等の標準クレームが定義されている。

## OAuthに追加されたもの

- **IDトークン**: 上記
- **`openid`スコープ**: これを付けた認可コードフローがOIDCのフローになる（`profile` `email`等で取得クレームを広げる）
- **UserInfoエンドポイント**: アクセストークンでユーザー属性を取得するAPI
- **Discovery**: `/.well-known/openid-configuration`にエンドポイント一覧・対応機能・`jwks_uri`（[[jwks-key-rotation|JWKS]]の場所）を公開する仕組み。クライアントは設定値1つ（issuer URL）で自動構成できる
- **nonce**: 認可リクエストで送り、IDトークンに載って返るリプレイ対策。[[pkce|PKCE]]と保護対象が重なる部分がある（OAuth 2.1ドラフトがconfidential client + nonceをPKCE例外として扱うのはこのため）

用語: OIDCでは認証を提供する側を**OP**（OpenID Provider、いわゆるIdP）、受ける側のアプリを**RP**（Relying Party）と呼ぶ。

## フローは認可コードフローがそのまま使われる

OIDCの標準フローは**Authorization Code Flow（+[[pkce|PKCE]]）**で、OAuthのフローに`openid`スコープとIDトークンが加わった形。かつてのImplicit Flowと同様、IDトークンをフラグメントで受けるハイブリッド系は現在は非推奨方向。[[oidc-federation|IDフェデレーション]]・SSOはこのフローの応用であり、[[bff-pattern|BFF]]がconfidential clientとしてOIDCでログインを受けるのが業務アプリの定石。

## [[web-auth-moc|Webアプリ認証認可MOC]]の中での位置づけ

「認可のOAuth」と「認証のOIDC」の区別を与える基盤ノート。[[oidc-federation]]はこのプロトコルの組織間応用、[[oauth-client-credentials]]は逆に「認証すべき人間がいない」場合のグラント。

## 出典

- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [oauth.net: User Authentication with OAuth 2.0（OAuthを認証に使う問題の解説）](https://oauth.net/articles/authentication/)

#認証認可 #oidc #oauth
