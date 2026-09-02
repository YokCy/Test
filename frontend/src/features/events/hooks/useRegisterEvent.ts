import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { eventKeys, type RegisterEventResponse } from "../api";

/**
 * POST /events/:id/register。
 * WHY(画面設計仕様.md 3.4「楽観的UI更新は採用しない」): 定員判定・繰り上げはサーバー側でのみ確定するため、
 * レスポンスを待ってから一覧・詳細の両クエリをinvalidateし、サーバーの最新状態で再描画する。
 */
export function useRegisterEvent(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post<RegisterEventResponse>(`/events/${eventId}/register`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: eventKeys.all }),
        queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) }),
      ]);
    },
  });
}
