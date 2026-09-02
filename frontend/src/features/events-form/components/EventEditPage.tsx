import type { CreateEventInput } from "@eventboard/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { ApiError, apiClient } from "../../../lib/api-client";
import type { EventForEdit } from "../api";
import { useUpdateEvent } from "../hooks/useUpdateEvent";

import { DeleteEventConfirmModal } from "./DeleteEventConfirmModal";
import { EventForm } from "./EventForm";
import { StartAtChangeWarningModal } from "./StartAtChangeWarningModal";

/**
 * イベント編集フォームの初期化に必要な項目を`GET /events/:id`から取得するだけのローカルフック。
 * WHY: features/events側のuseEventDetail（同じエンドポイントを叩く）とはあえて共有せず、
 * このfeatureが単独で完結するようにする（features間の非依存という方針、多少の重複は許容する）。
 */
function useEventForEdit(eventId: string) {
  return useQuery({
    queryKey: ["events-form", "edit", eventId],
    queryFn: () => apiClient.get<EventForEdit>(`/events/${eventId}`),
  });
}

function toFormDefaults(event: EventForEdit): CreateEventInput {
  return {
    title: event.title,
    description: event.description ?? "",
    categoryId: event.category.id,
    tags: event.tags,
    startAt: event.startAt,
    // WHY: 空欄の任意日時項目はundefinedにする必要がある（EventForm.tsx冒頭のコメント参照。
    // ""のままだとzodResolver(CreateEventSchema)の`.datetime()`検証に落ちてしまう）。
    endAt: event.endAt ?? undefined,
    capacity: event.capacity,
    registrationDeadline: event.registrationDeadline ?? undefined,
    cancellationDeadline: event.cancellationDeadline ?? undefined,
  };
}

/**
 * P-05 イベント編集画面（`/events/:eventId/edit`、画面設計仕様.md 1章P-05行・3.1.4節）。
 * P-04と同一の`EventForm`を、取得したイベント情報で初期化して使い回す。
 */
export function EventEditPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading, error } = useEventForEdit(eventId ?? "");
  const updateEvent = useUpdateEvent(eventId ?? "");

  const [showStartAtWarning, setShowStartAtWarning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (data: CreateEventInput) => {
    const result = await updateEvent.mutateAsync(data);
    if (result.hasRegisteredParticipants) {
      // WHY: 更新自体は既にこの時点で確定済み（StartAtChangeWarningModal.tsxのコメント参照）。
      setShowStartAtWarning(true);
      return;
    }
    navigate(`/events/${result.id}`);
  };

  if (!eventId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !event) {
    const message =
      error instanceof ApiError ? error.message : "イベント情報の取得に失敗しました";
    return <p className="text-sm text-red-600">{message}</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(`/events/${eventId}`)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← 戻る
        </button>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">イベントを編集</h1>
      </div>

      <EventForm
        defaultValues={toFormDefaults(event)}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/events/${eventId}`)}
        submitLabel="保存する"
      />

      <div className="border-t border-slate-200 pt-4 text-right">
        <Button variant="danger" type="button" onClick={() => setShowDeleteConfirm(true)}>
          このイベントを削除
        </Button>
      </div>

      <StartAtChangeWarningModal
        isOpen={showStartAtWarning}
        onContinue={() => navigate(`/events/${eventId}`)}
        onBack={() => setShowStartAtWarning(false)}
      />

      <DeleteEventConfirmModal
        isOpen={showDeleteConfirm}
        eventId={eventId}
        onCancel={() => setShowDeleteConfirm(false)}
        onDeleted={() => navigate("/events")}
      />
    </div>
  );
}
