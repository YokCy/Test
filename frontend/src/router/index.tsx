import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { LoginPage } from "../features/auth/components/LoginPage";
import { ProfilePage } from "../features/auth/components/ProfilePage";

import { NotFoundPage } from "./NotFoundPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { ROUTES } from "./routes";

/**
 * ルート定義。認証系（ログイン・プロフィール）のみ実装済み。
 * イベント一覧・詳細・作成編集・マイページ・出席管理・フィードバック・カテゴリ管理の各画面は、
 * ドメイン設計確定後にここへ追加していく（`AdminRoute`によるadmin専用ガードも同様）。
 */
export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [{ path: ROUTES.profile, element: <ProfilePage /> }],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
