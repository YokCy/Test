import { createHash } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

import { REFRESH_TOKEN_TTL_SECONDS } from "./token.constants";
import { TokenService } from "./token.service";

/**
 * Refresh Tokenのライフサイクル（発行・検証・失効・ローテーション）を管理するサービス。
 * MANIFEST.md 5章 RefreshTokenテーブルの方針（平文はCookieにのみ保持し、DBにはハッシュ値のみ保存）に従い、
 * JWTとしての署名検証（TokenService）とは別に、DB上での失効管理・再利用防止を担う。
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  /** 新しいRefresh Tokenを発行し、DBにハッシュ値を保存する（ログイン・登録時に使用） */
  async issue(userId: string): Promise<string> {
    const rawToken = this.tokenService.signRefreshToken({ sub: userId });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(rawToken),
        expiresAt: this.calculateExpiresAt(),
      },
    });

    return rawToken;
  }

  /**
   * Refresh Tokenを検証する。JWTとしての署名・有効期限に加え、
   * DB上で失効済み（ログアウト・ローテーション済み）でないことを確認する。
   * WHY: JWT単体の検証だけでは、ログアウト・ローテーション後に無効化されたはずの
   * トークンを再利用（トークンリプレイ）されても拒否できないため、DB側の状態を正とする。
   */
  async verify(rawToken: string): Promise<{ userId: string; tokenId: string }> {
    const payload = this.verifyJwtOrThrow(rawToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });

    if (!record || record.userId !== payload.sub || record.revokedAt !== null || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh Tokenが無効です");
    }

    return { userId: record.userId, tokenId: record.id };
  }

  /**
   * Refresh Tokenをローテーションする（検証→旧トークン失効→新トークン発行を1トランザクションで実施）。
   * WHY: 失効と新規発行を分離すると、間に処理が中断した場合に旧トークンが有効なまま残ってしまう
   * （盗難トークンの再利用を許してしまう）ため、アトミックに行う（CODING_STANDARDS 4章「トランザクション」）。
   */
  async rotate(rawToken: string): Promise<{ userId: string; refreshToken: string }> {
    const { userId, tokenId } = await this.verify(rawToken);
    const newRawToken = this.tokenService.signRefreshToken({ sub: userId });

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: tokenId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId,
          tokenHash: this.hash(newRawToken),
          expiresAt: this.calculateExpiresAt(),
        },
      }),
    ]);

    return { userId, refreshToken: newRawToken };
  }

  /**
   * ログアウト時にRefresh Tokenを失効させる。
   * WHY: 既に不正・期限切れのトークンで呼ばれても例外にしない。ログアウトの主目的は
   * 「クライアントのCookie削除」であり、既に無効なトークンの失効試行を失敗として扱う必要はないため
   * （MANIFEST.md「POST /auth/logout」参照）。
   */
  async revoke(rawToken: string): Promise<void> {
    let userId: string;
    try {
      userId = this.tokenService.verifyRefreshToken(rawToken).sub;
    } catch {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash: this.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private verifyJwtOrThrow(rawToken: string): { sub: string } {
    try {
      return this.tokenService.verifyRefreshToken(rawToken);
    } catch {
      throw new UnauthorizedException("Refresh Tokenが無効です");
    }
  }

  private calculateExpiresAt(): Date {
    return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  }

  /**
   * ハッシュ化にはbcryptではなくSHA-256を使う。
   * WHY: パスワードのような低エントロピーの入力ではなく、ランダムなJWT文字列（十分な強度を持つ秘密値）の
   * 一致確認が目的のため、総当たり防止のための意図的な低速化（bcryptのコストファクタ）は不要かつ非効率。
   */
  private hash(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }
}
