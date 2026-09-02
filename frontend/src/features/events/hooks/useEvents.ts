import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { eventKeys, type EventListFilters, type EventSummary } from "../api";

/** クエリ文字列は値が存在するキーのみ含める（空文字・undefinedのキーをAPIへ送らないため）。 */
function buildQueryString(filters: EventListFilters): string {
  const params = new URLSearchParams();
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.keyword) {
    params.set("keyword", filters.keyword);
  }
  if (filters.tags) {
    params.set("tags", filters.tags);
  }
  if (filters.sort) {
    params.set("sort", filters.sort);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** GET /events。P-02イベント一覧画面（画面設計仕様.md 3.1.2）のカード一覧を取得する。 */
export function useEvents(filters: EventListFilters) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: () => apiClient.get<EventSummary[]>(`/events${buildQueryString(filters)}`),
  });
}
