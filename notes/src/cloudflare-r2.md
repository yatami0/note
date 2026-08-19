---
created: 2026-08-19 07:07
updated: 2026-08-19 07:07
---
# Cloudflare R2

S3互換のオブジェクトストレージ。最大の特徴は**egress（下り転送）課金がゼロ**であること。

## egress無料が構造的に効く理由

S3系ストレージのコストは、保存よりも**配信（下り転送）で膨らむ**ことが多い。画像・動画・ファイル配信では「保存1TB分の料金 ≪ それを世界に配る転送料金」になりがちで、しかも転送量はバズやスクレイピングで自分の制御外に跳ねる。R2はここが常にゼロなので:

- 配信量が読めない個人開発・メディア系でコストの上限不安が消える
- 「データの引っ越し（他クラウドへの移行）に高額なegressがかかる」形のベンダーロックインが効かない

課金は保存容量と操作回数のみ: **Class A**（書き込み・リスト系）と**Class B**（読み取り系）の操作単位。無料枠は10GBストレージ＋Class A 100万回/月＋Class B 1000万回/月（2026年8月時点）。

## 使い方

- **S3互換API**: 既存のS3クライアント・SDK・ツール（aws-cli等）がエンドポイント差し替えで動く
- **[[cloudflare-workers|Workers]] binding**: エッジのコードから直接読み書き（S3 APIより低レイテンシ・認証情報の管理不要）

```js
// Workersから: アップロードと取得
await env.BUCKET.put("avatars/user1.png", request.body);
const obj = await env.BUCKET.get("avatars/user1.png");
```

- **公開バケット**: カスタムドメインを付けて直接配信できる（CloudflareのCDN・キャッシュが前段に載る）
- **presigned URL**: 期限付きの署名URLでクライアントから直接アップロード/ダウンロードさせ、Workersを転送の土管にしない
- イベント通知（オブジェクト作成をQueuesに流す）やライフサイクルルール（古いオブジェクトの自動削除）も持つ

## 向く用途

画像・動画・ユーザーアップロードの置き場、静的アセット配信、バックアップ・ログのアーカイブ、[[cloudflare-d1|D1]]に収まらないバイナリの置き場。強整合の読み書き調整が要るなら[[durable-objects]]、構造化データなら[[cloudflare-d1|D1]]と使い分ける。

## [[cloudflare-moc|Cloudflare MOC]]の中での位置づけ

Workersスタックの「ファイル置き場」担当。egress無料という価格構造がCloudflareで完結させる誘因の中心にある。

## 出典

- [Cloudflare Docs: R2](https://developers.cloudflare.com/r2/)
- [Cloudflare Docs: R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

#cloudflare #storage #serverless #個人開発
