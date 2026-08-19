---
created: 2026-08-19 02:25
updated: 2026-08-19 05:55
---
# ゼロトラスト

「**ネットワーク上の位置を信頼の根拠にしない**」セキュリティモデル。標語は "Never trust, always verify"。

従来の**境界型防御**（perimeter model、城と堀）は「社内ネットワーク/VPNの内側＝信頼できる、外側＝信頼できない」を前提に境界を固める。しかしこの前提は、①侵入した攻撃者が内側で横移動（lateral movement）し放題になる、②クラウド・リモートワーク・BYODで「内側」という概念自体が崩壊している、という2点で破綻した。ゼロトラストは境界の内外を問わず、**リソースへのアクセス1件ごとに、アイデンティティとコンテキストを検証する**方向に転換する。

- 用語の由来はForresterのJohn Kindervag（2010年頃）。Googleが自社実装[[beyondcorp|BeyondCorp]]（社内ネットワーク特権を廃止し、全アプリを認証プロキシ経由でインターネットに公開する構成）を論文化して実在性を示した
- 標準文書は**NIST SP 800-207 "Zero Trust Architecture"**（2020年）

## NIST SP 800-207の7原則（tenets）

1. すべてのデータソースとコンピューティングサービスを「リソース」とみなす
2. ネットワークの場所に関係なく、すべての通信を保護する
3. リソースへのアクセスは**セッション単位**で許可する
4. アクセス可否は**動的なポリシー**（アイデンティティ＋デバイス状態＋振る舞い等）で決める
5. すべての資産の完全性とセキュリティ状態（posture）を監視・測定する
6. 認証と認可は動的で、アクセス許可の前に**厳格に実施**する
7. 資産・ネットワーク・通信の状態を可能な限り収集し、防御の改善に使う

## 実装に落ちる形

概念を具体的な設計判断に翻訳すると:

- **ネットワーク的近さを認証の代わりにしない** — 同一クラスタ・同一Pod・localhostでもトークン検証を省略しない（[[oauth-resource-server]]）。「内側だから素通し」を作らない
- **アイデンティティ認識型プロキシ（Identity-Aware Proxy）** — アプリの前段に認証プロキシを置き、全リクエストをユーザー認証・ポリシー評価してから通す。BeyondCorpの中核で、[[cloudflare-zero-trust|Cloudflare Access]]・Google IAP等が製品形。この形は認証を外付けする[[bff-pattern|BFF]]の親戚とも言える
- **[[mtls|mTLS]] / [[service-mesh|サービスメッシュ]]** — サービス間通信も相互認証・暗号化する（原則2）。アプリ層のトークン検証への「追加の層」であって代替ではない
- **最小権限 + 短命な資格情報** — 広く長いアクセス権を配らない。[[token-revocation|短命トークン]]・セッション単位の許可（原則3）
- **VPNからZTNAへ** — VPNは「境界の内側に入れる」装置で、入った後は広く到達できてしまう。ZTNA（Zero Trust Network Access）はアプリ単位でトンネルを張り、他のリソースは見えもしない

注意: ゼロトラストは製品ではなくアーキテクチャの方針。単一製品の導入で「ゼロトラスト化完了」にはならず、既存の多層防御を置き換えるものでもない（境界防御も層の1つとして残る）。

## [[web-auth-moc|Webアプリ認証認可MOC]]の中での位置づけ

「なぜ同一Pod内でもJWT検証するのか」（[[oauth-resource-server]]）の背後にある原則。個人開発での実践は[[cloudflare-zero-trust]]。

## 出典

- [NIST SP 800-207: Zero Trust Architecture](https://nvlpubs.nist.gov/nistpubs/specialpublications/NIST.SP.800-207.pdf)
- [Google BeyondCorp: A New Approach to Enterprise Security](https://research.google/pubs/beyondcorp-a-new-approach-to-enterprise-security/)
- [CISA: Zero Trust Maturity Model](https://www.cisa.gov/sites/default/files/2023-04/CISA_Zero_Trust_Maturity_Model_Version_2_508c.pdf)

#ゼロトラスト #セキュリティ #アーキテクチャ
