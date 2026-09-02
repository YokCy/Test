import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Spinner } from "../../../components/ui/Spinner";
import type { EventListFilters } from "../api";
import { useEvents } from "../hooks/useEvents";

import { EventCard } from "./EventCard";

const SORT_OPTIONS: { value: NonNullable<EventListFilters["sort"]>; label: string }[] = [
  { value: "startAtAsc", label: "開催日が近い順" },
  { value: "startAtDesc", label: "開催日が遠い順" },
];

/**
 * P-02イベント一覧画面（`/events`、画面設計仕様.md 3.1.2）。
 * WHY(3.4節): 一覧はサーバーサイドページネーションを導入せず全件取得のうえキーワード・タグ絞り込みは
 * `GET /events`のクエリパラメータとしてサーバー側に渡す（フロント側での再フィルタはしない）。
 * カテゴリ絞り込み・「＋新規作成」導線はカテゴリマスタ・作成画面（別担当実装）に依存するため、
 * ここではキーワード・タグ・ソートのみを実装する（詳細は本エージェントの最終報告を参照）。
 */
export function EventsListPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [tags, setTags] = useState("");
  const [sort, setSort] = useState<NonNullable<EventListFilters["sort"]>>("startAtAsc");

  const filters: EventListFilters = {
    keyword: keyword.trim() || undefined,
    tags: tags.trim() || undefined,
    sort,
  };
  const { data: events, isLoading, isError } = useEvents(filters);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">イベント一覧</h1>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
          }}
          placeholder="キーワード検索"
          aria-label="キーワード検索"
          className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={tags}
          onChange={(event) => {
            setTags(event.target.value);
          }}
          placeholder="タグ（カンマ区切り）"
          aria-label="タグ検索"
          className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as NonNullable<EventListFilters["sort"]>);
          }}
          aria-label="開催日順ソート"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {isError && <p className="text-sm text-red-600">イベント一覧の取得に失敗しました。</p>}

      {events && events.length === 0 && (
        <p className="text-sm text-slate-500">該当するイベントがありません。</p>
      )}

      {events && events.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onOpenDetail={(eventId) => {
                navigate(`/events/${eventId}`);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
