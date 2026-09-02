import type { Config } from "jest";

/**
 * backend配下のユニットテスト実行設定。
 * CODING_STANDARDS.md 6章「ファイル構成」の通り、テスト対象と同じディレクトリへのコロケーション
 * 配置（例: `events.service.ts` → `events.service.spec.ts`）とする。
 * WHY: tsconfig.json の `module: "node16"` / `moduleResolution: "node16"` をそのままts-jestに渡すと
 * CommonJS実行環境のJestと相性が悪い（`node16`はファイル単位でESM/CJSを切り替える設定であり、Jestの
 * requireベースの読み込みと衝突しうる）ため、テスト変換時のみcommonjs/nodeへ上書きする。
 */
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  setupFiles: ["reflect-metadata"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          target: "ES2022",
          esModuleInterop: true,
          verbatimModuleSyntax: false,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
  },
};

export default config;
