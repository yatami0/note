---
created: 2026-08-21 00:12
updated: 2026-08-21 00:12
---
# オントロジー（情報科学）

ある領域（ドメイン）に「何が存在して、それらがどう関係するか」を、概念と関係の体系として明示的に定義したもの。[[information-architecture|UIをAIが作れる時代の情報設計]]で「エージェント時代に再注目されている」と触れられていたので調べた。

最も広く引用されるのはGruber (1993) の定義: 「**An ontology is an explicit specification of a conceptualization**（オントロジーとは概念化の明示的な仕様化である）」。その後Borst (1997)・Studerらが精緻化し、「formal, explicit specification of a **shared** conceptualization」——形式的・明示的・共有済み、の3要件で語られることが多い。

## 構成要素

- **クラス（概念）** — 共通の特徴を持つ個体のグループ。スーパークラス／サブクラスの階層（is-a）が基本骨格
- **インスタンス（個体）** — クラスの具体的な要素
- **関係・プロパティ** — 概念間の関係（part-ofなど）。値がデータ型になるものはプロパティ
- **公理** — 「常に真」の制約。整合性検証や推論に使われる

is-a階層だけならタクソノミー。そこに型付きの関係や公理が加わることで、分類を超えた意味のネットワークになる。

## 表現形式と「軽量オントロジー」

W3C標準の系譜では、RDF（トリプルのデータモデル）→ RDFS（クラス・プロパティの基本語彙）→ OWL 2（記述論理に基づく形式意味論を持ち、リーズナーで整合性検査・推論ができる）と表現力が上がっていく。統制語彙・シソーラス用にはSKOS（broader / narrower / relatedの意味関係。意図的に論理的形式化をしない設計）がある。

ただし実務のオントロジーが全部OWLで書かれるわけではなく、**概念階層と関係だけで公理をほとんど使わない「軽量オントロジー」**から、公理で意味を厳密に固定するヘビーウェイトなものまで連続的なスペクトラムがある。

## 隣接概念との違い

| 概念 | 何であるか |
|---|---|
| タクソノミー | 親子関係の**階層分類**。「taxonomies are about classification, ontologies are about relationships」という対比が定番。オントロジーはタクソノミー（is-a階層）を基盤として含む |
| ナレッジグラフ | **インスタンスを含むグラフ**（どの具体的エンティティが存在しどう繋がるか）。オントロジーはその**スキーマ層**（どんな型のエンティティ・関係がありうるか）という整理が一般的。実用上は両者の組み合わせで運用される |

## なぜLLM・AIエージェント文脈で再注目されているのか

- **GraphRAG (Microsoft Research, 2024)** — 通常のRAGは「このコーパス全体の主要テーマは？」のようなグローバルな質問に弱い（検索ではなく要約のタスクだから）。LLMでソース文書からエンティティグラフを構築し、コミュニティ要約を事前生成しておくアプローチで、これを大きく改善した。ただしGraphRAGが作るのはLLM抽出によるエンティティグラフで、人手設計の形式オントロジーそのものではない。
- **スキーマ制約によるハルシネーション抑制** — 事前定義したオントロジー／スキーマから関係を選ばせる制約をかけると、LLMが自由に関係を発明する場合に比べて出鱈目の余地が減る、という使い方。
- **エンタープライズの意味の曖昧性解消** — 例えばFinanceの「revenue」（GAAP認識収益）とSalesの「revenue」（ブッキング）のような部門間の用語の揺れは、オントロジーで解消しておかないとエージェントが正しく解釈できない。エージェントに渡す「context layer / semantic layer」の中核としてオントロジーを置く整理が2025-2026年に増えている（「Ontologies Are So Back」という言説も出ている）。
- **Palantir Ontology** — エンタープライズ実装の代表例。データセット・モデルを現実世界の対応物（プラント、設備、顧客注文…）に接続する「組織のoperational layer / デジタルツイン」で、objects / properties / links という記述的（semantic）要素に加えて、actions / functions という**組織を変更する操作まで含める**のが古典的オントロジーとの違い。

どのケースも根っこは同じで、**その業務世界に何が存在するべきかは表層パターンからは出てこない**というLLMの限界を、人間側の業務理解の形式化で補う話。[[information-architecture]]が「AIが最も勝手に補ってしまうのが最上流（オントロジー）」と指摘していたのと同じ地点。

## IA分野での用法

[[ontology-taxonomy-choreography|Dan KlynのIAモデル]]の第一要素もontologyだが、そちらは「特定の意味の確立」（単なる"apple"ではなく"Fuji Apple"とラベルする、のような）という広く緩い用法で、知識工学の形式オントロジーとは厳密さのレベルが違う。ただし「意味の決定が最上流にあり、他のすべてを支配する」という位置づけは共通。

## 出典

- [Understanding Ontologies — NCBI Bookshelf](https://www.ncbi.nlm.nih.gov/books/NBK584339/) — Gruber定義とその発展
- [Ontology Development 101 (Noy & McGuinness, Stanford)](https://protege.stanford.edu/publications/ontology_development/ontology101.pdf)
- [OWL 2 Document Overview — W3C](https://www.w3.org/TR/owl2-overview/) / [SKOS Reference — W3C](https://www.w3.org/TR/skos-reference/)
- [Lightweight ontology — Wikipedia](https://en.wikipedia.org/wiki/Lightweight_ontology)
- [Taxonomy vs Ontology vs Knowledge Graph — Neo4j](https://neo4j.com/blog/knowledge-graph/taxonomy-vs-ontology-vs-knowledge-graph/) / [Enterprise Knowledge: What's the Difference Between an Ontology and a Knowledge Graph?](https://enterprise-knowledge.com/whats-the-difference-between-an-ontology-and-a-knowledge-graph/)
- [GraphRAG論文 (arXiv 2404.16130)](https://arxiv.org/abs/2404.16130) / [Microsoft Research blog](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)
- [LLM-Empowered Knowledge Graph Construction — Emergent Mind](https://www.emergentmind.com/topics/llm-empowered-knowledge-graph-construction) — スキーマ制約とハルシネーション抑制
- [Palantir Ontology Overview](https://www.palantir.com/docs/foundry/ontology/overview) / [Core concepts](https://www.palantir.com/docs/foundry/ontology/core-concepts)
- [Ontologies Are So Back — Latent Space](https://www.latent.space/p/ontologies-agentic-systems)
- [Ontology and Knowledge Graph in the Age of AI and Agents — Enterprise Knowledge](https://enterprise-knowledge.com/ontology-and-knowledge-graph-in-the-age-of-ai-and-agents/)

#オントロジー #情報設計 #ai-agent #知識管理
