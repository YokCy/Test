import { Module } from "@nestjs/common";

import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

/**
 * カテゴリマスタ管理API（`/categories/*`）モジュール。
 * `PrismaService`（PrismaModule）・`JwtAuthGuard`/`PoliciesGuard`（GuardsModule）はいずれも
 * `@Global`なモジュールから提供されるため、本モジュールでのimport登録は不要。
 */
@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
