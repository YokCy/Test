import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../../lib/api-client";
import { categoryKeys, type CategoryListItem } from "../api";

/** GET /categories（P-09 カテゴリマスタ管理画面、画面設計仕様.md 3.1.8）。 */
export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: () => apiClient.get<CategoryListItem[]>("/categories"),
  });
}
