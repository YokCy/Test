import { Module } from "@nestjs/common";

import { EventFeedbacksController } from "./event-feedbacks.controller";
import { FeedbacksController } from "./feedbacks.controller";
import { FeedbacksService } from "./feedbacks.service";

/**
 * フィードバック（星評価＋コメント）API（`/events/:id/feedbacks`, `/feedbacks/:id`）モジュール。
 * ネストされた一覧・投稿用の`EventFeedbacksController`と、フラットな編集・非公開化用の
 * `FeedbacksController`の2つを1モジュールにまとめる（CODING_STANDARDS 3章「ルーティング」参照）。
 * `PrismaService`（PrismaModule）・`JwtAuthGuard`/`PoliciesGuard`（GuardsModule）はいずれも
 * `@Global`なモジュールから提供されるため、本モジュールでのimport登録は不要。
 */
@Module({
  controllers: [EventFeedbacksController, FeedbacksController],
  providers: [FeedbacksService],
})
export class FeedbacksModule {}
