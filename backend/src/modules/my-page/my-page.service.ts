import { Injectable } from "@nestjs/common";
import type { AttendanceStatus, RegistrationStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

/** マイページ「主催イベント」タブ1件分の形（画面設計仕様.md 3.1.5節）。 */
export interface OrganizingEventItem {
  id: string;
  title: string;
  startAt: Date;
  category: { id: string; name: string };
  confirmedCount: number;
  waitlistedCount: number;
}

/** マイページ「参加予定」タブ1件分の形。 */
export interface UpcomingEventItem {
  id: string;
  title: string;
  startAt: Date;
  category: { id: string; name: string };
  status: RegistrationStatus;
  position: number | null;
}

/** マイページ「参加履歴」タブ1件分の形。 */
export interface HistoryEventItem {
  id: string;
  title: string;
  startAt: Date;
  category: { id: string; name: string };
  attendanceStatus: AttendanceStatus | null;
}

/**
 * マイページ（`GET /users/me/events`, `GET /users/me/stats`）のビジネスロジックを担うService。
 * MANIFEST.md 6章 #27/#28、3.5節「出席管理」の集計要件に基づく。
 * 認可判定（本人分のみ）はController側で`@CurrentUser()`のuserIdのみを本Serviceへ渡すことで担保する
 * （リクエストから他人のuserIdを受け取れる経路を作らない）。
 */
@Injectable()
export class MyPageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 主催イベント・参加予定イベント・参加履歴を取得する（GET /users/me/events）。
   * MANIFEST.md 3.2/3.3節「主催者は暗黙的に参加確定」の通り、主催者は自身のイベントに
   * `Registration`行を持たないため、`organizing`と`upcoming`/`history`はRegistrationテーブル上
   * 自然に排反であり、突合・重複除去のロジックは不要。
   */
  async getEvents(userId: string): Promise<{
    organizing: OrganizingEventItem[];
    upcoming: UpcomingEventItem[];
    history: HistoryEventItem[];
  }> {
    const now = new Date();

    const [organizing, upcomingRegistrations, historyRegistrations] = await Promise.all([
      this.getOrganizingEvents(userId),
      this.prisma.registration.findMany({
        where: {
          userId,
          status: { in: ["CONFIRMED", "WAITLISTED"] },
          event: { startAt: { gt: now }, deletedAt: null },
        },
        include: { event: { include: { category: { select: { id: true, name: true } } } } },
        orderBy: { event: { startAt: "asc" } },
      }),
      this.prisma.registration.findMany({
        where: {
          userId,
          event: { startAt: { lte: now }, deletedAt: null },
        },
        include: { event: { include: { category: { select: { id: true, name: true } } } } },
        orderBy: { event: { startAt: "desc" } },
      }),
    ]);

    const upcoming: UpcomingEventItem[] = upcomingRegistrations.map((registration) => ({
      id: registration.event.id,
      title: registration.event.title,
      startAt: registration.event.startAt,
      category: registration.event.category,
      status: registration.status,
      position: registration.position ?? null,
    }));

    const history: HistoryEventItem[] = historyRegistrations.map((registration) => ({
      id: registration.event.id,
      title: registration.event.title,
      startAt: registration.event.startAt,
      category: registration.event.category,
      attendanceStatus: registration.attendanceStatus,
    }));

    return { organizing, upcoming, history };
  }

  /**
   * 自身が主催するイベント一覧を、各イベントの確定参加者数・キャンセル待ち数付きで取得する。
   * `Registration`は`status`別の件数集計が必要なため、イベント本体とは別クエリの`groupBy`で取得し、
   * アプリケーション層でマージする（Prismaの`_count`はrelationに対するstatusフィルタを直接表現できないため）。
   */
  private async getOrganizingEvents(userId: string): Promise<OrganizingEventItem[]> {
    const events = await this.prisma.event.findMany({
      where: { organizerId: userId, deletedAt: null },
      orderBy: { startAt: "asc" },
      include: { category: { select: { id: true, name: true } } },
    });

    if (events.length === 0) {
      return [];
    }

    const counts = await this.prisma.registration.groupBy({
      by: ["eventId", "status"],
      where: { eventId: { in: events.map((event) => event.id) } },
      _count: true,
    });

    const countMap = new Map<string, { confirmed: number; waitlisted: number }>();
    for (const row of counts) {
      const current = countMap.get(row.eventId) ?? { confirmed: 0, waitlisted: 0 };
      if (row.status === "CONFIRMED") {
        current.confirmed = row._count;
      } else if (row.status === "WAITLISTED") {
        current.waitlisted = row._count;
      }
      countMap.set(row.eventId, current);
    }

    return events.map((event) => {
      const count = countMap.get(event.id) ?? { confirmed: 0, waitlisted: 0 };
      return {
        id: event.id,
        title: event.title,
        startAt: event.startAt,
        category: event.category,
        confirmedCount: count.confirmed,
        waitlistedCount: count.waitlisted,
      };
    });
  }

  /**
   * 累計参加数・出席率・カテゴリ別参加傾向を取得する（GET /users/me/stats）。
   * MANIFEST.md 3.5節「出席率 = 出席回数 ÷ (出席回数 + 欠席回数)（未マークは分母から除外）」に基づく。
   * `totalParticipations`と`byCategory`は、開催前の確定参加を「参加実績」に含めないよう
   * `event.startAt <= now`で揃える（MANIFESTの文言はやや緩いが、本Serviceでは一貫してこの解釈を採る）。
   * 論理削除済みイベントは`getEvents`の参加履歴と同じ扱いで集計対象から除外する
   * （履歴一覧には出ないイベントが集計数だけ残ると利用者が不整合に感じるため）。
   */
  async getStats(userId: string): Promise<{
    totalParticipations: number;
    attendanceRate: number | null;
    byCategory: { category: string; count: number }[];
  }> {
    const now = new Date();

    const confirmedPastRegistrations = await this.prisma.registration.findMany({
      where: {
        userId,
        status: "CONFIRMED",
        event: { startAt: { lte: now }, deletedAt: null },
      },
      include: { event: { include: { category: { select: { name: true } } } } },
    });

    const totalParticipations = confirmedPastRegistrations.length;

    const attendedCount = confirmedPastRegistrations.filter(
      (registration) => registration.attendanceStatus === "ATTENDED",
    ).length;
    const absentCount = confirmedPastRegistrations.filter(
      (registration) => registration.attendanceStatus === "ABSENT",
    ).length;
    const markedCount = attendedCount + absentCount;
    // 分母（出席+欠席）が0件（未マークのみ）の場合は0除算を避け、集計不能を表すnullを返す。
    const attendanceRate = markedCount === 0 ? null : attendedCount / markedCount;

    const categoryCounts = new Map<string, number>();
    for (const registration of confirmedPastRegistrations) {
      const categoryName = registration.event.category.name;
      categoryCounts.set(categoryName, (categoryCounts.get(categoryName) ?? 0) + 1);
    }
    const byCategory = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .filter((entry) => entry.count > 0);

    return { totalParticipations, attendanceRate, byCategory };
  }
}
