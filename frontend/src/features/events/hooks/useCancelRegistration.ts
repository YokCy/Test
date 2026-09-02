import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { eventKeys } from "../api";

/**
 * POST /events/:id/cancel（本人による自己キャンセル、bodyは空オブジェクト）。
 * `userId`指定によるadmin強制キャンセルは出席管理画面（別担当実装）専用のため、ここでは扱わない。
 * WHY: 楽観的更新はせず、繰り上げ結果を含むサーバー側の最新状態を再取得する（画面設計仕様.md 3.4）。
 */
export function useCancelRegistration(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<Record<string, never>>(`/events/${eventId}/cancel`, {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: eventKeys.all }),
        queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) }),
      ]);
    },
  });
}
