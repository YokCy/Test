import { dayjs } from "../../../lib/dayjs";
import type { EventSummary } from "../api";

import { CategoryBadge } from "./CategoryBadge";

type EventCardProps = {
  event: EventSummary;
  onOpenDetail: (eventId: string) => void;
};

/**
 * P-02イベント一覧画面（画面設計仕様.md 3.1.2）のカード1件。
 * WHY: 空き状況表示（「残り n/capacity名」/「満席(キャンセル待ち)」）は`confirmedCount`/`capacity`から
 * 導出する表示専用ロジックであり、フロント側で独自に定員判定（登録可否等）はしない。
 */
export function EventCard({ event, onOpenDetail }: EventCardProps) {
  const remaining = event.capacity - event.confirmedCount;
  const availabilityLabel = remaining > 0 ? `残り ${remaining}/${event.capacity}名` : "満席(キャンセル待ち)";

  return (
    <button
      type="button"
      onClick={() => {
        onOpenDetail(event.id);
      }}
      className="flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:shadow-md"
    >
      <CategoryBadge category={event.category} />
      <p className="line-clamp-2 font-medium text-slate-900">{event.title}</p>
      <p className="text-sm text-slate-500">{dayjs(event.startAt).tz().format("MM/DD(ddd) HH:mm")}〜</p>
      <p className="text-sm text-slate-600">{availabilityLabel}</p>
    </button>
  );
}
