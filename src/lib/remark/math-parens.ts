import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';
import type { NoteFileData } from './util.js';

/**
 * \(...\) のインライン数式をパース前に $$...$$ (インライン位置の math_text) へ書き換える。
 *
 * remark-parse は `\(` を文字エスケープとして解決してしまい AST 上で復元できないため、
 * この変換だけはパース前のソース文字列で行う。コードフェンス・インラインコードは
 * build.py と同様にスキップして保護する ($$ は micromark がコード内を見ないので不要)。
 */
export function preprocessMathParens(src: string): string {
  return src
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/)
    .map((seg, i) => (i % 2 === 1 ? seg : seg.replace(/\\\((.+?)\\\)/gs, '$$$$$1$$$$')))
    .join('');
}

/** 数式 ($$ ブロック・インラインとも) の有無を data.hasMath に記録する。 */
export function remarkMathFlag() {
  return (tree: Root, file: VFile) => {
    const data = file.data as NoteFileData;
    visit(tree, ['math', 'inlineMath'], () => {
      data.hasMath = true;
    });
  };
}
