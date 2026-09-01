import type { AccessTokenPayload } from "@eventboard/shared";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { Strategy } from "passport-jwt";

import { PrismaService } from "../../prisma/prisma.service";

import type { AuthUser } from "./auth-user.type";
import { ACCESS_TOKEN_COOKIE_NAME } from "./token.constants";

/**
 * Access TokenをhttpOnly CookieからJWTとして検証するpassport-jwt戦略。
 * 署名・有効期限の検証はpassport-jwt本体（`secretOrKey`/`ignoreExpiration`）が行い、
 * `validate()`は検証済みペイロードから最新のユーザー状態をDBから取得する後段処理のみを担う。
 * WHY: AccessTokenPayloadに`role`等の権限情報を含めない設計のため、
 * 昇格/降格・無効化(`isActive`)をトークンの残り有効期限に関わらず常に最新の状態で判定できる。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: Request): string | null =>
        (req.cookies as Record<string, string | undefined> | undefined)?.[ACCESS_TOKEN_COOKIE_NAME] ?? null,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    // 退職・無効化済みのユーザーは、Access Tokenの残り有効期限に関わらず即座に認証エラーとする
    if (!user || !user.isActive) {
      throw new UnauthorizedException("認証情報が無効です");
    }

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
