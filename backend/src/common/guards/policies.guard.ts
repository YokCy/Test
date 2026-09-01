import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import type { AuthUser } from "../auth/auth-user.type";
import { CaslAbilityFactory } from "../casl/ability.factory";
import { CHECK_POLICIES_KEY } from "../casl/check-policies.decorator";
import type { PolicyHandler } from "../casl/check-policies.decorator";

/**
 * `@CheckPolicies(...)`で宣言された認可条件を、リクエストユーザーのCASL Abilityで検証するGuard。
 * `JwtAuthGuard`の後段に必ず適用し、`request.user`（JwtStrategy.validate()の結果）を前提とする
 * （CODING_STANDARDS 9章「認可」：全ての保護対象エンドポイントでJwtAuthGuard + PoliciesGuardを通す）。
 * `@CheckPolicies`が付与されていないハンドラは、認可判定なし（認証済みであれば通過）とする。
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.getAllAndOverride<PolicyHandler[]>(CHECK_POLICIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (policyHandlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const ability = await this.abilityFactory.createForUser(request.user);

    const allowed = policyHandlers.every((handler) => handler(ability));
    if (!allowed) {
      throw new ForbiddenException("この操作を実行する権限がありません");
    }

    return true;
  }
}
