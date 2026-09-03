import { z } from "zod";

/**
 * イベント管理API（`/events/*`）のリクエストボディZodスキーマ。
 * MANIFEST.md 6章 #15(POST /events)・#17(PUT /events/:id)を正とする。
 */
export const CreateEventSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(200),
  description: z.string().max(4000).optional(),
  categoryId: z.string().cuid("カテゴリを選択してください"),
  tags: z.array(z.string().min(1).max(50)).default([]),
  startAt: z.string().datetime({ message: "開催日時の形式が正しくありません" }),
  endAt: z.string().datetime().optional(),
  capacity: z
    .number()
    .int()
    .min(1, "定員は1以上で入力してください")
    .max(10000, "定員は10000以下で入力してください"),
  registrationDeadline: z.string().datetime().optional(),
  cancellationDeadline: z.string().datetime().optional(),
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

/** PUT /events/:id は作成時と同じ項目の部分更新を許可する（MANIFEST.md 6章 #17）。 */
export const UpdateEventSchema = CreateEventSchema.partial();
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
