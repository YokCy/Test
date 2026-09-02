import type { CreateEventInput } from "@eventboard/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { eventKeys } from "../../events/api";
import type { EventMutationResult } from "../api";

/**
 * POST /events（MANIFEST.md 6章 #15）。作成者が自動的に主催者になる。
 * WHY: 一覧画面は`features/events`が所有するクエリキー（`eventKeys.all`）でキャッシュされているため、
 * 作成後にそちらを無効化しないと新規イベントが一覧に反映されない（統合時に追加）。
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEventInput) => apiClient.post<EventMutationResult>("/events", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
