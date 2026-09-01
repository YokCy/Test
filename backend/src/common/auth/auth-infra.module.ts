import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { JwtStrategy } from "./jwt.strategy";
import { RefreshTokenService } from "./refresh-token.service";
import { TokenService } from "./token.service";

/**
 * 認証基盤（JWT発行・検証・Passport戦略）を全モジュールから利用可能にする共通モジュール。
 * `@Global`にすることで、Phase 3以降の各リソースモジュール（AuthModule等）でのimport登録漏れを防ぐ
 * （PrismaModuleと同じ方針。backend-tasks.md「共通ファイルへの登録競合」参照）。
 * WHY: `JwtModule.register({})`はデフォルト鍵を持たせず登録するのみとし、
 * 実際の署名鍵・有効期限はTokenService側で用途（Access/Refresh）ごとに呼び出し時指定する。
 */
@Global()
@Module({
  imports: [PassportModule, JwtModule.register({})],
  providers: [JwtStrategy, TokenService, RefreshTokenService],
  exports: [TokenService, RefreshTokenService],
})
export class AuthInfraModule {}
