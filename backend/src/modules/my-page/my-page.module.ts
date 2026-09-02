import { Module } from "@nestjs/common";

import { MyPageController } from "./my-page.controller";
import { MyPageService } from "./my-page.service";

/**
 * マイページAPI（`/users/me/*`）モジュール。
 * `PrismaService`（PrismaModule）・`JwtAuthGuard`（GuardsModule）はいずれも`@Global`なモジュールから
 * 提供されるため、本モジュールでのimport登録は不要。
 *
 * ルーティング安全性について:
 * `UsersController`（`modules/users`）は`@Controller("users")`で`GET /users/:id`等を公開しているが、
 * 本モジュールは`@Controller("users/me")`という別のコントローラーパスを使うため、
 * Nestのルーティングテーブル上`users/me/events`・`users/me/stats`は`users/:id`という
 * 単一セグメントのパターンとは経路（controller path）自体が異なり、登録順序に関わらず衝突しない
 * （そもそも`:id`パラメータの候補にすらならない）。
 * 参考: 仮に`@Controller("users")`配下に`@Get("me/events")`として実装した場合でも、
 * `users/me/events`はセグメント数が2つ（`me`, `events`）であるのに対し`users/:id`はプレフィックス
 * `users/`の直後1セグメントにしかマッチしないため、その場合も衝突しない
 * （Express/NestJSのルーティングはパスセグメント数で区別するため、`:id`が`me`という値を取ってから
 * さらに`/events`を続けて処理する経路は存在しない）。念のためより明確な専用パスとして
 * `@Controller("users/me")`を採用した。
 */
@Module({
  controllers: [MyPageController],
  providers: [MyPageService],
})
export class MyPageModule {}
