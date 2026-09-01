import type { UpdateUserRoleInput } from "@eventboard/shared";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

/**
 * ユーザー管理API（/users/*）のビジネスロジックを担うService。
 * 全メソッドはAdmin限定エンドポイント（UsersController）からのみ呼ばれる想定であり、
 * 認可判定自体はController側のCASL Guardで完結するため、本Serviceではロールチェックは行わない。
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 全ユーザーの一覧を取得する（GET /users）。
   * `passwordHash`は絶対に含めないよう、select句で必要なフィールドのみ明示的に取得する。
   */
  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * 指定した単一ユーザーの詳細情報を取得する（GET /users/:id）。
   * WHY(MANIFEST.md 6章 GET /users/:id): 対象が存在しない場合は404を返す。
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("指定したユーザーが見つかりません");
    }

    return user;
  }

  /**
   * 指定したユーザーのシステムロール（ADMIN/MEMBER）を変更する（PUT /users/:id/role）。
   * WHY(MANIFEST.md 5章 User「ビジネスルール」): システム上`role=ADMIN`かつ`isActive=true`のユーザーは
   * 常に1人以上存在しなければならない。対象ユーザーが現在ADMINかつisActiveで、変更後にMEMBERへ降格する場合のみ、
   * 対象を除いてADMIN&isActiveのユーザーが0人にならないかを検証する（それ以外の変更パターンでは制約に抵触しないため検証不要）。
   */
  async updateRole(id: string, input: UpdateUserRoleInput) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException("指定したユーザーが見つかりません");
    }

    if (target.role === "ADMIN" && target.isActive && input.role === "MEMBER") {
      await this.assertNotLastActiveAdmin(id);
    }

    return this.prisma.user.update({
      where: { id },
      data: { role: input.role },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  /**
   * 指定したユーザーを無効化する（POST /users/:id/deactivate）。
   * 物理削除ではなく`isActive`を`false`にする論理的な無効化であり、担当中のタスクはそのまま残す
   * （削除・カスケード処理は行わない。MANIFEST.md 6章）。
   * WHY(MANIFEST.md 6章 POST /users/:id/deactivate): 実行者自身を対象とする無効化は409（自己無効化禁止）。
   * WHY(MANIFEST.md 5章 User「ビジネスルール」、PUT /users/:id/roleと同じ制約): 対象が現在ADMINかつisActiveで、
   * 無効化によってADMIN&isActiveのユーザーが0人になる場合も409とする。
   */
  async deactivate(id: string, currentUserId: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException("指定したユーザーが見つかりません");
    }

    if (id === currentUserId) {
      throw new ConflictException("自分自身のアカウントを無効化することはできません");
    }

    if (target.role === "ADMIN" && target.isActive) {
      await this.assertNotLastActiveAdmin(id);
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  }

  /**
   * 「対象ユーザーを除いてrole=ADMINかつisActive=trueのユーザーが何人いるか」を確認し、
   * 0人になる場合は409を投げる共通処理。
   * updateRole（ADMIN→MEMBER降格）とdeactivate（ADMINの無効化）の両方から呼ばれる
   * （MANIFEST.md 5章 User「ビジネスルール」）。
   */
  private async assertNotLastActiveAdmin(excludeUserId: string): Promise<void> {
    const remainingActiveAdminCount = await this.prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: excludeUserId } },
    });

    if (remainingActiveAdminCount === 0) {
      throw new ConflictException(
        "この操作によりシステム上有効なAdminユーザーが0人になるため実行できません",
      );
    }
  }
}
