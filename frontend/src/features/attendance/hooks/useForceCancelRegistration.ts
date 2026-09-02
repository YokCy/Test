import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { attendanceKeys } from "../api";

/**
 * POST /events/:id/cancel（`userId`指定によるadmin強制キャンセル、MANIFEST.md 6章 #20）。
 * 本人によるキャンセル可能期限を無視して取り消す、admin専用の操作。
 * 自己キャンセル（`features/events/hooks/useCancelRegistration.ts`）とは別モジュールで扱う
 * （出席管理画面（P-07）専用のadmin強制パスであるため）。
 */
export function useForceCancelRegistration(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.post<Record<string, never>>(`/events/${eventId}/cancel`, { userId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.list(eventId) });
    },
  });
}
