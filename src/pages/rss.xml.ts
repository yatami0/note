import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getNotes } from '../lib/notes';
import { SITE_DESCRIPTION, SITE_TITLE } from '../lib/site';

/** "YYYY-MM-DD HH:MM" (JST) を Date にする */
function toDate(s: string): Date {
  const d = new Date(`${s.replace(' ', 'T')}:00+09:00`);
  return Number.isNaN(d.getTime()) ? new Date(`${s.slice(0, 10)}T00:00:00+09:00`) : d;
}

export async function GET(context: APIContext) {
  const site = context.site!.toString().replace(/\/$/, '');
  const { notes } = await getNotes();
  const byCreated = [...notes].sort((a, b) => b.created.localeCompare(a.created)).slice(0, 30);
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site!,
    customData: '<language>ja</language>',
    items: byCreated.map((n) => ({
      title: n.title,
      link: `/${n.slug}/`,
      pubDate: toDate(n.created),
      // RSSリーダーは相対hrefを解決できないので絶対URL化する
      content: n.html.replaceAll('href="/', `href="${site}/`),
    })),
  });
}
