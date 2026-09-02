import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { myPageKeys, type MyEventsResponse } from "../api";

/** GET /users/me/events。P-06マイページ（画面設計仕様.md 3.1.5）の3タブ分のデータをまとめて取得する。 */
export function useMyEvents() {
  return useQuery({
    queryKey: myPageKeys.events(),
    queryFn: () => apiClient.get<MyEventsResponse>("/users/me/events"),
  });
}
