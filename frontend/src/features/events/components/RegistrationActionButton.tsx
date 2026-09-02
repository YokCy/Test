import { useState } from "react";

import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { ApiError } from "../../../lib/api-client";
import type { RegistrationState } from "../api";
import { useCancelRegistration } from "../hooks/useCancelRegistration";
import { useRegisterEvent } from "../hooks/useRegisterEvent";

type RegistrationActionButtonProps = {
  eventId: string;
  registrationState: RegistrationState;
  /** WAITLISTEDの場合のみ意味を持つ、キャンセル待ちの順番（1始まり）。 */
  position?: number | null;
};

/**
 * `registrationState`を唯一の判定材料として参加登録/キャンセルのボタン・文言を出し分ける表示コンポーネント
 * （画面設計仕様.md 3.1.3・3.2）。P-03イベント詳細画面から使うほか、マイページ（P-06）のイベントカード等
 * 他画面からもそのまま再利用できるよう、`eventId`/`registrationState`/`position`のみに依存させ、
 * `EventDetail`型など他コンポーネントの型には依存しない。
 *
 * WHY(楽観的UI更新をしない): register/cancelのミューテーション自体はレスポンスを待ってから
 * `useRegisterEvent`/`useCancelRegistration`内でキャッシュをinvalidateする。ここでは送信中`disabled`＋
 * Buttonの`isLoading`表示のみを担当する（画面設計仕様.md 3.4）。
 */
export function RegistrationActionButton({ eventId, registrationState, position }: RegistrationActionButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { showToast } = useToast();
  const register = useRegisterEvent(eventId);
  const cancel = useCancelRegistration(eventId);

  const handleRegister = async () => {
    try {
      await register.mutateAsync();
    } catch (error) {
      if (error instanceof ApiError) {
        showToast(error.message, "error");
        return;
      }
      throw error;
    }
  };

  const handleConfirmCancel = async () => {
    try {
      await cancel.mutateAsync();
      setIsConfirmOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        showToast(error.message, "error");
        return;
      }
      throw error;
    }
  };

  if (registrationState === "ORGANIZER") {
    return <p className="text-sm font-medium text-slate-600">あなたが主催者です</p>;
  }

  if (registrationState === "CLOSED") {
    return (
      <Button variant="secondary" disabled>
        登録締切を過ぎました
      </Button>
    );
  }

  if (registrationState === "NOT_REGISTERED") {
    return (
      <Button onClick={() => void handleRegister()} isLoading={register.isPending}>
        参加登録する
      </Button>
    );
  }

  // registrationState: "CONFIRMED" | "WAITLISTED"
  const isWaitlisted = registrationState === "WAITLISTED";

  return (
    <>
      <div className="flex items-center gap-3">
        {isWaitlisted && (
          <p className="text-sm font-medium text-slate-700">
            {typeof position === "number" ? `キャンセル待ち中（${position}番目）` : "キャンセル待ち中"}
          </p>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            setIsConfirmOpen(true);
          }}
        >
          {isWaitlisted ? "キャンセル待ちをやめる" : "キャンセルする"}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={isWaitlisted ? "キャンセル待ちをやめる" : "参加をキャンセルする"}
        message={
          isWaitlisted
            ? "キャンセル待ちの登録を取り消します。よろしいですか？"
            : "参加をキャンセルします。あなたの代わりに繰り上げが発生する場合があります。よろしいですか？"
        }
        confirmLabel="キャンセルする"
        cancelLabel="戻る"
        isDanger
        isConfirming={cancel.isPending}
        onConfirm={() => void handleConfirmCancel()}
        onCancel={() => {
          setIsConfirmOpen(false);
        }}
      />
    </>
  );
}
