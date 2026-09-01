import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";

/**
 * POST /auth/logout。
 * WHY(queryClient.clear()): ログアウト後に別ユーザーが同じブラウザでログインした際、
 * 前ユーザーのプロジェクト・タスク等のキャッシュが一瞬でも見えてしまわないよう、
 * 認証情報に限らずTanStack Queryの全キャッシュを破棄する。
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post("/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
