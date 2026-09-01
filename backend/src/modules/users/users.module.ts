import { Module } from "@nestjs/common";

import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

/**
 * ユーザー管理API（/users/*）モジュール。
 * `PrismaService`（PrismaModule）・`JwtAuthGuard`/`PoliciesGuard`（GuardsModule）はいずれも
 * `@Global`なモジュールから提供されるため、本モジュールでのimport登録は不要。
 * `AppModule`への本モジュール自体の登録は、他リソースモジュールとの並列実装衝突を避けるため
 * Phase 12.6でまとめて行う（backend-tasks.md「共通ファイルへの登録競合」参照）。
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
