import { Link } from "react-router-dom";

import { ROUTES } from "./routes";

/**
 * P-11 404/エラー画面。
 * 画面仕様書.md 1章の通り、「存在しないURL」だけでなく「権限のないリソースへのアクセス時」
 * （Phase 2で実装するAdminRoute等からのリダイレクト先）にも共通で使うため、
 * 「404 Not Found」に限定しない汎用的な文言にしている。
 */
export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-4xl font-bold text-slate-300">404</p>
      <p className="text-lg font-medium text-slate-700">
        お探しのページが見つからないか、アクセスする権限がありません
      </p>
      <Link to={ROUTES.home} className="text-sm font-medium text-blue-600 hover:underline">
        トップへ戻る
      </Link>
    </div>
  );
}
