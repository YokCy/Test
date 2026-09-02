import type { ApiResponse } from "@eventboard/shared";

import { ROUTES } from "../router/routes";

/** バックエンドAPIのベースURL（`VITE_API_BASE_URL`未設定時は起動直後に気付けるようすぐ例外を投げる） */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// WHY: /auth/login・/auth/registerは未ログイン状態で呼ばれ、401は「認証情報が誤っている」ことを
// 意味するのでリフレッシュ対象ではない。/auth/refresh自体もリフレッシュ処理の起点であり、
// これをリトライ対象に含めると失敗時に無限ループしてしまうため除外する。
const AUTH_RETRY_EXCLUDED_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];

/**
 * APIがエラーレスポンス（`{ success: false, error }`）を返した際に投げる例外。
 * `code`（例外クラス名）と`message`（ユーザー表示可能な日本語文言）をそのまま保持し、
 * 呼び出し元（フォームのエラー表示等）でステータス種別ごとの分岐に使えるようにする。
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * fetchの共通ラッパー（リフレッシュ・リトライは行わない生の1回分の呼び出し）。
 * MANIFEST.md 6章の共通レスポンスエンベロープ（`{ success, data }` / `{ success: false, error }`）を
 * 解釈し、成功時は`data`のみを返す・失敗時は`ApiError`を投げる形に正規化する。
 * WHY(credentials: "include"): 認証はhttpOnly CookieのJWT（MANIFEST.md 6章）で行うため、
 * 同一オリジンでない場合でも常にCookieを送信する必要がある。
 */
async function rawRequest<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  // WHY(exactOptionalPropertyTypes): RequestInitのheaders/body/signalはoptionalなプロパティのため、
  // 値が無い場合はキー自体を含めない（`undefined`を明示的に代入するとtsconfig.base.jsonの
  // exactOptionalPropertyTypes設定に反する）。
  const init: RequestInit = { method, credentials: "include" };
  if (options.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }
  if (options.signal) {
    init.signal = options.signal;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, init);

  // WHY: `204 No Content`（例: DELETE /categories/:id, MANIFEST.md 6章 #13）はFetch仕様上
  // レスポンスボディが強制的に空になり、`response.json()`を呼ぶとパースエラーになるため先に分岐する。
  // 成功系のみが204を返す想定のため、ここに到達した時点で`payload.success`相当はtrueとして扱ってよい。
  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.success) {
    throw new ApiError(response.status, payload.error.code, payload.error.message);
  }

  return payload.data;
}

let refreshPromise: Promise<void> | null = null;

/**
 * `POST /auth/refresh`を実行する。同時に複数のリクエストが401を検知しても、
 * 進行中のリフレッシュ処理を使い回して1回しか実行しない（Refresh Tokenはローテーション式のため、
 * 並行して複数回叩くと片方が失効済みトークンを使って失敗してしまう）。
 */
function refreshAccessToken(): Promise<void> {
  refreshPromise ??= rawRequest("POST", "/auth/refresh")
    .then(() => undefined)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/**
 * リフレッシュも失敗した＝Refresh Tokenも無効なため再ログインが必要な状態。
 * TanStack Queryのキャッシュ等、メモリ上に残ったログイン中の状態を丸ごと破棄したいので、
 * SPA内遷移ではなくブラウザの画面遷移（フルリロード）で`/login`へ移動する。
 */
function redirectToLogin(): void {
  if (window.location.pathname !== ROUTES.login) {
    window.location.href = ROUTES.login;
  }
}

/**
 * `rawRequest`をラップし、401（Access Token期限切れ）を検知した場合に
 * `POST /auth/refresh`で再発行してから元のリクエストを1回だけ再試行する。
 * リフレッシュ自体が失敗した場合はログイン画面へリダイレクトする。
 */
async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(method, path, options);
  } catch (error) {
    const shouldRetryAfterRefresh =
      error instanceof ApiError && error.status === 401 && !AUTH_RETRY_EXCLUDED_PATHS.includes(path);
    if (!shouldRetryAfterRefresh) {
      throw error;
    }

    try {
      await refreshAccessToken();
    } catch {
      redirectToLogin();
      throw error;
    }

    return rawRequest<T>(method, path, options);
  }
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),
};
