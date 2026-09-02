import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../../common/auth/auth-user.type";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { FeedbacksService } from "./feedbacks.service";

/**
 * イベントに紐づくフィードバックのネストAPI（`/events/:id/feedbacks`）。
 * 認可は全て認証済みユーザーであれば実行可能で、投稿条件（3.7節）はデータ依存のため
 * CASLの静的ポリシーではなくService層で判定する（PoliciesGuardは使わない）。
 */
@Controller("events")
@UseGuards(JwtAuthGuard)
export class EventFeedbacksController {
  constructor(private readonly feedbacksService: FeedbacksService) {}

  /** イベントのフィードバック一覧・平均評価を取得する（MANIFEST.md 6章 GET /events/:id/feedbacks） */
  @Get(":id/feedbacks")
  findAll(@Param("id") eventId: string, @CurrentUser() user: AuthUser) {
    return this.feedbacksService.findAllForEvent(eventId, user);
  }

  /** フィードバックを投稿する（MANIFEST.md 6章 POST /events/:id/feedbacks） */
  @Post(":id/feedbacks")
  create(@Param("id") eventId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateFeedbackDto) {
    return this.feedbacksService.create(eventId, user.id, dto);
  }
}
