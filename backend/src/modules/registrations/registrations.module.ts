import { Module } from "@nestjs/common";

import { RegistrationsController } from "./registrations.controller";
import { RegistrationsService } from "./registrations.service";

/**
 * 参加登録・キャンセル・出席管理API（`/events/:id/register` 等）モジュール。
 * `PrismaService`（PrismaModule）・`JwtAuthGuard`（GuardsModule）はいずれも`@Global`な
 * モジュールから提供されるため、本モジュールでのimport登録は不要。
 */
@Module({
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
})
export class RegistrationsModule {}
