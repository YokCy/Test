import { CreateCategorySchema, type CreateCategoryInput } from "@eventboard/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { ApiError } from "../../../../lib/api-client";
import { useCreateCategory } from "../hooks/useCreateCategory";
import { useUpdateCategory } from "../hooks/useUpdateCategory";

type CategoryFormModalProps = {
  isOpen: boolean;
  /** 指定時は編集モード（対象カテゴリの現在値）。未指定（`undefined`）時は新規追加モード。 */
  initialValue?: { id: string; name: string } | undefined;
  onClose: () => void;
};

/**
 * M-01 カテゴリ追加/編集モーダル（画面設計仕様.md 2章）。
 * `initialValue`の有無だけで追加(`POST /categories`)/編集(`PUT /categories/:id`)を切り替え、
 * P-09の「＋追加」「編集」どちらのトリガーからも同じモーダルを使い回す。
 *
 * WHY(409をフィールドエラーに変換): 同名カテゴリの重複は「入力を直せば解決する」バリデーション相当の
 * エラーであり、M-03の削除コンフリクト（ユーザーが直接是正できない、DB制約由来のエラー）とは性質が異なる。
 * そのためトースト等の汎用エラー表示ではなく、RHFの`setError`で`name`フィールド直下に表示する
 * （画面設計仕様.md 2章 M-01「同名カテゴリが既に存在する場合は409をフィールドエラーとして表示」）。
 */
export function CategoryFormModal({ isOpen, initialValue, onClose }: CategoryFormModalProps) {
  const isEditing = initialValue !== undefined;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryInput>({
    resolver: zodResolver(CreateCategorySchema),
    defaultValues: { name: initialValue?.name ?? "" },
  });

  // WHY: 追加/編集で同じモーダルインスタンスを使い回すため、開くたびに対象カテゴリの値
  // （編集時）または空文字（追加時）へフォームをリセットする。
  useEffect(() => {
    if (isOpen) {
      reset({ name: initialValue?.name ?? "" });
    }
  }, [isOpen, initialValue, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (isEditing) {
        await updateCategory.mutateAsync({ id: initialValue.id, input: data });
      } else {
        await createCategory.mutateAsync(data);
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError("name", { message: error.message });
        return;
      }
      throw error;
    }
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "カテゴリの編集" : "カテゴリの追加"}>
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="category-name">
            カテゴリ名
          </label>
          <input
            id="category-name"
            type="text"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("name")}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEditing ? "保存する" : "追加する"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
