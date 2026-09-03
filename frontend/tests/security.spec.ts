import { expect, test, type APIRequestContext } from "@playwright/test";

import {
  createBackendContext,
  createBackendContextWithCookie,
  expectSuccessData,
  getAnyCategoryId,
  loginBackendContext,
} from "./helpers/api";
import { loginAsNewContext } from "./helpers/auth";
import { ADMIN_CREDENTIALS, MEMBER_CREDENTIALS } from "./helpers/credentials";
import { createEventViaUi, futureDate, futureMinuteAligned } from "./helpers/events";

/**
 * e2e-test-perspectives.md「9. セキュリティテスト（認可バイパス・情報漏えい）」に対応するE2E。
 * 方針（9章冒頭の記述を厳守）:
 * - 実データを削除・無効化・書き換えるような破壊的リクエストは一切送らない。
 * - 書き込みが必要なテストも、必ずテスト自身が作成した使い捨てデータ（自分が主催するイベント・
 *   自分が投稿したフィードバック等）のみを対象にする。他ユーザー・シード済みアカウントの状態は
 *   読み取る（`GET /auth/me`等）ことはあっても、一切変更しない。
 * - UI操作ではなく`@playwright/test`が公開するスタンドアロンAPIコンテキスト
 *   （`playwrightRequest.newContext()`）でバックエンド（`http://localhost:3000`）を直接呼び出す。
 */

/**
 * 「開催日時が過去であること」を要求する出席マーク・フィードバック投稿の前提を満たすため、
 * 実際に開催日時が経過するまで待つ（0.3節の方式。UIの描画待ちではなく業務上の時刻経過待ちのため
 * 固定`setTimeout`を用いる）。
 */
async function waitUntil(target: Date, bufferMs = 3000): Promise<void> {
  const waitMs = target.getTime() - Date.now() + bufferMs;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

/**
 * 「開催終了済み＋出席済み」の投稿条件を満たすフィードバックを1件、自分（sato）名義で作成する
 * （organizerはtanaka）。呼び出し元は返却された`organizer`/`participant`コンテキストを
 * 必ず`dispose()`すること。
 */
async function createAttendedFeedback(options: {
  isAnonymous: boolean;
  rating?: number;
  comment?: string;
}): Promise<{
  organizer: APIRequestContext;
  participant: APIRequestContext;
  eventId: string;
  feedbackId: string;
  participantUserId: string;
}> {
  const organizer = await loginBackendContext(MEMBER_CREDENTIALS.tanaka);
  const participant = await loginBackendContext(MEMBER_CREDENTIALS.sato);

  const categoryId = await getAnyCategoryId(organizer);
  const startAt = futureDate(15_000);

  const event = await expectSuccessData<{ id: string }>(
    await organizer.post("/events", {
      data: {
        title: `情報漏えい確認用イベント ${Date.now()}`,
        categoryId,
        startAt: startAt.toISOString(),
        capacity: 5,
      },
    }),
  );

  await expectSuccessData(await participant.post(`/events/${event.id}/register`));

  await waitUntil(startAt);

  const participantMe = await expectSuccessData<{ id: string }>(await participant.get("/auth/me"));
  await expectSuccessData(
    await organizer.put(`/events/${event.id}/registrations/${participantMe.id}/attendance`, {
      data: { attendanceStatus: "ATTENDED" },
    }),
  );

  const feedback = await expectSuccessData<{ id: string }>(
    await participant.post(`/events/${event.id}/feedbacks`, {
      data: {
        rating: options.rating ?? 4,
        comment: options.comment ?? "とても勉強になりました",
        isAnonymous: options.isAnonymous,
      },
    }),
  );

  return { organizer, participant, eventId: event.id, feedbackId: feedback.id, participantUserId: participantMe.id };
}

test.describe("9.1 未認証・認可バイパス（読み取り系IDOR・情報漏えい）", () => {
  test("未認証（Cookie無し）で保護APIを呼び出すと401になり、レスポンスにデータが一切含まれないこと", async () => {
    const anonymous = await createBackendContext();
    try {
      const protectedPaths = ["/events", "/events/nonexistent-dummy-id", "/users/me/stats"];

      for (const path of protectedPaths) {
        const response = await anonymous.get(path);
        expect(response.status(), `${path}は401であるべき`).toBe(401);

        const body = (await response.json()) as { success: boolean; data?: unknown };
        expect(body.success).toBe(false);
        expect(body.data).toBeUndefined();
      }
    } finally {
      await anonymous.dispose();
    }
  });

  test("改ざん・無効な値のAccess Token Cookieでは401になり、他人の情報が閲覧できないこと", async () => {
    const tampered = await createBackendContextWithCookie("access_token", "tampered.invalid-jwt.value");
    try {
      const response = await tampered.get("/users/me/stats");
      expect(response.status()).toBe(401);

      const body = (await response.json()) as { success: boolean; data?: unknown };
      expect(body.success).toBe(false);
      expect(body.data).toBeUndefined();
    } finally {
      await tampered.dispose();
    }
  });

  test("主催者本人でもadminでもないユーザーが、他人のイベントの参加者一覧APIを直接呼び出すと403になり参加者情報が読み取れないこと", async ({
    browser,
  }) => {
    const { context: organizerBrowserContext, page: organizerPage } = await loginAsNewContext(
      browser,
      MEMBER_CREDENTIALS.sato,
    );
    let victimEventId: string;
    try {
      victimEventId = await createEventViaUi(organizerPage, {
        title: `IDOR確認用イベント ${Date.now()}`,
        startAt: futureDate(2 * 24 * 60 * 60 * 1000),
      });
    } finally {
      await organizerBrowserContext.close();
    }

    const attacker = await loginBackendContext(MEMBER_CREDENTIALS.tanaka);
    try {
      const response = await attacker.get(`/events/${victimEventId}/registrations`);
      expect(response.status()).toBe(403);

      const bodyText = await response.text();
      expect(bodyText).not.toContain(MEMBER_CREDENTIALS.sato.name);
      expect(bodyText).not.toContain(MEMBER_CREDENTIALS.sato.email);

      const body = JSON.parse(bodyText) as { success: boolean; data?: unknown };
      expect(body.success).toBe(false);
      expect(body.data).toBeUndefined();
    } finally {
      await attacker.dispose();
    }
  });

  test("member権限でadmin専用のユーザー一覧APIを呼び出すと403になり、全ユーザー情報が読み取れないこと", async () => {
    const member = await loginBackendContext(MEMBER_CREDENTIALS.tanaka);
    try {
      const response = await member.get("/users");
      expect(response.status()).toBe(403);

      const bodyText = await response.text();
      // WHY: emailはユーザーごとに一意なため、レスポンスに他ユーザー分の一覧が漏れていないことの
      // 具体的な確認としてsato/suzukiのemailが含まれていないことまで見る。
      expect(bodyText).not.toContain(MEMBER_CREDENTIALS.sato.email);
      expect(bodyText).not.toContain(MEMBER_CREDENTIALS.suzuki.email);

      const body = JSON.parse(bodyText) as { success: boolean; data?: unknown };
      expect(body.success).toBe(false);
      expect(body.data).toBeUndefined();
    } finally {
      await member.dispose();
    }
  });

  test("非公開化されたフィードバックは、一般ユーザー視点のGETレスポンスに一切含まれないこと", async () => {
    test.setTimeout(90_000);

    const secretMarker = `非公開マーカーコメント${Date.now()}`;
    const { organizer, participant, eventId, feedbackId } = await createAttendedFeedback({
      isAnonymous: false,
      comment: secretMarker,
    });
    const admin = await loginBackendContext(ADMIN_CREDENTIALS);
    const bystander = await loginBackendContext(MEMBER_CREDENTIALS.suzuki);
    try {
      await expectSuccessData(await admin.post(`/feedbacks/${feedbackId}/hide`));

      const response = await bystander.get(`/events/${eventId}/feedbacks`);
      const bodyText = await response.text();

      // WHY: 表示上隠しているだけでなく、レスポンスJSON自体（開発者ツールのネットワークタブ相当）に
      // 対象フィードバックのid・本文が一切含まれていないことまで確認する。
      expect(bodyText).not.toContain(feedbackId);
      expect(bodyText).not.toContain(secretMarker);

      // WHY: レスポンスは`{ success, data: { feedbacks: [...] } }`の形（MANIFEST.md 6章の
      // レスポンス形式規約）であり、`feedbacks`はトップレベルではなく`data`の下にある。
      const body = JSON.parse(bodyText) as { success: boolean; data: { feedbacks: { id: string }[] } };
      expect(body.data.feedbacks.some((feedback) => feedback.id === feedbackId)).toBe(false);
    } finally {
      await organizer.dispose();
      await participant.dispose();
      await admin.dispose();
      await bystander.dispose();
    }
  });

  test("匿名投稿されたフィードバックは、一般ユーザー視点のGETレスポンスでauthorがnullになり、投稿者を特定できる情報が含まれないこと", async () => {
    test.setTimeout(90_000);

    const { organizer, participant, eventId, feedbackId, participantUserId } = await createAttendedFeedback({
      isAnonymous: true,
    });
    const bystander = await loginBackendContext(MEMBER_CREDENTIALS.suzuki);
    try {
      const data = await expectSuccessData<{ feedbacks: { id: string; author: unknown }[] }>(
        await bystander.get(`/events/${eventId}/feedbacks`),
      );
      const target = data.feedbacks.find((feedback) => feedback.id === feedbackId);
      expect(target).toBeDefined();
      expect(target?.author).toBeNull();

      const targetJson = JSON.stringify(target);
      expect(targetJson).not.toContain(MEMBER_CREDENTIALS.sato.name);
      expect(targetJson).not.toContain(MEMBER_CREDENTIALS.sato.email);
      expect(targetJson).not.toContain(participantUserId);
    } finally {
      await organizer.dispose();
      await participant.dispose();
      await bystander.dispose();
    }
  });

  test("ログイン失敗時、存在しないメールアドレスとパスワード不一致とで同一のエラーメッセージが返ること", async () => {
    // WHY(無効化済みアカウントのパターンを含めない): backend/prisma/seed.tsには無効化済み
    // （isActive=false）のユーザーが存在せず、無効化用のAPI（POST /users/:id/deactivate）を
    // 使うと実在するシード済みアカウントの状態を書き換えてしまい9章冒頭の方針に反するため、
    // 「存在しないメール」「パスワード不一致」の2パターンのみで確認する。
    const anonymous = await createBackendContext();
    try {
      const notFoundResponse = await anonymous.post("/auth/login", {
        data: { email: "no-such-user-for-e2e@eventboard.example.com", password: "WhateverPassword123!" },
      });
      const wrongPasswordResponse = await anonymous.post("/auth/login", {
        data: { email: MEMBER_CREDENTIALS.tanaka.email, password: "DefinitelyWrongPassword123!" },
      });

      expect(notFoundResponse.status()).toBe(401);
      expect(wrongPasswordResponse.status()).toBe(401);

      const notFoundBody = (await notFoundResponse.json()) as { error: { message: string } };
      const wrongPasswordBody = (await wrongPasswordResponse.json()) as { error: { message: string } };

      expect(notFoundBody.error.message).toBe("メールアドレスまたはパスワードが誤っています");
      expect(notFoundBody.error.message).toBe(wrongPasswordBody.error.message);
    } finally {
      await anonymous.dispose();
    }
  });
});

test.describe("9.2 入力値攻撃（自分が作成したテストデータの範囲内のみ）", () => {
  test("自分が作成したイベントのタイトル・説明文、フィードバックコメントにHTML/JSを含む文字列を投稿しても、エスケープされ実行されないこと", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    let dialogFired = false;
    // WHY: `alert()`等が実行されてしまった場合、ハンドラを登録しないとPlaywrightがダイアログの
    // 応答待ちでテストごとハングしてしまうため、フラグを立てたうえで必ず`dismiss()`する。
    page.on("dialog", (dialog) => {
      dialogFired = true;
      void dialog.dismiss();
    });

    const maliciousTitle = `<script>window.__xssTitle=true</script>タイトル ${Date.now()}`;
    const maliciousDescription = '<img src="x" onerror="window.__xssDescription=true" />説明文';
    const startAt = futureMinuteAligned(15_000);

    const eventId = await createEventViaUi(page, {
      title: maliciousTitle,
      description: maliciousDescription,
      startAt,
    });

    await expect(page.getByRole("heading", { name: maliciousTitle })).toBeVisible();
    await expect(page.getByText(maliciousDescription, { exact: false })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __xssTitle?: boolean }).__xssTitle),
    ).toBeUndefined();
    expect(
      await page.evaluate(() => (window as unknown as { __xssDescription?: boolean }).__xssDescription),
    ).toBeUndefined();

    const participant = await loginBackendContext(MEMBER_CREDENTIALS.sato);
    const organizerBackend = await loginBackendContext(MEMBER_CREDENTIALS.tanaka);
    try {
      await expectSuccessData(await participant.post(`/events/${eventId}/register`));
      await waitUntil(startAt);

      const satoMe = await expectSuccessData<{ id: string }>(await participant.get("/auth/me"));
      await expectSuccessData(
        await organizerBackend.put(`/events/${eventId}/registrations/${satoMe.id}/attendance`, {
          data: { attendanceStatus: "ATTENDED" },
        }),
      );

      const maliciousComment = "<script>window.__xssComment=true</script>コメントです";
      await expectSuccessData(
        await participant.post(`/events/${eventId}/feedbacks`, {
          data: { rating: 5, comment: maliciousComment, isAnonymous: false },
        }),
      );

      await page.reload();
      await expect(page.getByText(maliciousComment, { exact: false })).toBeVisible();
      expect(dialogFired).toBe(false);
      expect(
        await page.evaluate(() => (window as unknown as { __xssComment?: boolean }).__xssComment),
      ).toBeUndefined();
    } finally {
      await participant.dispose();
      await organizerBackend.dispose();
    }
  });

  test("イベント作成APIにスキーマにないフィールド（organizerId等）を追加しても無視され、他人が主催者にされないこと", async () => {
    const attacker = await loginBackendContext(MEMBER_CREDENTIALS.sato);
    const victim = await loginBackendContext(MEMBER_CREDENTIALS.tanaka);
    try {
      const categoryId = await getAnyCategoryId(attacker);
      const victimMe = await expectSuccessData<{ id: string }>(await victim.get("/auth/me"));
      const attackerMe = await expectSuccessData<{ id: string }>(await attacker.get("/auth/me"));

      const response = await attacker.post("/events", {
        data: {
          title: `マスアサインメント確認 ${Date.now()}`,
          categoryId,
          startAt: futureDate(2 * 24 * 60 * 60 * 1000).toISOString(),
          capacity: 3,
          // WHY: CreateEventSchemaに存在しないキー。zodのz.object()は既定で未知キーを黙って
          // 除去するため、400にはならず201で成功しつつ無視されるのが仕様通りの挙動になるはず。
          organizerId: victimMe.id,
          id: "attacker-controlled-id",
          role: "ADMIN",
        },
      });

      expect(response.status()).toBe(201);
      const created = await expectSuccessData<{ id: string }>(response);
      expect(created.id).not.toBe("attacker-controlled-id");

      const detail = await expectSuccessData<{ organizer: { id: string } }>(
        await attacker.get(`/events/${created.id}`),
      );
      expect(detail.organizer.id).toBe(attackerMe.id);
      expect(detail.organizer.id).not.toBe(victimMe.id);
    } finally {
      await attacker.dispose();
      await victim.dispose();
    }
  });

  test("イベント作成APIのcapacityに0・負数・巨大な数値を指定すると、サーバー側400で拒否されること", async () => {
    // WHY: `packages/shared/src/schemas/events.ts`のCreateEventSchemaは
    // `z.number().int().min(1, ...)`のみで上限（max）を定義していない。0・負数は仕様通り400になるが、
    // 「巨大な数値」は現状のスキーマ定義上は上限チェックが存在せず201で成功してしまう可能性が高い
    // （クライアント側のnumber入力に上限が無いことと合わせ、意図的な仕様なのか未実装のバリデーション
    // 漏れなのか要確認。本テストが失敗した場合はこの点をユーザーに報告する）。
    const member = await loginBackendContext(MEMBER_CREDENTIALS.tanaka);
    try {
      const categoryId = await getAnyCategoryId(member);
      const startAt = futureDate(2 * 24 * 60 * 60 * 1000).toISOString();

      for (const capacity of [0, -1, 999_999_999_999]) {
        const response = await member.post("/events", {
          data: { title: `capacity境界値確認_${capacity}_${Date.now()}`, categoryId, startAt, capacity },
        });
        expect(response.status(), `capacity=${capacity}は400であるべき`).toBe(400);
      }
    } finally {
      await member.dispose();
    }
  });

  test("フィードバック投稿APIのratingに範囲外の値(0・6)を指定すると、サーバー側400で拒否されること", async () => {
    const organizer = await loginBackendContext(MEMBER_CREDENTIALS.tanaka);
    const participant = await loginBackendContext(MEMBER_CREDENTIALS.sato);
    try {
      const categoryId = await getAnyCategoryId(organizer);
      const event = await expectSuccessData<{ id: string }>(
        await organizer.post("/events", {
          data: {
            title: `rating境界値確認 ${Date.now()}`,
            categoryId,
            startAt: futureDate(2 * 24 * 60 * 60 * 1000).toISOString(),
            capacity: 5,
          },
        }),
      );

      // WHY: rating検証（CreateFeedbackSchema）はNestのZodValidationPipeがルートハンドラより前に
      // 実行するため、投稿条件（開催終了済み＋出席済み）を満たしていなくても400が先に返る。
      // そのためここでは参加登録・出席マークを行わず、バリデーションの実効性のみを確認する。
      for (const rating of [0, 6]) {
        const response = await participant.post(`/events/${event.id}/feedbacks`, {
          data: { rating, comment: "評価境界値確認用コメント", isAnonymous: false },
        });
        expect(response.status(), `rating=${rating}は400であるべき`).toBe(400);
      }
    } finally {
      await organizer.dispose();
      await participant.dispose();
    }
  });
});
