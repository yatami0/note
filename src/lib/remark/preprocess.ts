/**
 * パース前のソース文字列前処理。AST では扱えない 2 点だけをここで行う:
 *
 * 1. \(...\) インライン数式 → $$...$$ (インライン位置の math_text)。
 *    remark-parse が `\(` を文字エスケープとして解決してしまい AST 上で復元できないため。
 * 2. [[slug|label]] の `|` → `\|`。GFM テーブルのセル区切りとして先に解釈され
 *    wikilink がセルに分断されるのを防ぐ (文字エスケープなので通常の本文では | に戻る)。
 *
 * コードフェンス・インラインコードは build.py と同様にスキップして保護する。
 */
const CODE_SEGMENT = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/;

export function preprocessSource(src: string): string {
  return src
    .split(CODE_SEGMENT)
    .map((seg, i) =>
      i % 2 === 1
        ? seg
        : seg.replace(/\\\((.+?)\\\)/gs, '$$$$$1$$$$').replace(/\[\[([\w-]+)\|/g, '[[$1\\|'),
    )
    .join('');
}
