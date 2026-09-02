import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { ApiError } from "../../../lib/api-client";
import { useDeleteEvent } from "../hooks/useDeleteEvent";

type DeleteEventConfirmModalProps = {
  isOpen: boolean;
  eventId: string;
  onCancel: () => void;
  /** `DELETE /events/:id`成功後に呼ばれる。呼び出し元（P-05）がP-02（イベント一覧）への遷移を行う。 */
  onDeleted: () => void;
};

/**
 * M-02 イベント削除確認モーダル（画面設計仕様.md 2章 M-02行）。
 * 「削除すると一覧・検索結果から表示されなくなります」の確認のみを行い、確定で
 * `DELETE /events/:id`（論理削除、MANIFEST.md 6章 #18）を実行する。
 */
export function DeleteEventConfirmModal({
  isOpen,
  eventId,
  onCancel,
  onDeleted,
}: DeleteEventConfirmModalProps) {
  const deleteEvent = useDeleteEvent(eventId);
  const { showToast } = useToast();

  const handleConfirm = async () => {
    try {
      await deleteEvent.mutateAsync();
      onDeleted();
    } catch (error) {
      // WHY: 403（主催者本人でもadminでもない）・404（既に削除済み等）はモーダルを閉じずトーストのみで
      // 知らせる（フォーム自体のフィールドエラーではないため、ConfirmDialog内にはエラー表示欄がない）。
      if (error instanceof ApiError) {
        showToast(error.message, "error");
        return;
      }
      throw error;
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="イベントの削除"
      message="削除すると一覧・検索結果から表示されなくなります。よろしいですか？"
      confirmLabel="削除する"
      isDanger
      isConfirming={deleteEvent.isPending}
      onConfirm={() => void handleConfirm()}
      onCancel={onCancel}
    />
  );
}
