import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../../common/auth/auth-user.type";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { CheckPolicies } from "../../common/casl/check-policies.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PoliciesGuard } from "../../common/guards/policies.guard";

import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UsersService } from "./users.service";

/**
 * ユーザー管理API（/users/*）。MANIFEST.md 2章「権限マトリクス」#7〜10の通り、全エンドポイントAdmin限定。
 * WHY: `ability.factory.ts`ではUserサブジェクトへの`manage`権限がAdminにのみ付与されており、
 * Member/Owner側には何も付与されていないため、クラスレベルに`@CheckPolicies`を1つ置くだけで
 * 403判定が完結する（エンドポイントごとの実データの所有条件は不要）。
 * ControllerはDTO検証・Guard適用・Service呼び出しのみを担い、ビジネスロジックは持たない
 * （CODING_STANDARDS 3章「レイヤードアーキテクチャ」）。
 */
@Controller("users")
@UseGuards(JwtAuthGuard, PoliciesGuard)
@CheckPolicies((ability) => ability.can("manage", "User"))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** 全ユーザーの一覧を取得する（MANIFEST.md 6章 GET /users） */
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  /** 指定した単一ユーザーの詳細情報を取得する（MANIFEST.md 6章 GET /users/:id） */
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  /** 指定したユーザーのシステムロールを変更する（MANIFEST.md 6章 PUT /users/:id/role） */
  @Put(":id/role")
  updateRole(@Param("id") id: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(id, dto);
  }

  /** 指定したユーザーを無効化する（MANIFEST.md 6章 POST /users/:id/deactivate） */
  @Post(":id/deactivate")
  deactivate(@Param("id") id: string, @CurrentUser() currentUser: AuthUser) {
    return this.usersService.deactivate(id, currentUser.id);
  }
}
