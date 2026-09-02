import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthInfraModule } from "./common/auth/auth-infra.module";
import { validateEnv } from "./common/config/env.schema";
import { GuardsModule } from "./common/guards/guards.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { EventsModule } from "./modules/events/events.module";
import { FeedbacksModule } from "./modules/feedbacks/feedbacks.module";
import { MyPageModule } from "./modules/my-page/my-page.module";
import { RegistrationsModule } from "./modules/registrations/registrations.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";

/**
 * アプリケーションのルートモジュール。
 * backend-tasks.md Phase 6〜10（カテゴリ・イベント・参加登録/出席・フィードバック・マイページ）の
 * 実装が完了したため、ここに一括登録している。
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
    EventsModule,
    RegistrationsModule,
    FeedbacksModule,
    MyPageModule,
  ],
})
export class AppModule {}
