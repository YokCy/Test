import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Spinner } from "../../../components/ui/Spinner";
import { apiClient } from "../../../lib/api-client";
import { dayjs } from "../../../lib/dayjs";
import { useMe } from "../../auth/hooks/useMe";
import type { AttendanceStatus } from "../api";
import { useForceCancelRegistration } from "../hooks/useForceCancelRegistration";
import { useMarkAttendance } from "../hooks/useMarkAttendance";
import { useRegistrations } from "../hooks/useRegistrations";

import { AttendanceRow } from "./AttendanceRow";
import { ForceCancelConfirmModal } from "./ForceCancelConfirmModal";

/**
 * GET /events/:id のうち、本画面のヘッダー表示（タイトル・開催日時）に必要な部分だけを取得する
 * ローカル専用の型・フック。
 * WHY: `features/events/`は並行実装中の別担当領域のため、本機能はそこに依存せず、
 * このファイル内で直接叩く（多少のレスポンス型の重複は意図的に許容する）。
 */
interface AttendanceEventHeader {
  title: string;
  startAt: string;
}

function useAttendanceEventHeader(eventId: string) {
  return useQuery({
    queryKey: ["attendance", "event-header", eventId] as const,
    queryFn: () => apiClient.get<AttendanceEventHeader>(`/events/${eventId}`),
  });
}

/** P-07 出席管理画面（画面設計仕様.md 3.1.6、`/events/:eventId/attendance`）。 */
export function AttendancePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: me } = useMe();
  const [forceCancelTarget, setForceCancelTarget] = useState<{ userId: string; name: string } | null>(null);

  const eventHeaderQuery = useAttendanceEventHeader(eventId ?? "");
  const registrationsQuery = useRegistrations(eventId ?? "");
  const markAttendance = useMarkAttendance(eventId ?? "");
  const forceCancel = useForceCancelRegistration(eventId ?? "");

  if (!eventId) {
    return null;
  }

  if (eventHeaderQuery.isLoading || registrationsQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (eventHeaderQuery.isError || registrationsQuery.isError || !eventHeaderQuery.data || !registrationsQuery.data) {
    return <p className="p-6 text-sm text-red-600">出席管理情報の取得に失敗しました。</p>;
  }

  const event = eventHeaderQuery.data;
  const registrations = registrationsQuery.data;
  const isAdmin = me?.role === "ADMIN";
  // WHY(MANIFEST.md 3.5節): 開催日時（startAt）に達する前の出席マークは禁止（now < event.startAt なら400）。
  // サーバーの判定と表示を一致させるため、フロントでも同じ条件で事前にボタンを無効化する。
  const isMarkingDisabled = dayjs().isBefore(dayjs(event.startAt));
  const formattedStartAt = dayjs(event.startAt).tz().format("YYYY-MM-DD HH:mm");

  const handleMark = (userId: string, attendanceStatus: Exclude<AttendanceStatus, null>) => {
    markAttendance.mutate({ userId, attendanceStatus });
  };

  const handleForceCancelRequest = (userId: string, name: string) => {
    setForceCancelTarget({ userId, name });
  };

  const handleForceCancelConfirm = () => {
    if (!forceCancelTarget) {
      return;
    }
    forceCancel.mutate(forceCancelTarget.userId, {
      onSuccess: () => setForceCancelTarget(null),
    });
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to={`/events/${eventId}`} className="text-sm text-blue-600 hover:underline">
        ← イベント詳細へ
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-slate-900">{event.title} の出席管理</h1>

      <p className="mt-2 text-sm text-slate-600">
        開催日時: {formattedStartAt}
        （本日{formattedStartAt}以降にマーク操作が有効になります）
      </p>

      <div className="mt-6">
        {registrations.length === 0 ? (
          <p className="text-sm text-slate-500">参加者がいません。</p>
        ) : (
          registrations.map((registration) => (
            <AttendanceRow
              key={registration.userId}
              registration={registration}
              isMarkingDisabled={isMarkingDisabled}
              isMarkPending={markAttendance.isPending && markAttendance.variables?.userId === registration.userId}
              onMark={handleMark}
              canForceCancel={isAdmin}
              onForceCancel={handleForceCancelRequest}
            />
          ))
        )}
      </div>

      <ForceCancelConfirmModal
        isOpen={forceCancelTarget !== null}
        targetName={forceCancelTarget?.name ?? null}
        isConfirming={forceCancel.isPending}
        onConfirm={handleForceCancelConfirm}
        onCancel={() => setForceCancelTarget(null)}
      />
    </div>
  );
}
