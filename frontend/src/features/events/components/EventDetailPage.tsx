import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Spinner } from "../../../components/ui/Spinner";
import { dayjs } from "../../../lib/dayjs";
import { useMe } from "../../auth/hooks/useMe";
import { DeleteEventConfirmModal } from "../../events-form/components/DeleteEventConfirmModal";
import { FeedbackList } from "../../feedbacks/components/FeedbackList";
import { useEventDetail } from "../hooks/useEventDetail";

import { CategoryBadge } from "./CategoryBadge";
import { RegistrationActionButton } from "./RegistrationActionButton";

function formatDateTime(iso: string): string {
  return dayjs(iso).tz().format("YYYY-MM-DD HH:mm");
}

/**
 * P-03イベント詳細画面（`/events/:eventId`、画面設計仕様.md 3.1.3）。
 *
 * - 参加者一覧はCONFIRMEDのみ表示せず（`GET /events/:id`は参加者の個別氏名一覧を返さないため）、
 *   `confirmedCount`/`capacity`の集計値と、キャンセル待ちの件数バッジ（`waitlistedCount`）のみを表示する。
 *   個々の参加者・待機者の氏名一覧は出席管理画面（P-07、別担当実装）でのみ表示する方針（3.1.3節）に合わせている。
 * - レビュー一覧本体（実データ・「フィードバックを書く」導線）は`features/feedbacks/`（別担当実装）が
 *   後から差し込む前提で、`data-testid="feedback-section-placeholder"`の位置にプレースホルダを残している。
 */
export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading, isError } = useEventDetail(eventId);
  const { data: me } = useMe();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !event) {
    return <p className="text-sm text-red-600">イベント情報の取得に失敗しました。</p>;
  }

  const remaining = event.capacity - event.confirmedCount;
  const canManage = me?.id === event.organizer.id || me?.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => {
          navigate("/events");
        }}
        className="w-fit text-sm text-slate-500 hover:text-slate-700"
      >
        ← イベント一覧へ
      </button>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={event.category} />
          {event.tags.map((tag) => (
            <span key={tag} className="text-sm text-slate-500">
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">{event.title}</h1>
          {canManage && (
            <div className="flex shrink-0 gap-2 text-sm">
              <Link to={`/events/${event.id}/edit`} className="text-blue-600 hover:underline">
                編集
              </Link>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="text-red-600 hover:underline"
              >
                削除
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-600">主催: {event.organizer.name}</p>
        <p className="flex flex-wrap gap-x-6 text-sm text-slate-600">
          <span>
            開催日時: {formatDateTime(event.startAt)}
            {event.endAt && ` 〜 ${formatDateTime(event.endAt)}`}
          </span>
          <span>
            定員: {event.capacity}名(残り {Math.max(remaining, 0)}名)
          </span>
        </p>
        <p className="flex flex-wrap gap-x-6 text-sm text-slate-600">
          {event.registrationDeadline && <span>登録締切: {formatDateTime(event.registrationDeadline)}</span>}
          {event.cancellationDeadline && <span>キャンセル期限: {formatDateTime(event.cancellationDeadline)}</span>}
        </p>
        {event.description && <p className="whitespace-pre-wrap text-sm text-slate-700">{event.description}</p>}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <RegistrationActionButton
          eventId={event.id}
          registrationState={event.registrationState}
          position={event.position}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            参加者一覧（{event.confirmedCount}/{event.capacity}）
          </h2>
          {event.waitlistedCount > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              キャンセル待ち {event.waitlistedCount}名
            </span>
          )}
          {canManage && (
            <Link to={`/events/${event.id}/attendance`} className="ml-auto text-sm text-blue-600 hover:underline">
              出席管理へ
            </Link>
          )}
        </div>
        {/* WHY: GET /events/:idはCONFIRMED参加者の個別氏名一覧を返さないため（3.1.3節の集計方針参照）、
            件数のみを表示する。氏名一覧の表示が必要になった場合は出席管理画面（P-07）を参照する。 */}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <Link to={`/events/${event.id}/feedback`} className="text-sm text-blue-600 hover:underline">
            フィードバックを書く
          </Link>
        </div>
        <FeedbackList eventId={event.id} />
      </div>

      <DeleteEventConfirmModal
        isOpen={isDeleteModalOpen}
        eventId={event.id}
        onCancel={() => setIsDeleteModalOpen(false)}
        onDeleted={() => navigate("/events")}
      />
    </div>
  );
}
