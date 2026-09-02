// WHY(CODING_STANDARDS.md 2章「カスタムフック」): Query Keyは配列形式で階層化し、
// features/*/api.ts に集約する（features/auth/api.tsのauthKeysと同じ方針）。
//
// WHY(このfeatureはfeatures/eventsとは意図的に非依存): 本featureは作成・編集・削除の
// ミューテーションのみを担当し、一覧・詳細・参加登録は別エージェントが実装するfeatures/events
// が担当する。互いにimportし合わないという方針のため、GET /events/:idのレスポンス型やカテゴリの
// 型がfeatures/events側と重複定義になるが、これは意図的なトレードオフ（疎結合を優先）。

export const eventFormKeys = {
  categoryOptions: ["categories", "options"] as const,
};

/** GET /categories の配列要素の形。 */
export interface CategoryOption {
  id: string;
  name: string;
  eventCount: number;
}

export interface EventFormCategory {
  id: string;
  name: string;
}

/**
 * POST /events・PUT /events/:id の共通レスポンス形（MANIFEST.md 6章 #15/#17）。
 * `hasRegisteredParticipants`はPUTのみ、かつ`startAt`変更時にCONFIRMED登録者が1人以上いる場合のみ含まれる。
 */
export interface EventMutationResult {
  id: string;
  title: string;
  description: string | null;
  category: EventFormCategory;
  tags: string[];
  startAt: string;
  endAt: string | null;
  capacity: number;
  registrationDeadline: string | null;
  cancellationDeadline: string | null;
  hasRegisteredParticipants?: boolean;
}

/**
 * GET /events/:id のレスポンスのうち、編集フォームの初期化に必要な項目のみを最小限抜粋した形。
 * features/events/api.tsのEventDetailと重複するが、features間を非依存に保つための意図的な重複。
 */
export interface EventForEdit {
  id: string;
  title: string;
  description: string | null;
  category: EventFormCategory;
  tags: string[];
  startAt: string;
  endAt: string | null;
  capacity: number;
  registrationDeadline: string | null;
  cancellationDeadline: string | null;
}
