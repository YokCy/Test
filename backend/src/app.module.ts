import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthInfraModule } from "./common/auth/auth-infra.module";
import { validateEnv } from "./common/config/env.schema";
import { GuardsModule } from "./common/guards/guards.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

/**
 * アプリケーションのルートモジュール。
 * 認証・認可基盤（AuthInfraModule/GuardsModule）は今後追加する全リソースモジュールが
 * 前提とする共通基盤のため先行登録している。
 * イベント・カテゴリ・参加登録・出席・フィードバック等のリソースモジュールは、
 * ドメイン設計確定後にここへ追加していく。
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
  ],
})
export class AppModule {}
