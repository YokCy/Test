import type { CreateCategoryInput, UpdateCategoryInput } from "@eventboard/shared";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

/**
 * カテゴリマスタ管理API（`/categories/*`）のビジネスロジックを担うService。
 * MANIFEST.md 6章の通り、閲覧は全ロール、追加・編集・削除はadmin限定（認可判定自体はController側のCASL Guardで完結する）。
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * カテゴリ一覧を取得する（GET /categories）。
   * `eventCount`は画面設計仕様.md 3.1.8節「カテゴリマスタ管理」で、削除前にユーザーが影響範囲へ
   * 気づけるようにするための参考情報。論理削除済みのEventも含めて数える
   * （物理削除の可否を決めるDBの外部キー制約は論理削除の有無を区別しないため、実態に合わせる）。
   */
  async findAll() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { events: true } } },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      eventCount: category._count.events,
    }));
  }

  /** カテゴリを新規追加する（POST /categories）。同名カテゴリが存在する場合は409。 */
  async create(input: CreateCategoryInput) {
    try {
      return await this.prisma.category.create({ data: { name: input.name } });
    } catch (error) {
      throw this.toHttpException(error, "作成");
    }
  }

  /** カテゴリ名を編集する（PUT /categories/:id）。対象不在は404、同名カテゴリが存在する場合は409。 */
  async update(id: string, input: UpdateCategoryInput) {
    try {
      return await this.prisma.category.update({ where: { id }, data: { name: input.name } });
    } catch (error) {
      throw this.toHttpException(error, "更新");
    }
  }

  /**
   * カテゴリを削除する（DELETE /categories/:id）。
   * 紐づく`Event`が1件でも存在する場合、Prismaの外部キー制約（`onDelete: Restrict`）違反として
   * `P2003`が投げられるため、これを捕捉し分かりやすいメッセージの409へ変換する
   * （選定要素提案.md 4章「カテゴリ削除」: 移動・論理削除ロジックを追加せず、DB制約への準拠のみで賄う方針）。
   */
  async remove(id: string): Promise<void> {
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      throw this.toHttpException(error, "削除");
    }
  }

  /** Prismaの既知エラーを、操作内容に応じた分かりやすいHTTP例外に変換する共通処理。 */
  private toHttpException(error: unknown, action: "作成" | "更新" | "削除"): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return new ConflictException("同じ名前のカテゴリが既に存在します");
      }
      if (error.code === "P2025") {
        return new NotFoundException("指定したカテゴリが見つかりません");
      }
      if (error.code === "P2003") {
        return new ConflictException("このカテゴリに紐づくイベントが存在するため削除できません");
      }
    }
    return error instanceof Error ? error : new Error(`カテゴリの${action}に失敗しました`);
  }
}
