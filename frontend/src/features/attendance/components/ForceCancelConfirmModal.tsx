import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

type ForceCancelConfirmModalProps = {
  isOpen: boolean;
  /** 確認メッセージに表示する対象ユーザー名。 */
  targetName: string | null;
  isConfirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * M-05 強制キャンセル確認モーダル（画面設計仕様.md 2章）。
 * `ConfirmDialog`（M-07基盤コンポーネント）をラップし、キャンセル可能期限を無視して
 * 強制的にキャンセルする旨の警告を表示する。後戻りしにくい操作（3.4節）のため確認を必須にする。
 */
export function ForceCancelConfirmModal({
  isOpen,
  targetName,
  isConfirming,
  onConfirm,
  onCancel,
}: ForceCancelConfirmModalProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="強制キャンセルの確認"
      message={`${targetName ?? ""}さんの参加登録を強制的にキャンセルします。キャンセル可能期限を過ぎていても取り消され、この操作は元に戻せません。よろしいですか？`}
      confirmLabel="強制キャンセルする"
      isDanger
      isConfirming={isConfirming}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
