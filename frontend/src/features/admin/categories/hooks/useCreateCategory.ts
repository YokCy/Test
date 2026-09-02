import type { CreateCategoryInput } from "@eventboard/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../../lib/api-client";
import { categoryKeys, type CategoryDetail } from "../api";

/**
 * POST /categories（M-01「＋追加」、MANIFEST.md 6章 #11）。
 * 同名カテゴリが存在する場合は`409`（呼び出し元の`CategoryFormModal`でフィールドエラーとして処理する）。
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => apiClient.post<CategoryDetail>("/categories", input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}
