import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * PrismaClientをアプリ全体でシングルトンとして扱うためのラッパー。
 * CODING_STANDARDS 4章「クライアント設定」に従い、各Serviceでの`new PrismaClient()`を禁止し、
 * 本サービス経由でのみDBアクセスさせることでコネクションプールの圧迫を防ぐ。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // 開発環境ではクエリログを有効化し、本番相当ではwarn/errorのみに絞る
    super({
      log:
        process.env.NODE_ENV === "production"
          ? ["warn", "error"]
          : ["query", "warn", "error"],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
