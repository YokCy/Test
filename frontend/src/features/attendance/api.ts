// WHY(CODING_STANDARDS.md 2章「カスタムフック」): Query Keyは配列形式で階層化し、
// features/*/api.ts に集約する（features/auth/api.tsのauthKeys、features/events/api.tsのeventKeysと同じ方針）。

/** 出席状態。未マークは`null`（MANIFEST.md 5章「データモデリング」）。 */
export type AttendanceStatus = "ATTENDED" | "ABSENT" | null;

export const attendanceKeys = {
  all: ["attendance"] as const,
  list: (eventId: string) => [...attendanceKeys.all, "list", eventId] as const,
};

/** GET /events/:id/registrations の配列要素の形（MANIFEST.md 6章 #21）。 */
export interface RegistrationRow {
  userId: string;
  name: string;
  status: "CONFIRMED";
  attendanceStatus: AttendanceStatus;
}
