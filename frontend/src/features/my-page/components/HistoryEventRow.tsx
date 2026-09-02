import { Link } from "react-router-dom";

import type { HistoryItem } from "../api";
import { formatEventDateTime } from "../utils/formatEventDateTime";

type HistoryEventRowProps = {
  event: HistoryItem;
};

/** 出席マーク状態に応じたバッジ文言・配色。`null`（未マーク）はまだ主催者がマークしていない状態。 */
function getAttendanceBadge(status: HistoryItem["attendanceStatus"]): { label: string; className: string } {
  if (status === "ATTENDED") {
    return { label: "出席", className: "bg-emerald-100 text-emerald-700" };
  }
  if (status === "ABSENT") {
    return { label: "欠席", className: "bg-red-100 text-red-700" };
  }
  return { label: "未マーク", className: "bg-slate-100 text-slate-500" };
}

/** 「参加履歴」タブの1行。 */
export function HistoryEventRow({ event }: HistoryEventRowProps) {
  const badge = getAttendanceBadge(event.attendanceStatus);

  return (
    <Link
      to={`/events/${event.id}`}
      className="flex items-center justify-between gap-4 py-3 hover:bg-slate-50"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{event.title}</p>
        <p className="text-sm text-slate-500">
          {event.category.name}
          {"　"}
          {formatEventDateTime(event.startAt)}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    </Link>
  );
}
