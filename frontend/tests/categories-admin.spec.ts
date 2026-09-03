import { expect, test } from "@playwright/test";

import { createEventViaUi, futureDate } from "./helpers/events";

// WHY: カテゴリマスタ管理（P-09）はadmin専用画面のため、既定のmember storageStateではなく
// adminのstorageStateに差し替える（e2e-test-perspectives.md 0.2節）。
test.use({ storageState: "tests/.auth/admin.json" });

/** 実行のたびに一意なカテゴリ名を作るためのヘルパー（他テスト・他実行との衝突を避ける）。 */
function uniqueCategoryName(label: string): string {
  return `E2Eカテゴリ-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

test.describe("カテゴリマスタ管理（P-09、admin専用）", () => {
  test("「＋追加」からカテゴリを新規作成すると一覧に反映される", async ({ page }) => {
    const categoryName = uniqueCategoryName("create");

    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "＋追加" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("カテゴリ名").fill(categoryName);
    await dialog.getByRole("button", { name: "追加する" }).click();

    // WHY: 追加成功でモーダルが閉じ、一覧（useCategoriesのinvalidateQueries）に反映される。
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("row", { name: categoryName })).toBeVisible();
  });

  test("同名カテゴリを重複作成しようとすると、モーダルを閉じずにフィールドエラーが表示される", async ({
    page,
  }) => {
    const categoryName = uniqueCategoryName("dup");

    await page.goto("/admin/categories");

    // Arrange: 先に1件作成しておく。
    await page.getByRole("button", { name: "＋追加" }).click();
    const firstDialog = page.getByRole("dialog");
    await firstDialog.getByLabel("カテゴリ名").fill(categoryName);
    await firstDialog.getByRole("button", { name: "追加する" }).click();
    await expect(firstDialog).not.toBeVisible();
    await expect(page.getByRole("row", { name: categoryName })).toBeVisible();

    // Act: 同名で再度作成を試みる。
    await page.getByRole("button", { name: "＋追加" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("カテゴリ名").fill(categoryName);
    await dialog.getByRole("button", { name: "追加する" }).click();

    // Assert: サーバー409がフィールドエラーとして表示され、モーダルは閉じない。
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("同じ名前のカテゴリが既に存在します")).toBeVisible();

    // 一覧には重複作成された行が増えていないこと（1行のみ）を確認する。
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByRole("row", { name: categoryName })).toHaveCount(1);
  });

  test("紐づくイベントが0件のカテゴリは削除確認モーダルの確定で一覧から消える", async ({ page }) => {
    const categoryName = uniqueCategoryName("del-ok");

    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "＋追加" }).click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByLabel("カテゴリ名").fill(categoryName);
    await createDialog.getByRole("button", { name: "追加する" }).click();
    await expect(createDialog).not.toBeVisible();

    const row = page.getByRole("row", { name: categoryName });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "削除" }).click();

    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "削除する" }).click();

    await expect(confirmDialog).not.toBeVisible();
    await expect(page.getByRole("row", { name: categoryName })).toHaveCount(0);
  });

  test("紐づくイベントが1件以上あるカテゴリは削除できず、409エラーがモーダル内に表示される", async ({
    page,
  }) => {
    const categoryName = uniqueCategoryName("del-ng");

    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "＋追加" }).click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByLabel("カテゴリ名").fill(categoryName);
    await createDialog.getByRole("button", { name: "追加する" }).click();
    await expect(createDialog).not.toBeVisible();

    // Arrange: このカテゴリに紐づくイベントを1件作成する（adminが主催者として作成する）。
    await createEventViaUi(page, {
      title: `E2E紐づきイベント-${Date.now()}`,
      startAt: futureDate(10 * 60 * 1000),
      categoryName,
      capacity: 5,
    });

    await page.goto("/admin/categories");
    const row = page.getByRole("row", { name: categoryName });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "削除" }).click();

    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "削除する" }).click();

    // Assert: モーダルは閉じずにサーバーのエラーメッセージがそのまま表示され、一覧からは消えない。
    await expect(confirmDialog).toBeVisible();
    await expect(
      confirmDialog.getByText("このカテゴリに紐づくイベントが存在するため削除できません"),
    ).toBeVisible();

    await confirmDialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByRole("row", { name: categoryName })).toBeVisible();
  });
});
