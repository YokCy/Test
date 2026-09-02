import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { eventKeys, type EventDetail } from "../api";

/**
 * GET /events/:id。P-03イベント詳細画面（画面設計仕様.md 3.1.3）の基本情報を取得する。
 * WHY(enabled): `useParams`由来の`eventId`はルート定義上ほぼ必ず存在するが、型上は`undefined`もあり得るため、
 * 未確定の間はクエリを発火させず、確定後に自動発火させる。
 */
export function useEventDetail(eventId: string | undefined) {
  return useQuery({
    queryKey: eventKeys.detail(eventId ?? ""),
    queryFn: () => apiClient.get<EventDetail>(`/events/${eventId}`),
    enabled: Boolean(eventId),
  });
}
