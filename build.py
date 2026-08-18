#!/usr/bin/env python3
"""notes/src/*.md から静的サイトを _site/ に生成する。

機能:
- [[slug]] / [[slug|表示テキスト]] のwikiリンク解決とバックリンク収集
  (存在しないslugを指すと警告を出して **太字** にフォールバック)
- #tag をタグページ (tags/<tag>.html) へのリンクに変換し、タグ別一覧と
  タグクラウド (tags/index.html) を生成
- ```mermaid フェンスをクライアントサイドレンダリング用 <div class="mermaid"> に変換
- $$...$$ / \\(...\\) のTeX数式をKaTeXレンダリング用要素に変換
- 単独行の x.com / twitter.com ステータスURLをX公式ウィジェット埋め込みに変換
- コードブロック・インラインコード内の [[...]] / #tag / $$ は変換しない
- created/updated はYAML frontmatter (pre-commitフックが自動付与) から取得、
  無ければファイルのmtimeにフォールバック
- RSS (rss.xml) は created の新しい順に最大30件

出力はすべて _site/ 配下 (gitignore対象)。GitHub Actionsがデプロイの度に再生成する。
"""

import datetime
import html
import re
import shutil
import sys
from pathlib import Path

import markdown

SITE_URL = "https://yatami0.github.io/note"
SITE_TITLE = "yatami0 notes"
SITE_AUTHOR = "yatami0"
SRC_DIR = Path("notes/src")
OUT_DIR = Path("_site")
TZ = datetime.timezone(datetime.timedelta(hours=9))

RFC822_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
RFC822_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def rfc822(dt):
    """RSSの<pubDate>用RFC822日付。localeに依存しないよう自前で組み立てる。"""
    return "%s, %02d %s %04d %02d:%02d:%02d +0900" % (
        RFC822_DAYS[dt.weekday()], dt.day, RFC822_MONTHS[dt.month - 1],
        dt.year, dt.hour, dt.minute, dt.second)


def parse_note(path):
    text = path.read_text(encoding="utf-8")
    created = updated = None
    m = re.match(r"\A---\n(.*?)\n---\n", text, re.S)
    if m:
        fm = m.group(1)
        text = text[m.end():]
        cm = re.search(r"^created:\s*(.+?)\s*$", fm, re.M)
        um = re.search(r"^updated:\s*(.+?)\s*$", fm, re.M)
        created = cm.group(1) if cm else None
        updated = um.group(1) if um else None
    if not (created and updated):
        # frontmatterが無いノート(初コミット前のプレビュー等)はmtimeで代用
        mtime = datetime.datetime.fromtimestamp(path.stat().st_mtime, TZ)
        fallback = mtime.strftime("%Y-%m-%d %H:%M")
        created = created or fallback
        updated = updated or fallback
    tm = re.match(r"\s*#?\s*(.+?)\n", text)
    title = tm.group(1).strip() if tm else path.stem
    return {
        "src": path,
        "slug": path.stem,
        "title": title,
        "mkdn": text,
        "created": created,
        "updated": updated,
    }


def transform(note, title_by_slug, backlinks, tag_notes):
    """wikiリンク・タグ・mermaid・数式・X埋め込みをMarkdownソース上で解決する。

    コード等の保護領域はプレースホルダに退避する。pre(コード)はMarkdown変換前に、
    post(生成済みHTML断片)はMarkdown変換後に復元する。
    """
    src = note["mkdn"]
    pre = []   # Markdown変換前に復元 (コードブロック等、Markdownとして処理させる)
    post = []  # Markdown変換後に復元 (生成済みHTML、Markdownに触らせない)
    # 制御文字はpython-markdownが内部プレースホルダに使っていて除去されるため、
    # Markdown記法として意味を持たないテキストトークンを使う

    def protect_pre(m):
        pre.append(m.group(0))
        return "\x01%d\x02" % (len(pre) - 1)

    def protect_post(html_fragment):
        post.append(html_fragment)
        return "{{POST:%d}}" % (len(post) - 1)

    def esc(s):
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    # ```mermaid フェンスはクライアントサイドで図としてレンダリングする。
    # 汎用コード保護より先に退避しないと普通のコードブロック扱いになってしまう。
    def mermaid_repl(m):
        note["has_mermaid"] = True
        return protect_post('<div class="mermaid">\n%s\n</div>' % esc(m.group(1)))

    src = re.sub(r"^```mermaid[ \t]*\n(.*?)\n```[ \t]*$", mermaid_repl,
                 src, flags=re.M | re.S)

    # フェンス付きコードブロックとインラインコード。中の [[...]] / #tag / $$ を守る。
    src = re.sub(r"```.*?```|`[^`\n]*`", protect_pre, src, flags=re.S)

    # 数式。コード保護の後に走らせることで、コード例中の $$ や \(...\) は素通しになる。
    def math_display_repl(m):
        note["has_math"] = True
        return protect_post('<div class="math-display">%s</div>' % esc(m.group(1)))

    def math_inline_repl(m):
        note["has_math"] = True
        return protect_post('<span class="math-inline">%s</span>' % esc(m.group(1)))

    src = re.sub(r"\$\$(.+?)\$\$", math_display_repl, src, flags=re.S)
    src = re.sub(r"\\\((.+?)\\\)", math_inline_repl, src, flags=re.S)

    # 単独行のX(Twitter)ステータスURLは公式widgets.jsによるライブ埋め込みへ。
    def tweet_repl(m):
        note["has_tweet"] = True
        return protect_post(
            '<blockquote class="twitter-tweet"><a href="%s"></a></blockquote>'
            % esc(m.group(1)))

    src = re.sub(r"^(https?://(?:x\.com|twitter\.com)/\S+/status/\d+\S*)\s*$",
                 tweet_repl, src, flags=re.M)

    # [[slug]] / [[slug|表示テキスト]] → 通常のMarkdownリンク。リンク元を記録。
    def wikilink_repl(m):
        target, label = m.group(1), m.group(2)
        if target in title_by_slug:
            backlinks.setdefault(target, set()).add(note["slug"])
            return "[%s](%s.html)" % (label or title_by_slug[target], target)
        print("%s: broken wikilink [[%s]]" % (note["src"], target), file=sys.stderr)
        return "**%s**" % (label or target)

    src = re.sub(r"\[\[([\w\-]+)(?:\|([^\]]+))?\]\]", wikilink_repl, src)

    # #tag → タグページへのリンク。
    # - 直前が単語構成文字(英数字・日本語の文字を含む)だと認識しない
    #   (URLフラグメントや C# を誤爆させない。句読点・括弧の直後はOK)
    # - タグはUnicodeの文字で始まる (数字・アンダースコア始まり不可 → #1234 を誤爆させない)
    # - 英字タグは小文字に正規化
    def tag_repl(m):
        tag = m.group(1).lower()
        tag_notes.setdefault(tag, set()).add(note["slug"])
        return protect_post(
            '<a class="note-tag" href="tags/%s.html">#%s</a>' % (tag, tag))

    src = re.sub(r"(?<!\w)#([^\W\d_][\w\-]*)", tag_repl, src)

    note["mkdn"] = src
    note["pre"] = pre
    note["post"] = post


def render_body(note):
    src = re.sub(r"\x01(\d+)\x02", lambda m: note["pre"][int(m.group(1))], note["mkdn"])
    body = markdown.markdown(src, extensions=["fenced_code", "tables"])
    # ブロック要素のプレースホルダは<p>ごと置換し、不正なネストを避ける
    body = re.sub(r"<p>\{\{POST:(\d+)\}\}</p>|\{\{POST:(\d+)\}\}",
                  lambda m: note["post"][int(m.group(1) or m.group(2))], body)
    return body


# ---------------------------------------------------------------- HTML生成

def sidebar(notes, root, current_slug=None):
    items = []
    for n in notes:
        cls = ' class="current"' if n["slug"] == current_slug else ""
        items.append('<li%s><a href="%s%s.html">%s</a></li>'
                     % (cls, root, n["slug"], html.escape(n["title"])))
    return """\
<nav class="notes-sidebar">
  <div class="sidebar-header">
    <a class="site-title" href="%(root)sindex.html">%(site)s</a>
    <button id="theme-toggle" title="テーマ切替">🌓</button>
  </div>
  <input type="search" id="note-search" placeholder="検索..." autocomplete="off">
  <div class="sidebar-links">
    <a href="%(root)stags/index.html">🏷️ タグ一覧</a>
    <a href="%(root)srss.xml">📡 RSS</a>
  </div>
  <ul class="note-list">
%(items)s
  </ul>
</nav>""" % {"root": root, "site": html.escape(SITE_TITLE), "items": "\n".join(items)}


def page(title, main_html, notes, root="", current_slug=None,
         has_math=False, has_mermaid=False, has_tweet=False):
    extra_head = ""
    extra_scripts = ""
    if has_math:
        extra_head += ('<link rel="stylesheet" '
                       'href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">\n')
        extra_scripts += """\
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js"
        onload="document.querySelectorAll('div.math-display, span.math-inline').forEach(function (el) {
            katex.render(el.textContent, el, { displayMode: el.tagName === 'DIV', throwOnError: false });
        })"></script>
"""
    if has_mermaid:
        extra_scripts += """\
<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
const root = document.documentElement;
const divs = document.querySelectorAll('div.mermaid');
divs.forEach(d => { d.dataset.src = d.textContent; });
function isDark() {
    const t = root.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function render() {
    mermaid.initialize({ startOnLoad: false, theme: isDark() ? 'dark' : 'default' });
    divs.forEach(d => { d.textContent = d.dataset.src; d.removeAttribute('data-processed'); });
    mermaid.run({ nodes: divs });
}
new MutationObserver(render).observe(root, { attributeFilter: ['data-theme'] });
render();
</script>
"""
    if has_tweet:
        extra_scripts += ('<script async src="https://platform.twitter.com/widgets.js" '
                          'charset="utf-8"></script>\n')
    return """\
<!doctype html>
<html lang="ja">
<head>
    <meta charset="utf-8">
    <title>%(title)s - %(site)s</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script>
    try { var t = localStorage.getItem('theme');
          if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}
    </script>
    <link rel="stylesheet" href="%(root)sstatic/notes.css">
    <link rel="alternate" type="application/rss+xml" title="%(site)s" href="%(root)srss.xml">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11/styles/github.min.css" media="(prefers-color-scheme: light)">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
%(extra_head)s</head>
<body>
    <div class="notes-layout">
%(sidebar)s
        <main class="notes-main">
%(main)s
            <footer class="notes-footer">
                <a href="https://github.com/yatami0">%(author)s</a> の個人的な調査メモです。
                正確な記述に努めていますが、正確性を保証するものではありません。
            </footer>
        </main>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>
    <script src="%(root)sstatic/notes.js"></script>
%(extra_scripts)s</body>
</html>
""" % {
        "title": html.escape(title),
        "site": html.escape(SITE_TITLE),
        "author": html.escape(SITE_AUTHOR),
        "root": root,
        "sidebar": sidebar(notes, root, current_slug),
        "main": main_html,
        "extra_head": extra_head,
        "extra_scripts": extra_scripts,
    }


def note_page(note, notes):
    backlinks_html = ""
    if note["backlinks"]:
        lis = "\n".join('<li><a href="%s.html">%s</a></li>'
                        % (slug, html.escape(title))
                        for slug, title in note["backlinks"])
        backlinks_html = ('<div class="notes-backlinks">\n'
                         '<h2>🔗 リンクされているノート</h2>\n<ul>\n%s\n</ul>\n</div>\n' % lis)
    main = """\
            <article class="notes-content">
                %(body)s
                %(backlinks)s
                <div class="notes-meta">作成日時: %(created)s / 更新日時: %(updated)s</div>
            </article>""" % {
        "body": note["body"],
        "backlinks": backlinks_html,
        "created": html.escape(note["created"]),
        "updated": html.escape(note["updated"]),
    }
    return page(note["title"], main, notes, root="", current_slug=note["slug"],
                has_math=note.get("has_math", False),
                has_mermaid=note.get("has_mermaid", False),
                has_tweet=note.get("has_tweet", False))


def note_list_html(notes):
    lis = "\n".join(
        '<li><a href="%s.html">%s</a> <span class="note-date">%s</span></li>'
        % (n["slug"], html.escape(n["title"]), html.escape(n["updated"][:10]))
        for n in notes)
    return "<ul class=\"note-index\">\n%s\n</ul>" % lis


def index_page(notes):
    main = """\
            <article class="notes-content">
                <h1>%s</h1>
                <p>調べたこと・考えたことを書き残すノート。更新日の新しい順。</p>
                %s
            </article>""" % (html.escape(SITE_TITLE), note_list_html(notes))
    return page("Notes", main, notes)


def tag_page(tag, tagged_notes, notes):
    lis = "\n".join(
        '<li><a href="../%s.html">%s</a> <span class="note-date">%s</span></li>'
        % (n["slug"], html.escape(n["title"]), html.escape(n["updated"][:10]))
        for n in tagged_notes)
    main = """\
            <article class="notes-content">
                <h1>#%s</h1>
                <ul class="note-index">
%s
                </ul>
            </article>""" % (html.escape(tag), lis)
    return page("#" + tag, main, notes, root="../")


def tags_index_page(tag_counts, notes):
    # タグクラウド: 件数が多いほど大きく表示
    max_count = max((c for _, c in tag_counts), default=1)
    links = []
    for tag, count in tag_counts:
        size = 0.85 + 0.6 * (count / max_count)
        links.append('<a class="tag-cloud-item" style="font-size:%.2fem" '
                     'href="%s.html">#%s<span class="tag-count">%d</span></a>'
                     % (size, tag, html.escape(tag), count))
    main = """\
            <article class="notes-content">
                <h1>🏷️ タグ一覧 (%d)</h1>
                <div class="tag-cloud">
%s
                </div>
            </article>""" % (len(tag_counts), "\n".join(links))
    return page("タグ一覧", main, notes, root="../")


def rss_xml(notes):
    by_created = sorted(notes, key=lambda n: n["created"], reverse=True)[:30]
    items = []
    for n in by_created:
        # RSSリーダーは相対hrefを解決できないので絶対URL化する
        body = re.sub(r'href="(?!https?://|#)([^"]*)"',
                      lambda m: 'href="%s/%s"' % (SITE_URL, m.group(1)),
                      n["body"])
        try:
            dt = datetime.datetime.strptime(n["created"], "%Y-%m-%d %H:%M")
        except ValueError:
            dt = datetime.datetime.strptime(n["created"][:10], "%Y-%m-%d")
        items.append("""\
  <item>
    <title>%(title)s</title>
    <link>%(url)s</link>
    <guid>%(url)s</guid>
    <pubDate>%(pub)s</pubDate>
    <description>%(body)s</description>
  </item>""" % {
            "title": html.escape(n["title"]),
            "url": "%s/%s.html" % (SITE_URL, n["slug"]),
            "pub": rfc822(dt),
            "body": html.escape(body),
        })
    return """\
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>%(site)s</title>
  <link>%(url)s/</link>
  <description>%(author)s notes</description>
  <lastBuildDate>%(now)s</lastBuildDate>
%(items)s
</channel>
</rss>
""" % {
        "site": html.escape(SITE_TITLE),
        "url": SITE_URL,
        "author": html.escape(SITE_AUTHOR),
        "now": rfc822(datetime.datetime.now(TZ)),
        "items": "\n".join(items),
    }


def spew(path, content):
    print("Writing %s" % path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main():
    notes = [parse_note(p) for p in sorted(SRC_DIR.glob("*.md"))]
    title_by_slug = {n["slug"]: n["title"] for n in notes}

    backlinks = {}
    tag_notes = {}
    for note in notes:
        transform(note, title_by_slug, backlinks, tag_notes)
    for note in notes:
        note["body"] = render_body(note)
        note["backlinks"] = sorted(
            ((slug, title_by_slug[slug]) for slug in backlinks.get(note["slug"], ())),
            key=lambda x: x[1])

    notes.sort(key=lambda n: n["updated"], reverse=True)

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)
    shutil.copytree("static", OUT_DIR / "static")

    for note in notes:
        spew(OUT_DIR / ("%s.html" % note["slug"]), note_page(note, notes))
    spew(OUT_DIR / "index.html", index_page(notes))
    spew(OUT_DIR / "rss.xml", rss_xml(notes))

    tag_counts = sorted(((tag, len(slugs)) for tag, slugs in tag_notes.items()),
                        key=lambda x: (-x[1], x[0]))
    spew(OUT_DIR / "tags" / "index.html", tags_index_page(tag_counts, notes))
    for tag, slugs in tag_notes.items():
        tagged = [n for n in notes if n["slug"] in slugs]
        spew(OUT_DIR / "tags" / ("%s.html" % tag), tag_page(tag, tagged, notes))


if __name__ == "__main__":
    main()
