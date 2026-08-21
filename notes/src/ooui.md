---
created: 2026-08-21 00:12
updated: 2026-08-21 00:15
---
# OOUI（オブジェクト指向UI）

オブジェクト（もの、名詞）を起点としてUIを設計する考え方。タスク（やること、動詞）を起点としたUIとの対比で語られる。[[information-architecture|UIをAIが作れる時代の情報設計]]の事例1（動詞メニュー→備品一覧への組み替え）で出てきたので調べた。

日本では上野学氏（ソシオメディア）が体系化した書籍『オブジェクト指向UIデザイン──使いやすいソフトウェアの原理』（技術評論社、2020年。ソシオメディア＋藤井幸多著、上野学監修・著）が定番。2026年7月に図版をカラー化した改訂新版も出ている。

## 中核原則: 名詞→動詞

- タスク指向UI: 最初に「やること（動詞）」を選ばせる。以降の入力はそのタスクの文脈に拘束される＝手続きが画面フローとして固定される
- OOUI: まず「もの（名詞）」を選び、その後でアクション（動詞）を選ぶ。人の日常的な行動は対象を見つけてから行為するので、それに沿う

書籍で挙げられる原則として、解説記事では次の4点がよく引かれる（二次ソース経由。正確な文言は書籍要照合）。

1. オブジェクトを知覚でき直接的に働きかけられる
2. オブジェクトは自身の性質と状態を体現する
3. オブジェクト選択→アクション選択の操作順序
4. すべてのオブジェクトが互いに協調しながらUIを構成する

## 設計プロセス

書籍・実践記事で共通して示されるのは3ステップ。

```mermaid
flowchart LR
    S1[Step 1<br/>オブジェクトの抽出<br/>タスク記述から名詞を抜き出す] --> S2[Step 2<br/>ビューとナビゲーション<br/>各オブジェクトにコレクションビュー(一覧)と<br/>シングルビュー(詳細)を与え、呼び出し関係を決める]
    S2 --> S3[Step 3<br/>レイアウトパターン適用<br/>デバイスに応じて調整]
```

各ステップは「モデル／インタラクション／プレゼンテーション」の抽象化3階層に対応する。レイアウトが最後に来る＝構造の決定が手前にあるという点で、[[information-architecture|情報設計の4層モデル]]と同じ形をしている。Step 1のオブジェクト抽出は、[[ontology|オントロジー]]でいう「この業務世界に何を一級の存在として認めるか」の決定に相当する。

## 歴史的背景: OOUIはGUIの原点回帰

- Alan KayらのXerox PARCがオブジェクト指向プログラミングとウィンドウGUI（Smalltalk、デスクトップメタファー）を生んだ
- 1981年のXerox Starは、操作対象をまず選択してからコマンドを起動する **noun-verb（select-then-operate）構文**を採用した。重要なのは「オブジェクトを先に選択してもシステムはモードに入らない」こと。コマンド先行の従来型システムとの対比で説明され、この構造はMacintoshに継承された
- 「OOUI」という枠組み自体はIBMが体系化した。CUA (Common User Access, 1987〜) の流れで、1992年の『Object-Oriented Interface Design: IBM Common User Access Guidelines』がアプリケーション中心からオブジェクト中心への移行を示し、OS/2のWorkplace Shellがそれを実装した。1995年にはDave Collins『Designing Object-Oriented User Interfaces』も出ている

つまりOOUIは新しい発明ではなく、GUIが元々持っていた性質の再確認という位置づけ。

## モードレスとの関係

OOUIは「UIをモードレスにするための具体的な手法」と位置づけられる。動詞を先に選ばせるUIは、以降の入力がそのタスクの文脈に拘束される＝モーダルになる。名詞先行ならモードが生まれない（Xerox Starの回顧論文がこの利点を明記している）。

モードレスUI自体の提唱者はXerox PARCのLarry Teslerで、「Don't Mode Me In」を掲げ、コピー&ペーストがモードレス設計の代表例。上野氏はこの思想的背景を単著『モードレスデザイン 意味空間の創造』（BNN）で本格的に論じている。

## タスク指向が適切な場面

どちらが優れているかではなく適材適所、というのが共通見解。

- ATM・自動販売機・券売機のように、**対象オブジェクトが実質1つ（口座など）でオブジェクト選択の必要がない**、自己完結的な定型手続きはタスク指向が機能する。書籍でもATMは例外例として扱われている
- ただし「ATMがタスク指向だから」を根拠に安易にタスク指向を選ぶことへの注意を促す議論もある（振込先や金額はアクションの引数であって、オブジェクト選択がないだけ、という整理）

## [[information-design-moc|情報設計・IA MOC]]の中での位置づけ

「何が存在するか」の決定（[[ontology|オントロジー]]側の仕事）を**UIの構造に落とす具体手法**。[[information-architecture|4層モデル]]でいえば2層目（対象と関係のモデル）と4層目（画面内の優先順位）を繋ぐ実装パターンにあたる。

## 出典

- [『オブジェクト指向UIデザイン──使いやすいソフトウェアの原理』（技術評論社, 2020）](https://gihyo.jp/book/2020/978-4-297-11351-3) / [改訂新版（2026）](https://gihyo.jp/book/2026/978-4-297-15716-6)
- [ソシオメディア | OOUI – オブジェクトベースのUIモデリング](https://www.sociomedia.co.jp/7279)
- [ソシオメディア | OOUIの目当て（上野学）](https://www.sociomedia.co.jp/8740) — World IA Day 2019 Tokyo基調講演を元にした論考
- [The Xerox "Star": A Retrospective](https://members.dcn.org/dwnelson/XeroxStarRetrospective.html) — noun-verb構文とモードレス性
- [Richard E. Berry: The designer's model of the CUA Workplace (IBM Systems Journal)](https://bitsavers.trailing-edge.com/pdf/ibm/IBM_Systems_Journal/313/ibmsj3103D.pdf)
- [Designing Object-Oriented User Interfaces (Dave Collins, 1995) — Internet Archive](https://archive.org/details/designingobjecto0000coll)
- [No Modes — Larry Teslerのモードレス思想](https://www.pavley.com/2020/02/20/no-modes/)
- [『モードレスデザイン 意味空間の創造』（BNN）](https://bnn.co.jp/products/9784802512794)

#ooui #uiデザイン #情報設計 #モードレス
