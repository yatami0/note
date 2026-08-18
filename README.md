# note

yatami0 の個人ノート。`notes/src/*.md` に書いたメモを `build.py` が静的サイトに変換し、GitHub Actions が GitHub Pages にデプロイする。

wikiリンク(`[[...]]`)・バックリンク・`#tag`・mermaid図・KaTeX数式に対応。運用ルールの詳細は [CLAUDE.md](CLAUDE.md) を参照。

[tokuhirom/64p.org](https://github.com/tokuhirom/64p.org) のノート運用を参考にした独自実装。

## セットアップ

```sh
pip install -r requirements.txt        # 依存は markdown パッケージのみ
git config core.hooksPath .githooks    # created/updated 自動付与フックを有効化
```

GitHub Pages を使う場合は、リポジトリの Settings → Pages → Source を「GitHub Actions」に設定する（初回のみ）。

## ビルドとプレビュー

```sh
python3 build.py
python3 -m http.server -d _site 8000   # http://localhost:8000/
```

`_site/` はビルド出力なのでコミットしない（gitignore済み）。コミット対象は `notes/src/*.md` のソースのみ。
