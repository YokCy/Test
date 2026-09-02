import { z } from "zod";

/**
 * カテゴリ作成/更新API（`POST`/`PUT /categories`(`/:id`)）のリクエストスキーマ。
 * `name`の一意性はDB制約（`@unique`）で担保し、違反時はService層で`409`に変換する
 * （CODING_STANDARDS 3章「バリデーション」の通り、DTOはリクエストの形のみを検証する）。
 */
export const CreateCategorySchema = z.object({
  name: z.string().min(1, "カテゴリ名は必須です").max(50, "カテゴリ名は50文字以内で入力してください"),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
