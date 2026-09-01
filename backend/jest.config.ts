import type { Config } from "jest";

/**
 * backend配下のユニットテスト実行設定。
 * WHY: 本プロジェクトのバックエンドテストは本来コロケーション配置（`*.spec.ts`）だが、
 * test-agent運用ではユーザー指示により `src/tests/*.test.ts` に集約する。tsconfig.json の `module: "node16"` /
 * `moduleResolution: "node16"` をそのままts-jestに渡すとCommonJS実行環境のJestと
 * 相性が悪い（`node16`はファイル単位でESM/CJSを切り替える設定であり、Jestの
 * requireベースの読み込みと衝突しうる）ため、テスト変換時のみcommonjs/nodeへ上書きする。
 */
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/src/tests/**/*.test.ts"],
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
