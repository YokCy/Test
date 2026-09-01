import { Global, Module } from "@nestjs/common";

import { CaslAbilityFactory } from "./ability.factory";

/**
 * CaslAbilityFactoryを全モジュールから利用可能にする共通モジュール。
 * `PoliciesGuard`（common/guards/）がこのファクトリに依存するため、`@Global`にして
 * import登録漏れを防ぐ（PrismaModule/AuthInfraModuleと同じ方針）。
 */
@Global()
@Module({
  providers: [CaslAbilityFactory],
  exports: [CaslAbilityFactory],
})
export class CaslModule {}
