import type { UpdateCategoryInput } from "@eventboard/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../../lib/api-client";
import { categoryKeys, type CategoryDetail } from "../api";

interface UpdateCategoryParams {
  id: string;
  input: UpdateCategoryInput;
}

/**
 * PUT /categories/:id（M-01「編集」、MANIFEST.md 6章 #12）。
 * 同名カテゴリが存在する場合は`409`（呼び出し元の`CategoryFormModal`でフィールドエラーとして処理する）。
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateCategoryParams) =>
      apiClient.put<CategoryDetail>(`/categories/${id}`, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}
