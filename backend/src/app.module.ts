import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthInfraModule } from "./common/auth/auth-infra.module";
import { validateEnv } from "./common/config/env.schema";
import { GuardsModule } from "./common/guards/guards.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

/**
 * アプリケーションのルートモジュール。
 * 認証・認可基盤（AuthInfraModule/GuardsModule）は今後追加する全リソースモジュールが
 * 前提とする共通基盤のため先行登録している。
 * イベント・参加登録・出席・フィードバック等の残りのリソースモジュールは、
 * backend-tasks.md Phase 7〜10の実装が完了次第ここへ追加していく。
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuthInfraModule,
    GuardsModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
  ],
})
export class AppModule {}
