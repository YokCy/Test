import { dayjs } from "../../../lib/dayjs";

/** `<input type="datetime-local">`が要求する`YYYY-MM-DDTHH:mm`形式（タイムゾーン情報なし）。 */
const DATETIME_LOCAL_FORMAT = "YYYY-MM-DDTHH:mm";

/**
 * サーバーが返すISO8601文字列（UTC）を、`<input type="datetime-local">`に表示するための
 * JSTローカル時刻文字列に変換する（frontend/src/lib/dayjs.tsでJSTを既定タイムゾーンに固定済み）。
 */
export function isoToLocalInputValue(iso: string): string {
  return dayjs(iso).tz("Asia/Tokyo").format(DATETIME_LOCAL_FORMAT);
}

/**
 * `<input type="datetime-local">`の値（タイムゾーン情報を持たないJSTのローカル時刻文字列）を、
 * サーバーへ送信するISO8601(UTC)文字列に変換する（packages/shared/src/schemas/events.tsの
 * `z.string().datetime()`が要求する形式）。
 */
export function localInputValueToIso(localValue: string): string {
  return dayjs.tz(localValue, "Asia/Tokyo").toISOString();
}
