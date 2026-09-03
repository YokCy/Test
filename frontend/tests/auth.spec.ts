import { expect, test } from "@playwright/test";

import { MEMBER_CREDENTIALS } from "./helpers/credentials";

/**
 * e2e-test-perspectives.md「1. 認証・アクセス制御横断」。
 */

test.describe("未ログイン状態でのアクセス制御", () => {
  // WHY: 既定のchromiumプロジェクト（playwright.config.ts）はmember（tanaka）のstorageStateを
  // 使い回すため、未ログイン状態を検証するテストだけは空のstorageStateで上書きする。
  test.use({ storageState: { cookies: [], origins: [] } });

  test("未ログイン状態で保護されたURL(/events)へ直接アクセスするとログイン画面(P-01)へリダイレクトされること", async ({
    page,
  }) => {
    await page.goto("/events");

    await page.waitForURL("**/login");
    await expect(page.getByRole("heading", { name: "EventBoard ログイン" })).toBeVisible();
  });

  test("ログイン→イベント一覧表示→ログアウト→保護URL再アクセスで再びログイン画面へリダイレクトされること", async ({
    page,
  }) => {
    const { email, password, name } = MEMBER_CREDENTIALS.tanaka;

    // ---- ログイン→イベント一覧が表示されること ----
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill(password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.waitForURL("**/events");
    await expect(page.getByRole("heading", { name: "イベント一覧" })).toBeVisible();

    // ---- ログアウト→ログイン画面に戻ること ----
    await page.getByRole("button", { name }).click();
    await page.getByRole("button", { name: "ログアウト" }).click();
    await page.waitForURL("**/login");

    // ---- ログアウト後、再度保護URLへアクセスするとログイン画面へリダイレクトされること ----
    await page.goto("/events");
    await page.waitForURL("**/login");
    await expect(page.getByRole("heading", { name: "EventBoard ログイン" })).toBeVisible();
  });
});

test.describe("member権限のアクセス制御", () => {
  // 既定のchromiumプロジェクト（member=tanaka）のstorageStateをそのまま使う。

  test("member権限で/admin/categoriesへ直接アクセスすると404相当の画面(P-10)が表示されること", async ({
    page,
  }) => {
    await page.goto("/admin/categories");

    await expect(
      page.getByText("お探しのページが見つからないか、アクセスする権限がありません"),
    ).toBeVisible();
  });

  test("memberのヘッダーには「カテゴリ管理」導線が表示されないこと", async ({ page }) => {
    await page.goto("/events");

    await expect(page.getByRole("link", { name: "カテゴリ管理" })).toHaveCount(0);
  });
});

test.describe("admin権限のアクセス制御", () => {
  test.use({ storageState: "tests/.auth/admin.json" });

  test("adminのヘッダーには「カテゴリ管理」導線が表示され、そこから遷移できること", async ({ page }) => {
    await page.goto("/events");

    const categoriesLink = page.getByRole("link", { name: "カテゴリ管理" });
    await expect(categoriesLink).toBeVisible();

    await categoriesLink.click();
    await page.waitForURL("**/admin/categories");
    await expect(page.getByRole("heading", { name: "カテゴリマスタ管理" })).toBeVisible();
  });
});
