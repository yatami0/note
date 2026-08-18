---
created: 2026-08-18 14:03
updated: 2026-08-18 14:03
---
# Webアプリ認証認可の見取り図（MOC）

Webアプリケーションの認証認可（トークンの置き場所・セッション方式・API保護・監査）に関する原子ノートの見取り図。発端は「BFF+セッション vs SPA+ブラウザトークン」の調査（[[accounting-system-auth-case]]）。

## 基礎概念

- [[session-id-vs-jwt]] — 全議論の土台。reference vs capability、「形式」と「置き場所」の2軸分離、資格情報の危険度3要素
- [[jwt-stateless-availability]] — JWTの署名検証がなぜ外部I/Oゼロなのか、「可用性が高い」の正確な意味
- [[token-revocation]] — ステートレス性の対価。denylist/allowlist、失効チェック位置のスペクトラム、expの決め方

## ブラウザアプリの構成パターン

- [[oauth-browser-based-apps]] — 標準側の根拠。IETFドラフトの3パターン（BFF/TMB/ブラウザクライアント）と保管場所の比較
- [[bff-pattern]] — 第一推奨。トークンをブラウザに出さない構成と、セッション管理の2方式（Redis型/Cookie型）
- [[stateless-session]] — 暗号化Cookieセッション。フレームワークのデフォルト勢と、状態をIdPに外注する変種1b′

## 脅威モデル

- [[xss-token-theft]] — 持ち出しvs相乗り、被害の爆発半径、CSPの位置づけ
- [[csrf]] — Cookie認証の宿命。SameSiteという決定的対策があるからIETFはCookie側を推す
- [[nextjs-token-exposure]] — 「BFFなら自動で安全」を崩す実装ミスと、防ぐ規律5ルール

## API層とサービス間認証

- [[oauth-resource-server]] — iss一本化・検証ミドルウェア・ゼロトラスト。マルチクライアント要件はここで受ける
- [[oauth-client-credentials]] — M2M認証の標準形と「誰の操作か」が消える限界
- [[oidc-federation]] — ユーザー単位の証跡とSSOを標準形で満たす。責務の4層分解
- [[oauth-token-exchange]] — 相手の認証を変えられないときの両替カード

## 要件・意思決定

- [[audit-trail-requirements]] — 方式を最終決定するのは技術ではなくこの要件。出どころ（J-SOX/ITGC等）と確認の最短経路
- [[browser-token-tradeoff]] — 「得るもの」実在チェックと決定的な質問リスト
- [[accounting-system-auth-case]] — 上記全部を実案件に適用したケース記録

#moc #認証認可 #セキュリティ
