import { z } from "zod";

/**
 * PUT /users/:id/role のリクエストボディ用Zodスキーマ。
 * MANIFEST.mdのPrismaスキーマ（SystemRole enum）と同じ値（"ADMIN" | "MEMBER"）のみを許可する。
 * バリデーションはこのスキーマを正とし、バックエンド（nestjs-zodのDTO）・フロントエンドの両方で共有する
 * （CODING_STANDARDS 3章「バリデーション」）。
 */
export const UpdateUserRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>;
