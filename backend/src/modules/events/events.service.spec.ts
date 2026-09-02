import type { CreateEventInput, UpdateEventInput } from "@eventboard/shared";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";

import type { AuthUser } from "../../common/auth/auth-user.type";
import type { PrismaService } from "../../prisma/prisma.service";

import { EventsService } from "./events.service";

/** テスト全体で固定する「現在時刻」。日時比較ロジックの検証を実行タイミングに依存させないため。 */
const NOW = new Date("2026-01-15T00:00:00.000Z");
const FUTURE_START_AT = new Date("2026-02-01T09:00:00.000Z");
const PAST_START_AT = new Date("2026-01-01T09:00:00.000Z");

const ORGANIZER_ID = "user-organizer";
const OTHER_MEMBER_ID = "user-other-member";
const ADMIN_ID = "user-admin";

/** `PrismaService`のうち`EventsService`が実際に使うメソッドのみをモック化する。 */
interface PrismaMock {
  event: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
  };
  category: {
    findUnique: jest.Mock;
  };
  registration: {
    count: jest.Mock;
  };
  feedback: {
    aggregate: jest.Mock;
  };
  $transaction: jest.Mock;
}

/** `$transaction(async (tx) => ...)`内で使われるトランザクションクライアントのモック。 */
interface TxMock {
  event: { create: jest.Mock; update: jest.Mock };
  tag: { upsert: jest.Mock };
  eventTag: { create: jest.Mock; deleteMany: jest.Mock };
}

function createPrismaMock(): PrismaMock {
  return {
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    registration: {
      count: jest.fn(),
    },
    feedback: {
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

function createTxMock(): TxMock {
  return {
    event: { create: jest.fn(), update: jest.fn() },
    tag: { upsert: jest.fn() },
    eventTag: { create: jest.fn(), deleteMany: jest.fn() },
  };
}

/** `$transaction`が渡されたコールバックへ`tx`を渡して即実行するようにモックする。 */
function stubTransaction(prisma: PrismaMock, tx: TxMock): void {
  prisma.$transaction.mockImplementation(async (callback: (tx: TxMock) => Promise<unknown>) => callback(tx));
}

/**
 * モック関数の1回目の呼び出しの第1引数を、指定した型として取り出す。
 * WHY: `expect.objectContaining`を入れ子にすると`@typescript-eslint/no-unsafe-assignment`に
 * 抵触するため、実際の呼び出し引数を型付けして取り出したうえでプレーンな`toEqual`/`toMatchObject`
 * で検証する。
 */
function firstCallArg<T>(mockFn: jest.Mock): T {
  const calls = mockFn.mock.calls as unknown[][];
  return calls[0]?.[0] as T;
}

function buildAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: OTHER_MEMBER_ID,
    email: "member@example.com",
    name: "参加メンバー",
    role: "MEMBER",
    ...overrides,
  };
}

interface RegistrationFixture {
  userId: string;
  status: "CONFIRMED" | "WAITLISTED";
}

/** `findAll`用の最小限のイベント行フィクスチャ。 */
function buildEventListRow(overrides: {
  id?: string;
  organizerId?: string;
  startAt?: Date;
  registrationDeadline?: Date | null;
  registrations?: RegistrationFixture[];
} = {}) {
  return {
    id: overrides.id ?? "event-1",
    title: "テストイベント",
    startAt: overrides.startAt ?? FUTURE_START_AT,
    capacity: 10,
    category: { id: "cat-1", name: "勉強会" },
    organizerId: overrides.organizerId ?? ORGANIZER_ID,
    registrationDeadline: overrides.registrationDeadline ?? null,
    registrations: overrides.registrations ?? [],
  };
}

/** `findOne`用の詳細イベント行フィクスチャ（`category`/`organizer`/`eventTags`/`registrations`を含む）。 */
function buildEventDetailRow(overrides: {
  id?: string;
  organizerId?: string;
  startAt?: Date;
  registrationDeadline?: Date | null;
  cancellationDeadline?: Date | null;
  registrations?: RegistrationFixture[];
} = {}) {
  return {
    id: overrides.id ?? "event-1",
    title: "テストイベント",
    description: "説明文",
    startAt: overrides.startAt ?? FUTURE_START_AT,
    endAt: null,
    capacity: 10,
    category: { id: "cat-1", name: "勉強会" },
    organizer: { id: overrides.organizerId ?? ORGANIZER_ID, name: "主催者太郎" },
    organizerId: overrides.organizerId ?? ORGANIZER_ID,
    eventTags: [],
    registrationDeadline: overrides.registrationDeadline ?? null,
    cancellationDeadline: overrides.cancellationDeadline ?? null,
    registrations: overrides.registrations ?? [],
  };
}

const EMPTY_FEEDBACK_AGGREGATE = { _avg: { rating: null }, _count: { _all: 0 } };

describe("EventsService", () => {
  let prisma: PrismaMock;
  let service: EventsService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    prisma = createPrismaMock();
    service = new EventsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("findAll", () => {
    it("カテゴリ絞り込み指定時、whereにcategoryIdが含まれること", async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.findAll(buildAuthUser(), { category: "cat-1" });

      const args = firstCallArg<{ where: Record<string, unknown> }>(prisma.event.findMany);
      expect(args.where).toMatchObject({ deletedAt: null, categoryId: "cat-1" });
    });

    it("キーワード検索指定時、title/descriptionへの大文字小文字を区別しないOR条件になること", async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.findAll(buildAuthUser(), { keyword: "勉強会" });

      const args = firstCallArg<{ where: Record<string, unknown> }>(prisma.event.findMany);
      expect(args.where).toMatchObject({
        OR: [
          { title: { contains: "勉強会", mode: "insensitive" } },
          { description: { contains: "勉強会", mode: "insensitive" } },
        ],
      });
    });

    it("タグ検索指定時、カンマ区切りタグ名をtrim・小文字化・重複除去した上でOR相当のin条件になること", async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.findAll(buildAuthUser(), { tags: "Study, STUDY ,Networking" });

      const args = firstCallArg<{ where: Record<string, unknown> }>(prisma.event.findMany);
      expect(args.where).toMatchObject({
        eventTags: { some: { tag: { name: { in: ["study", "networking"] } } } },
      });
    });

    it("tagsクエリ未指定時は、eventTagsによる絞り込み条件自体が付与されないこと", async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.findAll(buildAuthUser(), {});

      const [{ where }] = prisma.event.findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
      expect(where).not.toHaveProperty("eventTags");
    });

    it("sort未指定時は開催日時の昇順（startAtAsc）でソートされること", async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.findAll(buildAuthUser(), {});

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { startAt: "asc" } }),
      );
    });

    it("sort=startAtDesc指定時は開催日時の降順でソートされること", async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.findAll(buildAuthUser(), { sort: "startAtDesc" });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { startAt: "desc" } }),
      );
    });

    it("論理削除済みイベントを除外するため、whereに常にdeletedAt:nullが含まれること", async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.findAll(buildAuthUser(), {});

      const args = firstCallArg<{ where: Record<string, unknown> }>(prisma.event.findMany);
      expect(args.where).toMatchObject({ deletedAt: null });
    });

    it("confirmedCountはCONFIRMEDの登録件数のみをカウントすること（WAITLISTEDは含めない）", async () => {
      prisma.event.findMany.mockResolvedValue([
        buildEventListRow({
          registrations: [
            { userId: "a", status: "CONFIRMED" },
            { userId: "b", status: "CONFIRMED" },
            { userId: "c", status: "WAITLISTED" },
          ],
        }),
      ]);

      const result = await service.findAll(buildAuthUser(), {});

      expect(result[0]?.confirmedCount).toBe(2);
    });
  });

  describe("registrationState計算（findAll/findOne共通ロジック）", () => {
    it("実行者がorganizerIdと一致する場合はORGANIZERになること（Registration有無より優先）", async () => {
      const user = buildAuthUser({ id: ORGANIZER_ID });
      prisma.event.findMany.mockResolvedValue([
        buildEventListRow({
          organizerId: ORGANIZER_ID,
          // WHY: 実データでは主催者はRegistration行を持たないが、優先順位を明示的に検証するため
          // あえて同一ユーザーのRegistrationも存在する状態を作る。
          registrations: [{ userId: ORGANIZER_ID, status: "CONFIRMED" }],
        }),
      ]);

      const result = await service.findAll(user, {});

      expect(result[0]?.registrationState).toBe("ORGANIZER");
    });

    it("実行者にCONFIRMEDのRegistrationがある場合はCONFIRMEDになること", async () => {
      const user = buildAuthUser({ id: OTHER_MEMBER_ID });
      prisma.event.findMany.mockResolvedValue([
        buildEventListRow({ registrations: [{ userId: OTHER_MEMBER_ID, status: "CONFIRMED" }] }),
      ]);

      const result = await service.findAll(user, {});

      expect(result[0]?.registrationState).toBe("CONFIRMED");
    });

    it("実行者にWAITLISTEDのRegistrationがある場合はWAITLISTEDになること", async () => {
      const user = buildAuthUser({ id: OTHER_MEMBER_ID });
      prisma.event.findMany.mockResolvedValue([
        buildEventListRow({ registrations: [{ userId: OTHER_MEMBER_ID, status: "WAITLISTED" }] }),
      ]);

      const result = await service.findAll(user, {});

      expect(result[0]?.registrationState).toBe("WAITLISTED");
    });

    it("未登録かつ登録締切（registrationDeadline）を過ぎている場合はCLOSEDになること", async () => {
      const user = buildAuthUser({ id: OTHER_MEMBER_ID });
      prisma.event.findMany.mockResolvedValue([
        buildEventListRow({
          startAt: FUTURE_START_AT,
          registrationDeadline: new Date("2026-01-10T00:00:00.000Z"), // NOWより過去
          registrations: [],
        }),
      ]);

      const result = await service.findAll(user, {});

      expect(result[0]?.registrationState).toBe("CLOSED");
    });

    it("未登録かつregistrationDeadline未設定の場合、startAtを過ぎていればCLOSEDになること（開催自体が過去）", async () => {
      const user = buildAuthUser({ id: OTHER_MEMBER_ID });
      prisma.event.findMany.mockResolvedValue([
        buildEventListRow({
          startAt: PAST_START_AT,
          registrationDeadline: null,
          registrations: [],
        }),
      ]);

      const result = await service.findAll(user, {});

      expect(result[0]?.registrationState).toBe("CLOSED");
    });

    it("未登録かつ締切前・開催前の場合はNOT_REGISTEREDになること", async () => {
      const user = buildAuthUser({ id: OTHER_MEMBER_ID });
      prisma.event.findMany.mockResolvedValue([
        buildEventListRow({
          startAt: FUTURE_START_AT,
          registrationDeadline: null,
          registrations: [],
        }),
      ]);

      const result = await service.findAll(user, {});

      expect(result[0]?.registrationState).toBe("NOT_REGISTERED");
    });
  });

  describe("create", () => {
    const baseInput: CreateEventInput = {
      title: "新イベント",
      categoryId: "cat-1",
      tags: [],
      startAt: FUTURE_START_AT.toISOString(),
      capacity: 10,
    };

    function stubFormatBasicEvent(eventId: string, tagNames: string[] = []) {
      prisma.event.findUniqueOrThrow.mockResolvedValue({
        id: eventId,
        title: baseInput.title,
        description: null,
        category: { id: "cat-1", name: "勉強会" },
        eventTags: tagNames.map((name) => ({ tag: { name } })),
        startAt: FUTURE_START_AT,
        endAt: null,
        capacity: 10,
        registrationDeadline: null,
        cancellationDeadline: null,
      });
    }

    it("作成できること。organizerIdは引数で渡された実行者idになる", async () => {
      prisma.category.findUnique.mockResolvedValue({ id: "cat-1", name: "勉強会" });
      const tx = createTxMock();
      tx.event.create.mockResolvedValue({ id: "event-new" });
      stubTransaction(prisma, tx);
      stubFormatBasicEvent("event-new");

      await service.create(baseInput, ORGANIZER_ID);

      const args = firstCallArg<{ data: { organizerId: string } }>(tx.event.create);
      expect(args.data.organizerId).toBe(ORGANIZER_ID);
    });

    it("startAtが現在時刻以前（過去日時）の場合、400（BadRequestException）になること", async () => {
      const input: CreateEventInput = { ...baseInput, startAt: PAST_START_AT.toISOString() };

      await expect(service.create(input, ORGANIZER_ID)).rejects.toThrow(BadRequestException);
      expect(prisma.category.findUnique).not.toHaveBeenCalled();
    });

    it("存在しないcategoryIdの場合、404（NotFoundException）になること", async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.create(baseInput, ORGANIZER_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("既存タグ名を指定した場合、tag.upsertで流用され重複作成されないこと。新規タグ名は新規作成されること", async () => {
      prisma.category.findUnique.mockResolvedValue({ id: "cat-1", name: "勉強会" });
      const tx = createTxMock();
      tx.event.create.mockResolvedValue({ id: "event-new" });
      tx.tag.upsert.mockImplementation(
        ({ where }: { where: { name: string } }) => Promise.resolve({ id: `tag-${where.name}`, name: where.name }),
      );
      stubTransaction(prisma, tx);
      stubFormatBasicEvent("event-new", ["study", "networking"]);

      const input: CreateEventInput = { ...baseInput, tags: ["Study", " Networking "] };
      await service.create(input, ORGANIZER_ID);

      expect(tx.tag.upsert).toHaveBeenCalledTimes(2);
      expect(tx.tag.upsert).toHaveBeenNthCalledWith(1, {
        where: { name: "study" },
        create: { name: "study" },
        update: {},
      });
      expect(tx.tag.upsert).toHaveBeenNthCalledWith(2, {
        where: { name: "networking" },
        create: { name: "networking" },
        update: {},
      });
      expect(tx.eventTag.create).toHaveBeenCalledWith({ data: { eventId: "event-new", tagId: "tag-study" } });
      expect(tx.eventTag.create).toHaveBeenCalledWith({ data: { eventId: "event-new", tagId: "tag-networking" } });
    });

    it("タグ名はtrim・小文字化したうえで重複が除去されること", async () => {
      prisma.category.findUnique.mockResolvedValue({ id: "cat-1", name: "勉強会" });
      const tx = createTxMock();
      tx.event.create.mockResolvedValue({ id: "event-new" });
      tx.tag.upsert.mockResolvedValue({ id: "tag-study", name: "study" });
      stubTransaction(prisma, tx);
      stubFormatBasicEvent("event-new", ["study"]);

      const input: CreateEventInput = { ...baseInput, tags: ["Study", " study ", "STUDY"] };
      await service.create(input, ORGANIZER_ID);

      expect(tx.tag.upsert).toHaveBeenCalledTimes(1);
      expect(tx.eventTag.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("findOne", () => {
    it("confirmedCount/waitlistedCountがそれぞれのstatus件数と一致すること", async () => {
      prisma.event.findFirst.mockResolvedValue(
        buildEventDetailRow({
          registrations: [
            { userId: "a", status: "CONFIRMED" },
            { userId: "b", status: "CONFIRMED" },
            { userId: "c", status: "WAITLISTED" },
          ],
        }),
      );
      prisma.feedback.aggregate.mockResolvedValue(EMPTY_FEEDBACK_AGGREGATE);

      const result = await service.findOne("event-1", buildAuthUser({ id: OTHER_MEMBER_ID }));

      expect(result.confirmedCount).toBe(2);
      expect(result.waitlistedCount).toBe(1);
    });

    it("averageRatingは非公開分を除外した平均値を小数第1位に丸めて返すこと", async () => {
      prisma.event.findFirst.mockResolvedValue(buildEventDetailRow());
      prisma.feedback.aggregate.mockResolvedValue({ _avg: { rating: 4.666666 }, _count: { _all: 3 } });

      const result = await service.findOne("event-1", buildAuthUser());

      expect(prisma.feedback.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: "event-1", isHidden: false } }),
      );
      expect(result.averageRating).toBe(4.7);
      expect(result.feedbackCount).toBe(3);
    });

    it("非公開分を除いた対象が0件の場合、averageRatingは0ではなくnullになること", async () => {
      prisma.event.findFirst.mockResolvedValue(buildEventDetailRow());
      prisma.feedback.aggregate.mockResolvedValue(EMPTY_FEEDBACK_AGGREGATE);

      const result = await service.findOne("event-1", buildAuthUser());

      expect(result.averageRating).toBeNull();
      expect(result.feedbackCount).toBe(0);
    });

    it("存在しないイベントIDの場合、404（NotFoundException）になり、feedback集計は呼ばれないこと", async () => {
      prisma.event.findFirst.mockResolvedValue(null);

      await expect(service.findOne("nonexistent", buildAuthUser())).rejects.toThrow(NotFoundException);
      expect(prisma.feedback.aggregate).not.toHaveBeenCalled();
    });

    it("論理削除済み（deletedAt設定済み）のイベントは、findFirstのwhere条件により取得対象外となること", async () => {
      // WHY: 論理削除済みは`where: { deletedAt: null }`で除外されるため、モック上はfindFirstの
      // 呼び出し引数自体でこの意図を検証する（実DBのフィルタ挙動はモックでは再現できないため）。
      prisma.event.findFirst.mockResolvedValue(null);

      await expect(service.findOne("deleted-event", buildAuthUser())).rejects.toThrow(NotFoundException);
      expect(prisma.event.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "deleted-event", deletedAt: null } }),
      );
    });
  });

  describe("update", () => {
    const baseUpdateInput: UpdateEventInput = { title: "更新後タイトル" };

    it("部分更新の場合、指定したフィールドのみがtx.event.updateへ渡されること", async () => {
      prisma.event.findFirst.mockResolvedValue(buildEventDetailRow({ organizerId: ORGANIZER_ID }));
      const tx = createTxMock();
      tx.event.update.mockResolvedValue({ id: "event-1" });
      stubTransaction(prisma, tx);
      prisma.event.findUniqueOrThrow.mockResolvedValue({
        id: "event-1",
        title: "更新後タイトル",
        description: "説明文",
        category: { id: "cat-1", name: "勉強会" },
        eventTags: [],
        startAt: FUTURE_START_AT,
        endAt: null,
        capacity: 10,
        registrationDeadline: null,
        cancellationDeadline: null,
      });

      await service.update("event-1", baseUpdateInput, buildAuthUser({ id: ORGANIZER_ID, role: "MEMBER" }));

      expect(tx.event.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: { title: "更新後タイトル" },
      });
    });

    it("主催者本人でもadminでもない場合、403（ForbiddenException）になること", async () => {
      prisma.event.findFirst.mockResolvedValue(buildEventDetailRow({ organizerId: ORGANIZER_ID }));

      await expect(
        service.update("event-1", baseUpdateInput, buildAuthUser({ id: OTHER_MEMBER_ID, role: "MEMBER" })),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("主催者本人でなくてもadminであれば更新できること", async () => {
      prisma.event.findFirst.mockResolvedValue(buildEventDetailRow({ organizerId: ORGANIZER_ID }));
      const tx = createTxMock();
      tx.event.update.mockResolvedValue({ id: "event-1" });
      stubTransaction(prisma, tx);
      prisma.event.findUniqueOrThrow.mockResolvedValue({
        id: "event-1",
        title: "更新後タイトル",
        description: "説明文",
        category: { id: "cat-1", name: "勉強会" },
        eventTags: [],
        startAt: FUTURE_START_AT,
        endAt: null,
        capacity: 10,
        registrationDeadline: null,
        cancellationDeadline: null,
      });

      const result = await service.update("event-1", baseUpdateInput, buildAuthUser({ id: ADMIN_ID, role: "ADMIN" }));

      expect(result.title).toBe("更新後タイトル");
      expect(tx.event.update).toHaveBeenCalledWith({ where: { id: "event-1" }, data: { title: "更新後タイトル" } });
    });

    it("startAtを変更し、CONFIRMEDの登録者が1人以上いる場合、hasRegisteredParticipants:trueを返すこと", async () => {
      prisma.event.findFirst.mockResolvedValue(
        buildEventDetailRow({ organizerId: ORGANIZER_ID, startAt: FUTURE_START_AT }),
      );
      const tx = createTxMock();
      tx.event.update.mockResolvedValue({ id: "event-1" });
      stubTransaction(prisma, tx);
      prisma.registration.count.mockResolvedValue(2);
      prisma.event.findUniqueOrThrow.mockResolvedValue({
        id: "event-1",
        title: "テストイベント",
        description: "説明文",
        category: { id: "cat-1", name: "勉強会" },
        eventTags: [],
        startAt: new Date("2026-03-01T09:00:00.000Z"),
        endAt: null,
        capacity: 10,
        registrationDeadline: null,
        cancellationDeadline: null,
      });

      const result = await service.update(
        "event-1",
        { startAt: "2026-03-01T09:00:00.000Z" },
        buildAuthUser({ id: ORGANIZER_ID }),
      );

      expect(prisma.registration.count).toHaveBeenCalledWith({ where: { eventId: "event-1", status: "CONFIRMED" } });
      expect(result.hasRegisteredParticipants).toBe(true);
    });

    it("startAtを変更してもCONFIRMED登録者が0人の場合、hasRegisteredParticipants:falseになること", async () => {
      prisma.event.findFirst.mockResolvedValue(
        buildEventDetailRow({ organizerId: ORGANIZER_ID, startAt: FUTURE_START_AT }),
      );
      const tx = createTxMock();
      tx.event.update.mockResolvedValue({ id: "event-1" });
      stubTransaction(prisma, tx);
      prisma.registration.count.mockResolvedValue(0);
      prisma.event.findUniqueOrThrow.mockResolvedValue({
        id: "event-1",
        title: "テストイベント",
        description: "説明文",
        category: { id: "cat-1", name: "勉強会" },
        eventTags: [],
        startAt: new Date("2026-03-01T09:00:00.000Z"),
        endAt: null,
        capacity: 10,
        registrationDeadline: null,
        cancellationDeadline: null,
      });

      const result = await service.update(
        "event-1",
        { startAt: "2026-03-01T09:00:00.000Z" },
        buildAuthUser({ id: ORGANIZER_ID }),
      );

      expect(result.hasRegisteredParticipants).toBe(false);
    });

    it("startAtを変更しない更新の場合、CONFIRMED件数の判定自体が走らないこと（registration.countが呼ばれない）", async () => {
      prisma.event.findFirst.mockResolvedValue(
        buildEventDetailRow({ organizerId: ORGANIZER_ID, startAt: FUTURE_START_AT }),
      );
      const tx = createTxMock();
      tx.event.update.mockResolvedValue({ id: "event-1" });
      stubTransaction(prisma, tx);
      prisma.event.findUniqueOrThrow.mockResolvedValue({
        id: "event-1",
        title: "更新後タイトル",
        description: "説明文",
        category: { id: "cat-1", name: "勉強会" },
        eventTags: [],
        startAt: FUTURE_START_AT,
        endAt: null,
        capacity: 10,
        registrationDeadline: null,
        cancellationDeadline: null,
      });

      const result = await service.update("event-1", { title: "更新後タイトル" }, buildAuthUser({ id: ORGANIZER_ID }));

      expect(prisma.registration.count).not.toHaveBeenCalled();
      expect(result.hasRegisteredParticipants).toBe(false);
    });

    it("変更後のstartAtが過去日時の場合、400（BadRequestException）になること", async () => {
      prisma.event.findFirst.mockResolvedValue(
        buildEventDetailRow({ organizerId: ORGANIZER_ID, startAt: FUTURE_START_AT }),
      );

      await expect(
        service.update("event-1", { startAt: PAST_START_AT.toISOString() }, buildAuthUser({ id: ORGANIZER_ID })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("存在しないcategoryIdを指定した場合、404（NotFoundException）になること", async () => {
      prisma.event.findFirst.mockResolvedValue(buildEventDetailRow({ organizerId: ORGANIZER_ID }));
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.update("event-1", { categoryId: "nonexistent-cat" }, buildAuthUser({ id: ORGANIZER_ID })),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("tagsを指定した場合、既存のEventTagが全置換される（deleteMany後にlinkTagsが実行される）こと", async () => {
      prisma.event.findFirst.mockResolvedValue(buildEventDetailRow({ organizerId: ORGANIZER_ID }));
      const tx = createTxMock();
      tx.event.update.mockResolvedValue({ id: "event-1" });
      tx.tag.upsert.mockResolvedValue({ id: "tag-newtag", name: "newtag" });
      stubTransaction(prisma, tx);
      prisma.event.findUniqueOrThrow.mockResolvedValue({
        id: "event-1",
        title: "テストイベント",
        description: "説明文",
        category: { id: "cat-1", name: "勉強会" },
        eventTags: [{ tag: { name: "newtag" } }],
        startAt: FUTURE_START_AT,
        endAt: null,
        capacity: 10,
        registrationDeadline: null,
        cancellationDeadline: null,
      });

      await service.update("event-1", { tags: ["newtag"] }, buildAuthUser({ id: ORGANIZER_ID }));

      expect(tx.eventTag.deleteMany).toHaveBeenCalledWith({ where: { eventId: "event-1" } });
      expect(tx.tag.upsert).toHaveBeenCalledWith({
        where: { name: "newtag" },
        create: { name: "newtag" },
        update: {},
      });
      expect(tx.eventTag.create).toHaveBeenCalledWith({ data: { eventId: "event-1", tagId: "tag-newtag" } });
    });

    it("存在しない、または論理削除済みのイベントの場合、404（NotFoundException）になること", async () => {
      prisma.event.findFirst.mockResolvedValue(null);

      await expect(
        service.update("nonexistent", baseUpdateInput, buildAuthUser({ id: ORGANIZER_ID })),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("論理削除されること（deletedAtが現在時刻で設定され、物理削除ではないこと）", async () => {
      prisma.event.findFirst.mockResolvedValue({ id: "event-1", organizerId: ORGANIZER_ID, deletedAt: null });
      prisma.event.update.mockResolvedValue({ id: "event-1" });

      await service.remove("event-1", buildAuthUser({ id: ORGANIZER_ID }));

      expect(prisma.event.update).toHaveBeenCalledWith({ where: { id: "event-1" }, data: { deletedAt: NOW } });
    });

    it("主催者本人でもadminでもない場合、403（ForbiddenException）になり、更新は実行されないこと", async () => {
      prisma.event.findFirst.mockResolvedValue({ id: "event-1", organizerId: ORGANIZER_ID, deletedAt: null });

      await expect(service.remove("event-1", buildAuthUser({ id: OTHER_MEMBER_ID }))).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it("adminであれば主催者本人でなくても削除できること", async () => {
      prisma.event.findFirst.mockResolvedValue({ id: "event-1", organizerId: ORGANIZER_ID, deletedAt: null });
      prisma.event.update.mockResolvedValue({ id: "event-1" });

      await expect(service.remove("event-1", buildAuthUser({ id: ADMIN_ID, role: "ADMIN" }))).resolves.toBeUndefined();
    });

    it("存在しない、または既に削除済みのイベントの場合、404（NotFoundException）になること", async () => {
      prisma.event.findFirst.mockResolvedValue(null);

      await expect(service.remove("nonexistent", buildAuthUser({ id: ORGANIZER_ID }))).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });
});
