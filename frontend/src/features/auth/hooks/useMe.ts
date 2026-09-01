import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../../lib/api-client";
import { authKeys, type MeResponse } from "../api";

/**
 * ログイン状態・ユーザー情報・ロールを提供する。`ProtectedRoute`/`AdminRoute`/`Header`が共通で参照し、
 * TanStack Queryのキャッシュ経由で同一リクエストを使い回す（同じqueryKeyのため二重fetchされない）。
 * WHY(retry: false): 未ログイン時の401はlib/api-client.tsが既にリフレッシュ試行込みで判定済みのため、
 * ここでさらにリトライしても無意味に待ち時間が伸びるだけになる。
 */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => apiClient.get<MeResponse>("/auth/me"),
    retry: false,
  });
}
