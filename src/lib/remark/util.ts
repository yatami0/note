import type { Parent, PhrasingContent, RootContent } from 'mdast';

/** この型のノード配下のテキストは変換対象外 (コード・数式・リンクURL・生HTML)。
 *  build.py のプレースホルダ退避に相当する保護を、ASTのノード型で構造的に実現する。 */
const PROTECTED_TYPES = new Set([
  'code',
  'inlineCode',
  'math',
  'inlineMath',
  'link',
  'linkReference',
  'image',
  'imageReference',
  'definition',
  'html',
]);

/**
 * 保護ノードをスキップしながら text ノードを走査し、replace が返した
 * ノード列で置き換える (null なら変更なし)。
 */
export function transformTextNodes(
  tree: Parent,
  replace: (value: string) => PhrasingContent[] | null,
): void {
  const children = tree.children as RootContent[];
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (PROTECTED_TYPES.has(child.type)) continue;
    if (child.type === 'text') {
      const out = replace(child.value);
      if (out) {
        children.splice(i, 1, ...(out as RootContent[]));
        i += out.length - 1;
      }
    } else if ('children' in child) {
      transformTextNodes(child as Parent, replace);
    }
  }
}

/**
 * value を regex で分割し、マッチ部分を toNode の結果で置き換えたノード列を返す。
 * マッチが1つも無ければ null (置き換え不要)。
 */
export function splitByRegex(
  value: string,
  regex: RegExp,
  toNode: (match: RegExpExecArray) => PhrasingContent,
): PhrasingContent[] | null {
  regex.lastIndex = 0;
  const nodes: PhrasingContent[] = [];
  let last = 0;
  for (let m = regex.exec(value); m !== null; m = regex.exec(value)) {
    if (m.index > last) nodes.push({ type: 'text', value: value.slice(last, m.index) });
    nodes.push(toNode(m));
    last = m.index + m[0].length;
  }
  if (nodes.length === 0) return null;
  if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
  return nodes;
}

export function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** 各ノートの変換中に vfile.data へ書き込まれる収集結果。 */
export interface NoteFileData {
  /** このノートから張られた wikilink の先 (存在するslugのみ) */
  links?: Set<string>;
  /** このノートに付いた #tag (正規化済み・出現順) */
  tags?: string[];
  /** 解決できなかった wikilink のターゲット */
  broken?: string[];
  hasMermaid?: boolean;
  hasMath?: boolean;
  hasTweet?: boolean;
  headings?: { depth: number; id: string; text: string }[];
}
