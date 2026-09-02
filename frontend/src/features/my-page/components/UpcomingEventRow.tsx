import { Link } from "react-router-dom";

import type { UpcomingItem } from "../api";
import { formatEventDateTime } from "../utils/formatEventDateTime";

type UpcomingEventRowProps = {
  event: UpcomingItem;
};

/** 参加登録状態に応じたバッジ文言。キャンセル待ちの場合は順番も併記する。 */
function formatStatusLabel(event: UpcomingItem): string {
  if (event.status === "WAITLISTED") {
    return event.position !== null ? `キャンセル待ち ${event.position}番目` : "キャンセル待ち";
  }
  return "参加確定";
}

/** 「参加予定」タブの1行。 */
export function UpcomingEventRow({ event }: UpcomingEventRowProps) {
  const isWaitlisted = event.status === "WAITLISTED";

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
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          isWaitlisted ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {formatStatusLabel(event)}
      </span>
    </Link>
  );
}
