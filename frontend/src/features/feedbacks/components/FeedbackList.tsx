import { useState } from "react";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Spinner } from "../../../components/ui/Spinner";
import { useMe } from "../../auth/hooks/useMe";
import type { FeedbackItem } from "../api";
import { useEventFeedbacks } from "../hooks/useEventFeedbacks";
import { useHideFeedback } from "../hooks/useHideFeedback";

type FeedbackListProps = {
  eventId: string;
};

const FULL_STAR = "★";
const EMPTY_STAR = "☆";

function renderStars(rating: number): string {
  return FULL_STAR.repeat(rating) + EMPTY_STAR.repeat(5 - rating);
}

/**
 * P-03イベント詳細画面のレビュー一覧欄（画面設計仕様.md 3.1.3節、M-06）。
 * `eventId`のみを受け取り、フィードバックの取得・平均評価表示・匿名/非公開表示の出し分け・
 * admin向け非公開化操作までを自己完結で行う（`EventDetailPage`からは`<FeedbackList eventId={eventId} />`として
 * そのまま埋め込める設計）。
 */
export function FeedbackList({ eventId }: FeedbackListProps) {
  const { data: me } = useMe();
  const { data, isLoading, isError } = useEventFeedbacks(eventId);
  const hideFeedback = useHideFeedback(eventId);
  const [hideTarget, setHideTarget] = useState<FeedbackItem | null>(null);

  const isAdmin = me?.role === "ADMIN";

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-red-600">レビューの取得に失敗しました。</p>;
  }

  const handleConfirmHide = async () => {
    if (!hideTarget) {
      return;
    }
    await hideFeedback.mutateAsync(hideTarget.id);
    setHideTarget(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-slate-700">
        レビュー（平均 {data.averageRating !== null ? `★${data.averageRating.toFixed(1)}` : "評価なし"}、
        {data.feedbacks.length}件）
      </p>

      {data.feedbacks.length === 0 ? (
        <p className="text-sm text-slate-500">まだフィードバックが投稿されていません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.feedbacks.map((feedback) => (
            <li
              key={feedback.id}
              className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3"
            >
              <div>
                <p className="text-sm tracking-wide text-yellow-500" aria-label={`評価${feedback.rating}`}>
                  {renderStars(feedback.rating)}
                </p>
                <p className="mt-1 text-sm text-slate-700">{feedback.comment}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {/* WHY(画面設計仕様.md 3.4節): 匿名投稿は一般ユーザーに投稿者名を出さず固定文言にする。
                      adminは常に実名が返るため（MANIFEST.md 6章 #23）、isAnonymousの場合はその横に
                      「（匿名投稿）」を添えてadmin自身への注意喚起とする。 */}
                  {feedback.author ? feedback.author.name : "匿名希望"}
                  {isAdmin && feedback.isAnonymous ? "（匿名投稿）" : ""}
                </p>
              </div>

              {isAdmin && !feedback.isHidden && (
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-red-600 hover:underline"
                  onClick={() => setHideTarget(feedback)}
                >
                  非公開化
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={hideTarget !== null}
        title="フィードバックの非公開化"
        message="このフィードバックを非公開化します。非公開化したフィードバックは元に戻せません。よろしいですか？"
        confirmLabel="非公開化する"
        isDanger
        isConfirming={hideFeedback.isPending}
        onConfirm={() => void handleConfirmHide()}
        onCancel={() => setHideTarget(null)}
      />
    </div>
  );
}
