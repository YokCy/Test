import { Spinner } from "../../../components/ui/Spinner";
import { useMyEvents } from "../hooks/useMyEvents";
import { useMyStats } from "../hooks/useMyStats";

import { MyPageTabs } from "./MyPageTabs";
import { StatsSummary } from "./StatsSummary";

/** P-06 マイページ（`/my-page`、画面設計仕様.md 3.1.5）。 */
export function MyPage() {
  const { data: events, isLoading: isEventsLoading, isError: isEventsError } = useMyEvents();
  const { data: stats, isLoading: isStatsLoading, isError: isStatsError } = useMyStats();

  const isLoading = isEventsLoading || isStatsLoading;
  const isError = isEventsError || isStatsError;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !events || !stats) {
    return <p className="py-12 text-center text-sm text-slate-500">情報の取得に失敗しました</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">マイページ</h1>
      <StatsSummary stats={stats} />
      <MyPageTabs events={events} />
    </div>
  );
}
