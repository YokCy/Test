import type { CreateFeedbackInput } from "@eventboard/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { feedbackKeys, type FeedbackItem } from "../api";

/** POST /events/:id/feedbacks（MANIFEST.md 6章 #24）。投稿条件未充足時は`403`が返る。 */
export function useSubmitFeedback(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFeedbackInput) =>
      apiClient.post<FeedbackItem>(`/events/${eventId}/feedbacks`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feedbackKeys.byEvent(eventId) });
    },
  });
}
