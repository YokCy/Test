import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { loginAsNewContext } from "./helpers/auth";
import { MEMBER_CREDENTIALS } from "./helpers/credentials";
import { createEventViaUi, futureDate, futureMinuteAligned } from "./helpers/events";

// WHY: 既定のchromiumプロジェクトはmember(tanaka)のstorageStateを使う（playwright.config.ts）。
// 本ファイルは「あるユーザー（tanaka）から見たマイページの反映」を確認するため、既定のまま利用する。

test.describe("マイページ（P-06）の3タブへの振り分け", () => {
  test("主催イベント/参加予定/参加履歴の各タブに、実際の主催・登録・開催経過が正しく反映される", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);

    const organizer = await loginAsNewContext(browser, MEMBER_CREDENTIALS.sato);

    try {
      const organizingTitle = `E2E主催イベント-${Date.now()}`;
      const upcomingTitle = `E2E参加予定イベント-${Date.now()}`;
      const historyTitle = `E2E参加履歴イベント-${Date.now()}`;

      // Arrange: 「主催イベント」タブ用にtanaka自身が主催するイベントを作る。
      await createEventViaUi(page, {
        title: organizingTitle,
        startAt: futureDate(10 * 60 * 1000),
        capacity: 5,
      });

      // Arrange: 「参加予定」タブ用に、他ユーザー（sato）が主催する未来のイベントへtanakaが登録する。
      const upcomingEventId = await createEventViaUi(organizer.page, {
        title: upcomingTitle,
        startAt: futureDate(10 * 60 * 1000),
        capacity: 5,
      });
      await page.goto(`/events/${upcomingEventId}`);
      await page.getByRole("button", { name: "参加登録する" }).click();
      await expect(page.getByRole("button", { name: "キャンセルする" })).toBeVisible();

      // Arrange: 「参加履歴」タブ用に、開催日時を数十秒後に設定したイベントへtanakaが登録し、
      // 実際に時間経過を待つ（e2e-test-perspectives.md 0.3節）。
      const historyStartAt = futureMinuteAligned(20_000);
      const historyEventId = await createEventViaUi(organizer.page, {
        title: historyTitle,
        startAt: historyStartAt,
        capacity: 5,
      });
      await page.goto(`/events/${historyEventId}`);
      await page.getByRole("button", { name: "参加登録する" }).click();
      await expect(page.getByRole("button", { name: "キャンセルする" })).toBeVisible();

      const waitMs = historyStartAt.getTime() - Date.now() + 10_000;
      if (waitMs > 0) {
        await page.waitForTimeout(waitMs);
      }

      await page.goto("/my-page");

      // Assert: 「主催イベント」タブ（既定タブ）にtanaka主催のイベントが表示される。
      await expect(page.getByText(organizingTitle)).toBeVisible();
      await expect(page.getByText(upcomingTitle)).not.toBeVisible();
      await expect(page.getByText(historyTitle)).not.toBeVisible();

      // Assert: 「参加予定」タブに切り替えると、まだ開催前のupcomingEventが「参加確定」で表示される。
      await page.getByRole("button", { name: "参加予定" }).click();
      await expect(page.getByText(organizingTitle)).not.toBeVisible();
      const upcomingRow = page.getByRole("link").filter({ hasText: upcomingTitle });
      await expect(upcomingRow).toBeVisible();
      await expect(upcomingRow.getByText("参加確定")).toBeVisible();
      // historyEventは既に開催日時を過ぎているため「参加予定」タブには出てこない。
      await expect(page.getByText(historyTitle)).not.toBeVisible();

      // Assert: 「参加履歴」タブに切り替えると、開催日時を過ぎたhistoryEventが「未マーク」で表示される
      // （出席マーク前は`attendanceStatus`が`null`のため）。
      await page.getByRole("button", { name: "参加履歴" }).click();
      const historyRow = page.getByRole("link").filter({ hasText: historyTitle });
      await expect(historyRow).toBeVisible();
      await expect(historyRow.getByText("未マーク")).toBeVisible();
      await expect(page.getByText(upcomingTitle)).not.toBeVisible();
    } finally {
      await organizer.context.close();
    }
  });

  test("タブ切り替えはURLを変えず、ブラウザの戻るボタンでマイページに来る前の画面に戻る", async ({
    page,
  }) => {
    await page.goto("/events");
    await page.goto("/my-page");
    await expect(page).toHaveURL(/\/my-page$/);

    await page.getByRole("button", { name: "参加予定" }).click();
    await expect(page).toHaveURL(/\/my-page$/);
    await page.getByRole("button", { name: "参加履歴" }).click();
    await expect(page).toHaveURL(/\/my-page$/);

    // Assert: タブ切り替え自体は履歴エントリを増やしていないため、戻るボタんで
    // マイページ遷移前の画面（イベント一覧）へ戻る。
    await page.goBack();
    await expect(page).toHaveURL(/\/events$/);
  });
});

test.describe("マイページの累計参加数・出席率・カテゴリ別集計の反映", () => {
  test("出席マーク＋フィードバック投稿後、累計参加数・出席率・カテゴリ別集計に反映される", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);

    const organizer = await loginAsNewContext(browser, MEMBER_CREDENTIALS.sato);

    try {
      await page.goto("/my-page");
      const beforeStats = await readStatsText(page);
      const beforeTotal = parseTotalParticipations(beforeStats);
      const beforeCategoryCount = parseCategoryCount(beforeStats, "勉強会");

      const startAt = futureMinuteAligned(20_000);
      const eventId = await createEventViaUi(organizer.page, {
        title: `E2E統計反映確認-${Date.now()}`,
        startAt,
        categoryName: "勉強会",
        capacity: 5,
      });

      await page.goto(`/events/${eventId}`);
      await page.getByRole("button", { name: "参加登録する" }).click();
      await expect(page.getByRole("button", { name: "キャンセルする" })).toBeVisible();

      const waitMs = startAt.getTime() - Date.now() + 10_000;
      if (waitMs > 0) {
        await page.waitForTimeout(waitMs);
      }

      await organizer.page.goto(`/events/${eventId}/attendance`);
      const row = organizer.page.locator('[data-testid^="attendance-row-"]', {
        hasText: MEMBER_CREDENTIALS.tanaka.name,
      });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "出席" }).click();
      await expect(row.getByRole("button", { name: "●出席" })).toBeVisible();

      await page.goto(`/events/${eventId}/feedback`);
      await page.getByRole("radio", { name: "4" }).click();
      await page.getByLabel("コメント").fill("マイページ統計反映確認用コメント");
      await page.getByRole("button", { name: "投稿する" }).click();
      await expect(page.getByRole("button", { name: "更新する" })).toBeVisible();

      await page.goto("/my-page");
      const afterStats = await readStatsText(page);
      const afterTotal = parseTotalParticipations(afterStats);
      const afterCategoryCount = parseCategoryCount(afterStats, "勉強会");

      // Assert: 今回出席済みで確定参加したイベントの分だけ、累計参加数・カテゴリ別集計が増える。
      expect(afterTotal).toBe(beforeTotal + 1);
      expect(afterCategoryCount).toBe(beforeCategoryCount + 1);
      // Assert: 出席マーク済みの登録が生まれたため、出席率は必ず数値（null以外）になる。
      expect(afterStats).toMatch(/出席率: \d+%/);
    } finally {
      await organizer.context.close();
    }
  });
});

/**
 * `StatsSummary`は「累計参加数/出席率」と「カテゴリ別」を別々の`<p>`要素で描画するため、
 * 両方を連結した文字列で返す（`data-testid`が無いため、テキストベースで2箇所を個別に取得する）。
 */
async function readStatsText(page: Page): Promise<string> {
  const totalsParagraph = page.locator("p", { hasText: "累計参加数:" });
  const categoryParagraph = page.locator("p", { hasText: "カテゴリ別:" });
  await expect(totalsParagraph).toBeVisible();
  await expect(categoryParagraph).toBeVisible();
  const totalsText = (await totalsParagraph.textContent()) ?? "";
  const categoryText = (await categoryParagraph.textContent()) ?? "";
  return `${totalsText} ${categoryText}`;
}

function parseTotalParticipations(statsText: string): number {
  const match = /累計参加数:\s*(\d+)件/.exec(statsText);
  if (!match) {
    throw new Error(`累計参加数を読み取れませんでした: ${statsText}`);
  }
  return Number(match[1]);
}

function parseCategoryCount(statsText: string, categoryName: string): number {
  const escaped = categoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}(\\d+)`);
  const match = pattern.exec(statsText);
  return match ? Number(match[1]) : 0;
}
