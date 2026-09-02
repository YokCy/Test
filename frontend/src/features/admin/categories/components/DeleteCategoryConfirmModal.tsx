import { useEffect, useState } from "react";

import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { ApiError } from "../../../../lib/api-client";
import { useDeleteCategory } from "../hooks/useDeleteCategory";

type DeleteCategoryConfirmModalProps = {
  isOpen: boolean;
  /** 削除対象カテゴリ。`isOpen`がtrueの間は非nullである想定（P-09側で対象未選択時はモーダルを開かない）。 */
  category: { id: string; name: string } | null;
  onClose: () => void;
};

/**
 * M-03 カテゴリ削除確認モーダル（画面設計仕様.md 2章）。`ConfirmDialog`（M-07基盤コンポーネント）をラップする。
 *
 * WHY(409をモーダル内にそのまま表示): 紐づく`Event`が存在する場合の`409`は、削除確認モーダルを閉じて
 * トースト表示にしてしまうと「なぜ削除できないか」の文脈（対象カテゴリ名との対応）が失われる。
 * 画面設計仕様.md 3.1.8節・3.3節が明示する通り、モーダルを閉じずにサーバーの`error.message`を
 * そのままモーダル内に表示し続ける（`ConfirmDialog`の`message`propを確認文言からエラー文言へ差し替える）。
 * 「紐づくイベント数」表示だけを根拠にフロントで削除ボタンを無効化することはしない
 * （表示後にイベントが追加される競合がありうるため、可否の最終判定は常にサーバーの409に委ねる）。
 */
export function DeleteCategoryConfirmModal({ isOpen, category, onClose }: DeleteCategoryConfirmModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const deleteCategory = useDeleteCategory();

  // WHY: 別カテゴリに対して再度開いた際に前回のエラーを引き継がないようにする。
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!category) {
      return;
    }
    try {
      await deleteCategory.mutateAsync(category.id);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrorMessage(error.message);
        return;
      }
      throw error;
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="カテゴリの削除"
      message={
        errorMessage ??
        `「${category?.name ?? ""}」を削除します。この操作は元に戻せません。よろしいですか？`
      }
      confirmLabel="削除する"
      isDanger
      isConfirming={deleteCategory.isPending}
      onConfirm={() => void handleConfirm()}
      onCancel={onClose}
    />
  );
}
