import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import { splitByRegex, transformTextNodes, type NoteFileData } from './util.js';

/** [[slug]] / [[slug|表示テキスト]]。slug はファイル名由来の ASCII kebab-case */
const WIKILINK = /\[\[([\w-]+)(?:\|([^\]]+))?\]\]/g;

export interface WikilinksOptions {
  titleBySlug: ReadonlyMap<string, string>;
}

/**
 * wikiリンクをノートページへのリンクに解決する。
 * 存在しない slug は太字にフォールバックし data.broken に記録する (build.py と同じ挙動)。
 */
export function remarkWikilinks(options: WikilinksOptions) {
  return (tree: Root, file: VFile) => {
    const data = file.data as NoteFileData;
    transformTextNodes(tree, (value) =>
      splitByRegex(value, WIKILINK, (m) => {
        const target = m[1]!;
        const label = m[2];
        const title = options.titleBySlug.get(target);
        if (title === undefined) {
          (data.broken ??= []).push(target);
          return { type: 'strong', children: [{ type: 'text', value: label ?? target }] };
        }
        (data.links ??= new Set()).add(target);
        return {
          type: 'link',
          url: `/${target}/`,
          children: [{ type: 'text', value: label ?? title }],
        };
      }),
    );
  };
}
