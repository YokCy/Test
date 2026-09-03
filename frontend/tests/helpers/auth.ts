import type { Browser, BrowserContext, Page } from "@playwright/test";

/**
 * 新しいブラウザコンテキストでログイン済みのページを作る。
 * WHY: 満席時の自動繰り上げ・adminによる強制キャンセル等、1テスト内で複数ユーザーが同時にログイン済みで
 * あることを要求するシナリオでは、既定のstorageState（`playwright.config.ts`のchromiumプロジェクト）
 * だけでは表現できない。テストごとに必要な人数分のコンテキストをこのヘルパーで作り、テスト終了時に
 * `context.close()`で片付ける（`test.afterEach`等で呼び出し元が責任を持つ）。
 */
export async function loginAsNewContext(
  browser: Browser,
  credentials: { email: string; password: string },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(credentials.email);
  await page.getByLabel("パスワード").fill(credentials.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL("**/events");

  return { context, page };
}
