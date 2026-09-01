import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useLogout } from "../../features/auth/hooks/useLogout";
import { useMe } from "../../features/auth/hooks/useMe";
import { ROUTES } from "../../router/routes";

/**
 * 全ページ共通のグローバルヘッダー。
 * イベント一覧・マイページ等のナビゲーション導線は、該当画面の実装時にここへ追加する。
 */
export function Header() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // WHY: AppLayout経由（ProtectedRoute配下）でのみ描画される前提だが、
  // useMeの型上はundefinedもあり得るため、防御的にnullを返す。
  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => navigate(ROUTES.login, { replace: true }),
    });
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-4">
        <Link to={ROUTES.home} className="text-lg font-semibold text-slate-900">
          EventBoard
        </Link>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsUserMenuOpen((open) => !open)}
          className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          👤 {user.name} ▾
        </button>
        {isUserMenuOpen && (
          <div className="absolute right-0 top-full z-10 mt-2 w-40 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            <Link
              to={ROUTES.profile}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setIsUserMenuOpen(false)}
            >
              プロフィール設定
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
