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

// カテゴリ管理API（/categories/*）用スキーマ
export { CreateCategorySchema, UpdateCategorySchema } from "./schemas/categories";
export type { CreateCategoryInput, UpdateCategoryInput } from "./schemas/categories";

// イベント管理API（/events/*）用スキーマ
export { CreateEventSchema, UpdateEventSchema } from "./schemas/events";
export type { CreateEventInput, UpdateEventInput } from "./schemas/events";

// 参加登録・キャンセル・出席管理API用スキーマ
export { MarkAttendanceSchema, CancelRegistrationSchema } from "./schemas/registrations";
export type { MarkAttendanceInput, CancelRegistrationInput } from "./schemas/registrations";

// フィードバックAPI（/events/:id/feedbacks, /feedbacks/*）用スキーマ
export { CreateFeedbackSchema, UpdateFeedbackSchema } from "./schemas/feedbacks";
export type { CreateFeedbackInput, UpdateFeedbackInput } from "./schemas/feedbacks";
