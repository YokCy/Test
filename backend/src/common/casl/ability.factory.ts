import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { MongoAbility } from "@casl/ability";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/auth-user.type";

/**
 * CASLで判定するアクションの一覧。
 * `manage`はCASL標準のワイルドカードアクション（対象subjectへの全アクションを許可する）。
 * イベント・カテゴリ・参加登録・出席・フィードバック等のドメイン固有アクション
 * （例: 主催者本人による編集・削除、admin強制キャンセル等）はドメインモデル確定後に追加する。
 */
export type AppAction = "manage" | "read" | "create" | "update" | "delete";

export type AppSubjects = "User" | "Category" | "all";

export type AppAbility = MongoAbility<[AppAction, AppSubjects]>;

/**
 * ログインユーザーごとのCASL Abilityを組み立てるファクトリ。
 * 現時点ではシステムロール（`User.role`）のみに基づく判定。
 * 「イベント作成者=主催者」のような、リソースの所有関係に基づく権限判定（Project/Task相当）は、
 * Eventモデル確定後にsubject/conditionを追加して拡張する。
 */
@Injectable()
export class CaslAbilityFactory {
  constructor(private readonly prisma: PrismaService) {}

  // WHY: 現状はDB参照が不要なため`async`にしていないが、呼び出し側（PoliciesGuard）は
  // Promiseとして扱う前提のため戻り値の型はPromise<AppAbility>のままにしておく
  // （Eventモデル追加時、所有関係の判定でPrismaへのクエリが必要になれば`async`に戻す）。
  createForUser(user: AuthUser): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === "ADMIN") {
      can("manage", "User");
      can("manage", "Category");
      return Promise.resolve(build());
    }

    // memberは自分自身の情報のみ閲覧可（ドメインモデル追加時にこのファクトリを拡張していく）
    can("read", "User");
    // カテゴリ一覧はイベント一覧・作成フォームの絞り込みで全member共通に必要なため閲覧のみ許可する
    can("read", "Category");

    return Promise.resolve(build());
  }
}
