import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

type StartAtChangeWarningModalProps = {
  isOpen: boolean;
  /** 「続行」＝警告を確認しP-03（イベント詳細）へ遷移する。更新自体は既にサーバー側で確定済み。 */
  onContinue: () => void;
  /** 「戻る」＝編集フォームに留まる。更新を取り消すAPIは存在しないため、変更自体は確定したままになる。 */
  onBack: () => void;
};

/**
 * M-08 開催日時変更警告モーダル（画面設計仕様.md 2章 M-08行、3.1.4節）。
 *
 * WHY(保存後の確認として実装した理由): MANIFEST.md 6章 #17は「Success 200: dataは更新後のイベント
 * 詳細。startAt変更時、CONFIRMED登録者が1人以上いればhasRegisteredParticipants: trueを含める」と
 * 明記しており、`PUT /events/:id`は1回のリクエストで更新を完了しレスポンスに結果を含める設計になっている
 * （「確定前に一旦仮更新→追加の確定APIを呼ぶ」といった2段階のエンドポイントは存在しない）。
 * また画面設計仕様.md 2章M-08行も「『続行』で編集を確定済みとしてP-03へ遷移」と、続行時点で既に
 * 確定済みである前提の文言になっている。したがって本モーダルは「保存を実行するか否かを尋ねる事前確認
 * （pre-save gate）」ではなく、「既に保存済みの変更について、参加登録者がいる旨を主催者に知らせる
 * 事後通知（post-save acknowledgement）」として実装した。「戻る」を選んでも変更を取り消す処理は行わず、
 * 単に編集画面に留まるだけになる（3.1.4節の「保存確定前に…モーダルを挟む」という記述はやや紛らわしいが、
 * ここでの「確定」はUI上の画面遷移の確定を指すものと解釈した。詳細は本エージェントの最終報告を参照）。
 */
export function StartAtChangeWarningModal({
  isOpen,
  onContinue,
  onBack,
}: StartAtChangeWarningModalProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="開催日時変更の確認"
      message="既に参加登録済みのメンバーがいます。開催日時の変更を続行しますか？"
      confirmLabel="続行"
      cancelLabel="戻る"
      onConfirm={onContinue}
      onCancel={onBack}
    />
  );
}
