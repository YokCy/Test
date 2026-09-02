import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../../common/auth/auth-user.type";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CancelRegistrationDto } from "./dto/cancel-registration.dto";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { RegistrationsService } from "./registrations.service";

/**
 * 参加登録・キャンセル・出席管理API（`/events/:id/register` 等、`events`配下のサブリソース）。
 * MANIFEST.md 6章 #19〜#22。
 *
 * 認可は「主催者本人か」「本人の登録か」というデータ依存の条件のため、CASLの`PoliciesGuard`ではなく
 * `RegistrationsService`内で直接判定する（本タスクの指示・`ability.factory.ts`のコメント方針に従う）。
 */
@Controller("events")
@UseGuards(JwtAuthGuard)
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  /** 参加登録する（満席時は自動的にキャンセル待ち登録）（MANIFEST.md 6章 #19） */
  @Post(":id/register")
  register(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.registrationsService.register(id, user);
  }

  /** 参加登録／キャンセル待ちを取り消す（繰り上げ処理を内包）（MANIFEST.md 6章 #20） */
  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthUser, @Body() dto: CancelRegistrationDto) {
    return this.registrationsService.cancel(id, user, dto);
  }

  /** 参加者一覧を取得する（主催者本人・adminのみ）（MANIFEST.md 6章 #21） */
  @Get(":id/registrations")
  findRegistrations(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.registrationsService.findRegistrations(id, user);
  }

  /** 出席／欠席をマークする（主催者本人・adminのみ）（MANIFEST.md 6章 #22） */
  @Put(":id/registrations/:userId/attendance")
  markAttendance(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.registrationsService.markAttendance(id, userId, user, dto);
  }
}
