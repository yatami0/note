---
created: 2026-08-22 00:51
updated: 2026-08-22 00:51
---
# Vite Plus（Vite+）

VoidZero（Viteの作者Evan Youが設立した会社）が開発している、Web開発の**統合ツールチェーン**。Viteの後継や別物ではなく、Vite本体を含む開発ツール一式（ビルド・テスト・lint・format・タスクランナー・ランタイム管理）を`vp`という1つのCLIに束ねたもの。ViteConf 2025（2025年10月、アムステルダム）でEvan Youが発表し、2026年3月にアルファ、2026年7月のベータで**MITライセンスで完全OSS化**された。

## Viteとの関係

Viteは「devサーバ + 本番ビルド」のビルドツールで、それ以外（テスト・lint・format・モノレポのタスク実行・Node.jsのバージョン管理…）は別ツールを個別に選定して設定ファイルを繋ぎ込む必要があった。Vite+はこの「JSツールチェーンの断片化」への回答で、**Viteのスーパーセット**として以下を1バイナリ・ゼロコンフィグ寄りで同梱する:

| 領域 | 同梱ツール |
|---|---|
| dev / build | Vite（バンドラはRust製のRolldown） |
| テスト | Vitest |
| lint / format | oxlint / oxfmt（Rust製のoxcベース。oxlintはESLint互換でESLintプラグインも実行可） |
| ライブラリビルド | tsdown |
| タスクランナー | `vp run`（キャッシング・依存関係を考慮したスケジューリング。モノレポ対応） |
| 環境管理 | `vp env`（Node.jsバージョン管理）、`vp install`（依存インストール） |

`vp`コマンドの体験としては`vp dev` / `vp build` / `vp test` / `vp check`（format + lint + 型チェック）/ `vp pack`のように、cargoやgoコマンドのような「言語標準ツールチェーン」に近い形を目指している。Vite自体は今まで通り独立したOSSとして開発が続いていて、既存のVite設定（`vite.config.ts`）の延長で使える。

## pre-commitフックが組み込み

`vp staged`コマンドがGitフック経由でのステージ済みファイル処理（いわゆるlint-staged相当）に対応していて、`vite.config.ts`で設定できる。lint・formatをoxc系に寄せているなら、lefthook + lint-stagedのような別ツールの組み合わせを足さずにpre-commitまで完結する——[[workers-fullstack-ts-stack]]で「lefthook → Vite Plusでいい」とされていた根拠。

## 出典

- [voidzero-dev/vite-plus — GitHub](https://github.com/voidzero-dev/vite-plus)
- [Announcing Vite+ Alpha — VoidZero](https://voidzero.dev/posts/announcing-vite-plus-alpha) / [Announcing Vite+ Beta — VoidZero](https://voidzero.dev/posts/announcing-vite-plus-beta)
- [ViteConf 2025 Recap — VoidZero](https://voidzero.dev/posts/whats-new-viteconf-2025)
- [Vite+ Aims To End JavaScript's Fragmented Tooling Nightmare — The New Stack](https://thenewstack.io/vite-aims-to-end-javascripts-fragmented-tooling-nightmare/)

#frontend #開発ツール #typescript
