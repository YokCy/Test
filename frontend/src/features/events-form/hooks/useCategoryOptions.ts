import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { eventFormKeys, type CategoryOption } from "../api";

/**
 * GET /categories。フォームのカテゴリ`<select>`の選択肢を取得するためだけのローカルフック。
 * WHY: features/admin/categories（別エージェント実装予定）がより高機能なQuery Keyを別途定義する
 * 可能性があるが、TanStack QueryのQuery Keyはfeatureをまたいで共有する必要がないため問題ない。
 */
export function useCategoryOptions() {
  return useQuery({
    queryKey: eventFormKeys.categoryOptions,
    queryFn: () => apiClient.get<CategoryOption[]>("/categories"),
  });
}
