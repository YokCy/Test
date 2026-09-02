import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../../lib/api-client";
import { categoryKeys } from "../api";

/**
 * DELETE /categories/:id（M-03、MANIFEST.md 6章 #13）。`204 No Content`で成功する。
 * 紐づく`Event`が1件でも存在する場合は`409`（呼び出し元の`DeleteCategoryConfirmModal`で
 * モーダル内にサーバーのエラーメッセージをそのまま表示する。画面設計仕様.md 3.1.8節）。
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/categories/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}
