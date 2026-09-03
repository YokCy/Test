import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { loginAsNewContext } from "./helpers/auth";
import { MEMBER_CREDENTIALS } from "./helpers/credentials";
import { createEventViaUi, futureDate } from "./helpers/events";

/**
 * e2e-test-perspectives.md「3. 満席時のキャンセル待ち登録→キャンセル→自動繰り上げ」。
 * `capacity: 1`のイベントで、tanaka=主催者、sato=1人目(CONFIRMED)、suzuki=2人目(WAITLISTED)。
 */

const openContexts: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(openContexts.map((context) => context.close()));
  openContexts.length = 0;
});

async function loginAsMember(
  browser: Browser,
  credentials: { email: string; password: string },
): Promise<Page> {
  const { context, page } = await loginAsNewContext(browser, credentials);
  openContexts.push(context);
  return page;
}

test.describe("満席時のキャンセル待ち登録→キャンセル→自動繰り上げ", () => {
  test("定員超過でWAITLISTEDになった参加者が、先着者のキャンセルによりCONFIRMEDへ自動繰り上がること", async ({
    page: tanakaPage,
    browser,
  }) => {
    // ---- tanakaが定員1名のイベントを作成する ----
    const startAt = futureDate(7 * 24 * 60 * 60 * 1000);
    const title = `満席キャンセル待ちテスト_${Date.now()}`;
    const eventId = await createEventViaUi(tanakaPage, { title, startAt, capacity: 1 });

    const satoPage = await loginAsMember(browser, MEMBER_CREDENTIALS.sato);
    const suzukiPage = await loginAsMember(browser, MEMBER_CREDENTIALS.suzuki);

    // ---- 1. satoが登録→CONFIRMEDになること ----
    await satoPage.goto(`/events/${eventId}`);
    await satoPage.getByRole("button", { name: "参加登録する" }).click();
    await expect(satoPage.getByRole("button", { name: "キャンセルする" })).toBeVisible();

    // ---- 2. suzukiが登録→定員超過のためWAITLISTEDとして登録され、「キャンセル待ち中（1番目）」と表示されること ----
    await suzukiPage.goto(`/events/${eventId}`);
    await suzukiPage.getByRole("button", { name: "参加登録する" }).click();
    await expect(suzukiPage.getByRole("button", { name: "キャンセル待ちをやめる" })).toBeVisible();
    // WHY: 画面設計仕様.md 3.1.3の例では「WAITLISTED→キャンセル待ち中(3番目)」のように、P-03詳細画面でも
    // 順位付きで表示される仕様になっている。もし本アサーションが失敗する場合、GET /events/:idの
    // レスポンス型（EventDetail）にposition相当のフィールドが無く、RegistrationActionButtonへ
    // position propが渡っていない実装漏れの可能性が高い（frontend/src/features/events/api.tsの
    // EventDetail、EventDetailPage.tsxを参照）。
    await expect(suzukiPage.getByText("キャンセル待ち中（1番目）")).toBeVisible();

    await tanakaPage.goto(`/events/${eventId}`);
    await expect(tanakaPage.getByText("キャンセル待ち 1名")).toBeVisible();

    // ---- 3. satoが「キャンセルする」を実行する（M-04確認モーダル） ----
    await satoPage.getByRole("button", { name: "キャンセルする" }).click();
    const cancelDialog = satoPage.getByRole("dialog");
    await expect(cancelDialog).toBeVisible();
    await expect(cancelDialog.getByText("繰り上げが発生する場合があります")).toBeVisible();
    await cancelDialog.getByRole("button", { name: "キャンセルする" }).click();
    await expect(cancelDialog).not.toBeVisible();
    await expect(satoPage.getByRole("button", { name: "参加登録する" })).toBeVisible();

    // ---- 4. suzukiの画面(再読み込み後)でCONFIRMEDに自動繰り上がっていること ----
    await suzukiPage.reload();
    await expect(suzukiPage.getByRole("button", { name: "キャンセルする" })).toBeVisible();
    await expect(suzukiPage.getByText("キャンセル待ち中", { exact: false })).not.toBeVisible();

    // ---- 5. 繰り上げ後、イベント詳細の参加者数・空き状況表示が正しく更新されていること ----
    await tanakaPage.reload();
    await expect(tanakaPage.getByText("定員: 1名(残り 0名)")).toBeVisible();
    await expect(tanakaPage.getByText("参加者一覧（1/1）")).toBeVisible();
    // WHY: 単純に「キャンセル待ち」を含むテキストで検索すると、イベントタイトル自体
    // （`満席キャンセル待ちテスト_...`）に一致してしまう。キャンセル待ち件数バッジの実際の文言
    // （EventDetailPage.tsx「キャンセル待ち {n}名」）に絞って不在を確認する。
    await expect(tanakaPage.getByText(/キャンセル待ち \d+名/)).not.toBeVisible();
  });
});
