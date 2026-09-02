import type { UpdateFeedbackInput } from "@eventboard/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { feedbackKeys, type FeedbackItem } from "../api";

/**
 * PUT /feedbacks/:id（MANIFEST.md 6章 #25）。投稿者本人のみ実行可能。
 * `eventId`は`GET /events/:id/feedbacks`のキャッシュを再検証するためだけに使う
 * （エンドポイント自体は`feedbackId`のみで特定できるフラットなパス）。
 */
export function useUpdateFeedback(eventId: string, feedbackId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateFeedbackInput) => apiClient.put<FeedbackItem>(`/feedbacks/${feedbackId}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feedbackKeys.byEvent(eventId) });
    },
  });
}
