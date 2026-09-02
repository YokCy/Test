import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { attendanceKeys, type AttendanceStatus, type RegistrationRow } from "../api";

interface MarkAttendanceInput {
  userId: string;
  attendanceStatus: Exclude<AttendanceStatus, null>;
}

/**
 * PUT /events/:id/registrations/:userId/attendance（MANIFEST.md 6章 #22）。
 * WHY: 楽観的更新はせず（画面設計仕様.md 3.4）、成功後に一覧を再取得して最新の出席状態を反映する。
 */
export function useMarkAttendance(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, attendanceStatus }: MarkAttendanceInput) =>
      apiClient.put<RegistrationRow>(`/events/${eventId}/registrations/${userId}/attendance`, {
        attendanceStatus,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.list(eventId) });
    },
  });
}
