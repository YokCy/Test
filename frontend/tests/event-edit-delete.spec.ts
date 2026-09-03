import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { loginAsNewContext } from "./helpers/auth";
import { MEMBER_CREDENTIALS } from "./helpers/credentials";
import { createEventViaUi, futureDate, toJstDatetimeLocal } from "./helpers/events";

/**
 * e2e-test-perspectives.md「4. イベント編集（開催日時変更警告モーダルM-08）→削除」。
 *
 * WHY(M-08は事後通知): `StartAtChangeWarningModal.tsx`のWHYコメントの通り、`PUT /events/:id`は
 * 1回のリクエストで更新を完了しレスポンスに`hasRegisteredParticipants`を含める設計であり、本モーダルは
 * 「保存を実行するか否かを尋ねる事前確認」ではなく「既に保存済みの変更について参加登録者がいる旨を
 * 主催者に知らせる事後通知」である。そのため各テストは「PUTが既に成功している」ことを
 * `page.waitForResponse`で明示的に確認したうえで、モーダルの表示・「続行」「戻る」の挙動を検証する。
 */

const openContexts: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(openContexts.map((context) => context.close()));
  openContexts.length = 0;
});

async function loginAsMember(browser: Browser, credentials: { email: string; password: string }): Promise<Page> {
  const { context, page } = await loginAsNewContext(browser, credentials);
  openContexts.push(context);
  return page;
}

test.describe("イベント編集（M-08）→削除", () => {
  test("開催日時以外の項目のみ変更して保存した場合、M-08警告モーダルを経由せずそのままイベント詳細へ遷移すること", async ({
    page,
  }) => {
    const title = `編集テスト-日時据え置き-${Date.now()}`;
    const eventId = await createEventViaUi(page, { title, startAt: futureDate(3 * 24 * 60 * 60 * 1000) });

    await page.goto(`/events/${eventId}/edit`);
    const updatedTitle = `${title}-更新済み`;
    await page.getByLabel("タイトル").fill(updatedTitle);

    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith(`/events/${eventId}`) && res.request().method() === "PUT",
      ),
      page.getByRole("button", { name: "保存する" }).click(),
    ]);
    expect(putResponse.status()).toBe(200);

    await page.waitForURL(`**/events/${eventId}`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  });

  test("参加登録者がいるイベントの開催日時を変更して保存すると、PUTは既に成功したうえでM-08警告モーダルが表示され、「続行」でイベント詳細へ遷移すること", async ({
    page,
    browser,
  }) => {
    const title = `編集テスト-日時変更-続行-${Date.now()}`;
    const eventId = await createEventViaUi(page, { title, startAt: futureDate(3 * 24 * 60 * 60 * 1000) });

    // ---- 参加者(sato)がCONFIRMEDで登録済みの状態を作る ----
    const satoPage = await loginAsMember(browser, MEMBER_CREDENTIALS.sato);
    await satoPage.goto(`/events/${eventId}`);
    await satoPage.getByRole("button", { name: "参加登録する" }).click();
    await expect(satoPage.getByRole("button", { name: "キャンセルする" })).toBeVisible();

    // ---- 主催者が開催日時を変更して保存する ----
    await page.goto(`/events/${eventId}/edit`);
    const newStartAt = futureDate(10 * 24 * 60 * 60 * 1000);

    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith(`/events/${eventId}`) && res.request().method() === "PUT",
      ),
      (async () => {
        await page.getByLabel("開催日時").fill(toJstDatetimeLocal(newStartAt));
        await page.getByRole("button", { name: "保存する" }).click();
      })(),
    ]);

    // ---- PUT /events/:idはこの時点で既に成功している ----
    expect(putResponse.status()).toBe(200);
    const putBody = (await putResponse.json()) as { data: { hasRegisteredParticipants: boolean } };
    expect(putBody.data.hasRegisteredParticipants).toBe(true);

    // ---- M-08警告モーダルが表示され、URLはまだ編集画面のままであること ----
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}/edit$`));
    await expect(
      dialog.getByText("既に参加登録済みのメンバーがいます。開催日時の変更を続行しますか？"),
    ).toBeVisible();

    // ---- 「続行」を選択→そのままイベント詳細画面へ遷移すること ----
    await dialog.getByRole("button", { name: "続行" }).click();
    await page.waitForURL(`**/events/${eventId}`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });

  test("M-08表示後に「戻る」を選択すると、更新は取り消されずモーダルが閉じて編集画面に留まり、再読み込み後も変更後の値がサーバーに反映済みであること", async ({
    page,
    browser,
  }) => {
    const title = `編集テスト-日時変更-戻る-${Date.now()}`;
    const eventId = await createEventViaUi(page, { title, startAt: futureDate(3 * 24 * 60 * 60 * 1000) });

    const satoPage = await loginAsMember(browser, MEMBER_CREDENTIALS.sato);
    await satoPage.goto(`/events/${eventId}`);
    await satoPage.getByRole("button", { name: "参加登録する" }).click();
    await expect(satoPage.getByRole("button", { name: "キャンセルする" })).toBeVisible();

    await page.goto(`/events/${eventId}/edit`);
    const newStartAt = futureDate(14 * 24 * 60 * 60 * 1000);
    const newStartAtLocal = toJstDatetimeLocal(newStartAt);

    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith(`/events/${eventId}`) && res.request().method() === "PUT",
      ),
      (async () => {
        await page.getByLabel("開催日時").fill(newStartAtLocal);
        await page.getByRole("button", { name: "保存する" }).click();
      })(),
    ]);
    expect(putResponse.status()).toBe(200);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // ---- 「戻る」を選択→モーダルが閉じて編集画面に留まること（保存キャンセルではない） ----
    await dialog.getByRole("button", { name: "戻る" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}/edit$`));

    // ---- 再読み込みしても、変更後のstartAtがサーバーに反映済みであること（取り消すAPIが無いため） ----
    await page.reload();
    await expect(page.getByLabel("開催日時")).toHaveValue(newStartAtLocal);
  });

  test("編集画面から「このイベントを削除」→M-02確認モーダルで確定するとイベント一覧から当該イベントが消えること", async ({
    page,
  }) => {
    const title = `編集テスト-削除-${Date.now()}`;
    const eventId = await createEventViaUi(page, { title, startAt: futureDate(3 * 24 * 60 * 60 * 1000) });

    await page.goto(`/events/${eventId}/edit`);
    await page.getByRole("button", { name: "このイベントを削除" }).click();

    // WHY: EventEditPage・EventForm双方に「キャンセル」という同名ボタンが背景に存在しうるため、
    // M-02モーダル内のボタンは`getByRole("dialog")`でスコープして曖昧さを避ける（Modal.tsxのWHY参照）。
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("削除すると一覧・検索結果から表示されなくなります")).toBeVisible();
    await dialog.getByRole("button", { name: "削除する" }).click();

    await page.waitForURL("**/events");
    await expect(page.getByRole("heading", { name: "イベント一覧" })).toBeVisible();

    // ---- 一覧から当該イベントが消えていること（キーワード検索で該当0件になることまで確認する） ----
    await page.getByLabel("キーワード検索").fill(title);
    await expect(page.getByText("該当するイベントがありません。")).toBeVisible();
    await expect(page.getByRole("button", { name: title })).toHaveCount(0);
  });

  test("主催者でもadminでもないmemberが他人のイベント編集画面へURLを直接叩いてアクセスした場合、更新APIが403で拒否され画面遷移も起きないこと", async ({
    page,
    browser,
  }) => {
    const title = `編集テスト-権限-${Date.now()}`;
    const eventId = await createEventViaUi(page, { title, startAt: futureDate(3 * 24 * 60 * 60 * 1000) });

    const satoPage = await loginAsMember(browser, MEMBER_CREDENTIALS.sato);

    // WHY: GET /events/:idは主催者以外の閲覧も許可するため（events.service.ts findOne参照）、
    // 編集画面自体はエラーにならず表示される。認可チェックはPUT /events/:id側（サーバー）のみで
    // 行われている実装の実態を確認する（このテスト自身が仕様と実装の差分を洗い出す観点も兼ねる）。
    await satoPage.goto(`/events/${eventId}/edit`);
    await expect(satoPage.getByRole("heading", { name: "イベントを編集" })).toBeVisible();

    await satoPage.getByLabel("タイトル").fill("不正な編集タイトル");

    const [putResponse] = await Promise.all([
      satoPage.waitForResponse(
        (res) => res.url().endsWith(`/events/${eventId}`) && res.request().method() === "PUT",
      ),
      satoPage.getByRole("button", { name: "保存する" }).click(),
    ]);
    expect(putResponse.status()).toBe(403);

    // ---- 更新は反映されず、画面遷移も起きていないこと ----
    await expect(satoPage).toHaveURL(new RegExp(`/events/${eventId}/edit$`));

    await page.reload();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });
});
