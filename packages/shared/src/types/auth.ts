/**
 * Access/Refresh Token（JWT）のペイロード型定義。
 * バックエンドのTokenService（署名側）とJwtStrategy（検証側）の両方でこの型を単一の正として使う。
 */

/**
 * Access Tokenのペイロード。
 * WHY: `role`等の権限情報は含めない。ユーザーの権限変更（昇格/降格・無効化）が
 * トークン有効期限（15分）内に反映されず古い権限で認可判定してしまうリスクを避けるため、
 * JwtStrategy側で`sub`をキーに毎回最新のUser情報をDBから取得する方針とする。
 */
export interface AccessTokenPayload {
  sub: string;
}

/**
 * Refresh Tokenのペイロード。
 * 失効・ローテーション判定はJWT自体ではなくRefreshTokenテーブル側（tokenHashの一致）で行うため、
 * ペイロードはAccess Tokenと同じ`sub`のみで足りる（型としては意図を明確にするため区別する）。
 */
export interface RefreshTokenPayload {
  sub: string;
}
