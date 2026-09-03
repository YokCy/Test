import { expect, test } from "@playwright/test";

import { expectSuccessData, loginBackendContext } from "./helpers/api";
import { loginAsNewContext } from "./helpers/auth";
import { MEMBER_CREDENTIALS } from "./helpers/credentials";
import { createEventViaUi, futureDate, futureMinuteAligned } from "./helpers/events";

/**
 * e2e-test-perspectives.md「8. エッジケース・意地悪テスト」に対応するE2E。
 * 各テストは自分専用のイベントを作成し、他テストの残存データに依存しない（0.3節）。
 * WHY(registrationDeadline/cancellationDeadlineを過去日時で作成): `startAt`と異なりサーバー側は
 * 締切系の日時が未来であることを検証しないため（`EventsService.assertFutureStartAt`は`startAt`専用）、
 * 実際に時間が経過するのを待たずに「締切超過」状態を再現できる。0.3節が言及する「実際に時間経過を待つ」
 * 方式は、締切ではなくイベント自体の開催日時が過去である必要がある場合（出席マーク等）にのみ用いる。
 */
test.describe("8. エッジケース・意地悪テスト", () => {
  test("登録締切を過ぎたイベントは登録ボタンが無効化され、クリックしてもAPIが呼ばれないこと", async ({
    page,
    browser,
  }) => {
    const eventId = await createEventViaUi(page, {
      title: `締切超過テスト ${Date.now()}`,
      startAt: futureDate(2 * 24 * 60 * 60 * 1000),
      registrationDeadline: futureDate(-60 * 1000),
    });

    const { context, page: participantPage } = await loginAsNewContext(browser, MEMBER_CREDENTIALS.sato);
    try {
      let registerRequested = false;
      await participantPage.route(`**/events/${eventId}/register`, async (route) => {
        registerRequested = true;
        await route.abort();
      });

      await participantPage.goto(`/events/${eventId}`);
      const button = participantPage.getByRole("button", { name: "登録締切を過ぎました" });
      await expect(button).toBeVisible();
      await expect(button).toBeDisabled();

      // WHY(force: true): ブラウザはdisabled指定されたネイティブ<button>に対しclickイベント自体を
      // 発火させない（合成イベントで強制しても同様）ため、`force`で通常のactionabilityチェック
      // （enabled待ち）を素通りさせても「実際にクリックしても何も起きないこと」を確認できる。
      await button.click({ force: true }).catch(() => undefined);

      expect(registerRequested).toBe(false);
      await expect(participantPage.getByRole("button", { name: "登録締切を過ぎました" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("キャンセル可能期限を過ぎた確定参加者本人によるキャンセルは403で拒否され、CONFIRMEDのままであること", async ({
    page,
    browser,
  }) => {
    const eventId = await createEventViaUi(page, {
      title: `キャンセル期限超過テスト ${Date.now()}`,
      startAt: futureDate(2 * 24 * 60 * 60 * 1000),
      cancellationDeadline: futureDate(-60 * 1000),
    });

    const { context, page: participantPage } = await loginAsNewContext(browser, MEMBER_CREDENTIALS.sato);
    try {
      await participantPage.goto(`/events/${eventId}`);
      await participantPage.getByRole("button", { name: "参加登録する" }).click();
      await expect(participantPage.getByRole("button", { name: "キャンセルする" })).toBeVisible();

      await participantPage.getByRole("button", { name: "キャンセルする" }).click();
      const dialog = participantPage.getByRole("dialog");
      await dialog.getByRole("button", { name: "キャンセルする" }).click();

      await expect(participantPage.getByTestId("toast")).toContainText("キャンセル可能期限を過ぎている");

      // WHY: RegistrationActionButton.handleConfirmCancelはエラー時にダイアログを閉じない
      // （成功時のみsetIsConfirmOpen(false)する実装のため）。「戻る」で明示的に閉じ、
      // 参加登録がCONFIRMEDのまま取り消されていないことを確認する。
      await dialog.getByRole("button", { name: "戻る" }).click();
      await expect(participantPage.getByRole("button", { name: "キャンセルする" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("参加登録ボタンを連続クリックしても、CONFIRMEDが2件になる二重登録は起きないこと", async ({
    page,
    browser,
  }) => {
    const eventId = await createEventViaUi(page, {
      title: `二重登録防止テスト ${Date.now()}`,
      startAt: futureDate(2 * 24 * 60 * 60 * 1000),
      capacity: 5,
    });

    const { context, page: participantPage } = await loginAsNewContext(browser, MEMBER_CREDENTIALS.sato);
    try {
      await participantPage.goto(`/events/${eventId}`);
      const registerButton = participantPage.getByRole("button", { name: "参加登録する" });
      await expect(registerButton).toBeVisible();

      // WHY: 連打を再現するため、送信中disabledの反映を待たずにほぼ同時に2回クリックを試みる。
      // 2回目が「既にdisabledで何も起きない」か「サーバーの一意制約で409になる」かは問わず、
      // 最終的にCONFIRMEDが1件だけになっていることのみを検証する。
      await Promise.allSettled([registerButton.click(), registerButton.click()]);

      await expect(participantPage.getByRole("button", { name: "キャンセルする" })).toBeVisible();

      const backendContext = await loginBackendContext(MEMBER_CREDENTIALS.sato);
      try {
        const detail = await expectSuccessData<{ confirmedCount: number }>(
          await backendContext.get(`/events/${eventId}`),
        );
        expect(detail.confirmedCount).toBe(1);
      } finally {
        await backendContext.dispose();
      }
    } finally {
      await context.close();
    }
  });

  test("フィードバック投稿ボタンを連続クリックしても、1人1件を超える二重投稿にならないこと", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);

    const startAt = futureMinuteAligned(15_000);
    const eventId = await createEventViaUi(page, {
      title: `二重投稿防止テスト ${Date.now()}`,
      startAt,
      capacity: 5,
    });

    const { context, page: participantPage } = await loginAsNewContext(browser, MEMBER_CREDENTIALS.sato);
    try {
      await participantPage.goto(`/events/${eventId}`);
      await participantPage.getByRole("button", { name: "参加登録する" }).click();
      await expect(participantPage.getByRole("button", { name: "キャンセルする" })).toBeVisible();

      // WHY(0.3節): 出席マーク・フィードバック投稿の前提「開催日時が過去であること」は、
      // サーバー側の実時刻判定を素通りしないよう実際に時間が経過するまで待つ。
      const waitMs = startAt.getTime() - Date.now() + 3000;
      if (waitMs > 0) {
        await participantPage.waitForTimeout(waitMs);
      }

      const organizerContext = await loginBackendContext(MEMBER_CREDENTIALS.tanaka);
      const participantBackendContext = await loginBackendContext(MEMBER_CREDENTIALS.sato);
      try {
        const satoMe = await expectSuccessData<{ id: string }>(await participantBackendContext.get("/auth/me"));
        const markResponse = await organizerContext.put(
          `/events/${eventId}/registrations/${satoMe.id}/attendance`,
          { data: { attendanceStatus: "ATTENDED" } },
        );
        expect(markResponse.ok()).toBe(true);

        await participantPage.goto(`/events/${eventId}/feedback`);
        await participantPage.getByRole("radio", { name: "5" }).click();
        await participantPage.getByLabel("コメント").fill("とても良い勉強会でした");

        const submitButton = participantPage.getByRole("button", { name: "投稿する" });
        await expect(submitButton).toBeVisible();
        // WHY: 参加登録の二重クリックテストと同様、連打を再現するためほぼ同時に2回クリックする。
        await Promise.allSettled([submitButton.click(), submitButton.click()]);

        await participantPage.waitForLoadState("networkidle");

        const feedbacks = await expectSuccessData<{ feedbacks: { isMine: boolean }[] }>(
          await participantBackendContext.get(`/events/${eventId}/feedbacks`),
        );
        expect(feedbacks.feedbacks.filter((feedback) => feedback.isMine)).toHaveLength(1);
      } finally {
        await organizerContext.dispose();
        await participantBackendContext.dispose();
      }
    } finally {
      await context.close();
    }
  });

  test("投稿条件（開催終了済み＋出席済み）を満たさないイベントのフィードバック投稿URLへ直接アクセスすると、実サーバーの403を経由して理由メッセージが表示されること", async ({
    page,
    browser,
  }) => {
    const eventId = await createEventViaUi(page, {
      title: `投稿条件未達テスト ${Date.now()}`,
      startAt: futureDate(2 * 24 * 60 * 60 * 1000),
    });

    const { context, page: participantPage } = await loginAsNewContext(browser, MEMBER_CREDENTIALS.sato);
    try {
      await participantPage.goto(`/events/${eventId}`);
      await participantPage.getByRole("button", { name: "参加登録する" }).click();
      await expect(participantPage.getByRole("button", { name: "キャンセルする" })).toBeVisible();

      // WHY: 他画面のリンクを経由せず、フィードバック投稿URLへ直接アクセスする（他画面経由だと
      // 実際にはリンク自体が出ていても踏めてしまう場合との区別が付かないため）。
      await participantPage.goto(`/events/${eventId}/feedback`);

      // WHY: FeedbackPage自体はページ表示時点では投稿条件を検証しない（フォームは常に表示される）。
      // 403での理由表示は、実際に`onSubmit`でPOST /feedbacksを呼んで初めてサーバー側の判定結果として
      // 表示される（`FeedbackForm`の`onIneligible`コールバック経由）。星評価未選択のままだと
      // クライアント側バリデーションで止まってしまうため、評価を選択してから送信する。
      await participantPage.getByRole("radiogroup", { name: "評価" }).getByRole("radio", { name: "5" }).click();
      await participantPage.getByLabel("コメント").fill("テストコメント");
      await participantPage.getByRole("button", { name: "投稿する" }).click();

      await expect(
        participantPage.getByText("開催終了かつ出席済みのイベントのみフィードバックを投稿できます"),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("定員1名のイベントに2人がほぼ同時に登録しても、CONFIRMEDが2件になることはないこと", async ({ page }) => {
    const eventId = await createEventViaUi(page, {
      title: `同時登録テスト ${Date.now()}`,
      startAt: futureDate(2 * 24 * 60 * 60 * 1000),
      capacity: 1,
    });

    const satoContext = await loginBackendContext(MEMBER_CREDENTIALS.sato);
    const suzukiContext = await loginBackendContext(MEMBER_CREDENTIALS.suzuki);
    try {
      const [satoResponse, suzukiResponse] = await Promise.all([
        satoContext.post(`/events/${eventId}/register`),
        suzukiContext.post(`/events/${eventId}/register`),
      ]);

      const satoBody = (await satoResponse.json()) as { data?: { status: string } };
      const suzukiBody = (await suzukiResponse.json()) as { data?: { status: string } };
      const statuses = [satoBody.data?.status, suzukiBody.data?.status].filter(
        (status): status is string => status !== undefined,
      );

      expect(statuses).toHaveLength(2);
      expect(statuses.filter((status) => status === "CONFIRMED")).toHaveLength(1);
      expect(statuses.filter((status) => status === "WAITLISTED")).toHaveLength(1);

      const detail = await expectSuccessData<{ confirmedCount: number }>(
        await satoContext.get(`/events/${eventId}`),
      );
      expect(detail.confirmedCount).toBe(1);
    } finally {
      await satoContext.dispose();
      await suzukiContext.dispose();
    }
  });

  test("同一ブラウザで別ユーザーとしてログインし直すと、既存タブのセッションも新ユーザーに切り替わること", async ({
    page,
    context,
  }) => {
    await page.goto("/events");
    await expect(page.getByText(`👤 ${MEMBER_CREDENTIALS.tanaka.name}`)).toBeVisible();

    const secondPage = await context.newPage();
    try {
      await secondPage.goto("/login");
      await secondPage.getByLabel("メールアドレス").fill(MEMBER_CREDENTIALS.sato.email);
      await secondPage.getByLabel("パスワード").fill(MEMBER_CREDENTIALS.sato.password);
      await secondPage.getByRole("button", { name: "ログイン" }).click();
      await secondPage.waitForURL("**/events");

      // WHY: httpOnly CookieはブラウザコンテキストAPI全体で共有されるため、別タブでの再ログインが
      // 既存タブ（page）のセッションにも反映される。「別ユーザーのはずが403にならない」という
      // 過去の誤解を招いた挙動が意図した仕様であることを回帰確認する（e2e-test-perspectives.md 8章#7）。
      await page.reload();
      await expect(page.getByText(`👤 ${MEMBER_CREDENTIALS.sato.name}`)).toBeVisible();
    } finally {
      await secondPage.close();
    }
  });

  test("イベント一覧取得APIが失敗しても、画面がクラッシュせずエラー表示になること", async ({ page }) => {
    await page.route("**/events?*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: { code: "InternalServerError", message: "擬似的な障害です" },
        }),
      });
    });

    await page.goto("/events");

    // WHY(timeout延長): TanStack Queryの既定リトライ（3回、指数バックオフ）が尽きるまで
    // isErrorがtrueにならないため、既定の5秒より長めに待つ。
    await expect(page.getByText("イベント一覧の取得に失敗しました。")).toBeVisible({ timeout: 20_000 });
  });
});
