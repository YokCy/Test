import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { myPageKeys, type MyStatsResponse } from "../api";

/** GET /users/me/stats。P-06マイページの累計参加数・出席率・カテゴリ別集計を取得する。 */
export function useMyStats() {
  return useQuery({
    queryKey: myPageKeys.stats(),
    queryFn: () => apiClient.get<MyStatsResponse>("/users/me/stats"),
  });
}
