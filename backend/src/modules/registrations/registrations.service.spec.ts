import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Event, Registration } from "@prisma/client";
import { Prisma } from "@prisma/client";

import type { AuthUser } from "../../common/auth/auth-user.type";
import type { PrismaService } from "../../prisma/prisma.service";

import { RegistrationsService } from "./registrations.service";

/** テスト対象イベントのデフォルト値。各テストで必要なフィールドのみ上書きする。 */
function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    title: "テストイベント",
    description: "説明",
    categoryId: "category-1",
    organizerId: "organizer-1",
    capacity: 10,
    startAt: new Date("2026-09-10T10:00:00Z"),
    endAt: new Date("2026-09-10T12:00:00Z"),
    registrationDeadline: null,
    cancellationDeadline: null,
    location: "会議室A",
    deletedAt: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  } as unknown as Event;
}

/** テスト対象Registrationのデフォルト値。 */
function createRegistration(overrides: Partial<Registration> = {}): Registration {
  return {
    id: "registration-1",
    eventId: "event-1",
    userId: "user-1",
    status: "CONFIRMED",
    position: null,
    attendanceStatus: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  } as unknown as Registration;
}

function createUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "user1@example.com",
    name: "一般ユーザー",
    role: "MEMBER",
    ...overrides,
  };
}

/**
 * トランザクションコールバック内で使われる`tx`のモック。
 * `$transaction`のモック実装からこのオブジェクトを渡し、内部呼び出しを個別に検証できるようにする。
 */
/**
 * `jest.fn()`の呼び出し順序（`invocationCallOrder[0]`）を取得する。
 * 非nullアサーション（CODING_STANDARDS禁止）を使わず、未呼び出しの場合はテストを明示的に失敗させる。
 */
function getCallOrder(mockFn: jest.Mock): number {
  const order = mockFn.mock.invocationCallOrder[0];
  if (order === undefined) {
    throw new Error("対象のモック関数が一度も呼び出されていません");
  }
  return order;
}

function createMockTx() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([]),
    registration: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    promotionHistory: {
      create: jest.fn(),
    },
  };
}

describe("RegistrationsService", () => {
  let mockTx: ReturnType<typeof createMockTx>;
  let prisma: {
    event: { findUnique: jest.Mock };
    registration: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: RegistrationsService;

  beforeEach(() => {
    mockTx = createMockTx();
    prisma = {
      event: { findUnique: jest.fn() },
      registration: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      // WHY: register/cancelの実装は$transaction(callback)を呼び出すだけなので、
      // ここでcallbackにmockTxを渡して実行することで、tx経由の呼び出しをテストから直接検証できるようにする。
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(mockTx)),
    };
    service = new RegistrationsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("register", () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date("2026-09-01T00:00:00Z"));
    });

    it("定員に空きがある場合、CONFIRMEDとして登録される", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ capacity: 10 }));
      mockTx.registration.findUnique.mockResolvedValue(null);
      mockTx.registration.count.mockResolvedValue(5);

      // Act
      const result = await service.register("event-1", createUser({ id: "user-2" }));

      // Assert
      expect(result).toEqual({ status: "CONFIRMED", position: null });
      expect(mockTx.registration.create).toHaveBeenCalledWith({
        data: { eventId: "event-1", userId: "user-2", status: "CONFIRMED", position: null },
      });
    });

    it("満席の場合、WAITLISTEDとして登録され、positionは現在の最大position+1になる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ capacity: 5 }));
      mockTx.registration.findUnique.mockResolvedValue(null);
      mockTx.registration.count.mockResolvedValue(5);
      mockTx.registration.findFirst.mockResolvedValue(createRegistration({ position: 3 }));

      // Act
      const result = await service.register("event-1", createUser({ id: "user-2" }));

      // Assert
      expect(result).toEqual({ status: "WAITLISTED", position: 4 });
      expect(mockTx.registration.create).toHaveBeenCalledWith({
        data: { eventId: "event-1", userId: "user-2", status: "WAITLISTED", position: 4 },
      });
    });

    it("待機者が1人もいない状態での初回待機登録の場合、position:1になる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ capacity: 5 }));
      mockTx.registration.findUnique.mockResolvedValue(null);
      mockTx.registration.count.mockResolvedValue(5);
      mockTx.registration.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.register("event-1", createUser({ id: "user-2" }));

      // Assert
      expect(result).toEqual({ status: "WAITLISTED", position: 1 });
      expect(mockTx.registration.create).toHaveBeenCalledWith({
        data: { eventId: "event-1", userId: "user-2", status: "WAITLISTED", position: 1 },
      });
    });

    it("主催者本人が自イベントに登録しようとした場合、ConflictExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ organizerId: "organizer-1" }));

      // Act & Assert
      await expect(service.register("event-1", createUser({ id: "organizer-1" }))).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("既に参加登録済み（トランザクション内の再チェックで検出）の場合、ConflictExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent());
      mockTx.registration.findUnique.mockResolvedValue(createRegistration());

      // Act & Assert
      await expect(service.register("event-1", createUser({ id: "user-2" }))).rejects.toThrow(ConflictException);
      expect(mockTx.registration.create).not.toHaveBeenCalled();
    });

    it("P2002（一意制約違反）がトランザクション内で発生した場合もConflictExceptionに変換される", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent());
      mockTx.registration.findUnique.mockResolvedValue(null);
      mockTx.registration.count.mockResolvedValue(0);
      mockTx.registration.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

      // Act & Assert
      await expect(service.register("event-1", createUser({ id: "user-2" }))).rejects.toThrow(ConflictException);
    });

    it("イベントのstartAtを既に過ぎている場合、BadRequestExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(
        createEvent({ startAt: new Date("2026-08-01T00:00:00Z") }),
      );

      // Act & Assert
      await expect(service.register("event-1", createUser())).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("registrationDeadlineが明示的に設定されており、既に過ぎている場合、BadRequestExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(
        createEvent({
          startAt: new Date("2026-09-10T10:00:00Z"),
          registrationDeadline: new Date("2026-08-31T00:00:00Z"),
        }),
      );

      // Act & Assert
      await expect(service.register("event-1", createUser())).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("registrationDeadline未設定の場合、startAt前であれば受付期限切れとして扱われない", async () => {
      // Arrange: 現在時刻はstartAt(9/10)より前なので、デフォルト適用時も期限切れにならないはず
      prisma.event.findUnique.mockResolvedValue(
        createEvent({ startAt: new Date("2026-09-10T10:00:00Z"), registrationDeadline: null }),
      );
      mockTx.registration.findUnique.mockResolvedValue(null);
      mockTx.registration.count.mockResolvedValue(0);

      // Act
      const result = await service.register("event-1", createUser({ id: "user-2" }));

      // Assert
      expect(result.status).toBe("CONFIRMED");
    });

    it("存在しないイベントの場合、NotFoundExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.register("event-404", createUser())).rejects.toThrow(NotFoundException);
    });

    it("論理削除済みイベントの場合、NotFoundExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ deletedAt: new Date("2026-08-15T00:00:00Z") }));

      // Act & Assert
      await expect(service.register("event-1", createUser())).rejects.toThrow(NotFoundException);
    });

    it("イベント行ロック取得後に二重登録チェック・定員カウントが実行される（呼び出し順序の検証）", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ capacity: 10 }));
      mockTx.registration.findUnique.mockResolvedValue(null);
      mockTx.registration.count.mockResolvedValue(0);

      // Act
      await service.register("event-1", createUser({ id: "user-2" }));

      // Assert: $queryRaw（行ロック）→ findUnique（二重登録チェック）→ count（定員判定）の順で呼ばれること
      const queryRawOrder = getCallOrder(mockTx.$queryRaw);
      const findUniqueOrder = getCallOrder(mockTx.registration.findUnique);
      const countOrder = getCallOrder(mockTx.registration.count);
      expect(queryRawOrder).toBeLessThan(findUniqueOrder);
      expect(findUniqueOrder).toBeLessThan(countOrder);
      expect(mockTx.registration.count).toHaveBeenCalledWith({
        where: { eventId: "event-1", status: "CONFIRMED" },
      });
    });
  });

  describe("cancel", () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date("2026-09-01T00:00:00Z"));
    });

    it("本人が期限内にCONFIRMEDをキャンセルできる（待機者がいない場合は繰り上げが発生しない）", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent());
      prisma.registration.findUnique.mockResolvedValue(createRegistration({ status: "CONFIRMED" }));
      mockTx.registration.delete.mockResolvedValue(createRegistration({ status: "CONFIRMED" }));
      mockTx.registration.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.cancel("event-1", createUser({ id: "user-1" }), {});

      // Assert
      expect(result).toEqual({});
      expect(mockTx.registration.delete).toHaveBeenCalledWith({
        where: { eventId_userId: { eventId: "event-1", userId: "user-1" } },
      });
      expect(mockTx.registration.update).not.toHaveBeenCalled();
      expect(mockTx.promotionHistory.create).not.toHaveBeenCalled();
    });

    it("本人が期限内にWAITLISTEDをキャンセルした場合、繰り上げ処理自体が発火しない", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent());
      prisma.registration.findUnique.mockResolvedValue(
        createRegistration({ status: "WAITLISTED", position: 2 }),
      );
      mockTx.registration.delete.mockResolvedValue(createRegistration({ status: "WAITLISTED", position: 2 }));

      // Act
      await service.cancel("event-1", createUser({ id: "user-1" }), {});

      // Assert
      expect(mockTx.registration.findFirst).not.toHaveBeenCalled();
      expect(mockTx.registration.update).not.toHaveBeenCalled();
      expect(mockTx.promotionHistory.create).not.toHaveBeenCalled();
    });

    it("CONFIRMEDのキャンセル時、position最小のWAITLISTEDがCONFIRMEDに昇格し、PromotionHistoryが保存される", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent());
      prisma.registration.findUnique.mockResolvedValue(createRegistration({ status: "CONFIRMED", userId: "user-1" }));
      mockTx.registration.delete.mockResolvedValue(createRegistration({ status: "CONFIRMED", userId: "user-1" }));
      const nextInLine = createRegistration({
        id: "registration-2",
        userId: "user-2",
        status: "WAITLISTED",
        position: 1,
      });
      mockTx.registration.findFirst.mockResolvedValue(nextInLine);

      // Act
      await service.cancel("event-1", createUser({ id: "user-1" }), {});

      // Assert
      expect(mockTx.registration.findFirst).toHaveBeenCalledWith({
        where: { eventId: "event-1", status: "WAITLISTED" },
        orderBy: { position: "asc" },
      });
      expect(mockTx.registration.update).toHaveBeenCalledWith({
        where: { id: "registration-2" },
        data: { status: "CONFIRMED", position: null },
      });
      expect(mockTx.promotionHistory.create).toHaveBeenCalledWith({
        data: { eventId: "event-1", promotedUserId: "user-2", vacatedByUserId: "user-1" },
      });
    });

    it("待機者が0人の場合、削除のみで完了しPromotionHistoryは作成されない", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent());
      prisma.registration.findUnique.mockResolvedValue(createRegistration({ status: "CONFIRMED" }));
      mockTx.registration.delete.mockResolvedValue(createRegistration({ status: "CONFIRMED" }));
      mockTx.registration.findFirst.mockResolvedValue(null);

      // Act
      await service.cancel("event-1", createUser({ id: "user-1" }), {});

      // Assert
      expect(mockTx.registration.update).not.toHaveBeenCalled();
      expect(mockTx.promotionHistory.create).not.toHaveBeenCalled();
    });

    it("イベント行ロック取得後に削除・繰り上げが実行される（呼び出し順序の検証）", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent());
      prisma.registration.findUnique.mockResolvedValue(createRegistration({ status: "CONFIRMED", userId: "user-1" }));
      mockTx.registration.delete.mockResolvedValue(createRegistration({ status: "CONFIRMED", userId: "user-1" }));
      const nextInLine = createRegistration({ id: "registration-2", userId: "user-2", status: "WAITLISTED", position: 1 });
      mockTx.registration.findFirst.mockResolvedValue(nextInLine);

      // Act
      await service.cancel("event-1", createUser({ id: "user-1" }), {});

      // Assert: ロック → 削除 → 繰り上げ検索 → 更新 → 履歴保存 の順で呼ばれること
      const orders: number[] = [
        getCallOrder(mockTx.$queryRaw),
        getCallOrder(mockTx.registration.delete),
        getCallOrder(mockTx.registration.findFirst),
        getCallOrder(mockTx.registration.update),
        getCallOrder(mockTx.promotionHistory.create),
      ];
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    });

    it("キャンセル可能期限（明示設定）を過ぎている通常キャンセルの場合、ForbiddenExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(
        createEvent({ cancellationDeadline: new Date("2026-08-31T00:00:00Z") }),
      );

      // Act & Assert
      await expect(service.cancel("event-1", createUser({ id: "user-1" }), {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.registration.findUnique).not.toHaveBeenCalled();
    });

    it("cancellationDeadline未設定の場合、startAtを過ぎていれば通常キャンセルはForbiddenExceptionになる", async () => {
      // Arrange: 現在時刻(9/1)はstartAt(9/10)より前なので通常はキャンセル可能 → デフォルト適用の確認のため現在時刻をstartAt後にずらす
      jest.setSystemTime(new Date("2026-09-11T00:00:00Z"));
      prisma.event.findUnique.mockResolvedValue(
        createEvent({ startAt: new Date("2026-09-10T10:00:00Z"), cancellationDeadline: null }),
      );

      // Act & Assert
      await expect(service.cancel("event-1", createUser({ id: "user-1" }), {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("adminがuserId指定で強制キャンセルする場合、キャンセル可能期限を過ぎていても成功する", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(
        createEvent({ cancellationDeadline: new Date("2026-08-31T00:00:00Z") }),
      );
      prisma.registration.findUnique.mockResolvedValue(createRegistration({ status: "CONFIRMED", userId: "user-2" }));
      mockTx.registration.delete.mockResolvedValue(createRegistration({ status: "CONFIRMED", userId: "user-2" }));
      mockTx.registration.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.cancel(
        "event-1",
        createUser({ id: "admin-1", role: "ADMIN" }),
        { userId: "user-2" },
      );

      // Assert
      expect(result).toEqual({});
      expect(mockTx.registration.delete).toHaveBeenCalledWith({
        where: { eventId_userId: { eventId: "event-1", userId: "user-2" } },
      });
    });

    it("userId指定時、実行者がADMINでない場合、ForbiddenExceptionを投げる", async () => {
      // Act & Assert
      await expect(
        service.cancel("event-1", createUser({ id: "user-1", role: "MEMBER" }), { userId: "user-2" }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.event.findUnique).not.toHaveBeenCalled();
    });

    it("対象のRegistrationが存在しない場合、NotFoundExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent());
      prisma.registration.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.cancel("event-1", createUser({ id: "user-1" }), {})).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("【参考】キャンセル可能期限チェック後・トランザクション前のRegistration存在確認は非トランザクション（tx外）のprisma経由で行われる", async () => {
      // WHY: この存在確認とトランザクション内のdelete()の間には行ロックが無い時間差があり、
      // 理論上は同時実行時に他のキャンセル操作と競合しうる（本テストはその実装上の設計を明示するもので、
      // 競合そのものを再現するテストではない。test-agentからの報告事項）。
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent());
      prisma.registration.findUnique.mockResolvedValue(createRegistration({ status: "CONFIRMED" }));
      mockTx.registration.delete.mockResolvedValue(createRegistration({ status: "CONFIRMED" }));
      mockTx.registration.findFirst.mockResolvedValue(null);

      // Act
      await service.cancel("event-1", createUser({ id: "user-1" }), {});

      // Assert: 存在確認はトランザクション開始（$transaction呼び出し）より前に完了している
      const preCheckOrder = getCallOrder(prisma.registration.findUnique);
      const transactionOrder = getCallOrder(prisma.$transaction);
      expect(preCheckOrder).toBeLessThan(transactionOrder);
    });
  });

  describe("findRegistrations", () => {
    it("CONFIRMEDの登録のみを返す（WAITLISTEDは含まれない）", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ organizerId: "organizer-1" }));
      prisma.registration.findMany.mockResolvedValue([
        {
          user: { id: "user-1", name: "参加者1" },
          status: "CONFIRMED",
          attendanceStatus: null,
        },
      ]);

      // Act
      const result = await service.findRegistrations("event-1", createUser({ id: "organizer-1" }));

      // Assert
      expect(prisma.registration.findMany).toHaveBeenCalledWith({
        where: { eventId: "event-1", status: "CONFIRMED" },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual([
        { userId: "user-1", name: "参加者1", status: "CONFIRMED", attendanceStatus: null },
      ]);
    });

    it("主催者本人でもadminでもない場合、ForbiddenExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ organizerId: "organizer-1" }));

      // Act & Assert
      await expect(
        service.findRegistrations("event-1", createUser({ id: "other-user", role: "MEMBER" })),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.registration.findMany).not.toHaveBeenCalled();
    });

    it("存在しないイベントの場合、NotFoundExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findRegistrations("event-404", createUser({ role: "ADMIN" })),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("markAttendance", () => {
    beforeEach(() => {
      // WHY: markAttendanceはevent.startAt以降のみ許可されるため、開催後の時刻に固定する
      jest.useFakeTimers().setSystemTime(new Date("2026-09-10T11:00:00Z"));
    });

    it("ATTENDEDをマークできる", async () => {
      // Arrange
      const event = createEvent({ organizerId: "organizer-1" });
      prisma.event.findUnique.mockResolvedValue(event);
      prisma.registration.findUnique.mockResolvedValue(createRegistration({ status: "CONFIRMED" }));
      prisma.registration.update.mockResolvedValue(
        createRegistration({ status: "CONFIRMED", attendanceStatus: "ATTENDED" }),
      );

      // Act
      const result = await service.markAttendance(
        "event-1",
        "user-1",
        createUser({ id: "organizer-1" }),
        { attendanceStatus: "ATTENDED" },
      );

      // Assert
      expect(prisma.registration.update).toHaveBeenCalledWith({
        where: { eventId_userId: { eventId: "event-1", userId: "user-1" } },
        data: { attendanceStatus: "ATTENDED" },
      });
      expect(result.attendanceStatus).toBe("ATTENDED");
    });

    it("ABSENTをマークできる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ organizerId: "organizer-1" }));
      prisma.registration.findUnique.mockResolvedValue(createRegistration({ status: "CONFIRMED" }));
      prisma.registration.update.mockResolvedValue(
        createRegistration({ status: "CONFIRMED", attendanceStatus: "ABSENT" }),
      );

      // Act
      await service.markAttendance("event-1", "user-1", createUser({ id: "organizer-1" }), {
        attendanceStatus: "ABSENT",
      });

      // Assert
      expect(prisma.registration.update).toHaveBeenCalledWith({
        where: { eventId_userId: { eventId: "event-1", userId: "user-1" } },
        data: { attendanceStatus: "ABSENT" },
      });
    });

    it("マーク済みの登録を上書き変更できる（誤操作リカバリ、追加の確認や制限が無い）", async () => {
      // Arrange: 既にATTENDEDでマーク済みの登録をABSENTへ変更するケース
      prisma.event.findUnique.mockResolvedValue(createEvent({ organizerId: "organizer-1" }));
      prisma.registration.findUnique.mockResolvedValue(
        createRegistration({ status: "CONFIRMED", attendanceStatus: "ATTENDED" }),
      );
      prisma.registration.update.mockResolvedValue(
        createRegistration({ status: "CONFIRMED", attendanceStatus: "ABSENT" }),
      );

      // Act
      const result = await service.markAttendance(
        "event-1",
        "user-1",
        createUser({ id: "organizer-1" }),
        { attendanceStatus: "ABSENT" },
      );

      // Assert
      expect(result.attendanceStatus).toBe("ABSENT");
    });

    it("開催日時前の場合、BadRequestExceptionを投げる", async () => {
      // Arrange
      jest.setSystemTime(new Date("2026-09-10T09:00:00Z"));
      prisma.event.findUnique.mockResolvedValue(createEvent({ organizerId: "organizer-1" }));

      // Act & Assert
      await expect(
        service.markAttendance("event-1", "user-1", createUser({ id: "organizer-1" }), {
          attendanceStatus: "ATTENDED",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.registration.findUnique).not.toHaveBeenCalled();
    });

    it("主催者本人でもadminでもない場合、ForbiddenExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ organizerId: "organizer-1" }));

      // Act & Assert
      await expect(
        service.markAttendance("event-1", "user-1", createUser({ id: "other-user", role: "MEMBER" }), {
          attendanceStatus: "ATTENDED",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("対象ユーザーのCONFIRMED登録が存在しない（未登録）場合、NotFoundExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ organizerId: "organizer-1" }));
      prisma.registration.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.markAttendance("event-1", "user-1", createUser({ id: "organizer-1" }), {
          attendanceStatus: "ATTENDED",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("対象ユーザーの登録がWAITLISTEDのみの場合、NotFoundExceptionを投げる", async () => {
      // Arrange
      prisma.event.findUnique.mockResolvedValue(createEvent({ organizerId: "organizer-1" }));
      prisma.registration.findUnique.mockResolvedValue(createRegistration({ status: "WAITLISTED", position: 1 }));

      // Act & Assert
      await expect(
        service.markAttendance("event-1", "user-1", createUser({ id: "organizer-1" }), {
          attendanceStatus: "ATTENDED",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
