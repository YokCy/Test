import { Global, Module } from "@nestjs/common";

import { CaslModule } from "../casl/casl.module";

import { JwtAuthGuard } from "./jwt-auth.guard";
import { PoliciesGuard } from "./policies.guard";

/**
 * JwtAuthGuard・PoliciesGuardをDIコンテナに登録する共通モジュール。
 * `PoliciesGuard`はCaslAbilityFactoryに依存するコンストラクタインジェクションを持つため、
 * 各Controllerで`@UseGuards(JwtAuthGuard, PoliciesGuard)`とクラス参照のみを書けば
 * 解決できるよう、あらかじめ`@Global`としてDIコンテナに登録しておく。
 */
@Global()
@Module({
  imports: [CaslModule],
  providers: [JwtAuthGuard, PoliciesGuard],
  exports: [JwtAuthGuard, PoliciesGuard],
})
export class GuardsModule {}
