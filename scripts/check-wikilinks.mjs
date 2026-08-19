// 全ノートの [[wikilink]] が実在する slug を指しているかの軽量チェック。
// pre-commit フックで使う (フルビルドより速い)。壊れリンクは警告のみで
// コミット自体は通す — 本検証は CI の pnpm build が行う。
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'notes/src');
const files = readdirSync(srcDir).filter((f) => f.endsWith('.md'));
const slugs = new Set(files.map((f) => f.replace(/\.md$/, '')));

let broken = 0;
for (const file of files) {
  const text = readFileSync(path.join(srcDir, file), 'utf8')
    // コードフェンス・インラインコード内の [[...]] は対象外
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, '');
  for (const m of text.matchAll(/\[\[([\w-]+)(?:\|[^\]]+)?\]\]/g)) {
    if (!slugs.has(m[1])) {
      console.warn(`${file}: broken wikilink [[${m[1]}]]`);
      broken++;
    }
  }
}
if (broken > 0) console.warn(`${broken} broken wikilink(s) found`);
