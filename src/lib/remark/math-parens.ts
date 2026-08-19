import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';
import type { NoteFileData } from './util.js';

/** 数式 ($$ ブロック・インラインとも) の有無を data.hasMath に記録する。 */
export function remarkMathFlag() {
  return (tree: Root, file: VFile) => {
    const data = file.data as NoteFileData;
    visit(tree, ['math', 'inlineMath'], () => {
      data.hasMath = true;
    });
  };
}
