import { z } from "zod";

/**
 * 起動時に環境変数の型・必須項目を検証するためのスキーマ。
 * CODING_STANDARDS 8章に従い、未設定・不正値がある場合はアプリ起動自体を失敗させる
 * （実行時に初めてprocess.env参照エラーで気づく事態を防ぐため）。
 */
export const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().min(1),
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  TZ: z.string().optional().default("Asia/Tokyo"),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * NestJSの ConfigModule.forRoot({ validate }) に渡すバリデーション関数。
 */
export function validateEnv(config: Record<string, unknown>): Env {
  return EnvSchema.parse(config);
}
