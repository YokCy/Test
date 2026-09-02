import type { CancelRegistrationInput, MarkAttendanceInput } from "@eventboard/shared";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Event } from "@prisma/client";
import { Prisma } from "@prisma/client";

import type { AuthUser } from "../../common/auth/auth-user.type";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * 参加登録・キャンセル・出席マークAPI（`/events/:id/register` 等）のビジネスロジックを担うService。
 * MANIFEST.md 3.3節「参加登録・キャンセル」、3.5節「出席管理」、3.6節「キャンセル待ち＋自動繰り上げ」を実装する。
 *
 * この機能の認可は「イベントの主催者本人か」「本人の登録か」というデータ依存の条件のため、
 * CASL（`ability.factory.ts`）では表現せず、本Service内で直接判定する
 * （CODING_STANDARDS 3章の方針、および本タスクの指示に従う）。
 */
@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 参加登録する（POST /events/:id/register）。
   * 定員に達している場合は自動的にキャンセル待ち（WAITLISTED）として登録する。
   */
  async register(eventId: string, user: AuthUser): Promise<{ status: "CONFIRMED" | "WAITLISTED"; position: number | null }> {
    const event = await this.findActiveEventOrThrow(eventId);
    const now = new Date();

    if (event.startAt <= now) {
      throw new BadRequestException("終了したイベント、または開催日時を過ぎたイベントには参加登録できません");
    }
    const registrationDeadline = event.registrationDeadline ?? event.startAt;
    if (now > registrationDeadline) {
      throw new BadRequestException("参加登録の受付期限を過ぎています");
    }
    if (event.organizerId === user.id) {
      throw new ConflictException("主催者は自身のイベントに参加登録できません");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // WHY: 同一イベントへの同時登録による定員判定の競合を避けるため、
        // 登録数のカウント・作成の前にイベント行をロックする（CODING_STANDARDS 4章）。
        await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;

        const existing = await tx.registration.findUnique({
          where: { eventId_userId: { eventId, userId: user.id } },
        });
        if (existing) {
          throw new ConflictException("既に参加登録済み、またはキャンセル待ち登録済みです");
        }

        const confirmedCount = await tx.registration.count({
          where: { eventId, status: "CONFIRMED" },
        });

        if (confirmedCount < event.capacity) {
          await tx.registration.create({
            data: { eventId, userId: user.id, status: "CONFIRMED", position: null },
          });
          return { status: "CONFIRMED" as const, position: null };
        }

        const lastWaitlisted = await tx.registration.findFirst({
          where: { eventId, status: "WAITLISTED" },
          orderBy: { position: "desc" },
        });
        const nextPosition = (lastWaitlisted?.position ?? 0) + 1;

        await tx.registration.create({
          data: { eventId, userId: user.id, status: "WAITLISTED", position: nextPosition },
        });
        return { status: "WAITLISTED" as const, position: nextPosition };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("既に参加登録済み、またはキャンセル待ち登録済みです");
      }
      throw error;
    }
  }

  /**
   * 参加登録／キャンセル待ちを取り消す（POST /events/:id/cancel）。
   * `CONFIRMED`の取り消し時は、待機列の先頭を繰り上げる（MANIFEST.md 3.6節）。
   *
   * `dto.userId`が指定されている場合、それはadminによる他ユーザーの強制キャンセル
   * （キャンセル可能期限を無視する）であり、事前にController側でADMIN権限を確認済みである前提とする。
   */
  async cancel(eventId: string, actingUser: AuthUser, dto: CancelRegistrationInput): Promise<Record<string, never>> {
    const isForcedByAdmin = dto.userId !== undefined;
    if (isForcedByAdmin && actingUser.role !== "ADMIN") {
      throw new ForbiddenException("他のユーザーの参加登録をキャンセルする権限がありません");
    }
    const targetUserId = dto.userId ?? actingUser.id;

    const event = await this.findActiveEventOrThrow(eventId);

    if (!isForcedByAdmin) {
      const cancellationDeadline = event.cancellationDeadline ?? event.startAt;
      if (new Date() > cancellationDeadline) {
        throw new ForbiddenException("キャンセル可能期限を過ぎているため、通常のキャンセルはできません");
      }
    }

    const target = await this.prisma.registration.findUnique({
      where: { eventId_userId: { eventId, userId: targetUserId } },
    });
    if (!target) {
      throw new NotFoundException("参加登録が見つかりません");
    }

    await this.prisma.$transaction(async (tx) => {
      // WHY: 同一イベントへの同時キャンセル・登録による繰り上げ判定の競合を避けるため、
      // イベント行をロックしてから削除・繰り上げを行う（CODING_STANDARDS 4章のトランザクション例に準拠）。
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;

      const deleted = await tx.registration.delete({
        where: { eventId_userId: { eventId, userId: targetUserId } },
      });

      if (deleted.status === "CONFIRMED") {
        const nextInLine = await tx.registration.findFirst({
          where: { eventId, status: "WAITLISTED" },
          orderBy: { position: "asc" },
        });
        if (nextInLine) {
          await tx.registration.update({
            where: { id: nextInLine.id },
            data: { status: "CONFIRMED", position: null },
          });
          await tx.promotionHistory.create({
            data: { eventId, promotedUserId: nextInLine.userId, vacatedByUserId: targetUserId },
          });
        }
      }
    });

    return {};
  }

  /** 参加者一覧を取得する（GET /events/:id/registrations）。主催者本人・adminのみ。 */
  async findRegistrations(eventId: string, actingUser: AuthUser) {
    const event = await this.findActiveEventOrThrow(eventId);
    this.assertOrganizerOrAdmin(event, actingUser);

    const registrations = await this.prisma.registration.findMany({
      where: { eventId, status: "CONFIRMED" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return registrations.map((registration) => ({
      userId: registration.user.id,
      name: registration.user.name,
      status: registration.status,
      attendanceStatus: registration.attendanceStatus,
    }));
  }

  /** 出席／欠席をマークする（PUT /events/:id/registrations/:userId/attendance）。主催者本人・adminのみ。 */
  async markAttendance(eventId: string, targetUserId: string, actingUser: AuthUser, dto: MarkAttendanceInput) {
    const event = await this.findActiveEventOrThrow(eventId);
    this.assertOrganizerOrAdmin(event, actingUser);

    if (new Date() < event.startAt) {
      throw new BadRequestException("開催日時に達する前は出席マークできません");
    }

    const registration = await this.prisma.registration.findUnique({
      where: { eventId_userId: { eventId, userId: targetUserId } },
    });
    if (!registration || registration.status !== "CONFIRMED") {
      throw new NotFoundException("参加確定済みの登録が見つかりません");
    }

    return this.prisma.registration.update({
      where: { eventId_userId: { eventId, userId: targetUserId } },
      data: { attendanceStatus: dto.attendanceStatus },
    });
  }

  /** 論理削除されていないイベントを取得する。存在しない場合は404。 */
  private async findActiveEventOrThrow(eventId: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.deletedAt) {
      throw new NotFoundException("指定したイベントが見つかりません");
    }
    return event;
  }

  /** 主催者本人またはadminであることを確認する。それ以外は403。 */
  private assertOrganizerOrAdmin(event: Event, user: AuthUser): void {
    if (event.organizerId !== user.id && user.role !== "ADMIN") {
      throw new ForbiddenException("この操作を行う権限がありません");
    }
  }
}
