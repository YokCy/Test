import type { LoginInput } from "@eventboard/shared";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { SystemRole, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { RefreshTokenService } from "../../common/auth/refresh-token.service";
import { TokenService } from "../../common/auth/token.service";
import { PrismaService } from "../../prisma/prisma.service";

/** レスポンスに含めるユーザー情報の形（パスワードハッシュ等の内部情報は含めない） */
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: SystemRole;
}

/** loginの成功結果（Controller側でCookie設定に使うトークンを含む） */
export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * 認証API（`/auth/*`）のビジネスロジックを担うService。
 * 招待制ではなくシンプルなログインのみ実装のため、ユーザー作成はseed経由のみで、
 * register相当のAPIは提供しない。
 * Controllerからは`Request`/`Response`に依存しない形（DTOの値・AuthUser）でのみ呼び出される
 * （CODING_STANDARDS 3章「レイヤードアーキテクチャ」）。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * メールアドレス・パスワードでログインする。
   * WHY: ユーザー列挙攻撃を避けるため（CODING_STANDARDS 9章「入力値検証」）、
   * 「該当ユーザーなし」「パスワード不一致」「無効化済み」のいずれも同じ401・同じメッセージで返す。
   */
  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;

    if (!user || !passwordMatches || !user.isActive) {
      throw new UnauthorizedException("メールアドレスまたはパスワードが誤っています");
    }

    const accessToken = this.tokenService.signAccessToken({ sub: user.id });
    const refreshToken = await this.refreshTokenService.issue(user.id);

    return { user: this.toSafeUser(user), accessToken, refreshToken };
  }

  /**
   * Refresh Tokenをローテーションし、新しいAccess/Refresh Tokenを発行する。
   * 検証・DB失効チェック・ローテーション自体は`RefreshTokenService.rotate()`に委譲する
   * （不正・期限切れの場合は`UnauthorizedException`がそのまま伝播する）。
   */
  async refresh(rawRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { userId, refreshToken } = await this.refreshTokenService.rotate(rawRefreshToken);
    const accessToken = this.tokenService.signAccessToken({ sub: userId });

    return { accessToken, refreshToken };
  }

  /** ログアウト時にRefresh Tokenを失効させる（Cookie削除自体はController側の責務） */
  async logout(rawRefreshToken: string): Promise<void> {
    await this.refreshTokenService.revoke(rawRefreshToken);
  }

  /** ログイン中の本人情報を返す（`@CurrentUser()`から取得済みの情報をそのまま整形するのみ） */
  getMe(user: SafeUser): SafeUser {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  /** ログイン中の本人のプロフィール（表示名）を更新する。更新対象は常に`userId`（`@CurrentUser()`由来）のみ。 */
  async updateProfile(userId: string, name: string): Promise<SafeUser> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { name },
    });

    return this.toSafeUser(updatedUser);
  }

  /** Prismaの`User`エンティティから、レスポンスに含めてよい項目のみを抽出する */
  private toSafeUser(user: User): SafeUser {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}
