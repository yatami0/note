import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import { splitByRegex, transformTextNodes, type NoteFileData } from './util.js';

/**
 * #tag の認識ルール (build.py の (?<!\w)#([^\W\d_][\w\-]*) の Unicode 対応 JS 版):
 * - 直前が単語構成文字 (英数字・日本語等の文字・_) だと認識しない → foo#bar / URLフラグメント除け
 * - タグは Unicode の文字で始まる (数字・_ 始まり不可) → #1234 除け
 * - 2文字目以降は文字・数字・_・ハイフン
 *
 * URL 内の #fragment は、GFM autolink がURLを link ノードにするため
 * transformTextNodes の保護型スキップで構造的に除外される。
 */
const TAG = /(?<![\p{L}\p{N}_])#([\p{L}][\p{L}\p{N}_-]*)/gu;

/** #tag をタグページへのリンクに変換し、data.tags に記録する。英字は小文字に正規化。 */
export function remarkTags() {
  return (tree: Root, file: VFile) => {
    const data = file.data as NoteFileData;
    transformTextNodes(tree, (value) =>
      splitByRegex(value, TAG, (m) => {
        const tag = m[1]!.toLowerCase();
        data.tags ??= [];
        if (!data.tags.includes(tag)) data.tags.push(tag);
        return {
          type: 'link',
          url: `/tags/${encodeURIComponent(tag)}/`,
          data: { hProperties: { className: ['note-tag'] } },
          children: [{ type: 'text', value: `#${tag}` }],
        };
      }),
    );
  };
}
