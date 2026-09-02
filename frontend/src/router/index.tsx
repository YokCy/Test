import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { CategoriesAdminPage } from "../features/admin/categories/components/CategoriesAdminPage";
import { AttendancePage } from "../features/attendance/components/AttendancePage";
import { LoginPage } from "../features/auth/components/LoginPage";
import { ProfilePage } from "../features/auth/components/ProfilePage";
import { EventDetailPage } from "../features/events/components/EventDetailPage";
import { EventsListPage } from "../features/events/components/EventsListPage";
import { EventCreatePage } from "../features/events-form/components/EventCreatePage";
import { EventEditPage } from "../features/events-form/components/EventEditPage";
import { FeedbackPage } from "../features/feedbacks/components/FeedbackPage";
import { MyPage } from "../features/my-page/components/MyPage";

import { AdminRoute } from "./AdminRoute";
import { NotFoundPage } from "./NotFoundPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { ROUTES } from "./routes";

/**
 * ルート定義。画面設計仕様.md 1章「ページ一覧」の全10画面(P-01〜P-10)を実装する。
 * P-01(ログイン)は未ログイン状態でアクセスするため`AppLayout`の外に置き、それ以外は
 * `ProtectedRoute`配下(ログイン必須)、P-09(カテゴリマスタ管理)はさらに`AdminRoute`配下に置く。
 */
export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.events, element: <EventsListPage /> },
          { path: ROUTES.eventDetail, element: <EventDetailPage /> },
          { path: ROUTES.eventCreate, element: <EventCreatePage /> },
          { path: ROUTES.eventEdit, element: <EventEditPage /> },
          { path: ROUTES.eventAttendance, element: <AttendancePage /> },
          { path: ROUTES.eventFeedback, element: <FeedbackPage /> },
          { path: ROUTES.myPage, element: <MyPage /> },
          { path: ROUTES.profile, element: <ProfilePage /> },
          {
            element: <AdminRoute />,
            children: [{ path: ROUTES.adminCategories, element: <CategoriesAdminPage /> }],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
