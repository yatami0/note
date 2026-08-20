---
created: 2026-08-20 00:16
updated: 2026-08-20 00:16
---
# 自動化パイプラインを持つリポジトリの可視性

個人リポジトリを公開するかどうかは、コードを見せたいかの話だと思っていた。CIやLLMエージェントを回し始めると、**公開は「自動化の起動口と課金経路を全世界に晒す」ことを含む**ようになり、判断の性質が変わる。

## 公開が意味するものが増える

公開リポジトリで自動化を組むと、次が公開される。

- ワークフローの**起動口**。Issue・コメント・PRで起動する設計なら、Issueを立てられる誰もがジョブを走らせられる
- ジョブの**実行ログ**
- PRの**差分と途中経過**
- LLMエージェントを回すなら、その**入力（会話ログ・プロンプト）**と、消費される**APIクレジット**

起動口の露出は権限設計の穴になるので、`github.event.issue.user.login == github.repository_owner`のような起動者チェックや、外部から直接叩けない起動方式（サーバが持つ資格情報でのみ叩けるディスパッチ）が必要になる。非公開ならこれらの防御そのものが不要になる。

## 公開・非公開のトレードオフ

| | public | private（Freeプラン） |
|---|---|---|
| GitHub Actions | 無制限・無料 | 2,000 Linux分/月。超過は$0.006/分 |
| secret scanning / push protection | 無料で有効 | 基本的に対象外（Secret Protectionは有料） |
| ワークフローの起動口 | 誰でも触れる。防御が要る | 自分だけ |
| スター・ウォッチャー | — | 非公開化で**永久に失われる**（公開に戻しても復元されない） |
| 既存フォーク | — | 切り離されて公開のまま残る |

**secret scanningが外れるのは、APIキーを扱い始めるタイミングでは無視できない。** 補償としてpre-commitフックでのキー検出や、CIでのシークレット検査（gitleaks等）を入れておく。

Actionsの2,000分は、個人のノートリポジトリ程度なら余裕がある。CIが1回2〜4分、LLMエージェントのジョブがAPI待ち主体で5〜10分として、月20回書いても数百分。ただし**エージェントがリトライループに入ると一気に食う**ので、`timeout-minutes`は必須。

## 「サイトの公開」と「リポジトリの公開」は別

見落としやすいのがこれ。生成したサイトを公開している場合、**コンテンツは非公開化しても読める**。リポジトリを非公開にして隠れるのはコンテンツではなく、ビルド実装・下書き・CIログ・自動化の入力のほうだ。

つまり「ノートを公開したい」は公開リポジトリの理由にならない。理由になるのは「実装を他人が参照・流用できること」だけで、そこに価値を感じるかで決まる。

もう1つ、[[evergreen-notes|エバーグリーンノート]]的な運用では、**まとまる前の思考が公開されること自体が無意識のブレーキになる**という運用面の論点もある。育てる前提のノートで下書きが常時見えているのは、書く手を鈍らせうる。

## このリポジトリでの判断

[[note-llm-chat-design]]を進めるにあたって非公開に倒した。

- 公開を維持するために払うコストが「LLMパイプラインの起動口を晒した状態で守る」という構造的なもので、機能追加のたびに効いてくる
- 失うもの（スター・ウォッチャー）が実質ゼロの今が一番安い
- 起動口の防御と会話ログの外部退避が不要になり、実装が1段減る

なお非公開化しても、[[worker-protected-api]]で触れたプレビューURLの露出は消えない。URLがPRコメントに載らなくなるだけで、URL自体は残る。可視性で消せるリスクとそうでないリスクは分けて考える。

## 出典

- [GitHub Docs: About billing for GitHub Actions](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
- [GitHub Docs: Push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)
- [GitHub Docs: Setting repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [GitHub Docs: What happens to forks when a repository changes visibility?](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/what-happens-to-forks-when-a-repository-is-deleted-or-changes-visibility)

#github #ci #個人開発 #セキュリティ #意思決定
