import type { Paragraph, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';
import { escapeHtml, type NoteFileData } from './util.js';

const TWEET_URL = /^https?:\/\/(?:x\.com|twitter\.com)\/\S+\/status\/\d+\S*$/;

/** 段落が単独の X(Twitter) ステータスURLだけなら、そのURLを返す。 */
function soleTweetUrl(p: Paragraph): string | null {
  if (p.children.length !== 1) return null;
  const child = p.children[0]!;
  // GFM autolink で link ノード化されている場合 (表示テキスト = URL のときだけ埋め込み対象)
  if (child.type === 'link' && TWEET_URL.test(child.url)) {
    const inner = child.children;
    if (inner.length === 1 && inner[0]!.type === 'text' && inner[0].value === child.url) {
      return child.url;
    }
    return null;
  }
  if (child.type === 'text' && TWEET_URL.test(child.value.trim())) return child.value.trim();
  return null;
}

/** 単独行の X ステータスURLを公式 widgets.js のライブ埋め込みに変換する。 */
export function remarkTweets() {
  return (tree: Root, file: VFile) => {
    const data = file.data as NoteFileData;
    visit(tree, 'paragraph', (node, index, parent) => {
      if (parent === undefined || index === undefined) return;
      const url = soleTweetUrl(node);
      if (url === null) return;
      data.hasTweet = true;
      parent.children[index] = {
        type: 'html',
        value: `<blockquote class="twitter-tweet"><a href="${escapeHtml(url)}"></a></blockquote>`,
      };
    });
  };
}
