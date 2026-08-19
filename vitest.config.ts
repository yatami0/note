import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 最初の renderNote() が Shiki の文法・テーマと KaTeX の初期化を丸ごと
    // 背負うため、CI の遅いランナーでは既定の 5s を超えて 1 本目だけ落ちる。
    // 2 本目以降はキャッシュが効いて数 ms なので、余裕を持たせるだけでよい。
    testTimeout: 30_000,
  },
});
