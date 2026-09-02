import type { CreateFeedbackInput } from "@eventboard/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Spinner } from "../../../components/ui/Spinner";
import { apiClient } from "../../../lib/api-client";
import { useMe } from "../../auth/hooks/useMe";
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
 *
 * 既知の制約: 「投稿済みかどうか」の判定は`GET /events/:id/feedbacks`のレスポンスの中から
 * `author?.id === me.id`のフィードバックを探すことで行っている。この方法はadmin閲覧時、および
 * 非匿名投稿の場合には正しく機能するが、**一般ユーザー（member）が自分自身の投稿を匿名で行った場合、
 * サーバーは`author: null`を返すため、この画面からは「自分の投稿」として認識できない**
 * （非adminには匿名投稿者の`author`情報自体が返らない仕様のため）。
 * この場合、本人が再度このページを開くと「新規投稿」フォームが表示されてしまい、送信すると
 * サーバー側の一意制約により`409`になる。将来的にはサーバー側に`isMine`相当のフラグを
 * 追加してもらうのが正攻法の解決策であり、現時点では既知の制約として残す。
 */
export function FeedbackPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: me } = useMe();
  const [ineligibleMessage, setIneligibleMessage] = useState<string | null>(null);

  const eventHeaderQuery = useFeedbackEventHeader(eventId ?? "");
  const feedbacksQuery = useEventFeedbacks(eventId ?? "");

  const myFeedback = feedbacksQuery.data?.feedbacks.find((feedback) => feedback.author?.id === me?.id);

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
