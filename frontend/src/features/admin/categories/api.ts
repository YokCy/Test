// WHY(CODING_STANDARDS.md 2章「カスタムフック」): Query Keyは配列形式で階層化し、
// features/*/api.ts に集約する（features/auth/api.tsのauthKeys、features/events/api.tsのeventKeysと同じ方針）。
export const categoryKeys = {
  all: ["categories"] as const,
  list: () => [...categoryKeys.all, "list"] as const,
};

/**
 * GET /categories の配列要素の形（MANIFEST.md 6章 #10）。
 * `eventCount`は紐づくイベント数（論理削除済みも含む）で、削除可否をユーザーが事前に把握するための
 * 参考表示にのみ使う（画面設計仕様.md 3.1.8節。この値を根拠に削除ボタンを無効化はしない）。
 */
export interface CategoryListItem {
  id: string;
  name: string;
  eventCount: number;
}

/** POST /categories, PUT /categories/:id のレスポンス形（MANIFEST.md 6章 #11, #12）。 */
export interface CategoryDetail {
  id: string;
  name: string;
}
