// フロント・バック共有のZodスキーマ・型定義のエントリーポイント。
// 各リソースのスキーマはドメイン設計確定後にここからバレルエクスポートしていく。
export type { AccessTokenPayload, RefreshTokenPayload } from "./types/auth";
export type { ApiErrorResponse, ApiResponse, ApiSuccessResponse } from "./types/api-response";

// 認証API（/auth/*）のZodスキーマ・型
export { LoginSchema, UpdateProfileSchema } from "./schemas/auth";
export type { LoginInput, UpdateProfileInput } from "./schemas/auth";

// ユーザー管理API（/users/*）用スキーマ
export { UpdateUserRoleSchema } from "./schemas/users";
export type { UpdateUserRoleInput } from "./schemas/users";
