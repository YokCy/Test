import type { CreateEventInput } from "@eventboard/shared";
import { useNavigate } from "react-router-dom";

import { useCreateEvent } from "../hooks/useCreateEvent";

import { EventForm } from "./EventForm";

/**
 * P-04 イベント作成画面（`/events/new`、画面設計仕様.md 1章P-04行・3.1.4節）。
 * 作成成功時はP-03（イベント詳細）へ遷移する（作成者が自動的に主催者になるため、直後に詳細を
 * 確認できるようにする）。
 */
export function EventCreatePage() {
  const navigate = useNavigate();
  const createEvent = useCreateEvent();

  const handleSubmit = async (data: CreateEventInput) => {
    const created = await createEvent.mutateAsync(data);
    navigate(`/events/${created.id}`);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← 戻る
        </button>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">イベントを作成</h1>
      </div>

      <EventForm onSubmit={handleSubmit} onCancel={() => navigate(-1)} submitLabel="保存する" />
    </div>
  );
}
