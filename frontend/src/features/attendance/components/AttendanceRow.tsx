import { Button } from "../../../components/ui/Button";
import type { AttendanceStatus, RegistrationRow } from "../api";

type AttendanceRowProps = {
  registration: RegistrationRow;
  /** 開催日時前はtrue（マークボタンを無効化する）。MANIFEST.md 3.5節「開催日時に達する前の出席マークは禁止」。 */
  isMarkingDisabled: boolean;
  /** このユーザー行に対する出席/欠席マーク送信中はtrue（二重送信防止のためボタンを無効化する）。 */
  isMarkPending: boolean;
  onMark: (userId: string, attendanceStatus: Exclude<AttendanceStatus, null>) => void;
  /** 強制キャンセルボタンの表示可否（adminのみtrue）。画面設計仕様.md M-05は「adminのみ表示」。 */
  canForceCancel: boolean;
  onForceCancel: (userId: string, name: string) => void;
};

/**
 * P-07出席管理画面の参加者1行（画面設計仕様.md 3.1.6）。
 * 出席/欠席ボタンはトグル式で、押下済みの再訂正には確認モーダルを挟まない
 * （3.1.6節「誤操作リカバリのしやすさを優先する」）。
 */
export function AttendanceRow({
  registration,
  isMarkingDisabled,
  isMarkPending,
  onMark,
  canForceCancel,
  onForceCancel,
}: AttendanceRowProps) {
  const { userId, name, attendanceStatus } = registration;
  const buttonsDisabled = isMarkingDisabled || isMarkPending;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-3">
      <span className="text-sm font-medium text-slate-900">{name}</span>
      <div className="flex items-center gap-2">
        <Button
          variant={attendanceStatus === "ATTENDED" ? "primary" : "secondary"}
          size="sm"
          disabled={buttonsDisabled}
          title={isMarkingDisabled ? "開催後にマークできます" : undefined}
          onClick={() => onMark(userId, "ATTENDED")}
        >
          {attendanceStatus === "ATTENDED" ? "●出席" : "出席"}
        </Button>
        <Button
          variant={attendanceStatus === "ABSENT" ? "primary" : "secondary"}
          size="sm"
          disabled={buttonsDisabled}
          title={isMarkingDisabled ? "開催後にマークできます" : undefined}
          onClick={() => onMark(userId, "ABSENT")}
        >
          {attendanceStatus === "ABSENT" ? "●欠席" : "欠席"}
        </Button>
        {canForceCancel && (
          <Button variant="danger" size="sm" onClick={() => onForceCancel(userId, name)}>
            強制キャンセル
          </Button>
        )}
      </div>
    </div>
  );
}
