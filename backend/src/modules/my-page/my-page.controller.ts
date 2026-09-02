import { Controller, Get, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../../common/auth/auth-user.type";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { MyPageService } from "./my-page.service";

/**
 * マイページAPI（`/users/me/*`）。MANIFEST.md 6章 #27/#28の通り、要認証・本人分のみ。
 * 対象データがすべて「ログイン中の本人」に固定され、他人のuserIdを受け取る経路が存在しないため、
 * ロールに関わらず認証済みであれば足りる（CASLの`PoliciesGuard`は不要、`JwtAuthGuard`のみ適用）。
 * `@Controller("users/me")`と、`UsersController`（`@Controller("users")`、`GET /users/:id`等）が
 * 別コントローラーとして共存する（ルーティングの安全性はmy-page.module.tsのコメント参照）。
 */
@Controller("users/me")
@UseGuards(JwtAuthGuard)
export class MyPageController {
  constructor(private readonly myPageService: MyPageService) {}

  /** 主催イベント・参加予定イベント・参加履歴を取得する（MANIFEST.md 6章 GET /users/me/events） */
  @Get("events")
  getEvents(@CurrentUser() user: AuthUser) {
    return this.myPageService.getEvents(user.id);
  }

  /** 累計参加数・出席率・カテゴリ別参加傾向を取得する（MANIFEST.md 6章 GET /users/me/stats） */
  @Get("stats")
  getStats(@CurrentUser() user: AuthUser) {
    return this.myPageService.getStats(user.id);
  }
}
