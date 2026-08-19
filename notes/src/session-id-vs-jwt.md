---
created: 2026-08-18 14:03
updated: 2026-08-18 14:03
---
# セッションIDとJWTの違い

混同されやすいが別の概念。本質は **reference（参照）vs self-contained（自己完結した証明）** の違い。

| | セッションID | JWT（アクセストークン） |
|---|---|---|
| 正体 | ランダムな文字列。**それ自体に意味はない** | 署名付きのJSON。**中身にユーザー情報や権限が入っている** |
| 性質 | **reference（参照）** — サーバ側の状態（Redis等）を指すだけ | **capability（能力）** — 持っているだけで行使できる |
| 検証方法 | サーバがストアを引いて確認 | 署名検証のみ（ストア参照不要＝ステートレス。詳細は[[jwt-stateless-availability]]） |
| 失効 | サーバ側で消せば**即時失効** | **有効期限まで失効できない**（詳細は[[token-revocation]]） |
| 漏洩時 | サーバが消せば無力化できる | 期限まで攻撃者が使い放題 |

## 独立した2つの軸を混同しない

「セッションID vs JWT」を考えるとき、暗黙に2つの軸が混ざりがち。分離して考えること。

| 軸 | 選択肢 |
|---|---|
| **軸1: 資格情報の形式** | reference（セッションID） vs self-contained（JWT） |
| **軸2: 資格情報の置き場所** | ①サーバのみ（ブラウザにはセッションCookie） / ②ブラウザの**HttpOnly Cookie** / ③ブラウザの**JSが読める場所**（memory/localStorage） |

危険性を決めるのは軸1（形式）ではなく**軸2（置き場所）**。「JWT＝危険」という認識は「JWT＝localStorageに置くもの」という古いSPA実装の印象に引きずられている。JWTをHttpOnly Cookieに入れる[[stateless-session|ステートレスセッション]]という正当な構成が存在する。

| 構成 | 軸1 | 軸2 | ステートレス | XSSでの持ち出し | 即時失効 |
|---|---|---|---|---|---|
| [[bff-pattern|BFF]]+Redisセッション | reference | ① | ✗ | 不可 | **可** |
| [[stateless-session|ステートレスセッション]]（JWT in HttpOnly Cookie） | JWT | ② | **○** | 不可（読めない。相乗りは可） | **不可** |
| SPA+ブラウザ保持トークン | JWT | ③ | ○ | **可** | 不可 |

本当のトレードオフは「セッションID vs JWT」ではなく、**「即時失効を取る（①）か、ストアレス運用を取る（②）か」**。③はどちらの利点のためにも必要ない。

## 「JWTを使うか」と「ブラウザに出すか」も別の軸

BFF構成でも、BFF→バックエンドAPI間の認証にJWTを使ってよい。その場合JWTは**サーバ内にのみ存在**し、ブラウザにはHttpOnlyのセッションCookieだけが渡る。人間のブラウザセッションは失効要件が支配的だからステートフルに、サービス間はストアを共有できないからステートレスJWTに——**層ごとに最適解が違う**（[[oauth-resource-server]]参照）。

## 「引換券だから安全」という誤解

「セッションIDはただの引換券だから、盗まれても大したことない」は誤り。セッションIDは**BFFに対する全権のbearer credential（持参人払い証券）**であり、盗んだ攻撃者はそのユーザーとして何でもできる。クロークの引換券を盗んだ人間はコートを着て帰れる。

資格情報の危険度は次の3要素の積で考えるのが正確:

> **危険度 = ①提示された側が与える権限 × ②盗める場所の広さ × ③盗まれてから止めるまでの時間**

セッションID（HttpOnly Cookie）と暗号化JWT Cookieは①②が完全に同一で、差は**③（失効できるか）だけ**。「引換券は無害・本体は危険」というメンタルモデルではなく、この3要素で評価する。

## [[web-auth-moc|Webアプリ認証認可MOC]]の中での位置づけ

全議論の土台になる基礎概念。ここの2軸の分離ができていないと以降の比較がすべて歪む。

## 出典

- [OAuth 2.0 for Browser-Based Applications (IETF draft)](https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-26.html)
- [RFC 7519: JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
- [Auth.js: Session strategies](https://authjs.dev/concepts/session-strategies)

#認証認可 #jwt #セキュリティ
