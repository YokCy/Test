// WHY(CODING_STANDARDS.md 2章「カスタムフック」): Query Keyは配列形式で階層化し、
// features/*/api.ts に集約する（コンポーネントから直接useQuery/useMutationを呼ばせないための一元管理）。
export const feedbackKeys = {
  all: ["feedbacks"] as const,
  byEvent: (eventId: string) => [...feedbackKeys.all, "event", eventId] as const,
};

/**
 * GET /events/:id/feedbacks の1件分（MANIFEST.md 6章 #23）。
 * - `author`は匿名投稿かつ非adminの場合`null`（一般ユーザーには「匿名希望」等の固定文言で表示する）。
 * - `isHidden`はadmin閲覧時のみ含まれる（非adminは非公開分自体がサーバー側で除外されるため見えない）。
 */
export interface FeedbackAuthor {
  id: string;
  name: string;
}

export interface FeedbackItem {
  id: string;
  rating: number;
  comment: string;
  isAnonymous: boolean;
  author: FeedbackAuthor | null;
  /** adminがこのエンドポイントを叩いた場合のみ含まれる。 */
  isHidden?: boolean;
}

export interface EventFeedbacksResponse {
  averageRating: number | null;
  feedbacks: FeedbackItem[];
}
