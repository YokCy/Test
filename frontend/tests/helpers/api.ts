import { request as playwrightRequest, type APIRequestContext, type APIResponse } from "@playwright/test";

/**
 * バックエンドAPIのベースURL。フロント（`http://localhost:5173`）とは別オリジンのため、
 * `frontend/.env.example`の`VITE_API_BASE_URL`と同じ値をE2E側にも明示的に持たせる
 * （`playwright.config.ts`の`use.baseURL`はフロント用でありAPI直叩きには使えない）。
 */
export const BACKEND_BASE_URL = "http://localhost:3000";

/**
 * バックエンドAPIを直接叩くための、Cookie無し（未認証）の`APIRequestContext`を作る。
 * WHY: Playwrightの`request`フィクスチャは`baseURL`が`playwright.config.ts`のフロント用設定を
 * 引き継いでしまうため、9章のAPI直叩きテストでは`@playwright/test`が公開するグローバルな`request`
 * （ブラウザに紐付かないスタンドアロンAPIコンテキスト）から都度生成する。呼び出し元は
 * `context.dispose()`で必ず後片付けすること。
 */
export function createBackendContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: BACKEND_BASE_URL });
}

/**
 * バックエンドに対して`POST /auth/login`を実行し、以後のリクエストにログイン済みCookieが
 * 自動的に付与される`APIRequestContext`を返す（`APIRequestContext`はSet-Cookieを自身の
 * Cookieストアに保持し続けるため、以後は`context.get/post(...)`をそのまま呼べばよい）。
 */
export async function loginBackendContext(credentials: {
  email: string;
  password: string;
}): Promise<APIRequestContext> {
  const context = await createBackendContext();
  const response = await context.post("/auth/login", { data: credentials });
  if (!response.ok()) {
    throw new Error(
      `E2Eテスト用ログインに失敗しました（${response.status()}）: ${await response.text()}`,
    );
  }
  return context;
}

/**
 * 指定した名前・値のCookieのみを保持した状態の`APIRequestContext`を作る
 * （改ざん・無効なAccess Token Cookieを直接送りつける認可バイパステスト用）。
 */
export function createBackendContextWithCookie(name: string, value: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: BACKEND_BASE_URL,
    storageState: {
      cookies: [
        {
          name,
          value,
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  });
}

/** 成功レスポンス（`{ success: true, data }`）を期待して`data`部分のみを取り出す。 */
export async function expectSuccessData<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw new Error(`成功レスポンスを期待しましたが失敗しました（${response.status()}）: ${await response.text()}`);
  }
  const body = (await response.json()) as { success: true; data: T };
  return body.data;
}

/** カテゴリ一覧から先頭の1件のIDを取得する（イベント作成の`categoryId`に使う）。 */
export async function getAnyCategoryId(context: APIRequestContext): Promise<string> {
  const response = await context.get("/categories");
  const categories = await expectSuccessData<{ id: string; name: string }[]>(response);
  const first = categories[0];
  if (!first) {
    throw new Error("カテゴリが1件も存在しません（seedが投入されていない可能性があります）");
  }
  return first.id;
}
