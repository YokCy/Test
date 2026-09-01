import { SetMetadata } from "@nestjs/common";

import type { AppAbility } from "./ability.factory";

/** 1つの認可条件を表す関数。Abilityを受け取り、許可するかどうかを返す */
export type PolicyHandler = (ability: AppAbility) => boolean;

export const CHECK_POLICIES_KEY = "check_policies";

/**
 * エンドポイントに要求するCASL認可条件を宣言するデコレータ。
 * `PoliciesGuard`がこのメタデータを読み取り、リクエストユーザーのAbilityで判定する
 * （CODING_STANDARDS 3章「レイヤードアーキテクチャ」のControllerサンプルに合わせた形）。
 *
 * 例: @CheckPolicies((ability) => ability.can("assign", "Task"))
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) => SetMetadata(CHECK_POLICIES_KEY, handlers);
