import { useState } from "react";

import type { MyEventsResponse } from "../api";

import { HistoryEventRow } from "./HistoryEventRow";
import { OrganizingEventRow } from "./OrganizingEventRow";
import { UpcomingEventRow } from "./UpcomingEventRow";

type TabKey = "organizing" | "upcoming" | "history";

const TABS: { key: TabKey; label: string }[] = [
  { key: "organizing", label: "主催イベント" },
  { key: "upcoming", label: "参加予定" },
  { key: "history", label: "参加履歴" },
];

type MyPageTabsProps = {
  events: MyEventsResponse;
};

/**
 * P-06マイページのタブ切り替え（主催イベント/参加予定/参加履歴）。
 * WHY(useState): 画面設計仕様.md 3.1.5の注記の通り、タブ選択はURLクエリ等に反映しないローカルUI状態
 * （CODING_STANDARDS.md 2章「状態管理」の分類に基づく）とする。
 */
export function MyPageTabs({ events }: MyPageTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("organizing");

  return (
    <div>
      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-slate-100">
        {activeTab === "organizing" &&
          (events.organizing.length > 0 ? (
            events.organizing.map((event) => <OrganizingEventRow key={event.id} event={event} />)
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">主催しているイベントはまだありません</p>
          ))}

        {activeTab === "upcoming" &&
          (events.upcoming.length > 0 ? (
            events.upcoming.map((event) => <UpcomingEventRow key={event.id} event={event} />)
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">参加予定のイベントはまだありません</p>
          ))}

        {activeTab === "history" &&
          (events.history.length > 0 ? (
            events.history.map((event) => <HistoryEventRow key={event.id} event={event} />)
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">参加履歴はまだありません</p>
          ))}
      </div>
    </div>
  );
}
