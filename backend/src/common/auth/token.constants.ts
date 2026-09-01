/**
 * Access/Refresh Tokenを保持するCookie名、および有効期限（秒）の定数。
 * MANIFEST.md「3.6 セキュリティ・アクセス管理」「6章 設計方針」で定めた
 * Access Token 15分・Refresh Token 7日をアプリ全体で単一の値として管理する。
 */
export const ACCESS_TOKEN_COOKIE_NAME = "access_token";
export const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
