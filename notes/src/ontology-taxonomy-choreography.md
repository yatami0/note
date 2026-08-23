---
created: 2026-08-21 00:12
updated: 2026-08-21 00:15
---
# Ontology / Taxonomy / Choreography（Dan KlynのIAモデル）

情報アーキテクチャ（IA）を3つの構成要素で説明するDan Klynのモデル。[[information-architecture|UIをAIが作れる時代の情報設計]]の記事で参照されていたので調べた。

Klyn自身はIAを「**the thoughtful contriving of ontology, taxonomy, and choreography in the service of utility and delight — making the complex clear**（有用性と喜びに資するための、オントロジー・タクソノミー・コレオグラフィーの思慮深い仕組み立て——複雑なものを明快にすること）」と説明している。

## 3要素

| 要素 | Klynの言い方 | 意味 |
|---|---|---|
| **Ontology** | "particular meaning" | そのプロダクト/サービス世界における「特定の意味」の確立。言葉を発するとき何を意味しているか |
| **Taxonomy** | "arrangement of the parts" | 意味を持ったパーツの配置・分類・構造化 |
| **Choreography** | "rules for interaction among the parts" | パーツ間の相互作用のルール。構造の中のフローが滞りなく進むようにすること |

3要素は独立ではなく噛み合った歯車のように相互作用し、特に**意味（ontology）に関する決定が、システムの他のすべての部分の相互作用を支配する**とされる。ここでのontologyは「意味の確立」という広く緩い用法で、知識工学の[[ontology|形式オントロジー]]とは厳密さのレベルが違う（違いはそちらのノート参照）。上流が最も効く、という構図は[[information-architecture|4層モデル]]の「最初の2層がほぼオントロジーの仕事」という整理と対応している。

## 提唱者と初出

- Dan Klynは情報アーキテクト。2011年にBob RoyceとThe Understanding Group (TUG) を共同創業し、ミシガン大学 School of Information でIAを教えている。World IA Dayの共同創設者でもある。
- モデルの初出はKlyn本人の約4分の短編動画「Explaining Information Architecture」。個人ブログのURL日付からは2010年1月公開が有力（2009年公開とする資料もあり、正確な年は確認しきれなかった）。
- 文章としての定式化は2013年3月のブログ記事「A Model for Understanding Information Architecture: Ontology, Taxonomy and Choreography」（現在サイトは停止しており、原文はアーカイブ経由でしか読めない）。

## Richard Saul Wurmanとの系譜

- Wurmanは1976年、AIA（米国建築家協会）全国大会の議長として大会テーマ「The Architecture of Information」を掲げ、「情報のアーキテクチャ」という概念を提示した人物。1996年の著書 *Information Architects* では情報アーキテクトを「the individual who organizes the patterns inherent in data, **making the complex clear**」と定義した。
- Klynの「making the complex clear」というフレーズはこのWurmanの定義を直接引き継いだもの。KlynはWurmanの公認伝記作家であり、Wurman Archive（wurmanarchive.org）のキュレーターも務めている。

## Rosenfeld & Morville（白熊本）との対比

Web時代のIA実務を定式化したRosenfeld & Morville『Information Architecture for the World Wide Web』（通称 polar bear book。初版1998年、第4版2015年からJorge Arangoが共著）は、IAを **organization / labeling / navigation / search の4システム**に分解する。

- 白熊本の4システムは「Webサイトの構成要素（何を作るか）」の分解
- Klynモデルは意味→構造→動きという抽象度の高いレイヤー分けで、Web以外（物理空間、API設計など）にも適用される。実際にMike AmundsenがAPI設計文脈でこのモデルを論じている例がある

（この対比の枠組みは複数の解説記事に見られる整理で、Klyn本人が白熊本と明示的に対比した一次資料は見つけられなかった。）

## [[information-design-moc|情報設計・IA MOC]]の中での位置づけ

この領域の**理論の骨格**。意味→配置→動きという3要素は、[[information-architecture|4層モデル]]をより抽象度の高いレイヤーで言い直したものとして読める。第一要素ontologyの厳密版が[[ontology]]。

## 出典

- [Understanding Information Architecture — The Understanding Group (TUG)](https://understandinggroup.com/ia-theory/understanding-information-architecture)
- [Explaining Information Architecture — TUG（動画掲載ページ）](https://understandinggroup.com/ia-theory/explaining-information-architecture) / [YouTube再掲版「Explaining Information Architecture circa 2010 by Dan Klyn」](https://www.youtube.com/watch?v=rm9KpDS0L-o)
- [A Model for Understanding Information Architecture: Ontology, Taxonomy and Choreography（Wildly Appropriate, 2013）](http://wildlyappropriate.com/2013/03/10/a-model-for-understanding-information-architecture-ontology-taxonomy-and-choreography/) — 現在サイト停止
- [Dan Klyn プロフィール（World IA Day）](https://www.worldiaday.org/people/dan-klyn) / [about.me/danklyn](https://about.me/danklyn)
- [1976 AIA Convention — Richard Saul Wurman Archive](https://www.wurmanarchive.org/timeline/1976-aia-convention)
- [Information Architecture First Principles (Jorge Arango, 2024)](https://jarango.com/2024/09/01/information-architecture-first-principles/) — Wurman 1996の定義の引用元
- [A Brief History of Information Architecture (Resmini & Rosati, Journal of IA)](https://journalofia.org/volume3/issue2/03-resmini/)
- [Information Architecture, 4th Edition — O'Reilly（白熊本の版歴）](https://www.oreilly.com/library/view/information-architecture-4th/9781491913529/copyright-page01.html)
- [Ontology, taxonomy, choreography (Mike Amundsen)](https://mamund.substack.com/p/ontology-taxonomy-choreography) — API設計への応用例

#情報設計 #ia #uiデザイン
