import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthUser } from "../../common/auth/auth-user.type";
import type { PrismaService } from "../../prisma/prisma.service";

import { FeedbacksService } from "./feedbacks.service";

/**
 * PrismaServiceの薄いモック。本テストで使用するモデル・メソッドのみ`jest.fn()`化する。
 * 実DBには接続せず、各テストのArrangeで戻り値を明示的に設定する。
 * WHY: 戻り値をあえて`PrismaService`型と交差させない。交差させるとプロパティ参照が
 * 実際のPrismaClientメソッド（`this`束縛が必要な宣言）として解決され、
 * `@typescript-eslint/unbound-method`が誤検知するため、モックの型はプレーンな
 * `jest.fn()`のままにし、Service注入時のみ`PrismaService`へキャストする。
 */
function createPrismaMock() {
  return {
    event: { findUnique: jest.fn() },
    feedback: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    registration: { findUnique: jest.fn() },
  };
}

function asPrismaService(prisma: ReturnType<typeof createPrismaMock>): PrismaService {
  return prisma as unknown as PrismaService;
}

function buildAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: "user-1", email: "user1@example.com", name: "ユーザー1", role: "MEMBER", ...overrides };
}

/** テスト用のEvent最小フィクスチャ（本Serviceが参照するフィールドのみ埋める）。 */
function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    organizerId: "organizer-1",
    startAt: new Date("2026-01-01T10:00:00+09:00"),
    endAt: null as Date | null,
    deletedAt: null as Date | null,
    ...overrides,
  };
}

function buildFeedback(overrides: Record<string, unknown> = {}) {
  return {
    id: "feedback-1",
    eventId: "event-1",
    userId: "author-1",
    rating: 5,
    comment: "良いイベントでした",
    isAnonymous: false,
    isHidden: false,
    user: { id: "author-1", name: "投稿者" },
    ...overrides,
  };
}

function prismaKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("mock", { code, clientVersion: "5.0.0" });
}

describe("FeedbacksService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: FeedbacksService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new FeedbacksService(asPrismaService(prisma));
  });

  describe("findAllForEvent", () => {
    it("存在しないイベントの場合、NotFoundExceptionを投げる", async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.findAllForEvent("event-1", buildAuthUser())).rejects.toThrow(NotFoundException);
    });

    it("論理削除済みのイベントの場合、NotFoundExceptionを投げる", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent({ deletedAt: new Date("2026-01-01T00:00:00+09:00") }));

      await expect(service.findAllForEvent("event-1", buildAuthUser())).rejects.toThrow(NotFoundException);
    });

    it("非adminの場合、isHidden=falseに絞り込む条件でフィードバックを検索する", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent());
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.findAllForEvent("event-1", buildAuthUser({ role: "MEMBER" }));

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: "event-1", isHidden: false } }),
      );
    });

    it("adminの場合、isHiddenによる絞り込みをせず全件検索する", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent());
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.findAllForEvent("event-1", buildAuthUser({ id: "admin-1", role: "ADMIN" }));

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: "event-1" } }));
    });

    it("非公開分を除いた評価の平均を小数第1位に丸めて返す", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent());
      prisma.feedback.findMany.mockResolvedValue([
        buildFeedback({ id: "f1", rating: 5, isHidden: false }),
        buildFeedback({ id: "f2", rating: 4, isHidden: false }),
        buildFeedback({ id: "f3", rating: 2, isHidden: false }),
        buildFeedback({ id: "f4", rating: 1, isHidden: true }),
      ]);

      // WHY: (5+4+2)/3 = 3.666... を丸めた3.7になること（isHiddenのf4は分母・分子から除外）を検証する。
      const result = await service.findAllForEvent("event-1", buildAuthUser({ id: "admin-1", role: "ADMIN" }));

      expect(result.averageRating).toBe(3.7);
    });

    it("非公開分を除いた対象が0件の場合、averageRatingはnullになる", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent());
      prisma.feedback.findMany.mockResolvedValue([buildFeedback({ id: "f1", rating: 5, isHidden: true })]);

      const result = await service.findAllForEvent("event-1", buildAuthUser({ id: "admin-1", role: "ADMIN" }));

      expect(result.averageRating).toBeNull();
    });

    it("非adminかつ匿名投稿の場合、authorはnullになる", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent());
      prisma.feedback.findMany.mockResolvedValue([
        buildFeedback({ userId: "other-user", isAnonymous: true }),
      ]);

      const result = await service.findAllForEvent("event-1", buildAuthUser({ id: "user-1", role: "MEMBER" }));

      expect(result.feedbacks[0]?.author).toBeNull();
      expect(result.feedbacks[0]).not.toHaveProperty("isHidden");
    });

    it("非adminかつ非匿名投稿の場合、authorは実名で返る", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent());
      prisma.feedback.findMany.mockResolvedValue([
        buildFeedback({ userId: "other-user", isAnonymous: false, user: { id: "other-user", name: "他人" } }),
      ]);

      const result = await service.findAllForEvent("event-1", buildAuthUser({ id: "user-1", role: "MEMBER" }));

      expect(result.feedbacks[0]?.author).toEqual({ id: "other-user", name: "他人" });
    });

    it("adminの場合、匿名投稿・非公開投稿でもauthorは常に実名でありisHiddenも含まれる", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent());
      prisma.feedback.findMany.mockResolvedValue([
        buildFeedback({
          userId: "other-user",
          isAnonymous: true,
          isHidden: true,
          user: { id: "other-user", name: "他人" },
        }),
      ]);

      const result = await service.findAllForEvent("event-1", buildAuthUser({ id: "admin-1", role: "ADMIN" }));

      const [feedback] = result.feedbacks as Array<{ author: unknown; isHidden: boolean } | undefined>;
      expect(feedback?.author).toEqual({ id: "other-user", name: "他人" });
      expect(feedback?.isHidden).toBe(true);
    });

    it("isMineは匿名投稿かどうかに関わらず投稿者本人の要素でのみtrueになる", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent());
      prisma.feedback.findMany.mockResolvedValue([buildFeedback({ userId: "user-1", isAnonymous: true })]);

      const result = await service.findAllForEvent("event-1", buildAuthUser({ id: "user-1", role: "MEMBER" }));

      // WHY: 匿名投稿のためauthorはnullになる一方、isMineは投稿者本人かどうかの独立した情報として真になる。
      expect(result.feedbacks[0]?.isMine).toBe(true);
      expect(result.feedbacks[0]?.author).toBeNull();
    });
  });

  describe("create", () => {
    const validInput = { rating: 5, comment: "良かったです", isAnonymous: true };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("存在しないイベントの場合、NotFoundExceptionを投げる", async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.create("event-1", "user-1", validInput)).rejects.toThrow(NotFoundException);
    });

    it("論理削除済みのイベントの場合、NotFoundExceptionを投げる", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent({ deletedAt: new Date() }));

      await expect(service.create("event-1", "user-1", validInput)).rejects.toThrow(NotFoundException);
    });

    it("主催者本人が自イベントに投稿しようとした場合、ForbiddenExceptionを投げる", async () => {
      prisma.event.findUnique.mockResolvedValue(buildEvent({ organizerId: "user-1" }));

      await expect(service.create("event-1", "user-1", validInput)).rejects.toThrow(ForbiddenException);
      expect(prisma.registration.findUnique).not.toHaveBeenCalled();
    });

    it("イベントが未終了の場合、出席済みであってもForbiddenExceptionを投げる", async () => {
      jest.setSystemTime(new Date("2026-01-01T00:00:00+09:00"));
      prisma.event.findUnique.mockResolvedValue(
        buildEvent({ endAt: new Date("2026-06-01T00:00:00+09:00") }),
      );
      prisma.registration.findUnique.mockResolvedValue({ attendanceStatus: "ATTENDED" });

      await expect(service.create("event-1", "user-1", validInput)).rejects.toThrow(ForbiddenException);
    });

    it("イベント終了済みでもattendanceStatusがATTENDEDでない場合、ForbiddenExceptionを投げる", async () => {
      jest.setSystemTime(new Date("2026-06-02T00:00:00+09:00"));
      prisma.event.findUnique.mockResolvedValue(
        buildEvent({ endAt: new Date("2026-06-01T00:00:00+09:00") }),
      );
      prisma.registration.findUnique.mockResolvedValue({ attendanceStatus: "ABSENT" });

      await expect(service.create("event-1", "user-1", validInput)).rejects.toThrow(ForbiddenException);
    });

    it("登録自体が存在しない（未登録）場合、ForbiddenExceptionを投げる", async () => {
      jest.setSystemTime(new Date("2026-06-02T00:00:00+09:00"));
      prisma.event.findUnique.mockResolvedValue(
        buildEvent({ endAt: new Date("2026-06-01T00:00:00+09:00") }),
      );
      prisma.registration.findUnique.mockResolvedValue(null);

      await expect(service.create("event-1", "user-1", validInput)).rejects.toThrow(ForbiddenException);
    });

    it("endAt未設定の場合、startAtを基準に終了判定する（境界値）", async () => {
      jest.setSystemTime(new Date("2026-06-02T00:00:00+09:00"));
      prisma.event.findUnique.mockResolvedValue(
        buildEvent({ endAt: null, startAt: new Date("2026-06-01T00:00:00+09:00") }),
      );
      prisma.registration.findUnique.mockResolvedValue({ attendanceStatus: "ATTENDED" });
      prisma.feedback.create.mockResolvedValue(buildFeedback());

      await expect(service.create("event-1", "user-1", validInput)).resolves.toEqual(buildFeedback());
    });

    it("開催終了かつ出席済みの場合、入力内容通りにフィードバックを作成する", async () => {
      jest.setSystemTime(new Date("2026-06-02T00:00:00+09:00"));
      prisma.event.findUnique.mockResolvedValue(
        buildEvent({ endAt: new Date("2026-06-01T00:00:00+09:00") }),
      );
      prisma.registration.findUnique.mockResolvedValue({ attendanceStatus: "ATTENDED" });
      const created = buildFeedback();
      prisma.feedback.create.mockResolvedValue(created);

      const result = await service.create("event-1", "user-1", validInput);

      expect(prisma.feedback.create).toHaveBeenCalledWith({
        data: {
          eventId: "event-1",
          userId: "user-1",
          rating: validInput.rating,
          comment: validInput.comment,
          isAnonymous: validInput.isAnonymous,
        },
      });
      expect(result).toEqual(created);
    });

    it("既に投稿済み（一意制約違反）の場合、ConflictExceptionを投げる", async () => {
      jest.setSystemTime(new Date("2026-06-02T00:00:00+09:00"));
      prisma.event.findUnique.mockResolvedValue(
        buildEvent({ endAt: new Date("2026-06-01T00:00:00+09:00") }),
      );
      prisma.registration.findUnique.mockResolvedValue({ attendanceStatus: "ATTENDED" });
      prisma.feedback.create.mockRejectedValue(prismaKnownError("P2002"));

      await expect(service.create("event-1", "user-1", validInput)).rejects.toThrow(ConflictException);
    });
  });

  describe("update", () => {
    it("投稿者本人による更新の場合、更新内容が反映される", async () => {
      const existing = buildFeedback({ userId: "user-1" });
      prisma.feedback.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, rating: 3, comment: "更新後" };
      prisma.feedback.update.mockResolvedValue(updated);

      const input = { rating: 3, comment: "更新後", isAnonymous: false };
      const result = await service.update("feedback-1", "user-1", input);

      expect(prisma.feedback.update).toHaveBeenCalledWith({
        where: { id: "feedback-1" },
        data: { rating: 3, comment: "更新後", isAnonymous: false },
      });
      expect(result).toEqual(updated);
    });

    it("投稿者本人以外が更新しようとした場合、ForbiddenExceptionを投げる（adminであっても対象外）", async () => {
      prisma.feedback.findUnique.mockResolvedValue(buildFeedback({ userId: "author-1" }));

      await expect(
        service.update("feedback-1", "someone-else", { rating: 1, comment: "x", isAnonymous: false }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.feedback.update).not.toHaveBeenCalled();
    });

    it("存在しないidの場合、NotFoundExceptionを投げる", async () => {
      prisma.feedback.findUnique.mockResolvedValue(null);

      await expect(
        service.update("missing", "user-1", { rating: 1, comment: "x", isAnonymous: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("hide", () => {
    it("正常に非公開化できる", async () => {
      const hidden = buildFeedback({ isHidden: true });
      prisma.feedback.update.mockResolvedValue(hidden);

      const result = await service.hide("feedback-1");

      expect(prisma.feedback.update).toHaveBeenCalledWith({
        where: { id: "feedback-1" },
        data: { isHidden: true },
      });
      expect(result).toEqual(hidden);
    });

    it("存在しないidの場合、NotFoundExceptionを投げる", async () => {
      prisma.feedback.update.mockRejectedValue(prismaKnownError("P2025"));

      await expect(service.hide("missing")).rejects.toThrow(NotFoundException);
    });
  });
});
