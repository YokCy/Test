import { CreateEventSchema, type CreateEventInput } from "@eventboard/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/api-client";
import { useCategoryOptions } from "../hooks/useCategoryOptions";
import { isoToLocalInputValue, localInputValueToIso } from "../lib/datetime";

import { TagInput } from "./TagInput";

type EventFormProps = {
  /** 編集時（P-05）はイベント情報で初期化する。未指定（P-04・新規作成時）は空フォームになる。 */
  defaultValues?: CreateEventInput | undefined;
  /**
   * 送信ボタン押下時に呼ばれる。`CreateEventSchema`でクライアント側バリデーション済みのデータを渡す
   * （PUT時もPOSTと同じ全項目を送るため、部分更新を許可する`UpdateEventSchema`にもそのまま適合する）。
   * 失敗時は`ApiError`をthrowする想定（LoginPage/ProfilePageと同じパターン）。
   */
  onSubmit: (data: CreateEventInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
};

// WHY: `endAt`/`registrationDeadline`/`cancellationDeadline`は`z.string().datetime().optional()`。
// Zodの`.optional()`は値が`undefined`の場合のみ検証をスキップし、空文字列`""`は「日時としては不正な文字列」
// として`.datetime()`自体に弾かれる（Zod既定のエラーメッセージが"Invalid datetime"）。
// 未入力を表すには`""`ではなく`undefined`にする必要がある。
const emptyDefaults: CreateEventInput = {
  title: "",
  description: "",
  categoryId: "",
  tags: [],
  startAt: "",
  endAt: undefined,
  capacity: 1,
  registrationDeadline: undefined,
  cancellationDeadline: undefined,
};

/**
 * P-04（イベント作成画面）・P-05（イベント編集画面）が共有するフォーム本体（画面設計仕様.md 3.1.4）。
 * このコンポーネント自身は作成／編集どちらの画面かを意識せず、`defaultValues`の有無と`onSubmit`の
 * 実装（呼び出し元がPOST /eventsかPUT /events/:idかを決める）だけで両画面から再利用される。
 *
 * WHY(datetime-localとISO8601の橋渡し): `CreateEventSchema`の日時項目は`z.string().datetime()`
 * （タイムゾーン付きのISO8601文字列）を要求する一方、`<input type="datetime-local">`はタイムゾーン
 * 情報を持たないローカル時刻文字列しか読み書きできない。react-hook-formの内部状態には常にISO文字列を
 * 保持しつつ、`<input>`への表示・入力だけを`Controller`でJSTのローカル時刻文字列に変換することで、
 * `zodResolver(CreateEventSchema)`をそのまま（バリデーションルールを再定義せず）使えるようにしている。
 */
export function EventForm({ defaultValues, onSubmit, onCancel, submitLabel }: EventFormProps) {
  const { data: categoryOptions, isLoading: isCategoryLoading } = useCategoryOptions();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventInput>({
    resolver: zodResolver(CreateEventSchema),
    defaultValues: defaultValues ?? emptyDefaults,
  });

  const onFormSubmit = handleSubmit(async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      // WHY: バリデーション自体はクライアント側（zodResolver）で完結する想定だが、カテゴリが
      // 直前に削除された等の競合（404）・サーバー固有のルール（過去日時の開催不可等、400）は
      // クライアント側スキーマに存在しないためサーバー側の判定に委ねる（LoginPage.tsxと同じ方針）。
      // 403（主催者本人でもadminでもない）も、URL直接アクセス等でこの画面にたどり着けてしまう経路が
      // ある以上ここで拾わないと無言のPromise rejectionになってしまうため、同様にフォーム全体の
      // エラーとして表示する（過去にE2Eテスト作成時のコードレビューで発見・修正）。
      if (error instanceof ApiError) {
        setError("root", { message: error.message });
        return;
      }
      throw error;
    }
  });

  return (
    <form onSubmit={(event) => void onFormSubmit(event)} className="flex flex-col gap-4">
      {errors.root && (
        <p role="alert" className="text-sm text-red-600">
          {errors.root.message}
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-title">
          タイトル
        </label>
        <input
          id="event-title"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("title")}
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-description">
          説明
        </label>
        <textarea
          id="event-description"
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("description")}
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-category">
            カテゴリ
          </label>
          <select
            id="event-category"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            disabled={isCategoryLoading}
            {...register("categoryId")}
          >
            <option value="">選択してください</option>
            {categoryOptions?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="mt-1 text-sm text-red-600">{errors.categoryId.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-tags">
            タグ
          </label>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <TagInput id="event-tags" value={field.value} onChange={field.onChange} />
            )}
          />
          {errors.tags && <p className="mt-1 text-sm text-red-600">{errors.tags.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-start-at">
            開催日時
          </label>
          <Controller
            control={control}
            name="startAt"
            render={({ field }) => (
              <input
                id="event-start-at"
                type="datetime-local"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={field.value ? isoToLocalInputValue(field.value) : ""}
                onChange={(event) =>
                  field.onChange(event.target.value ? localInputValueToIso(event.target.value) : "")
                }
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.startAt && <p className="mt-1 text-sm text-red-600">{errors.startAt.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-end-at">
            終了日時(任意)
          </label>
          <Controller
            control={control}
            name="endAt"
            render={({ field }) => (
              <input
                id="event-end-at"
                type="datetime-local"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={field.value ? isoToLocalInputValue(field.value) : ""}
                onChange={(event) =>
                  field.onChange(event.target.value ? localInputValueToIso(event.target.value) : undefined)
                }
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.endAt && <p className="mt-1 text-sm text-red-600">{errors.endAt.message}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="event-capacity">
          定員
        </label>
        <input
          id="event-capacity"
          type="number"
          min={1}
          className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("capacity", { valueAsNumber: true })}
        />
        {errors.capacity && <p className="mt-1 text-sm text-red-600">{errors.capacity.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor="event-registration-deadline"
          >
            登録締切(任意)
          </label>
          <Controller
            control={control}
            name="registrationDeadline"
            render={({ field }) => (
              <input
                id="event-registration-deadline"
                type="datetime-local"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={field.value ? isoToLocalInputValue(field.value) : ""}
                onChange={(event) =>
                  field.onChange(event.target.value ? localInputValueToIso(event.target.value) : undefined)
                }
                onBlur={field.onBlur}
              />
            )}
          />
          <p className="mt-1 text-xs text-slate-500">未設定時は開催日時が締切になります</p>
          {errors.registrationDeadline && (
            <p className="mt-1 text-sm text-red-600">{errors.registrationDeadline.message}</p>
          )}
        </div>

        <div>
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor="event-cancellation-deadline"
          >
            キャンセル期限(任意)
          </label>
          <Controller
            control={control}
            name="cancellationDeadline"
            render={({ field }) => (
              <input
                id="event-cancellation-deadline"
                type="datetime-local"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={field.value ? isoToLocalInputValue(field.value) : ""}
                onChange={(event) =>
                  field.onChange(event.target.value ? localInputValueToIso(event.target.value) : undefined)
                }
                onBlur={field.onBlur}
              />
            )}
          />
          <p className="mt-1 text-xs text-slate-500">未設定時は開催日時が期限になります</p>
          {errors.cancellationDeadline && (
            <p className="mt-1 text-sm text-red-600">{errors.cancellationDeadline.message}</p>
          )}
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          キャンセル
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
