import { dayjs } from "../../../lib/dayjs";

/** 画面設計仕様.md 3.1.5の例（`09/10(木)19:00〜`）に合わせた開催日時の表示用フォーマット。 */
export function formatEventDateTime(startAt: string): string {
  return `${dayjs(startAt).tz().format("MM/DD(ddd)HH:mm")}〜`;
}
