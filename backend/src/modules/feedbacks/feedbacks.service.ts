import type { CreateFeedbackInput, UpdateFeedbackInput } from "@eventboard/shared";
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthUser } from "../../common/auth/auth-user.type";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * フィードバック（星評価＋コメント）API（`/events/:id/feedbacks`, `/feedbacks/:id`）のビジネスロジック。
 * MANIFEST.md 6章 #23-#26、3.7節「フィードバック（星評価＋コメント）」の業務ルールを実装する。
 * CASLでは判定しきれないデータ依存の認可（投稿者本人か・主催者本人か等）はここで直接判定する
 * （common/casl/ability.factoryのコメント、CODING_STANDARDS 3章の方針に従う）。
 */
@Injectable()
export class FeedbacksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * イベントのフィードバック一覧・平均評価を取得する（GET /events/:id/feedbacks）。
   * 非公開（isHidden）のレビューは一般ユーザーには一切見せず、平均評価の算出からも除外する。
   * adminには非公開分も含め、常に実際の投稿者情報を返す。
   */
  async findAllForEvent(eventId: string, currentUser: AuthUser) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.deletedAt) {
      throw new NotFoundException("指定したイベントが見つかりません");
    }

    const isAdmin = currentUser.role === "ADMIN";

    const feedbacks = await this.prisma.feedback.findMany({
      where: isAdmin ? { eventId } : { eventId, isHidden: false },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    // WHY: 平均評価は非公開分を除外して算出する（3.7節）。admin向け一覧には非公開分も含めて
    // 返すため、非公開分を除いた集合から改めて平均を計算する。
    const visibleForAverage = feedbacks.filter((feedback) => !feedback.isHidden);
    const averageRating =
      visibleForAverage.length === 0
        ? null
        : Math.round((visibleForAverage.reduce((sum, feedback) => sum + feedback.rating, 0) / visibleForAverage.length) * 10) / 10;

    return {
      averageRating,
      feedbacks: feedbacks.map((feedback) => {
        const base = {
          id: feedback.id,
          rating: feedback.rating,
          comment: feedback.comment,
          isAnonymous: feedback.isAnonymous,
        };

        if (isAdmin) {
          return {
            ...base,
            author: { id: feedback.user.id, name: feedback.user.name },
            isHidden: feedback.isHidden,
          };
        }

        return {
          ...base,
          author: feedback.isAnonymous ? null : { id: feedback.user.id, name: feedback.user.name },
        };
      }),
    };
  }

  /**
   * フィードバックを投稿する（POST /events/:id/feedbacks）。
   * 投稿条件（3.7節）: イベントが終了済み（endAtがあればendAt、なければstartAtが過去）かつ、
   * 投稿者が当該イベントで`attendanceStatus=ATTENDED`としてマークされていること。
   * 主催者本人は自身のイベントにフィードバックを投稿できない（権限マトリクス#24）。
   */
  async create(eventId: string, userId: string, input: CreateFeedbackInput) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.deletedAt) {
      throw new NotFoundException("指定したイベントが見つかりません");
    }

    if (event.organizerId === userId) {
      throw new ForbiddenException("主催者は自身のイベントにフィードバックを投稿できません");
    }

    const endOfEvent = event.endAt ?? event.startAt;
    const registration = await this.prisma.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    const isEligible = endOfEvent.getTime() < Date.now() && registration?.attendanceStatus === "ATTENDED";
    if (!isEligible) {
      throw new ForbiddenException("開催終了かつ出席済みのイベントのみフィードバックを投稿できます");
    }

    try {
      return await this.prisma.feedback.create({
        data: {
          eventId,
          userId,
          rating: input.rating,
          comment: input.comment,
          isAnonymous: input.isAnonymous,
        },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /**
   * 自身が投稿したフィードバックを編集する（PUT /feedbacks/:id）。
   * 投稿者本人のみ可能。adminであっても他者の投稿は編集できない（非公開化は26番で対応、MANIFEST.md #25）。
   */
  async update(feedbackId: string, userId: string, input: UpdateFeedbackInput) {
    const feedback = await this.prisma.feedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) {
      throw new NotFoundException("指定したフィードバックが見つかりません");
    }

    if (feedback.userId !== userId) {
      throw new ForbiddenException("自身が投稿したフィードバックのみ編集できます");
    }

    return this.prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        rating: input.rating,
        comment: input.comment,
        isAnonymous: input.isAnonymous,
      },
    });
  }

  /**
   * 不適切なフィードバックを非公開化する（POST /feedbacks/:id/hide）。
   * admin専用（ControllerのPoliciesGuardで判定済みだが、念のためここでも再確認はしない
   * ―― データ依存の条件ではなく静的なロールチェックのため、Guard側の責務とする）。
   * `isHidden=true`への一方向の更新のみで、再表示用のtoggleは提供しない（MANIFEST.md #26）。
   */
  async hide(feedbackId: string) {
    try {
      return await this.prisma.feedback.update({
        where: { id: feedbackId },
        data: { isHidden: true },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /** Prismaの既知エラーを、意味の通るHTTP例外に変換する共通処理。 */
  private toHttpException(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return new ConflictException("既にこのイベントにフィードバックを投稿済みです");
      }
      if (error.code === "P2025") {
        return new NotFoundException("指定したフィードバックが見つかりません");
      }
    }
    return error instanceof Error ? error : new Error("フィードバックの処理に失敗しました");
  }
}
