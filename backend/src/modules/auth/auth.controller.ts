import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";

import type { AuthUser } from "../../common/auth/auth-user.type";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
} from "../../common/auth/token.constants";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

/**
 * 認証API（`/auth/*`）のController。
 * DTO検証・Guard適用・Cookie発行/削除・Serviceの呼び出しのみを担い、ビジネスロジックは持たない
 * （CODING_STANDARDS 3章「レイヤードアーキテクチャ」）。
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** メールアドレス・パスワードによるログイン。認可不要（未ログイン状態でアクセス可能）。 */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.authService.login(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
    return user;
  }

  /**
   * Refresh Token Cookieのみで検証し、Access/Refresh Tokenをローテーション発行する。
   * `JwtAuthGuard`は付けない（Access Tokenが期限切れの状態で呼ばれるエンドポイントのため）。
   */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = this.getRefreshTokenCookie(req);
    if (!rawRefreshToken) {
      throw new UnauthorizedException("Refresh Tokenが必要です");
    }

    const { accessToken, refreshToken } = await this.authService.refresh(rawRefreshToken);
    this.setAuthCookies(res, accessToken, refreshToken);
    return {};
  }

  /** ログアウト。サーバー側でRefresh Tokenを失効させ、Access/Refresh両Cookieを削除する。 */
  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = this.getRefreshTokenCookie(req);
    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken);
    }

    // WHY: Cookie設定時と同じpathを指定しないと削除されないため、setAuthCookiesと揃える
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, { path: "/" });
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: "/" });
    return {};
  }

  /** ログイン中の本人情報を取得する。 */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user);
  }

  /** ログイン中の本人のプロフィール（表示名）を更新する。更新対象は常に本人のみ。 */
  @Put("profile")
  @UseGuards(JwtAuthGuard)
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto.name);
  }

  /** Access/Refresh TokenをhttpOnly Cookieとして設定する（CODING_STANDARDS 9章「認証トークン」）。 */
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
      path: "/",
    });
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
      path: "/",
    });
  }

  /** Cookieからraw Refresh Tokenを取得する（未設定の場合はundefined）。 */
  private getRefreshTokenCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_TOKEN_COOKIE_NAME];
  }
}
