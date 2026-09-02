import { Link } from "react-router-dom";

import type { OrganizingItem } from "../api";
import { formatEventDateTime } from "../utils/formatEventDateTime";

type OrganizingEventRowProps = {
  event: OrganizingItem;
};

/**
 * 「主催イベント」タブの1行。
 * WHY(capacityが無い件): `OrganizingItem`には`capacity`が含まれず「参加者{confirmedCount}/{capacity}」
 * という画面設計仕様.md 3.1.5の表示例通りには描画できないため、代わりに確定・キャンセル待ちの
 * 人数をそのまま表示する（バックエンドのレスポンス設計の見直しが必要であれば別途検討する）。
 */
export function OrganizingEventRow({ event }: OrganizingEventRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{event.title}</p>
        <p className="text-sm text-slate-500">
          {event.category.name}
          {"　"}
          {formatEventDateTime(event.startAt)}
          {"　"}
          確定 {event.confirmedCount}名・キャンセル待ち {event.waitlistedCount}名
        </p>
      </div>
      <Link
        to={`/events/${event.id}`}
        className="shrink-0 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-200"
      >
        管理
      </Link>
    </div>
  );
}
