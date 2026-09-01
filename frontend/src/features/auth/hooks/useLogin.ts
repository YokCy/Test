import type { LoginInput } from "@eventboard/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { authKeys, type MeResponse } from "../api";

/** POST /auth/login。成功時のレスポンスをそのまま`useMe`のキャッシュへ書き込み、直後の再フェッチを不要にする。 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => apiClient.post<MeResponse>("/auth/login", input),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}
