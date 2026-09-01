import type { SystemRole } from "@prisma/client";

/**
 * 認証済みリクエストにおける `request.user` の型。
 * JwtStrategy.validate() の戻り値であり、以降 CurrentUser デコレータ経由で
 * 各Controller/Serviceから参照する（MANIFEST.md 2章の認可判定に用いるシステムロールを含む）。
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
}
