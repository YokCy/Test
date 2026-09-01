import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

/**
 * PrismaServiceを全モジュールから注入可能にするための共通DBアクセスモジュール。
 * `@Global`にすることで、各リソースモジュール側でのimport登録漏れを防ぐ。
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
