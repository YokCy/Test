import { z } from "zod";

/**
 * 認証API（`/auth/*`）のリクエストボディZodスキーマ。
 * フロントエンド・バックエンドの両方から本スキーマをimportして使う
 * （CODING_STANDARDS 3章「バリデーション」）。
 * WHY: 本アプリは招待制ではなくシンプルなログインのみ実装のため、
 * ユーザー登録（register）APIは提供しない（初期ユーザーはseedで作成）。
 */

/** POST /auth/login のリクエストスキーマ */
export const LoginSchema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(1, "パスワードは必須です"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/** PUT /auth/profile のリクエストスキーマ */
export const UpdateProfileSchema = z.object({
  name: z.string().min(1, "氏名は必須です"),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
