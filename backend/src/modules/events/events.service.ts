import type { CreateEventInput, UpdateEventInput } from "@eventboard/shared";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Event, Prisma } from "@prisma/client";

import type { AuthUser } from "../../common/auth/auth-user.type";
import { PrismaService } from "../../prisma/prisma.service";

/** イベント一覧・詳細のクエリパラメータ（MANIFEST.md 6章 #14）。 */
export interface EventListQuery {
  category?: string | undefined;
  keyword?: string | undefined;
  tags?: string | undefined;
  sort?: string | undefined;
}

/**
 * ログインユーザー視点での参加登録状態（MANIFEST.md 6章「設計方針」）。
 * ボタンの出し分けロジックをフロントに持たせず、サーバー側で一元的に計算する。
 */
export type RegistrationState = "NOT_REGISTERED" | "CONFIRMED" | "WAITLISTED" | "ORGANIZER" | "CLOSED";

/** `computeRegistrationState`の判定に必要なイベント側の最小限の情報。 */
interface EventForStateCheck {
  organizerId: string;
  startAt: Date;
  registrationDeadline: Date | null;
}

/** `computeRegistrationState`の判定に必要な参加登録側の最小限の情報。 */
interface RegistrationForStateCheck {
  status: "CONFIRMED" | "WAITLISTED";
}

/**
 * イベント管理API（`/events/*`）のビジネスロジックを担うService（MANIFEST.md 6章 #14〜#18）。
 * 編集・削除の「主催者本人 or admin」判定はCASLの静的な条件では表現できないデータ依存の
 * 判定のため、本Service内で手動チェックする（CODING_STANDARDS 3章の方針、ability.factory.tsのコメント参照）。
 */
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /** イベント一覧を取得する（GET /events）。論理削除済みは除外する。 */
  async findAll(user: AuthUser, query: EventListQuery) {
    const tagNames = this.parseTagFilter(query.tags);

    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      ...(query.category ? { categoryId: query.category } : {}),
      ...(query.keyword
        ? {
            OR: [
              { title: { contains: query.keyword, mode: "insensitive" } },
              { description: { contains: query.keyword, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(tagNames.length > 0 ? { eventTags: { some: { tag: { name: { in: tagNames } } } } } : {}),
    };

    const events = await this.prisma.event.findMany({
      where,
      include: { category: true },
      orderBy: { startAt: query.sort === "startAtDesc" ? "desc" : "asc" },
    });
    const eventIds = events.map((event) => event.id);

    // WHY: 一覧画面が必要とするのは「確定人数」と「自分の登録有無」のみ。全イベントの
    // 参加登録行を丸ごとincludeしてJS側でfilter/findすると、イベント数×参加者数でレスポンスが
    // 肥大化するため、confirmedCountは`groupBy`で、myRegistrationは自分の分のみに絞って取得する
    // （`MyPageService.getOrganizingEvents`と同じ集計パターン）。
    const [confirmedCounts, myRegistrations] = await Promise.all([
      this.prisma.registration.groupBy({
        by: ["eventId"],
        where: { eventId: { in: eventIds }, status: "CONFIRMED" },
        _count: { _all: true },
      }),
      this.prisma.registration.findMany({
        where: { eventId: { in: eventIds }, userId: user.id },
        select: { eventId: true, status: true },
      }),
    ]);
    const confirmedCountByEventId = new Map(confirmedCounts.map((row) => [row.eventId, row._count._all]));
    const myRegistrationByEventId = new Map(myRegistrations.map((registration) => [registration.eventId, registration]));

    return events.map((event) => {
      const confirmedCount = confirmedCountByEventId.get(event.id) ?? 0;
      const myRegistration = myRegistrationByEventId.get(event.id) ?? null;

      return {
        id: event.id,
        title: event.title,
        category: { id: event.category.id, name: event.category.name },
        startAt: event.startAt,
        capacity: event.capacity,
        confirmedCount,
        registrationState: this.computeRegistrationState(event, user.id, myRegistration),
      };
    });
  }

  /** イベントを新規作成する（POST /events）。作成者が自動的に主催者になる。 */
  async create(input: CreateEventInput, organizerId: string): Promise<ReturnType<EventsService["formatBasicEvent"]>> {
    const startAt = new Date(input.startAt);
    this.assertFutureStartAt(startAt);

    const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new NotFoundException("指定したカテゴリが見つかりません");
    }

    const tagNames = this.normalizeTagNames(input.tags ?? []);

    const created = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title: input.title,
          categoryId: input.categoryId,
          organizerId,
          startAt,
          capacity: input.capacity,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.endAt !== undefined ? { endAt: new Date(input.endAt) } : {}),
          ...(input.registrationDeadline !== undefined
            ? { registrationDeadline: new Date(input.registrationDeadline) }
            : {}),
          ...(input.cancellationDeadline !== undefined
            ? { cancellationDeadline: new Date(input.cancellationDeadline) }
            : {}),
        },
      });

      await this.linkTags(tx, event.id, tagNames);

      return event;
    });

    return this.formatBasicEvent(created.id);
  }

  /** イベント詳細を取得する（GET /events/:id）。存在しない、または論理削除済みの場合は404。 */
  async findOne(id: string, user: AuthUser) {
    const event = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        organizer: true,
        eventTags: { include: { tag: true } },
        registrations: true,
      },
    });
    if (!event) {
      throw new NotFoundException("指定したイベントが見つかりません");
    }

    const confirmedCount = event.registrations.filter((r) => r.status === "CONFIRMED").length;
    const waitlistedCount = event.registrations.filter((r) => r.status === "WAITLISTED").length;
    const myRegistration = event.registrations.find((r) => r.userId === user.id) ?? null;

    const feedbackAggregate = await this.prisma.feedback.aggregate({
      where: { eventId: id, isHidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const feedbackCount = feedbackAggregate._count._all;
    // WHY: フィードバックが1件も無い場合、平均評価は「0件で平均0点」ではなく「未評価」を表すため
    // nullを返す（フロント側で「まだレビューがありません」等の表示分岐に使う想定）。
    const averageRating =
      feedbackCount > 0 && feedbackAggregate._avg.rating !== null
        ? Math.round(feedbackAggregate._avg.rating * 10) / 10
        : null;

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      category: { id: event.category.id, name: event.category.name },
      tags: event.eventTags.map((eventTag) => eventTag.tag.name),
      organizer: { id: event.organizer.id, name: event.organizer.name },
      startAt: event.startAt,
      endAt: event.endAt,
      capacity: event.capacity,
      confirmedCount,
      waitlistedCount,
      registrationDeadline: event.registrationDeadline,
      cancellationDeadline: event.cancellationDeadline,
      registrationState: this.computeRegistrationState(event, user.id, myRegistration),
      averageRating,
      feedbackCount,
    };
  }

  /** イベントを編集する（PUT /events/:id）。主催者本人 or adminのみ。 */
  async update(id: string, input: UpdateEventInput, user: AuthUser) {
    const existing = await this.prisma.event.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException("指定したイベントが見つかりません");
    }
    this.assertOrganizerOrAdmin(existing, user);

    if (input.categoryId !== undefined) {
      const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
      if (!category) {
        throw new NotFoundException("指定したカテゴリが見つかりません");
      }
    }

    let newStartAt: Date | undefined;
    if (input.startAt !== undefined) {
      newStartAt = new Date(input.startAt);
      this.assertFutureStartAt(newStartAt);
    }
    const startAtChanged = newStartAt !== undefined && newStartAt.getTime() !== existing.startAt.getTime();

    const tagNames = input.tags !== undefined ? this.normalizeTagNames(input.tags) : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(newStartAt !== undefined ? { startAt: newStartAt } : {}),
          ...(input.endAt !== undefined ? { endAt: new Date(input.endAt) } : {}),
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.registrationDeadline !== undefined
            ? { registrationDeadline: new Date(input.registrationDeadline) }
            : {}),
          ...(input.cancellationDeadline !== undefined
            ? { cancellationDeadline: new Date(input.cancellationDeadline) }
            : {}),
        },
      });

      if (tagNames !== undefined) {
        await tx.eventTag.deleteMany({ where: { eventId: id } });
        await this.linkTags(tx, id, tagNames);
      }

      return event;
    });

    let hasRegisteredParticipants = false;
    if (startAtChanged) {
      const confirmedCount = await this.prisma.registration.count({ where: { eventId: id, status: "CONFIRMED" } });
      hasRegisteredParticipants = confirmedCount > 0;
    }

    const response = await this.formatBasicEvent(updated.id);
    return { ...response, hasRegisteredParticipants };
  }

  /** イベントを削除する（DELETE /events/:id）。論理削除、主催者本人 or adminのみ。 */
  async remove(id: string, user: AuthUser): Promise<void> {
    const existing = await this.prisma.event.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new NotFoundException("指定したイベントが見つかりません");
    }
    this.assertOrganizerOrAdmin(existing, user);

    await this.prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * ログインユーザー視点の参加登録状態を計算する（MANIFEST.md 6章「設計方針」）。
   * 一覧・詳細のいずれからも同じロジックを使うよう、単一のprivateメソッドに集約する。
   */
  private computeRegistrationState(
    event: EventForStateCheck,
    userId: string,
    registration: RegistrationForStateCheck | null,
  ): RegistrationState {
    if (event.organizerId === userId) {
      return "ORGANIZER";
    }
    if (registration) {
      return registration.status;
    }

    const now = new Date();
    const registrationDeadline = event.registrationDeadline ?? event.startAt;
    if (now > registrationDeadline || now > event.startAt) {
      return "CLOSED";
    }
    return "NOT_REGISTERED";
  }

  /** 主催者本人でもadminでもない場合、403を投げる（MANIFEST.md 6章 #17・#18）。 */
  private assertOrganizerOrAdmin(event: Pick<Event, "organizerId">, user: AuthUser): void {
    if (event.organizerId !== user.id && user.role !== "ADMIN") {
      throw new ForbiddenException("このイベントを編集・削除できるのは主催者本人またはadminのみです");
    }
  }

  /** 作成・編集時、開催日時が過去でないことを検証する（MANIFEST.md 3.2節）。 */
  private assertFutureStartAt(startAt: Date): void {
    if (startAt <= new Date()) {
      throw new BadRequestException("開催日時は現在より未来の日時を指定してください");
    }
  }

  /** `tags`クエリ（カンマ区切り）をタグ名の配列にパースする。 */
  private parseTagFilter(tags: string | undefined): string[] {
    if (!tags) {
      return [];
    }
    return this.normalizeTagNames(tags.split(","));
  }

  /** タグ名をtrim+小文字化し、重複を除去する（MANIFEST.md 3.4節）。 */
  private normalizeTagNames(tags: string[]): string[] {
    const normalized = tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);
    return Array.from(new Set(normalized));
  }

  /**
   * タグ名ごとに`Tag`をupsertし、`EventTag`で紐付ける（MANIFEST.md 6章 #15）。
   * 呼び出し元のトランザクション内で実行する前提のため、`Prisma.TransactionClient`を受け取る。
   */
  private async linkTags(tx: Prisma.TransactionClient, eventId: string, tagNames: string[]): Promise<void> {
    for (const name of tagNames) {
      const tag = await tx.tag.upsert({ where: { name }, create: { name }, update: {} });
      await tx.eventTag.create({ data: { eventId, tagId: tag.id } });
    }
  }

  /**
   * 作成・編集レスポンス用に、イベントの基本項目のみをフラットな形へ整形する
   * （タスク仕様: title/description/category/tags/startAt/endAt/capacity/registrationDeadline/cancellationDeadline）。
   */
  private async formatBasicEvent(eventId: string) {
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { category: true, eventTags: { include: { tag: true } } },
    });

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      category: { id: event.category.id, name: event.category.name },
      tags: event.eventTags.map((eventTag) => eventTag.tag.name),
      startAt: event.startAt,
      endAt: event.endAt,
      capacity: event.capacity,
      registrationDeadline: event.registrationDeadline,
      cancellationDeadline: event.cancellationDeadline,
    };
  }
}
