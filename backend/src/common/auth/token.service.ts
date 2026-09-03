import { randomUUID } from "node:crypto";

import type { AccessTokenPayload, RefreshTokenPayload } from "@eventboard/shared";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "./token.constants";

/**
 * Access/Refresh Token（JWT）の署名・検証のみを担うユーティリティ。
 * MANIFEST.md「3.6 セキュリティ・アクセス管理」に定めた有効期限（Access 15分・Refresh 7日）に従い、
 * 用途ごとに異なる署名鍵（JWT_ACCESS_SECRET/JWT_REFRESH_SECRET）で署名する。
 * DBを介したRefresh Tokenの失効・ローテーションはRefreshTokenServiceの責務とし、本サービスは
 * トークン文字列の発行・検証という純粋な暗号処理のみに専念する。
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Access Token（有効期限15分）を発行する */
  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  /**
   * Refresh Token（有効期限7日）を発行する。
   * WHY(jwtid): ペイロードが`{ sub: userId }`のみだと、同一ユーザーが同じ秒内に複数回ログイン
   * （二重クリック・複数タブでのほぼ同時ログイン等）した場合、`iat`（秒単位）まで含めて署名結果が
   * 完全に一致してしまい、`RefreshTokenService.issue`が保存する`tokenHash`（トークンのSHA-256）が
   * 衝突してDBのユニーク制約違反（500エラー）になる不具合があった。`jwtid`にランダム値を持たせることで、
   * タイミングに関わらず毎回一意なトークンになるようにする。
   */
  signRefreshToken(payload: RefreshTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      jwtid: randomUUID(),
    });
  }

  /**
   * Refresh Tokenの署名・有効期限を検証しペイロードを返す。
   * 不正または期限切れの場合は`JsonWebTokenError`/`TokenExpiredError`を投げる
   * （呼び出し元のRefreshTokenServiceで`UnauthorizedException`に変換する）。
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.jwtService.verify<RefreshTokenPayload>(token, {
      secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
    });
  }
}
