/**
 * E2E用の認証情報。backend/prisma/seed.tsが投入する固定のシードデータに対応する。
 * WHY: adminはSEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD（ルートの.env、playwright.config.tsでロード済み）
 * から取得する。member側はseed.ts内に固定値としてハードコードされている値と一致させる
 * （ローカル開発専用のダミーデータのため、テストコード側にも直接記載する）。
 */
export const ADMIN_CREDENTIALS = {
  email: process.env.SEED_ADMIN_EMAIL ?? "",
  password: process.env.SEED_ADMIN_PASSWORD ?? "",
};

/** シードデータの一般member。3名とも共通パスワード（seed.tsのSAMPLE_MEMBER_PASSWORD）。 */
export const MEMBER_CREDENTIALS = {
  tanaka: { email: "tanaka@eventboard.example.com", password: "Password123!", name: "田中 太郎" },
  sato: { email: "sato@eventboard.example.com", password: "Password123!", name: "佐藤 花子" },
  suzuki: { email: "suzuki@eventboard.example.com", password: "Password123!", name: "鈴木 一郎" },
} as const;
