import { Outlet } from "react-router-dom";

import { Header } from "./Header";

/** ログイン後の全ページ共通シェル（ヘッダー＋ページ本体）。`ProtectedRoute`配下のレイアウトルートとして使う。 */
export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
