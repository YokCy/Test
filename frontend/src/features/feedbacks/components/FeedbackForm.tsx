import { CreateFeedbackSchema, type CreateFeedbackInput } from "@eventboard/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/api-client";

import { StarRatingInput } from "./StarRatingInput";

type FeedbackFormProps = {
  /** 編集モード時、投稿済みのフィードバックで初期化する（未指定時は空の新規投稿フォームになる）。 */
  defaultValues?: CreateFeedbackInput | undefined;
  submitLabel: string;
  onSubmit: (data: CreateFeedbackInput) => Promise<void>;
  /**
   * `403`（投稿条件未充足、または主催者本人による投稿等）を検知した際に呼ばれる。
   * サーバーが返した`error.message`をそのまま渡すので、呼び出し元（`FeedbackPage`）は
   * この文言をそのまま理由表示に使う（MANIFEST.md 6章 #24、画面設計仕様.md 3.1.7節）。
   */
  onIneligible: (message: string) => void;
};

const EMPTY_DEFAULT_VALUES: CreateFeedbackInput = { rating: 0, comment: "", isAnonymous: false };

/**
 * P-08フィードバック投稿画面のフォーム本体。新規投稿（`useSubmitFeedback`）・編集（`useUpdateFeedback`）の
 * どちらからも同一コンポーネントを利用する（`FeedbackPage`が`defaultValues`と`onSubmit`を出し分ける）。
 */
export function FeedbackForm({ defaultValues, submitLabel, onSubmit, onIneligible }: FeedbackFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateFeedbackInput>({
    resolver: zodResolver(CreateFeedbackSchema),
    defaultValues: defaultValues ?? EMPTY_DEFAULT_VALUES,
  });

  const submit = handleSubmit(async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        onIneligible(error.message);
        return;
      }
      // WHY: 400（バリデーション）・409（二重投稿。本来は事前の既存投稿検出で避けられるはずだが、
      // 念のためのフォールバック）はフォームを閉じずフィールド外のエラーとして表示する
      // （画面設計仕様.md 3.4節「サーバー側のバリデーションエラー発生時もフォームを閉じない」）。
      if (error instanceof ApiError) {
        setError("root", { message: error.message });
        return;
      }
      throw error;
    }
  });

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      {errors.root && (
        <p role="alert" className="text-sm text-red-600">
          {errors.root.message}
        </p>
      )}

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">評価</span>
        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <StarRatingInput value={field.value} onChange={field.onChange} disabled={isSubmitting} />
          )}
        />
        {errors.rating && <p className="mt-1 text-sm text-red-600">{errors.rating.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="feedback-comment">
          コメント
        </label>
        <textarea
          id="feedback-comment"
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("comment")}
        />
        {errors.comment && <p className="mt-1 text-sm text-red-600">{errors.comment.message}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register("isAnonymous")} />
        匿名で投稿する
      </label>

      <div className="mt-2 flex justify-end">
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
