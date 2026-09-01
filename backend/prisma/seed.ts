import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// bcryptのコストファクタ。CODING_STANDARDS 9章に従い環境変数化し、
// コード側にハードコードした値をそのまま本番へ持ち込まない前提のデフォルト値とする
const BCRYPT_SALT_ROUNDS = 10;

// サンプルメンバーの共通ログインパスワード（ローカル開発専用のダミーデータのため固定値）。
// admin@example.comの認証情報はSEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD（.env）で別管理する。
const SAMPLE_MEMBER_PASSWORD = "Password123!";

/** 全テーブルのデータを削除する。イベント関連モデル追加時は依存の末端から順に追加すること。 */
async function resetDatabase() {
  await prisma.$transaction([prisma.refreshToken.deleteMany(), prisma.user.deleteMany()]);
  console.log("既存データを全削除しました。");
}

/**
 * 初期Adminアカウントを投入する。
 * 環境変数（SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD）が未設定の場合は投入をスキップし、
 * 誤って固定のデフォルト認証情報が本番相当の環境に残ることを防ぐ。
 */
async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD が未設定のため、初期Adminの投入をスキップします。",
    );
    return null;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "System Admin",
      passwordHash,
      role: "ADMIN",
    },
  });
}

/** 動作確認用の一般社員（member）サンプルアカウントを投入する。 */
async function seedSampleMembers() {
  const passwordHash = await bcrypt.hash(SAMPLE_MEMBER_PASSWORD, BCRYPT_SALT_ROUNDS);

  const members = [
    { name: "田中 太郎", email: "tanaka@eventboard.example.com" },
    { name: "佐藤 花子", email: "sato@eventboard.example.com" },
    { name: "鈴木 一郎", email: "suzuki@eventboard.example.com" },
  ];

  await Promise.all(
    members.map((member) =>
      prisma.user.create({ data: { ...member, passwordHash, role: "MEMBER" } }),
    ),
  );

  console.log(`サンプルメンバーを${members.length}件投入しました。`);
  console.log(`サンプルメンバーの共通パスワード（ローカル開発用）: ${SAMPLE_MEMBER_PASSWORD}`);
}

async function main() {
  await resetDatabase();
  await seedAdmin();
  await seedSampleMembers();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
