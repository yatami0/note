# bookmarks/

ブックマークのデータ置き場 (1件1ファイルの `*.json`)。手で書かず、日次の
GitHub Actions (`.github/workflows/bookmarks.yml` → `scripts/process-bookmarks.mjs`) が
`bookmark` ラベル付き Issue を処理して生成・コミットする。表示は `/bookmarks/`
(`src/pages/bookmarks/index.astro` + `src/lib/bookmarks.ts`)。

詳細は `CLAUDE.md` の「ブックマーク機能」参照。
