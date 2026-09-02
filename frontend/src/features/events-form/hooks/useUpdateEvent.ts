import type { UpdateEventInput } from "@eventboard/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { eventKeys } from "../../events/api";
import type { EventMutationResult } from "../api";

/**
 * PUT /events/:id（MANIFEST.md 6章 #17）。部分更新可。
 * `startAt`変更時にCONFIRMED登録者が1人以上いれば、レスポンスに`hasRegisteredParticipants: true`が
 * 含まれる（更新自体は既に確定済み。呼び出し元がこのフラグを見てM-08警告モーダルを表示する）。
 * WHY: `features/events`が所有する一覧・詳細のキャッシュを無効化しないと、編集後にP-03へ戻っても
 * 古い内容のまま表示されてしまう（統合時に追加）。
 */
export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateEventInput) =>
      apiClient.put<EventMutationResult>(`/events/${eventId}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
