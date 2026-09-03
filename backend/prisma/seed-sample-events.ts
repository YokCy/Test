import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 手動動作確認用のサンプルイベントデータを作り直すスクリプト。
 * `seed.ts`と異なり、User（admin/tanaka/sato/suzuki）は一切削除・変更しない
 * （ユーザーはそのままで、イベント関連データだけを作り直したいという要望に対応）。
 *
 * 削除対象: Feedback / PromotionHistory / Registration / EventTag / Event / Tag（全件）、
 * および過去のE2Eテスト実行で残った"E2Eカテゴリ-"始まりのCategory。
 * 既定カテゴリ（勉強会・懇親会・講演会・研修・その他）は残す。
 */
async function cleanTestData() {
  await prisma.$transaction([
    prisma.feedback.deleteMany(),
    prisma.promotionHistory.deleteMany(),
    prisma.registration.deleteMany(),
    prisma.eventTag.deleteMany(),
    prisma.event.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.category.deleteMany({ where: { name: { startsWith: "E2E" } } }),
  ]);
  console.log("テスト由来のイベント関連データを削除しました。");
}

async function main() {
  await cleanTestData();

  const [admin, tanaka, sato, suzuki] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "tanaka@eventboard.example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "sato@eventboard.example.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "suzuki@eventboard.example.com" } }),
  ]);

  const categories = await prisma.category.findMany();
  const categoryId = (name: string): string => {
    const found = categories.find((category) => category.name === name);
    if (!found) {
      throw new Error(`カテゴリ「${name}」が見つかりません。既定カテゴリのseedが投入済みか確認してください。`);
    }
    return found.id;
  };

  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  async function attachTags(eventId: string, tagNames: string[]): Promise<void> {
    for (const name of tagNames) {
      const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
      await prisma.eventTag.create({ data: { eventId, tagId: tag.id } });
    }
  }

  // ---- 過去イベント1: 出席・フィードバックまで完了済み（匿名投稿1件含む） ----
  const past1 = await prisma.event.create({
    data: {
      title: "フロントエンド勉強会 vol.3",
      description: "React/TypeScriptの実践パターンを紹介する回でした。",
      categoryId: categoryId("勉強会"),
      organizerId: tanaka.id,
      startAt: new Date(now - 10 * DAY_MS),
      endAt: new Date(now - 10 * DAY_MS + 2 * 60 * 60 * 1000),
      capacity: 5,
    },
  });
  await attachTags(past1.id, ["react", "typescript"]);
  await prisma.registration.create({
    data: { eventId: past1.id, userId: sato.id, status: "CONFIRMED", attendanceStatus: "ATTENDED" },
  });
  await prisma.registration.create({
    data: { eventId: past1.id, userId: suzuki.id, status: "CONFIRMED", attendanceStatus: "ATTENDED" },
  });
  await prisma.registration.create({
    data: { eventId: past1.id, userId: admin.id, status: "CONFIRMED", attendanceStatus: "ABSENT" },
  });
  await prisma.feedback.create({
    data: {
      eventId: past1.id,
      userId: sato.id,
      rating: 5,
      comment: "実践的な内容でとても勉強になりました。",
      isAnonymous: false,
    },
  });
  await prisma.feedback.create({
    data: {
      eventId: past1.id,
      userId: suzuki.id,
      rating: 4,
      comment: "資料がわかりやすかったです。匿名で失礼します。",
      isAnonymous: true,
    },
  });

  // ---- 過去イベント2: 別カテゴリ・別主催者でのフィードバック ----
  const past2 = await prisma.event.create({
    data: {
      title: "冬の懇親会",
      description: "今年一年の労をねぎらう懇親会でした。",
      categoryId: categoryId("懇親会"),
      organizerId: sato.id,
      startAt: new Date(now - 25 * DAY_MS),
      endAt: new Date(now - 25 * DAY_MS + 3 * 60 * 60 * 1000),
      capacity: 10,
    },
  });
  await prisma.registration.create({
    data: { eventId: past2.id, userId: tanaka.id, status: "CONFIRMED", attendanceStatus: "ATTENDED" },
  });
  await prisma.registration.create({
    data: { eventId: past2.id, userId: suzuki.id, status: "CONFIRMED", attendanceStatus: "ABSENT" },
  });
  await prisma.registration.create({
    data: { eventId: past2.id, userId: admin.id, status: "CONFIRMED", attendanceStatus: "ATTENDED" },
  });
  await prisma.feedback.create({
    data: { eventId: past2.id, userId: tanaka.id, rating: 4, comment: "楽しい時間でした。", isAnonymous: false },
  });
  await prisma.feedback.create({
    data: {
      eventId: past2.id,
      userId: admin.id,
      rating: 3,
      comment: "もう少し早い時間だと参加しやすいかもしれません。",
      isAnonymous: false,
    },
  });

  // ---- 直近イベント: 定員2名でキャンセル待ちが発生している状態 ----
  const soon = await prisma.event.create({
    data: {
      title: "業界動向セミナー",
      description: "直近の業界トレンドをまとめて紹介するセミナーです。",
      categoryId: categoryId("講演会"),
      organizerId: admin.id,
      startAt: new Date(now + 2 * DAY_MS),
      capacity: 2,
    },
  });
  await attachTags(soon.id, ["キャリア"]);
  // WHY: キャンセル待ちが発生するのは定員が実際に埋まっている場合のみ（本来のアプリ操作では
  // 定員に空きがある状態でWAITLISTEDにはならない）。capacity: 2に対しCONFIRMEDを2名（tanaka/suzuki）
  // で満たした上でsatoをWAITLISTEDにする。
  await prisma.registration.create({
    data: { eventId: soon.id, userId: tanaka.id, status: "CONFIRMED" },
  });
  await prisma.registration.create({
    data: { eventId: soon.id, userId: suzuki.id, status: "CONFIRMED" },
  });
  await prisma.registration.create({
    data: { eventId: soon.id, userId: sato.id, status: "WAITLISTED", position: 1 },
  });

  // ---- 未来イベント: まだ誰も登録していない、定員に余裕のあるイベント ----
  await prisma.event.create({
    data: {
      title: "新人向けオンボーディング研修",
      description: "配属後1ヶ月をめどに実施する新人研修です。",
      categoryId: categoryId("研修"),
      organizerId: tanaka.id,
      startAt: new Date(now + 45 * DAY_MS),
      capacity: 30,
    },
  });

  console.log("サンプルイベント（過去2件・直近1件・未来1件）を作成しました。");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
