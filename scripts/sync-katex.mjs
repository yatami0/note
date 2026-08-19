// katex の CSS とフォントを node_modules から public/ へ複製する (dev/build の前段で実行)。
// 数式を含むページだけが <link> で読み込む。CDN 依存を避けるための自己ホスト。
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const katexDist = join(root, 'node_modules', 'katex', 'dist');
const out = join(root, 'public', 'katex');

mkdirSync(out, { recursive: true });
cpSync(join(katexDist, 'katex.min.css'), join(out, 'katex.min.css'));
cpSync(join(katexDist, 'fonts'), join(out, 'fonts'), { recursive: true });
