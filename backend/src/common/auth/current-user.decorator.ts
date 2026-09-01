import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import type { AuthUser } from "./auth-user.type";

/**
 * JwtAuthGuardを通過したリクエストから認証済みユーザー情報を取り出すパラメータデコレータ。
 * `@UseGuards(JwtAuthGuard)` を適用したエンドポイントでのみ意味のある値が入る
 * （CODING_STANDARDS 3章「レイヤードアーキテクチャ」のControllerサンプルで使用する形に合わせる）。
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
  return request.user;
});
