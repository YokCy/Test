import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

import { loginAsNewContext } from "./helpers/auth";
import { MEMBER_CREDENTIALS } from "./helpers/credentials";
import { createEventViaUi, futureDate, futureMinuteAligned } from "./helpers/events";

// WHY: 6章「権限に応じた操作」はadmin視点の確認が中心のため、既定のmember storageStateではなく
// adminのstorageStateに差し替える（e2e-test-perspectives.md 0.2節）。organizer役・参加者役は
// このファイル内で`loginAsNewContext`を使い、別のmember（sato/suzuki）として個別に用意する。
test.use({ storageState: "tests/.auth/admin.json" });

async function openAsOrganizer(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  return loginAsNewContext(browser, MEMBER_CREDENTIALS.sato);
}

async function openAsParticipant(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  return loginAsNewContext(browser, MEMBER_CREDENTIALS.suzuki);
}

test.describe("出席管理画面の強制キャンセル操作（M-05、admin専用）", () => {
  test("強制キャンセルボタンはadminにのみ表示され、主催者（member）には表示されない", async ({
    page: adminPage,
    browser,
  }) => {
    const organizer = await openAsOrganizer(browser);
    const participant = await openAsParticipant(browser);

    try {
      const eventId = await createEventViaUi(organizer.page, {
        title: `E2E強制キャンセル権限確認-${Date.now()}`,
        startAt: futureDate(10 * 60 * 1000),
        capacity: 2,
      });

      await participant.page.goto(`/events/${eventId}`);
      await participant.page.getByRole("button", { name: "参加登録する" }).click();
      await expect(participant.page.getByRole("button", { name: "キャンセルする" })).toBeVisible();

      // Assert: 主催者（member）視点では強制キャンセルボタンが表示されない。
      await organizer.page.goto(`/events/${eventId}/attendance`);
      await expect(organizer.page.getByRole("button", { name: "強制キャンセル" })).not.toBeVisible();

      // Assert: 同じ画面をadminで開くと強制キャンセルボタンが表示される。
      await adminPage.goto(`/events/${eventId}/attendance`);
      await expect(adminPage.getByRole("button", { name: "強制キャンセル" })).toBeVisible();
    } finally {
      await organizer.context.close();
      await participant.context.close();
    }
  });

  test("キャンセル可能期限を過ぎた確定参加者でも、adminは強制キャンセルを実行できる", async ({
    page: adminPage,
    browser,
  }) => {
    const organizer = await openAsOrganizer(browser);
    const participant = await openAsParticipant(browser);

    try {
      // Arrange: 開催日時は未来だが、キャンセル可能期限は既に過ぎているイベントを作る
      // （e2e-test-perspectives.md 0.3節の通り、startAtは未来日時しか作成できないため、
      // cancellationDeadlineだけを過去に明示指定して期限超過状態を再現する）。
      const eventId = await createEventViaUi(organizer.page, {
        title: `E2E強制キャンセル実行確認-${Date.now()}`,
        startAt: futureDate(10 * 60 * 1000),
        capacity: 2,
        cancellationDeadline: futureDate(-60 * 1000),
      });

      await participant.page.goto(`/events/${eventId}`);
      await participant.page.getByRole("button", { name: "参加登録する" }).click();
      await expect(participant.page.getByRole("button", { name: "キャンセルする" })).toBeVisible();

      await adminPage.goto(`/events/${eventId}/attendance`);
      const participantRow = adminPage.locator('[data-testid^="attendance-row-"]', {
        hasText: MEMBER_CREDENTIALS.suzuki.name,
      });
      await expect(participantRow).toBeVisible();
      await participantRow.getByRole("button", { name: "強制キャンセル" }).click();

      const confirmDialog = adminPage.getByRole("dialog");
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog.getByText("キャンセル可能期限を過ぎていても取り消され")).toBeVisible();
      await confirmDialog.getByRole("button", { name: "強制キャンセルする" }).click();

      // Assert: 出席管理画面の一覧から対象者の行が消える（GET /events/:id/registrationsはCONFIRMEDのみ返すため）。
      await expect(confirmDialog).not.toBeVisible();
      await expect(participantRow).toHaveCount(0);

      // Assert: 参加者本人の画面（再読み込み後）でNOT_REGISTERED（「参加登録する」）に戻っている。
      await participant.page.reload();
      await expect(participant.page.getByRole("button", { name: "参加登録する" })).toBeVisible();
    } finally {
      await organizer.context.close();
      await participant.context.close();
    }
  });
});

test.describe("フィードバックの非公開化（M-06）・匿名表示（admin専用操作）", () => {
  test("非公開化ボタンの権限表示、非公開化の反映、匿名投稿の表示出し分けを一連で確認する", async ({
    page: adminPage,
    browser,
  }) => {
    test.setTimeout(120_000);

    const organizer = await openAsOrganizer(browser);
    const participant = await openAsParticipant(browser);

    try {
      // Arrange: 開催日時を数十秒後に設定し、実際に時間経過を待ってから出席マーク・フィードバック投稿へ
      // 進む（e2e-test-perspectives.md 0.3節の方式）。
      const startAt = futureMinuteAligned(20_000);
      const eventId = await createEventViaUi(organizer.page, {
        title: `E2E非公開化確認-${Date.now()}`,
        startAt,
        capacity: 2,
      });

      await participant.page.goto(`/events/${eventId}`);
      await participant.page.getByRole("button", { name: "参加登録する" }).click();
      await expect(participant.page.getByRole("button", { name: "キャンセルする" })).toBeVisible();

      const waitMs = startAt.getTime() - Date.now() + 10_000;
      if (waitMs > 0) {
        await adminPage.waitForTimeout(waitMs);
      }

      await organizer.page.goto(`/events/${eventId}/attendance`);
      const participantRow = organizer.page.locator('[data-testid^="attendance-row-"]', {
        hasText: MEMBER_CREDENTIALS.suzuki.name,
      });
      await expect(participantRow).toBeVisible();
      await participantRow.getByRole("button", { name: "出席" }).click();
      await expect(participantRow.getByRole("button", { name: "●出席" })).toBeVisible();

      await participant.page.goto(`/events/${eventId}/feedback`);
      await participant.page.getByRole("radio", { name: "5" }).click();
      await participant.page.getByLabel("コメント").fill("匿名投稿の表示確認用コメント");
      await participant.page.getByLabel("匿名で投稿する").check();
      await participant.page.getByRole("button", { name: "投稿する" }).click();

      // Assert: 一般member視点（参加者本人）では、匿名投稿の投稿者名が固定文言になる。
      await participant.page.goto(`/events/${eventId}`);
      const participantFeedbackItem = participant.page
        .locator("li", { hasText: "匿名投稿の表示確認用コメント" })
        .first();
      await expect(participantFeedbackItem).toContainText("匿名希望");
      await expect(participantFeedbackItem.getByRole("button", { name: "非公開化" })).not.toBeVisible();

      // Assert: admin視点では実際の投稿者名が表示され、非公開化ボタンも表示される。
      await adminPage.goto(`/events/${eventId}`);
      const adminFeedbackItem = adminPage.locator("li", { hasText: "匿名投稿の表示確認用コメント" }).first();
      await expect(adminFeedbackItem).toContainText(MEMBER_CREDENTIALS.suzuki.name);
      await expect(adminFeedbackItem).toContainText("（匿名投稿）");
      const hideButton = adminFeedbackItem.getByRole("button", { name: "非公開化" });
      await expect(hideButton).toBeVisible();

      await hideButton.click();
      const hideDialog = adminPage.getByRole("dialog");
      await expect(hideDialog).toBeVisible();
      await expect(hideDialog.getByText("非公開化したフィードバックは元に戻せません")).toBeVisible();
      await hideDialog.getByRole("button", { name: "非公開化する" }).click();
      await expect(hideDialog).not.toBeVisible();

      // Assert: 一般member視点（再読み込み後）でレビューが表示されなくなり、平均評価も再計算される。
      await participant.page.goto(`/events/${eventId}`);
      await expect(
        participant.page.locator("li", { hasText: "匿名投稿の表示確認用コメント" }),
      ).toHaveCount(0);
      await expect(participant.page.getByText(/レビュー（平均\s*評価なし、\s*0件）/)).toBeVisible();
    } finally {
      await organizer.context.close();
      await participant.context.close();
    }
  });
});
