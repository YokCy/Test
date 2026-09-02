import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { feedbackKeys, type FeedbackItem } from "../api";

/**
 * POST /feedbacks/:id/hide（MANIFEST.md 6章 #26、adminのみ）。
 * 非公開化は取り消し不可（一方向）のため、呼び出し元（`FeedbackList`）で
 * `ConfirmDialog`による確認を必ず挟む。
 */
export function useHideFeedback(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedbackId: string) => apiClient.post<FeedbackItem>(`/feedbacks/${feedbackId}/hide`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feedbackKeys.byEvent(eventId) });
    },
  });
}
