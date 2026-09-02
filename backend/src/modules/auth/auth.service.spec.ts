import { UnauthorizedException } from "@nestjs/common";
import type { SystemRole, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import type { RefreshTokenService } from "../../common/auth/refresh-token.service";
import type { TokenService } from "../../common/auth/token.service";
import type { PrismaService } from "../../prisma/prisma.service";

import { AuthService } from "./auth.service";

// WHY: bcrypt.compare は実際のハッシュ照合を行わず、テストごとに戻り値を明示的に制御したいためモック化する
jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let tokenService: { signAccessToken: jest.Mock };
  let refreshTokenService: { issue: jest.Mock; rotate: jest.Mock; revoke: jest.Mock };

  const baseUser: User = {
    id: "user-1",
    email: "taro@example.com",
    name: "山田太郎",
    passwordHash: "hashed-password",
    role: "MEMBER",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    tokenService = {
      signAccessToken: jest.fn().mockReturnValue("access-token-signed"),
    };
    refreshTokenService = {
      issue: jest.fn().mockResolvedValue("refresh-token-issued"),
      rotate: jest.fn(),
      revoke: jest.fn(),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      tokenService as unknown as TokenService,
      refreshTokenService as unknown as RefreshTokenService,
    );

    jest.clearAllMocks();
    // clearAllMocksが戻り値もクリアするため、デフォルト挙動を再設定する
    tokenService.signAccessToken.mockReturnValue("access-token-signed");
    refreshTokenService.issue.mockResolvedValue("refresh-token-issued");
  });

  describe("login", () => {
    it("正しいemail/passwordの場合、Access/Refresh Tokenが発行される", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: baseUser.email, password: "correct-password" });

      expect(result).toEqual({
        user: { id: baseUser.id, name: baseUser.name, email: baseUser.email, role: baseUser.role },
        accessToken: "access-token-signed",
        refreshToken: "refresh-token-issued",
      });
      expect(tokenService.signAccessToken).toHaveBeenCalledWith({ sub: baseUser.id });
      expect(refreshTokenService.issue).toHaveBeenCalledWith(baseUser.id);
    });

    it("存在しないemailの場合、401を投げる", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "unknown@example.com", password: "any-password" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("パスワードが不一致の場合、401を投げる", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: baseUser.email, password: "wrong-password" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("isActive=falseの場合、パスワードが正しくても401を投げる", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, isActive: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: baseUser.email, password: "correct-password" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("ユーザー不在・パスワード不一致・無効化済みのいずれも同一のエラーメッセージであること（列挙攻撃対策）", async () => {
      const expectedMessage = "メールアドレスまたはパスワードが誤っています";

      // 存在しないemail
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const notFoundError: unknown = await service
        .login({ email: "unknown@example.com", password: "any-password" })
        .catch((error: unknown) => error);

      // パスワード不一致
      prisma.user.findUnique.mockResolvedValueOnce(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      const mismatchError: unknown = await service
        .login({ email: baseUser.email, password: "wrong-password" })
        .catch((error: unknown) => error);

      // 無効化済み
      prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, isActive: false });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      const inactiveError: unknown = await service
        .login({ email: baseUser.email, password: "correct-password" })
        .catch((error: unknown) => error);

      expect(notFoundError).toBeInstanceOf(UnauthorizedException);
      expect(mismatchError).toBeInstanceOf(UnauthorizedException);
      expect(inactiveError).toBeInstanceOf(UnauthorizedException);
      expect((notFoundError as Error).message).toBe(expectedMessage);
      expect((mismatchError as Error).message).toBe(expectedMessage);
      expect((inactiveError as Error).message).toBe(expectedMessage);
    });
  });

  describe("refresh", () => {
    it("有効なRefresh Tokenの場合、ローテーションされた新しいAccess/Refresh Tokenを返す", async () => {
      refreshTokenService.rotate.mockResolvedValue({ userId: "user-1", refreshToken: "new-refresh-token" });

      const result = await service.refresh("old-refresh-token");

      expect(refreshTokenService.rotate).toHaveBeenCalledWith("old-refresh-token");
      expect(tokenService.signAccessToken).toHaveBeenCalledWith({ sub: "user-1" });
      expect(result).toEqual({ accessToken: "access-token-signed", refreshToken: "new-refresh-token" });
    });

    it("無効・期限切れ・失効済みのRefresh Tokenの場合、RefreshTokenServiceの401がそのまま伝播する", async () => {
      refreshTokenService.rotate.mockRejectedValue(new UnauthorizedException("Refresh Tokenが無効です"));

      await expect(service.refresh("invalid-refresh-token")).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("logout", () => {
    it("指定したRefresh Tokenの失効処理をRefreshTokenServiceに委譲する", async () => {
      await service.logout("some-refresh-token");

      expect(refreshTokenService.revoke).toHaveBeenCalledWith("some-refresh-token");
    });
  });

  describe("getMe", () => {
    it("渡されたSafeUserの内容をそのまま整形して返す", () => {
      const safeUser = { id: "user-1", name: "山田太郎", email: "taro@example.com", role: "MEMBER" as SystemRole };

      const result = service.getMe(safeUser);

      expect(result).toEqual(safeUser);
    });
  });

  describe("updateProfile", () => {
    it("指定したuserIdの表示名が更新される", async () => {
      prisma.user.update.mockResolvedValue({ ...baseUser, name: "更新後の名前" });

      const result = await service.updateProfile("user-1", "更新後の名前");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { name: "更新後の名前" },
      });
      expect(result).toEqual({
        id: baseUser.id,
        name: "更新後の名前",
        email: baseUser.email,
        role: baseUser.role,
      });
    });

    it("更新対象は常に引数のuserIdのみであり、他のフィールドから別ユーザーを対象にする経路が無いこと", async () => {
      prisma.user.update.mockResolvedValue(baseUser);

      await service.updateProfile("own-user-id", "任意の名前");

      // whereにuserId以外の項目（他人のid等）が紛れ込んでいないことを検証する
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "own-user-id" },
        data: { name: "任意の名前" },
      });
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });
  });
});
