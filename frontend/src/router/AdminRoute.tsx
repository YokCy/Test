import { Outlet } from "react-router-dom";

import { useMe } from "../features/auth/hooks/useMe";

import { NotFoundPage } from "./NotFoundPage";

/**
 * `ProtectedRoute`配下（ログイン済み確定後）でのみ使うAdmin限定ガード。
 * `useMe`は`ProtectedRoute`と同じqueryKeyのキャッシュを参照するため、追加のリクエストは発生しない。
 * WHY(URL遷移ではなくP-11をその場に描画): P-11「404/エラー画面」は「存在しないURL」用の固定パスを
 * 持たない（画面仕様書.md 1章の通り`*`＝どのパスにも一致しなかった場合の表示）ため、
 * 権限エラー時もURLはそのままにP-11の内容だけを描画する。
 */
export function AdminRoute() {
  const { data: user } = useMe();

  if (user?.role !== "ADMIN") {
    return <NotFoundPage />;
  }

  return <Outlet />;
}
