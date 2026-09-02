import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../../common/auth/auth-user.type";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { CheckPolicies } from "../../common/casl/check-policies.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PoliciesGuard } from "../../common/guards/policies.guard";

import { UpdateFeedbackDto } from "./dto/update-feedback.dto";
import { FeedbacksService } from "./feedbacks.service";

/**
 * フィードバック単体を操作するフラットAPI（`/feedbacks/:id`）。
 * 編集は投稿者本人のみ（データ依存の判定のためService層で行い、PoliciesGuardは使わない）。
 * 非公開化はadmin専用の静的なロールチェックのため、categoriesモジュールと同じくPoliciesGuardで判定する。
 */
@Controller("feedbacks")
@UseGuards(JwtAuthGuard)
export class FeedbacksController {
  constructor(private readonly feedbacksService: FeedbacksService) {}

  /** 自身が投稿したフィードバックを編集する（MANIFEST.md 6章 PUT /feedbacks/:id） */
  @Put(":id")
  update(@Param("id") id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateFeedbackDto) {
    return this.feedbacksService.update(id, user.id, dto);
  }

  /** 不適切なフィードバックを非公開化する（MANIFEST.md 6章 POST /feedbacks/:id/hide、admin専用） */
  @Post(":id/hide")
  @UseGuards(PoliciesGuard)
  @HttpCode(HttpStatus.OK)
  @CheckPolicies((ability) => ability.can("manage", "Feedback"))
  hide(@Param("id") id: string) {
    return this.feedbacksService.hide(id);
  }
}
