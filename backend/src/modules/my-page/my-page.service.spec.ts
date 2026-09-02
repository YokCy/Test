import type { PrismaService } from "../../prisma/prisma.service";

import { MyPageService } from "./my-page.service";

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
    event: { findMany: jest.fn() },
    registration: { findMany: jest.fn(), groupBy: jest.fn() },
  };
}

function asPrismaService(prisma: ReturnType<typeof createPrismaMock>): PrismaService {
  return prisma as unknown as PrismaService;
}

const CATEGORY_A = { id: "cat-a", name: "勉強会" };
const CATEGORY_B = { id: "cat-b", name: "懇親会" };

function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    title: "サンプルイベント",
    startAt: new Date("2026-01-10T10:00:00+09:00"),
    capacity: 10,
    category: CATEGORY_A,
    ...overrides,
  };
}

function buildRegistration(overrides: Record<string, unknown> = {}) {
  return {
    status: "CONFIRMED",
    position: null,
    attendanceStatus: null,
    event: buildEvent(),
    ...overrides,
  };
}

describe("MyPageService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: MyPageService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-01T00:00:00+09:00"));
    prisma = createPrismaMock();
    service = new MyPageService(asPrismaService(prisma));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("getEvents", () => {
    it("主催イベントが0件の場合、groupByを呼ばずに空配列を返す", async () => {
      prisma.event.findMany.mockResolvedValue([]);
      prisma.registration.findMany.mockResolvedValue([]);

      const result = await service.getEvents("user-1");

      expect(result.organizing).toEqual([]);
      expect(prisma.registration.groupBy).not.toHaveBeenCalled();
    });

    it("主催イベントについて、CONFIRMED/WAITLISTEDの件数をイベントごとに正しく集計する", async () => {
      prisma.event.findMany.mockResolvedValue([
        buildEvent({ id: "event-1", capacity: 10 }),
        buildEvent({ id: "event-2", capacity: 5 }),
      ]);
      prisma.registration.groupBy.mockResolvedValue([
        { eventId: "event-1", status: "CONFIRMED", _count: 3 },
        { eventId: "event-1", status: "WAITLISTED", _count: 2 },
        // event-2はCONFIRMED登録が無い（groupByの結果に行が現れない）ケース
      ]);
      prisma.registration.findMany.mockResolvedValue([]);

      const result = await service.getEvents("user-1");

      expect(result.organizing).toEqual([
        expect.objectContaining({ id: "event-1", capacity: 10, confirmedCount: 3, waitlistedCount: 2 }),
        expect.objectContaining({ id: "event-2", capacity: 5, confirmedCount: 0, waitlistedCount: 0 }),
      ]);
    });

    it("参加予定（upcoming）は開催前かつCONFIRMED/WAITLISTEDの登録を対象に検索される", async () => {
      prisma.event.findMany.mockResolvedValue([]);
      prisma.registration.findMany
        .mockResolvedValueOnce([
          buildRegistration({
            status: "WAITLISTED",
            position: 2,
            event: buildEvent({ id: "event-upcoming", startAt: new Date("2026-03-01T00:00:00+09:00") }),
          }),
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getEvents("user-1");

      expect(prisma.registration.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            userId: "user-1",
            status: { in: ["CONFIRMED", "WAITLISTED"] },
            event: { startAt: { gt: new Date("2026-02-01T00:00:00+09:00") }, deletedAt: null },
          },
        }),
      );
      expect(result.upcoming).toEqual([
        {
          id: "event-upcoming",
          title: "サンプルイベント",
          startAt: new Date("2026-03-01T00:00:00+09:00"),
          category: CATEGORY_A,
          status: "WAITLISTED",
          position: 2,
        },
      ]);
    });

    it("参加履歴（history）は開催済みの登録を対象に検索され、attendanceStatusが未マークの場合はnullを含む", async () => {
      prisma.event.findMany.mockResolvedValue([]);
      prisma.registration.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          buildRegistration({
            status: "CONFIRMED",
            attendanceStatus: null,
            event: buildEvent({ id: "event-history", startAt: new Date("2026-01-01T00:00:00+09:00") }),
          }),
        ]);

      const result = await service.getEvents("user-1");

      expect(prisma.registration.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            userId: "user-1",
            event: { startAt: { lte: new Date("2026-02-01T00:00:00+09:00") }, deletedAt: null },
          },
        }),
      );
      expect(result.history).toEqual([
        {
          id: "event-history",
          title: "サンプルイベント",
          startAt: new Date("2026-01-01T00:00:00+09:00"),
          category: CATEGORY_A,
          attendanceStatus: null,
        },
      ]);
    });

    it("主催イベントと参加予定・参加履歴は別々のクエリ結果から独立して構成され、重複しない", async () => {
      prisma.event.findMany.mockResolvedValue([buildEvent({ id: "organizing-event" })]);
      prisma.registration.groupBy.mockResolvedValue([]);
      prisma.registration.findMany
        .mockResolvedValueOnce([buildRegistration({ event: buildEvent({ id: "upcoming-event" }) })])
        .mockResolvedValueOnce([buildRegistration({ event: buildEvent({ id: "history-event" }) })]);

      const result = await service.getEvents("user-1");

      const ids = [
        ...result.organizing.map((event) => event.id),
        ...result.upcoming.map((event) => event.id),
        ...result.history.map((event) => event.id),
      ];
      expect(ids).toEqual(["organizing-event", "upcoming-event", "history-event"]);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("getStats", () => {
    it("開催済みかつCONFIRMEDの登録のみをtotalParticipationsとしてカウントする", async () => {
      prisma.registration.findMany.mockResolvedValue([
        buildRegistration({ event: buildEvent({ category: CATEGORY_A }) }),
        buildRegistration({ event: buildEvent({ category: CATEGORY_A }) }),
      ]);

      const result = await service.getStats("user-1");

      expect(prisma.registration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: "user-1",
            status: "CONFIRMED",
            event: { startAt: { lte: new Date("2026-02-01T00:00:00+09:00") }, deletedAt: null },
          },
        }),
      );
      expect(result.totalParticipations).toBe(2);
    });

    it("出席率は出席回数÷(出席回数+欠席回数)であり、未マークは分母から除外される", async () => {
      prisma.registration.findMany.mockResolvedValue([
        buildRegistration({ attendanceStatus: "ATTENDED" }),
        buildRegistration({ attendanceStatus: "ATTENDED" }),
        buildRegistration({ attendanceStatus: "ABSENT" }),
        buildRegistration({ attendanceStatus: null }),
      ]);

      const result = await service.getStats("user-1");

      // 出席2件・欠席1件・未マーク1件 → 未マークを除いた3件を分母として2/3
      expect(result.attendanceRate).toBeCloseTo(2 / 3);
    });

    it("出席マーク済みの登録が1件も無い場合、attendanceRateはnullになる（0除算しない）", async () => {
      prisma.registration.findMany.mockResolvedValue([
        buildRegistration({ attendanceStatus: null }),
        buildRegistration({ attendanceStatus: null }),
      ]);

      const result = await service.getStats("user-1");

      expect(result.attendanceRate).toBeNull();
    });

    it("参加登録が1件も無い場合も、attendanceRateはnullになる", async () => {
      prisma.registration.findMany.mockResolvedValue([]);

      const result = await service.getStats("user-1");

      expect(result.totalParticipations).toBe(0);
      expect(result.attendanceRate).toBeNull();
    });

    it("byCategoryはカテゴリ名ごとの件数集計であり、登録が存在しないカテゴリは含まれない", async () => {
      prisma.registration.findMany.mockResolvedValue([
        buildRegistration({ event: buildEvent({ category: CATEGORY_A }) }),
        buildRegistration({ event: buildEvent({ category: CATEGORY_A }) }),
        buildRegistration({ event: buildEvent({ category: CATEGORY_B }) }),
      ]);

      const result = await service.getStats("user-1");

      expect(result.byCategory).toEqual([
        { category: CATEGORY_A.name, count: 2 },
        { category: CATEGORY_B.name, count: 1 },
      ]);
    });
  });
});
