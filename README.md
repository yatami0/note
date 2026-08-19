# note

yatami0 の個人ノート。`notes/src/*.md` に書いたメモを Astro (TypeScript) が静的サイトに変換し、GitHub Actions が Cloudflare Workers (static assets) の https://konohachi.com へデプロイする。

wikiリンク(`[[...]]`)・バックリンク・`#tag`・mermaid図・KaTeX数式・全文検索に対応。運用ルールの詳細は [CLAUDE.md](CLAUDE.md) を参照。

[tokuhirom/64p.org](https://github.com/tokuhirom/64p.org) のノート運用を参考にした独自実装（初代は Python 実装、現在は TypeScript / Astro 実装）。

## セットアップ

```sh
pnpm install
git config core.hooksPath .githooks   # created/updated 自動付与フックを有効化
```

Node.js >= 22 / pnpm が必要。

## 開発・ビルド・プレビュー

```sh
pnpm dev       # http://localhost:4321/ (mdを編集したらブラウザをリロード)
pnpm test      # 変換パイプラインの仕様テスト (Vitest)
pnpm build     # dist/ に静的サイトを生成
pnpm preview   # dist/ をローカル配信して確認
```

`dist/` はビルド出力なのでコミットしない（gitignore済み）。コミット対象は `notes/src/*.md` のソースと `src/` のビルド実装のみ。

## デプロイ

- PR を作ると CI がテスト・ビルドを回し、プレビュー URL をコメントする
- main にマージすると `.github/workflows/deploy.yml` が Cloudflare Workers へ自動デプロイする
- 手元から `wrangler deploy` は打たない（デプロイは常に CI 経由）

必要な GitHub Secrets: `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
