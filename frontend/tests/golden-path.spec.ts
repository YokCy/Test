import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { loginAsNewContext } from "./helpers/auth";
import { MEMBER_CREDENTIALS } from "./helpers/credentials";
import { createEventViaUi, futureDate } from "./helpers/events";

/**
 * e2e-test-perspectives.md「2. ゴールデンパス: イベント作成→参加登録→出席マーク→フィードバック投稿」。
 * WHY(120秒): 出席マーク・フィードバック投稿は「開催日時が実際に経過するまで待つ」方式（0.3節）を取るため、
 * 既定の60秒（playwright.config.ts）では足りない可能性がある。
 */
test.setTimeout(120_000);

// WHY: `loginAsNewContext`で作った参加者用コンテキストは、テスト終了後に必ず閉じる
// （test-agentガイドライン）。テスト本体から`afterEach`のスコープへ渡すため、配列に集めておく。
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

test.describe("ゴールデンパス: イベント作成→参加登録→出席マーク→フィードバック投稿", () => {
  test("tanakaが主催するイベントにsatoが参加登録し、出席マーク・フィードバック投稿まで一連の流れが行えること", async ({
    page: tanakaPage,
    browser,
  }) => {
    // ---- 1. tanaka(主催者、既定のstorageState)がイベントを作成する ----
    // WHY(40秒後): 出席マーク・フィードバック投稿の前提となる「開催日時経過」を実際に待つため、
    // 手順2〜4（参加登録・表示確認）にかかる時間を見込みつつ、待ち時間を現実的な範囲に収める。
    const startAt = futureDate(40_000);
    const title = `ゴールデンパステスト_${Date.now()}`;
    const eventId = await createEventViaUi(tanakaPage, { title, startAt, capacity: 2 });

    await expect(tanakaPage.getByRole("heading", { name: title })).toBeVisible();
    await expect(tanakaPage.getByText("定員: 2名(残り 2名)")).toBeVisible();

    // ---- 2. satoが同イベントに参加登録する→CONFIRMEDになること ----
    const satoPage = await loginAsMember(browser, MEMBER_CREDENTIALS.sato);
    await satoPage.goto(`/events/${eventId}`);
    await satoPage.getByRole("button", { name: "参加登録する" }).click();
    await expect(satoPage.getByRole("button", { name: "キャンセルする" })).toBeVisible();

    // ---- 3. tanakaの画面には「あなたが主催者です」と表示され、参加登録ボタンが出ないこと ----
    await tanakaPage.reload();
    await expect(tanakaPage.getByText("あなたが主催者です")).toBeVisible();
    await expect(tanakaPage.getByRole("button", { name: "参加登録する" })).not.toBeVisible();

    // ---- 4. 参加登録後、残り人数表示が更新されること ----
    await expect(tanakaPage.getByText("定員: 2名(残り 1名)")).toBeVisible();
    await expect(tanakaPage.getByText("参加者一覧（1/2）")).toBeVisible();

    // ---- 開催日時が経過するまで待つ（0.3節の方式。UI描画待ちではなく業務上の時刻経過待ち） ----
    const waitMs = startAt.getTime() - Date.now() + 5_000;
    if (waitMs > 0) {
      await tanakaPage.waitForTimeout(waitMs);
    }

    // ---- 5. tanaka(主催者)が出席管理画面でsatoを「出席」としてマークする ----
    await tanakaPage.goto(`/events/${eventId}/attendance`);
    const satoAttendanceRow = tanakaPage.locator('[data-testid^="attendance-row-"]', {
      hasText: MEMBER_CREDENTIALS.sato.name,
    });
    await expect(satoAttendanceRow).toBeVisible();
    await satoAttendanceRow.getByRole("button", { name: "出席", exact: true }).click();
    await expect(satoAttendanceRow.getByRole("button", { name: "●出席" })).toBeVisible();

    // ---- 6. satoがフィードバック投稿画面で星評価・コメントを入力して投稿する ----
    await satoPage.goto(`/events/${eventId}/feedback`);
    await satoPage.getByRole("radio", { name: "5" }).click();
    await satoPage.getByLabel("コメント").fill("とても勉強になるイベントでした。");
    await satoPage.getByRole("button", { name: "投稿する" }).click();
    // WHY: クリック自体はミューテーション完了を待たないため、投稿完了後にフォームが編集モード
    // （「更新する」ボタン）へ切り替わることを明示的に待ってから後続の検証へ進む。
    await expect(satoPage.getByRole("button", { name: "更新する" })).toBeVisible();

    // レビューがイベント詳細のレビュー一覧に反映されること
    await tanakaPage.goto(`/events/${eventId}`);
    await expect(tanakaPage.getByText("とても勉強になるイベントでした。")).toBeVisible();
    await expect(tanakaPage.getByText("レビュー（平均 ★5.0、1件）")).toBeVisible();

    // ---- 7. 同じsatoが再度フィードバック投稿画面を開くと、投稿済み内容で初期化され「更新する」になること ----
    await satoPage.goto(`/events/${eventId}/feedback`);
    await expect(satoPage.getByRole("button", { name: "更新する" })).toBeVisible();
    await expect(satoPage.getByRole("radio", { name: "5", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(satoPage.getByLabel("コメント")).toHaveValue("とても勉強になるイベントでした。");
  });
});
