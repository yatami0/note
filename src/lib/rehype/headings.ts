import GithubSlugger from 'github-slugger';
import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';
import type { NoteFileData } from '../remark/util.js';

const HEADING_DEPTH: Record<string, number> = { h2: 2, h3: 3, h4: 4 };

function textOf(node: Element): string {
  let out = '';
  visit(node, 'text', (t) => {
    out += t.value;
  });
  return out;
}

/** h2-h4 に id を振り、目次用に data.headings へ収集する。 */
export function rehypeHeadings() {
  return (tree: Root, file: VFile) => {
    const data = file.data as NoteFileData;
    const slugger = new GithubSlugger();
    visit(tree, 'element', (node) => {
      const depth = HEADING_DEPTH[node.tagName];
      if (depth === undefined) return;
      const text = textOf(node);
      const id = slugger.slug(text);
      node.properties = { ...node.properties, id };
      (data.headings ??= []).push({ depth, id, text });
    });
  };
}
