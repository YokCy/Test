// WHY(CODING_STANDARDS.md 2章「カスタムフック」): Query Keyは配列形式で階層化し、
// features/*/api.ts に集約する（コンポーネントから直接useQuery/useMutationを呼ばせないための一元管理）。
export const authKeys = {
  me: ["auth", "me"] as const,
};

/** GET /auth/me, POST /auth/login, PUT /auth/profile のレスポンス形（backend SafeUser） */
export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
}
