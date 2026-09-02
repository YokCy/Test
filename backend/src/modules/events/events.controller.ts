import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import type { AuthUser } from "../../common/auth/auth-user.type";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { CheckPolicies } from "../../common/casl/check-policies.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PoliciesGuard } from "../../common/guards/policies.guard";

import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { EventsService } from "./events.service";

/**
 * イベント管理API（`/events/*`）。MANIFEST.md 6章 #14〜#18を実装する。
 * 閲覧・作成はロールに関わらず全member可（`ability.factory.ts`で`can(["read","create"],"Event")`）。
 * 編集・削除の「主催者本人 or admin」判定はデータ依存のためCASLでは表現せず、
 * EventsService側で手動の所有関係チェックとして行う（CODING_STANDARDS 3章の方針）。
 */
@Controller("events")
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /** イベント一覧を取得する（MANIFEST.md 6章 GET /events） */
  @Get()
  @CheckPolicies((ability) => ability.can("read", "Event"))
  findAll(
    @CurrentUser() user: AuthUser,
    @Query("category") category?: string,
    @Query("keyword") keyword?: string,
    @Query("tags") tags?: string,
    @Query("sort") sort?: string,
  ) {
    return this.eventsService.findAll(user, { category, keyword, tags, sort });
  }

  /** イベントを新規作成する（MANIFEST.md 6章 POST /events。作成者が自動的に主催者になる） */
  @Post()
  @CheckPolicies((ability) => ability.can("create", "Event"))
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthUser) {
    return this.eventsService.create(dto, user.id);
  }

  /** イベント詳細を取得する（MANIFEST.md 6章 GET /events/:id） */
  @Get(":id")
  @CheckPolicies((ability) => ability.can("read", "Event"))
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.findOne(id, user);
  }

  /**
   * イベントを編集する（MANIFEST.md 6章 PUT /events/:id。主催者本人 or adminのみ）。
   * WHY: 「主催者本人か」はデータ依存の条件でCASLの静的な`can()`では表現できないため、
   * ここでは`@CheckPolicies`を付けず`EventsService.update()`内の手動チェックに委ねる
   * （registrations/feedbacksモジュールと同じ方針。誤って`read`権限をチェックする
   * コピペミスを修正済み）。
   */
  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateEventDto, @CurrentUser() user: AuthUser) {
    return this.eventsService.update(id, dto, user);
  }

  /** イベントを削除する（MANIFEST.md 6章 DELETE /events/:id。論理削除、主催者本人 or adminのみ） */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.remove(id, user);
  }
}
