// WHY(CODING_STANDARDS.md 2章「カスタムフック」): Query Keyは配列形式で階層化し、
// features/*/api.ts に集約する（features/auth/api.tsのauthKeysと同じ方針）。

/** GET /events のクエリパラメータ（フロントの絞り込みUIの状態をそのままAPIへ渡す）。 */
export interface EventListFilters {
  category?: string | undefined;
  keyword?: string | undefined;
  tags?: string | undefined;
  sort?: "startAtAsc" | "startAtDesc" | undefined;
}

export const eventKeys = {
  all: ["events"] as const,
  list: (filters: EventListFilters) => [...eventKeys.all, "list", filters] as const,
  detail: (eventId: string) => [...eventKeys.all, "detail", eventId] as const,
};

/** 参加登録状態。3.2節の状態遷移図・3.1.3節の表示切り替えの唯一の判定材料（フロントで再計算しない）。 */
export type RegistrationState = "NOT_REGISTERED" | "CONFIRMED" | "WAITLISTED" | "ORGANIZER" | "CLOSED";

export interface CategorySummary {
  id: string;
  name: string;
}

/** GET /events の配列要素の形。 */
export interface EventSummary {
  id: string;
  title: string;
  category: CategorySummary;
  startAt: string;
  capacity: number;
  confirmedCount: number;
  registrationState: RegistrationState;
}

/** GET /events/:id のレスポンス形。 */
export interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  category: CategorySummary;
  tags: string[];
  organizer: { id: string; name: string };
  startAt: string;
  endAt: string | null;
  capacity: number;
  confirmedCount: number;
  waitlistedCount: number;
  registrationDeadline: string | null;
  cancellationDeadline: string | null;
  registrationState: RegistrationState;
  averageRating: number | null;
  feedbackCount: number;
}

/** POST /events/:id/register のレスポンス形。 */
export interface RegisterEventResponse {
  status: "CONFIRMED" | "WAITLISTED";
  position: number | null;
}
