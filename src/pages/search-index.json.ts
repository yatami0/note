import type { APIRoute } from 'astro';
import { getNotes } from '../lib/notes';

function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * クライアントサイド全文検索用のインデックス。日本語は形態素分割ベースの
 * 検索エンジン (Pagefind等) だと複合語内の部分語が取れないため、
 * 全文サブストリング一致で検索する (このサイト規模なら全文配布で十分)。
 */
export const GET: APIRoute = async () => {
  const { notes } = await getNotes();
  const items = notes.map((n) => ({
    slug: n.slug,
    title: n.title,
    updated: n.updated.slice(0, 10),
    tags: n.tags,
    text: toPlainText(n.html),
  }));
  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
