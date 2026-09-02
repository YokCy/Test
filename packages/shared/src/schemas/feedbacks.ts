import { z } from "zod";

/**
 * フィードバック投稿/編集API（`POST`/`PUT /events/:id/feedbacks`(`/feedbacks/:id`)）の
 * リクエストスキーマ（MANIFEST.md 6章 #24, #25）。
 */
export const CreateFeedbackSchema = z.object({
  rating: z.number().int().min(1, "評価は1〜5で指定してください").max(5, "評価は1〜5で指定してください"),
  comment: z.string().min(1, "コメントは必須です").max(1000),
  isAnonymous: z.boolean().default(false),
});
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>;

export const UpdateFeedbackSchema = CreateFeedbackSchema;
export type UpdateFeedbackInput = z.infer<typeof UpdateFeedbackSchema>;
