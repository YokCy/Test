import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { attendanceKeys, type RegistrationRow } from "../api";

/**
 * GET /events/:id/registrations。P-07出席管理画面（画面設計仕様.md 3.1.6）の参加者一覧を取得する。
 * `CONFIRMED`の参加者のみが返る（`WAITLISTED`はMANIFEST.md 6章 #21の通り対象外）。
 */
export function useRegistrations(eventId: string) {
  return useQuery({
    queryKey: attendanceKeys.list(eventId),
    queryFn: () => apiClient.get<RegistrationRow[]>(`/events/${eventId}/registrations`),
  });
}
