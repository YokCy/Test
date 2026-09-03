import { JwtService } from "@nestjs/jwt";

import { TokenService } from "./token.service";

/** `ConfigService`のうち`TokenService`が実際に使う`getOrThrow`のみをモック化する。 */
function createConfigServiceMock(): { getOrThrow: jest.Mock } {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === "JWT_ACCESS_SECRET") {
        return "test-access-secret";
      }
      if (key === "JWT_REFRESH_SECRET") {
        return "test-refresh-secret";
      }
      throw new Error(`未知の設定キーです: ${key}`);
    }),
  };
}

describe("TokenService", () => {
  describe("signRefreshToken", () => {
    it("同一ペイロード・同一秒内に発行しても、毎回異なるトークン文字列になること", () => {
      // WHY: ペイロードが{ sub: userId }のみで`jwtid`が無いと、同一ユーザーが同じ秒内に複数回
      // ログインした場合、iat（秒単位）まで含めて署名結果が完全に一致してしまい、
      // RefreshTokenService.issueが保存するtokenHashが衝突してDBのユニーク制約違反になる
      // 不具合があった（実際にE2Eテストの並列実行で再現・発見）。jwtidにランダム値を持たせることで
      // 回避していることを確認する回帰防止テスト。
      const service = new TokenService(new JwtService({}), createConfigServiceMock() as never);

      const tokenA = service.signRefreshToken({ sub: "user-1" });
      const tokenB = service.signRefreshToken({ sub: "user-1" });

      expect(tokenA).not.toBe(tokenB);
    });

    it("発行したトークンをverifyRefreshTokenで検証すると、同じsubが取り出せること", () => {
      const service = new TokenService(new JwtService({}), createConfigServiceMock() as never);

      const token = service.signRefreshToken({ sub: "user-1" });
      const payload = service.verifyRefreshToken(token);

      expect(payload.sub).toBe("user-1");
    });
  });
});
