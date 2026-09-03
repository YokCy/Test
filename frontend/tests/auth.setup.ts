import { test as setup } from "@playwright/test";

import { ADMIN_CREDENTIALS, MEMBER_CREDENTIALS } from "./helpers/credentials";

const ADMIN_STORAGE_STATE = "tests/.auth/admin.json";
const MEMBER_STORAGE_STATE = "tests/.auth/member.json";

/**
 * `playwright.config.ts`の`setup`プロジェクトが最初に実行するログイン処理。
 * admin用・member用（田中太郎で代表）のstorageStateをそれぞれ生成する
 * （e2e-test-perspectives.md 0.2節「adminのstorageStateのみでは主催者=admin固定になってしまう」対応）。
 */
setup("authenticate as admin", async ({ page }) => {
  if (!ADMIN_CREDENTIALS.email || !ADMIN_CREDENTIALS.password) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD が未設定です。ルートの.envを確認してください（.env.example参照）。",
    );
  }

  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(ADMIN_CREDENTIALS.email);
  await page.getByLabel("パスワード").fill(ADMIN_CREDENTIALS.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL("**/events");

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});

setup("authenticate as member (tanaka)", async ({ page }) => {
  const { email, password } = MEMBER_CREDENTIALS.tanaka;

  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL("**/events");

  await page.context().storageState({ path: MEMBER_STORAGE_STATE });
});
