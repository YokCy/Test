import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { eventKeys } from "../../events/api";

/** DELETE /events/:id（MANIFEST.md 6章 #18）。論理削除。主催者本人・adminのみ実行可。 */
export function useDeleteEvent(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.delete<void>(`/events/${eventId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
