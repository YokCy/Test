/**
 * フロント・バック共通のAPIレスポンスエンベロープ型。
 * MANIFEST.md「6. API設計」「設計方針」で定めた成功時/エラー時の共通形式に対応する。
 */

/** 成功時レスポンス（`ResponseInterceptor`が生成する形） */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** エラー時レスポンス（`HttpExceptionFilter`が生成する形） */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
