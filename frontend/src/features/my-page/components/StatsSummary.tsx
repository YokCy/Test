import type { MyStatsResponse } from "../api";

type StatsSummaryProps = {
  stats: MyStatsResponse;
};

/**
 * 累計参加数・出席率・カテゴリ別集計（画面設計仕様.md 3.1.5）。
 * WHY(attendanceRateがnullの場合): 出席マーク済みの登録が1件も無いユーザー（例: 参加登録したばかりの
 * 新入社員）はゼロ除算になるため、バックエンドが`null`を返す。「0%」ではなく「―」を表示し、
 * 「出席実績がまだ無い」ことと「出席率0%」を混同させない。
 */
export function StatsSummary({ stats }: StatsSummaryProps) {
  const attendanceRateLabel =
    stats.attendanceRate === null ? "―" : `${Math.round(stats.attendanceRate * 100)}%`;

  return (
    <div className="space-y-1 rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-700">
        累計参加数: {stats.totalParticipations}件{"　"}出席率: {attendanceRateLabel}
      </p>
      {stats.byCategory.length > 0 ? (
        <p className="text-sm text-slate-500">
          カテゴリ別: {stats.byCategory.map((c) => `${c.category}${c.count}`).join(" / ")}
        </p>
      ) : (
        <p className="text-sm text-slate-500">カテゴリ別: データなし</p>
      )}
    </div>
  );
}
