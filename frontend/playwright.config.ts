import { defineConfig, devices } from "@playwright/test";

/**
 * E2Eテストの設定。テストケース自体はドメイン設計確定後に`./tests`配下へ追加していく。
 * WHY(webServerを定義しない): docker-compose（frontend:5173, backend:3000, db:5433）を
 * 事前に起動しておく運用を前提とする。Playwright自身にdevサーバを二重起動させない。
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
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
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "tests/.auth/admin.json" },
      dependencies: ["setup"],
    },
  ],
});
