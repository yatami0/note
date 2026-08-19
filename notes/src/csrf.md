---
created: 2026-08-18 14:03
updated: 2026-08-18 14:03
---
# CSRF（クロスサイトリクエストフォージェリ）

**CSRFは「Cookieを認証に使うこと」に付随する脅威**。Cookieの中身がセッションIDかJWTかは無関係。

- 原理: Cookieはブラウザが**宛先ドメインに自動で付ける**。攻撃者サイトが `POST https://our-app/api/transfer` を発火させると、被害者のCookieが勝手に付いて飛ぶ。中身が乱数だろうがJWTだろうが同じように付く
- したがって[[bff-pattern|BFF]]のセッションがRedis型（1a）でも[[stateless-session|暗号化Cookie型]]（1b）でも、CSRF対策は**全く同じだけ**必要。「JWT-Cookieにしたから増える脅威」ではない

## 対策

[[oauth-browser-based-apps|IETFドラフト]]はBFFに対して「The BFF MUST implement a proper CSRF defense」を要求。手段:

1. `SameSite=Strict`（クロスサイトからのCookie送信自体を止める。Laxでも変更系POSTは概ね守れる）
2. CORS + カスタムヘッダ要求（プリフライトで弾く）
3. anti-forgeryトークン（double-submit等）
4. Origin/Refererヘッダ検証

Next.js補足: Server Actionsは**Origin/Hostヘッダ検証が組み込み**。Route Handlerの変更系（POST/PUT/DELETE）には自前でOriginチェックかCSRFトークンを足す。

## XSSとのトレードオフの正確な姿

Bearer-in-JS方式（JSが`Authorization`ヘッダを手で付ける）はCSRF**耐性が構造的に高い**（Cookieの自動送信に依存しないため）。つまり:

> **Cookie方式はXSS持ち出しに強くCSRFの手当てが必要。Bearer-in-JS方式はCSRFに強くXSS持ち出しに無力。**

そしてCSRFには`SameSite`という決定的で安価な対策があるのに対し、[[xss-token-theft|XSS持ち出し]]には決定的な対策がない——だからIETFはCookie側（BFF）を推奨している。

## [[web-auth-moc|Webアプリ認証認可MOC]]の中での位置づけ

Cookie認証を選んだ瞬間に必ず付いてくる宿題。[[xss-token-theft]]と対で「どちらの脅威に構造的に強い方式を選ぶか」の議論を構成する。

## 出典

- [OAuth 2.0 for Browser-Based Applications draft-26（CSRF要件）](https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-26.html)
- [OWASP: Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

#セキュリティ #csrf #認証認可
