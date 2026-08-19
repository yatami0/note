import rehypeShiki from '@shikijs/rehype';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified, type Processor } from 'unified';
import { VFile } from 'vfile';
import { rehypeHeadings } from './rehype/headings.js';
import { remarkMathFlag } from './remark/math-parens.js';
import { preprocessSource } from './remark/preprocess.js';
import { remarkMermaid } from './remark/mermaid.js';
import { remarkTags } from './remark/tags.js';
import { remarkTweets } from './remark/tweets.js';
import type { NoteFileData } from './remark/util.js';
import { remarkWikilinks } from './remark/wikilinks.js';

export interface RenderResult {
  html: string;
  /** wikilink で張った先の slug (存在するもののみ) */
  links: string[];
  /** 解決できなかった wikilink のターゲット */
  broken: string[];
  /** 正規化済みタグ (出現順) */
  tags: string[];
  headings: { depth: number; id: string; text: string }[];
  hasMermaid: boolean;
  hasMath: boolean;
  hasTweet: boolean;
}

export type NoteProcessor = Processor<any, any, any, any, string>;

/**
 * ノート変換パイプライン。1インスタンスを全ノートで使い回す。
 * 変換順は build.py と同じ意味順: mermaid → 数式 → X埋め込み → wikilink → #tag。
 * コード・URL内の記法はASTのノード型 (code / inlineCode / link) で構造的に保護される。
 */
export function createProcessor(titleBySlug: ReadonlyMap<string, string>): NoteProcessor {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath, { singleDollarTextMath: false })
    .use(remarkMermaid)
    .use(remarkMathFlag)
    .use(remarkTweets)
    .use(remarkWikilinks, { titleBySlug })
    .use(remarkTags)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeShiki, {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      fallbackLanguage: 'text',
    })
    .use(rehypeHeadings)
    .use(rehypeStringify) as NoteProcessor;
}

export async function renderNote(processor: NoteProcessor, source: string): Promise<RenderResult> {
  const file = new VFile({ value: preprocessSource(source) });
  const result = await processor.process(file);
  const data = file.data as NoteFileData;
  return {
    html: String(result),
    links: [...(data.links ?? [])],
    broken: data.broken ?? [],
    tags: data.tags ?? [],
    headings: data.headings ?? [],
    hasMermaid: data.hasMermaid ?? false,
    hasMath: data.hasMath ?? false,
    hasTweet: data.hasTweet ?? false,
  };
}
