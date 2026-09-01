import type { UpdateProfileInput } from "@eventboard/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { authKeys, type MeResponse } from "../api";

/**
 * PUT /auth/profile。成功時にuseMeのキャッシュを更新後の値で書き換えることで、
 * Header等useMeを参照する箇所の氏名表示を再フェッチなしで再検証する。
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => apiClient.put<MeResponse>("/auth/profile", input),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}
