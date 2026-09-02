import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { feedbackKeys, type EventFeedbacksResponse } from "../api";

/**
 * GET /events/:id/feedbacks（MANIFEST.md 6章 #23）。
 * P-03のレビュー一覧（`FeedbackList`）とP-08（`FeedbackPage`、自分の既存投稿の検出用）の
 * 両方から参照される共通フック。
 */
export function useEventFeedbacks(eventId: string) {
  return useQuery({
    queryKey: feedbackKeys.byEvent(eventId),
    queryFn: () => apiClient.get<EventFeedbacksResponse>(`/events/${eventId}/feedbacks`),
    enabled: eventId !== "",
  });
}
