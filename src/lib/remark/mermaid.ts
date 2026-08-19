import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';
import { escapeHtml, type NoteFileData } from './util.js';

/**
 * ```mermaid フェンスをクライアントサイドレンダリング用の <div class="mermaid"> に変換する。
 * html ノード化することで、後段の wikilink/#tag 変換からも構造的に保護される。
 */
export function remarkMermaid() {
  return (tree: Root, file: VFile) => {
    const data = file.data as NoteFileData;
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'mermaid' || parent === undefined || index === undefined) return;
      data.hasMermaid = true;
      parent.children[index] = {
        type: 'html',
        value: `<div class="mermaid">\n${escapeHtml(node.value)}\n</div>`,
      };
    });
  };
}
