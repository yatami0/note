// ブックマークの日次処理 (.github/workflows/bookmarks.yml から実行)。
//
// `bookmark` ラベル付きのオープン Issue を登録キューとして読み、各 Issue の URL
// について 記事本文の取得 → Claude API での要約+タグ付け → bookmarks/<id>.json
// の書き出し → Issue クローズ を行う。コミット/プッシュはワークフロー側の責務。
//
// 必要な環境変数:
//   GITHUB_TOKEN       Issue の読み書き用 (Actions の既定トークンで可)
//   ANTHROPIC_API_KEY  要約・タグ付け用
//   GITHUB_REPOSITORY  "owner/repo" (Actions が自動設定。手元実行時は指定)
//   BOOKMARKS_MODEL    使用モデル (省略時 claude-opus-5)
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const BOOKMARKS_DIR = path.resolve(process.cwd(), 'bookmarks');
const SITE_BOOKMARKS_URL = 'https://konohachi.com/bookmarks/';
const LABEL = 'bookmark';
const ERROR_LABEL = 'bookmark-error';
// Issue 作成者がこのいずれかでなければ処理しない (公開リポジトリで第三者が
// Issue を立てても勝手にサイトへ載らないように)
const ALLOWED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
// 記事本文をプロンプトへ渡す際の上限 (文字数)
const MAX_CONTENT_CHARS = 40000;

// ---- URL / HTML ユーティリティ (tests/bookmarks.test.ts でテスト) ----

/** テキスト中の最初の http(s) URL を返す。末尾の句読点・閉じ括弧は落とす。 */
export function extractUrl(text) {
  const m = /https?:\/\/[^\s<>"'\])]+/.exec(text ?? '');
  if (!m) return undefined;
  return m[0].replace(/[.,。、」)]+$/, '');
}

/** 重複判定用の正規化。fragment と utm 系パラメータを除き、末尾スラッシュを揃える。 */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === 'fbclid' || key === 'gclid') u.searchParams.delete(key);
    }
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (u.pathname !== '/' && !u.search && s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}

/** X(Twitter) のポスト URL か。本文が JS レンダリングのため oEmbed で取得する。 */
export function isTweetUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|mobile)\./, '');
    return (host === 'x.com' || host === 'twitter.com') && /\/status(?:es)?\/\d+/.test(u.pathname);
  } catch {
    return false;
  }
}

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}

/** HTML から本文らしきプレーンテキストを取り出す (雑でよい。要約は Claude 側が行う)。 */
export function htmlToText(html) {
  const s = html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript\s*>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg\s*>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(s).replace(/\s+/g, ' ').trim();
}

/** og:title または <title> を返す。 */
export function extractHtmlTitle(html) {
  const og =
    /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i.exec(html);
  if (og?.[1]) return decodeEntities(og[1]).trim();
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return t ? decodeEntities(t[1]).replace(/\s+/g, ' ').trim() : undefined;
}

/** サイトの #tag 仕様 (英数字始まり不可等) に合わせてタグを整える。 */
export function sanitizeTag(tag) {
  const t = String(tag)
    .trim()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/^[^\p{L}]+/u, ''); // 先頭は文字 (数字・記号始まりはタグとして認識されない)
  return t.toLowerCase();
}

/** ファイル名にする ID。登録日 + URL のハッシュ先頭8桁。 */
export function bookmarkId(url, addedDate) {
  const hash = crypto.createHash('sha256').update(normalizeUrl(url)).digest('hex').slice(0, 8);
  return `${addedDate.replaceAll('-', '').slice(0, 8)}-${hash}`;
}

/** "YYYY-MM-DD HH:MM" (JST)。notes の frontmatter と同じ表記に揃える。 */
export function fmtDateJst(date) {
  // sv-SE ロケールは "YYYY-MM-DD HH:MM:SS" 形式を返す
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(',', '');
}

// ---- コンテンツ取得 ----

async function fetchArticle(url) {
  if (isTweetUrl(url)) {
    // X の oEmbed API (認証不要) でポスト本文を取る。x.com のままだと弾かれる
    // ことがあるため twitter.com に揃えて渡す
    const oembedTarget = new URL(url);
    oembedTarget.hostname = 'twitter.com';
    const res = await fetch(
      `https://publish.twitter.com/oembed?omit_script=true&lang=ja&url=${encodeURIComponent(oembedTarget.toString())}`,
      { signal: AbortSignal.timeout(30000) },
    );
    if (!res.ok) throw new Error(`oEmbed の取得に失敗 (HTTP ${res.status})`);
    const data = await res.json();
    return {
      titleHint: data.author_name ? `${data.author_name} のポスト` : undefined,
      text: `X のポスト (投稿者: ${data.author_name ?? '不明'})\n${htmlToText(data.html ?? '')}`,
    };
  }
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; konohachi-bookmark-bot; +https://konohachi.com/)',
      accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
    },
    signal: AbortSignal.timeout(30000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`ページの取得に失敗 (HTTP ${res.status})`);
  const type = res.headers.get('content-type') ?? '';
  if (!/text\/|application\/(xhtml|xml)/.test(type)) {
    throw new Error(`HTML ではないコンテンツ (${type || 'content-type 不明'}) は要約できない`);
  }
  const html = await res.text();
  return { titleHint: extractHtmlTitle(html), text: htmlToText(html) };
}

// ---- Claude API ----

async function summarize({ url, titleHint, text, existingTags, model }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { z } = await import('zod');
  const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod');

  const Result = z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
  });

  const client = new Anthropic();
  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    system: [
      'あなたは個人用ブックマークの整理係。渡されたウェブページ本文から以下を日本語で作る。',
      '- title: 記事の原題をそのまま使う (取れない場合のみ内容から簡潔に付ける)。サイト名のサフィックス (「 - Qiita」等) は落とす。',
      '- summary: 200〜400字程度。記事の主題・要点・結論を具体的に。後からキーワード検索で見つけられるよう、本文中の重要な技術用語・固有名詞を要約文に含める。前置きや「この記事は」という書き出しは不要。',
      '- tags: 3〜6個。既存タグ一覧に合うものがあれば必ず再利用し、なければ新設する。英語タグは小文字 kebab-case、日本語タグも可。数字始まりは不可。',
      '本文がほぼ取得できていない場合も、URL とタイトルから分かる範囲で作り、summary の冒頭に「(本文が取得できなかったため推測)」と明記する。',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          `URL: ${url}`,
          `ページタイトル: ${titleHint ?? '(不明)'}`,
          `既存タグ一覧: ${existingTags.length > 0 ? existingTags.join(', ') : '(まだない)'}`,
          '',
          '--- ページ本文 (抽出テキスト) ---',
          text.slice(0, MAX_CONTENT_CHARS),
        ].join('\n'),
      },
    ],
    output_config: { format: zodOutputFormat(Result) },
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('モデルが要約を拒否した (stop_reason: refusal)');
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('構造化出力のパースに失敗');
  const tags = [...new Set(parsed.tags.map(sanitizeTag).filter(Boolean))].slice(0, 6);
  return { title: parsed.title.trim(), summary: parsed.summary.trim(), tags };
}

// ---- GitHub API ----

function ghClient(repo, token) {
  return async function gh(pathname, { method = 'GET', body } = {}) {
    const res = await fetch(`https://api.github.com/repos/${repo}${pathname}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'konohachi-bookmark-bot',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const err = new Error(`GitHub API ${method} ${pathname} → HTTP ${res.status} ${detail}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? undefined : res.json();
  };
}

async function ensureLabels(gh) {
  const labels = [
    { name: LABEL, color: '0e8a16', description: 'ブックマーク登録キュー (日次バッチが処理)' },
    { name: ERROR_LABEL, color: 'd93f0b', description: 'ブックマーク処理に失敗 (外して再試行)' },
  ];
  for (const label of labels) {
    try {
      await gh('/labels', { method: 'POST', body: label });
    } catch (e) {
      if (e.status !== 422) throw e; // 422 = 既に存在
    }
  }
}

// ---- メイン ----

async function loadExisting() {
  let files = [];
  try {
    files = (await fs.readdir(BOOKMARKS_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    await fs.mkdir(BOOKMARKS_DIR, { recursive: true });
  }
  const urls = new Set();
  const tags = new Set();
  for (const f of files) {
    const b = JSON.parse(await fs.readFile(path.join(BOOKMARKS_DIR, f), 'utf8'));
    urls.add(normalizeUrl(b.url));
    for (const t of b.tags ?? []) tags.add(t);
  }
  return { urls, tags };
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const model = process.env.BOOKMARKS_MODEL || 'claude-opus-5';
  if (!repo || !token) throw new Error('GITHUB_REPOSITORY / GITHUB_TOKEN が未設定');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY が未設定');

  const gh = ghClient(repo, token);
  await ensureLabels(gh);

  const issues = (await gh(`/issues?labels=${LABEL}&state=open&per_page=100`)).filter(
    (i) => !i.pull_request,
  );
  // 古い順に処理する
  issues.sort((a, b) => a.created_at.localeCompare(b.created_at));
  console.log(`bookmark ラベルのオープン Issue: ${issues.length}件`);

  const existing = await loadExisting();
  let ok = 0;
  let failed = 0;

  for (const issue of issues) {
    const prefix = `#${issue.number}`;
    if (issue.labels.some((l) => l.name === ERROR_LABEL)) {
      console.log(`${prefix}: ${ERROR_LABEL} ラベル付きのためスキップ (外すと再試行される)`);
      continue;
    }
    if (!ALLOWED_ASSOCIATIONS.has(issue.author_association)) {
      console.log(`${prefix}: 作成者 (${issue.user?.login}) がコラボレータでないためスキップ`);
      continue;
    }
    const url = extractUrl(issue.title) ?? extractUrl(issue.body ?? '');
    try {
      if (!url) throw new Error('Issue のタイトル・本文から URL を見つけられなかった');
      if (existing.urls.has(normalizeUrl(url))) {
        await gh(`/issues/${issue.number}/comments`, {
          method: 'POST',
          body: { body: `この URL は登録済みのためクローズします。\n${SITE_BOOKMARKS_URL}` },
        });
        await gh(`/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed' } });
        console.log(`${prefix}: 登録済み URL のためクローズ (${url})`);
        continue;
      }

      console.log(`${prefix}: 処理開始 ${url}`);
      const article = await fetchArticle(url);
      const { title, summary, tags } = await summarize({
        url,
        titleHint: article.titleHint,
        text: article.text,
        existingTags: [...existing.tags].sort(),
        model,
      });

      const added = fmtDateJst(new Date(issue.created_at));
      const bookmark = {
        id: bookmarkId(url, added),
        url,
        domain: new URL(url).hostname.replace(/^www\./, ''),
        title,
        summary,
        tags,
        added,
        issue: issue.number,
      };
      await fs.writeFile(
        path.join(BOOKMARKS_DIR, `${bookmark.id}.json`),
        `${JSON.stringify(bookmark, null, 2)}\n`,
      );
      existing.urls.add(normalizeUrl(url));
      for (const t of tags) existing.tags.add(t);

      await gh(`/issues/${issue.number}/comments`, {
        method: 'POST',
        body: {
          body: [
            `📚 ブックマークに登録しました: **${title}**`,
            '',
            `タグ: ${tags.map((t) => `\`${t}\``).join(' ')}`,
            '',
            `> ${summary}`,
            '',
            `次回デプロイ後に ${SITE_BOOKMARKS_URL} に表示されます。`,
          ].join('\n'),
        },
      });
      await gh(`/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed' } });
      console.log(`${prefix}: 登録完了 (${bookmark.id})`);
      ok += 1;
    } catch (e) {
      failed += 1;
      console.error(`${prefix}: 失敗 —`, e);
      try {
        await gh(`/issues/${issue.number}/comments`, {
          method: 'POST',
          body: {
            body: [
              `⚠️ ブックマーク処理に失敗しました: ${e.message}`,
              '',
              `\`${ERROR_LABEL}\` ラベルを外すと次回の日次バッチで再試行されます。`,
            ].join('\n'),
          },
        });
        await gh(`/issues/${issue.number}/labels`, {
          method: 'POST',
          body: { labels: [ERROR_LABEL] },
        });
      } catch (e2) {
        console.error(`${prefix}: エラー報告にも失敗 —`, e2);
      }
    }
  }
  console.log(`完了: 登録 ${ok}件 / 失敗 ${failed}件`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
