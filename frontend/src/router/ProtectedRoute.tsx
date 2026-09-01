import { Navigate, Outlet } from "react-router-dom";

import { Spinner } from "../components/ui/Spinner";
import { useMe } from "../features/auth/hooks/useMe";

import { ROUTES } from "./routes";

/**
 * レイアウトルートとして使う認証ガード（react-router v6の「pathなし親ルート＋Outlet」パターン）。
 * `GET /auth/me`の結果が確定するまでは判定できないため、ローディング中は専用の表示を挟む
 * （未ログイン/ログイン済みのどちらかを誤って一瞬描画してしまうのを防ぐ）。
 */
export function ProtectedRoute() {
  const { data: user, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return <Outlet />;
}
