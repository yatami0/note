import type { APIRoute, GetStaticPaths } from 'astro';
import { getNotes, type Note } from '../lib/notes';

/**
 * 各ノートのエクスポートMarkdownを /<slug>.md として配信する。
 * ページ上の「Markdownをコピー」ボタンの取得元であり、curl等で直接取ることもできる。
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const { notes } = await getNotes();
  return notes.map((note) => ({ params: { slug: note.slug }, props: { note } }));
};

export const GET: APIRoute<{ note: Note }> = ({ props }) => {
  return new Response(props.note.markdown, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
