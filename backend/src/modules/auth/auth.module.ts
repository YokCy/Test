import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

/**
 * 認証API（`/auth/*`）モジュール。
 * `TokenService`/`RefreshTokenService`は`AuthInfraModule`（`@Global`）が既に提供しているため、
 * 本モジュールでは再定義せずそのまま`AuthService`のDIで利用する。
 * WHY: `AppModule`への登録はPhase 12.6でまとめて行う方針のため（backend-tasks.md）、
 * 本モジュール自体は他Phaseと衝突しないよう`app.module.ts`を編集せず単体で完成させる。
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
