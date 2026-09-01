import { Button } from "./Button";
import { Modal } from "./Modal";

type ConfirmDialogProps = {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** アーカイブ・廃棄・無効化等の破壊的操作の場合にtrue。確定ボタンを危険色（赤）で表示する。 */
  isDanger?: boolean;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * M-09 汎用確認ダイアログ。
 * 画面仕様書.mdの通り、本コンポーネントは確認メッセージの表示・確定/キャンセル操作のみを担い、
 * 実際の確定処理（API呼び出し等）は呼び出し元（プロジェクトアーカイブ・メンバー解除・
 * ユーザー無効化・招待取り消し等、Phase 4以降の各機能）が`onConfirm`内で実行する。
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "確定",
  cancelLabel = "キャンセル",
  isDanger,
  isConfirming,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={isConfirming}>
          {cancelLabel}
        </Button>
        <Button
          variant={isDanger ? "danger" : "primary"}
          onClick={onConfirm}
          isLoading={isConfirming}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
