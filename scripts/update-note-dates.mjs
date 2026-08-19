// pre-commitフック (.githooks/pre-commit) から呼ばれ、ステージ済みの
// notes/src/*.md に YAML frontmatter で作成日・更新日を刻印する。
//
// - frontmatter が無い新規ノート → created/updated を追加
// - frontmatter がある既存ノート → updated だけ現在時刻に更新 (created は保持)
//
// ファイルの mtime には依存しない (clone直後やCIでは mtime が壊れるため)。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const p = (n) => String(n).padStart(2, '0');
const d = new Date();
const now = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;

for (const file of process.argv.slice(2)) {
  if (!existsSync(file)) continue;
  let content = readFileSync(file, 'utf8');
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (m) {
    let fm = m[1];
    fm = /^updated:\s*.+$/m.test(fm)
      ? fm.replace(/^updated:\s*.+$/m, `updated: ${now}`)
      : `${fm}\nupdated: ${now}`;
    content = `---\n${fm}\n---\n${content.slice(m[0].length)}`;
  } else {
    content = `---\ncreated: ${now}\nupdated: ${now}\n---\n${content}`;
  }
  writeFileSync(file, content, 'utf8');
  console.log(`Stamped ${file}`);
}
