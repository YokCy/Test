import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// WHY(import.meta.url): frontendは"type": "module"のためこのファイルはESMとして読み込まれ、
// CommonJS専用の__dirnameは使えない。import.meta.urlから同等のディレクトリパスを導出する。
const dirname = path.dirname(fileURLToPath(import.meta.url));

// WHY: adminのログイン情報（SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD）はリポジトリルートの.envで
// 管理している（backend/prisma/seed.tsが読む環境変数と同一）。Playwright単体で実行してもdocker-compose
// 経由の環境変数注入は効かないため、ここでルートの.envを明示的に読み込む。
dotenv.config({ path: path.resolve(dirname, "../.env") });

/**
 * E2Eテストの設定。
 * WHY(webServerを定義しない): docker-compose（frontend:5173, backend:3000, db:5433）を
 * 事前に起動しておく運用を前提とする。Playwright自身にdevサーバを二重起動させない。
 * WHY(timeout=60s): 出席マーク・フィードバック投稿系のシナリオは「開催日時が過去であること」を
 * 実際に時間が経過させて満たす方式を取っており（e2e-test-perspectives.md 0.3節）、単純なUI操作のみの
 * テストより長めの実行時間を要するため、既定のテストタイムアウトを緩めておく。
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  retries: 0,
  workers: 4,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      // WHY(既定をmemberに変更): ゴールデンパスの大半（イベント作成・参加登録等）は一般memberとしての
      // 操作であり、admin固定だと「主催者本人 or admin」の権限分岐を自然にテストできない
      // （e2e-test-perspectives.md 0.2節）。admin視点が必要なテストは各spec内で
      // `test.use({ storageState: "tests/.auth/admin.json" })` を個別に指定する。
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "tests/.auth/member.json" },
      dependencies: ["setup"],
    },
  ],
});
