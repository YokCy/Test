// WHY(CODING_STANDARDS.md 2章「カスタムフック」): Query Keyは配列形式で階層化し、
// features/*/api.ts に集約する（features/auth/api.tsのauthKeysと同じ方針）。

export const myPageKeys = {
  all: ["my-page"] as const,
  events: () => [...myPageKeys.all, "events"] as const,
  stats: () => [...myPageKeys.all, "stats"] as const,
};

export interface MyPageCategorySummary {
  id: string;
  name: string;
}

/** GET /users/me/events の`organizing`要素の形。 */
export interface OrganizingItem {
  id: string;
  title: string;
  startAt: string;
  category: MyPageCategorySummary;
  confirmedCount: number;
  waitlistedCount: number;
}

/** GET /users/me/events の`upcoming`要素の形。`position`は`status === "WAITLISTED"`の場合のみ意味を持つ。 */
export interface UpcomingItem {
  id: string;
  title: string;
  startAt: string;
  category: MyPageCategorySummary;
  status: "CONFIRMED" | "WAITLISTED";
  position: number | null;
}

/** GET /users/me/events の`history`要素の形。`attendanceStatus`が`null`の場合は未マーク。 */
export interface HistoryItem {
  id: string;
  title: string;
  startAt: string;
  category: MyPageCategorySummary;
  attendanceStatus: "ATTENDED" | "ABSENT" | null;
}

/** GET /users/me/events のレスポンス形。 */
export interface MyEventsResponse {
  organizing: OrganizingItem[];
  upcoming: UpcomingItem[];
  history: HistoryItem[];
}

export interface CategoryStat {
  category: string;
  count: number;
}

/**
 * GET /users/me/stats のレスポンス形。
 * `attendanceRate`は0〜1の割合（未マーク分を除いた出席済み登録に対する出席率）で、
 * 出席マーク済みの登録が1件も無い場合は`null`になる（画面側でNaN%表示にならないよう分岐する）。
 */
export interface MyStatsResponse {
  totalParticipations: number;
  attendanceRate: number | null;
  byCategory: CategoryStat[];
}
