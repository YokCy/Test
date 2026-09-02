import type { CreateFeedbackInput } from "@eventboard/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Spinner } from "../../../components/ui/Spinner";
import { apiClient } from "../../../lib/api-client";
import { useEventFeedbacks } from "../hooks/useEventFeedbacks";
import { useSubmitFeedback } from "../hooks/useSubmitFeedback";
import { useUpdateFeedback } from "../hooks/useUpdateFeedback";

import { FeedbackForm } from "./FeedbackForm";

/**
 * GET /events/:id のうち、本画面のヘッダー表示（イベントタイトル）に必要な部分だけを取得する
 * ローカル専用の型・フック。
 * WHY: `features/events/`は並行実装中の別担当領域のため、本機能はそこに依存せず、
 * このファイル内で直接叩く（`features/attendance/AttendancePage.tsx`と同じ方針。多少のレスポンス型の
 * 重複は意図的に許容する）。
 */
interface FeedbackEventHeader {
  title: string;
}

function useFeedbackEventHeader(eventId: string) {
  return useQuery({
    queryKey: ["feedbacks", "event-header", eventId] as const,
    queryFn: () => apiClient.get<FeedbackEventHeader>(`/events/${eventId}`),
    enabled: eventId !== "",
  });
}

/**
 * P-08 フィードバック投稿画面（画面設計仕様.md 3.1.7節、`/events/:eventId/feedback`）。
 * 「投稿済みかどうか」はサーバーが返す`isMine`フラグで判定する（`author`は匿名投稿時`null`になり
 * 本人判定に使えないため、判定専用のフラグとして別途用意されている。以前は`author?.id === me.id`で
 * 判定しており、member自身の匿名投稿を検出できない不具合があったが解消済み）。
 */
export function FeedbackPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [ineligibleMessage, setIneligibleMessage] = useState<string | null>(null);

  const eventHeaderQuery = useFeedbackEventHeader(eventId ?? "");
  const feedbacksQuery = useEventFeedbacks(eventId ?? "");

  const myFeedback = feedbacksQuery.data?.feedbacks.find((feedback) => feedback.isMine);

  const submitFeedback = useSubmitFeedback(eventId ?? "");
  const updateFeedback = useUpdateFeedback(eventId ?? "", myFeedback?.id ?? "");

  if (!eventId) {
    return null;
  }

  if (eventHeaderQuery.isLoading || feedbacksQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const backLink = (
    <Link to={`/events/${eventId}`} className="text-sm text-blue-600 hover:underline">
      ← イベント詳細へ
    </Link>
  );

  if (ineligibleMessage) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
        <p className="text-sm text-slate-600">{ineligibleMessage}</p>
        {backLink}
      </div>
    );
  }

  if (eventHeaderQuery.isError || !eventHeaderQuery.data || feedbacksQuery.isError || !feedbacksQuery.data) {
    return <p className="p-6 text-sm text-red-600">フィードバック投稿画面の情報取得に失敗しました。</p>;
  }

  const isEditMode = Boolean(myFeedback);

  const handleSubmit = async (data: CreateFeedbackInput) => {
    if (myFeedback) {
      await updateFeedback.mutateAsync(data);
    } else {
      await submitFeedback.mutateAsync(data);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      {backLink}
      <h1 className="text-xl font-semibold text-slate-900">{eventHeaderQuery.data.title} のフィードバック</h1>

      <FeedbackForm
        defaultValues={
          myFeedback
            ? { rating: myFeedback.rating, comment: myFeedback.comment, isAnonymous: myFeedback.isAnonymous }
            : undefined
        }
        submitLabel={isEditMode ? "更新する" : "投稿する"}
        onSubmit={handleSubmit}
        onIneligible={setIneligibleMessage}
      />
    </div>
  );
}
