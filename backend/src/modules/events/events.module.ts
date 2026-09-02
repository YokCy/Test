import { Module } from "@nestjs/common";

import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

/**
 * イベント管理API（`/events/*`）モジュール。
 * `PrismaService`（PrismaModule）・`JwtAuthGuard`/`PoliciesGuard`（GuardsModule）はいずれも
 * `@Global`なモジュールから提供されるため、本モジュールでのimport登録は不要。
 */
@Module({
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
