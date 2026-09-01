import dayjs from "dayjs";
import "dayjs/locale/ja";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("ja");

// WHY(MANIFEST.md 7章「日時処理」): DB/Appともタイムゾーンを`Asia/Tokyo`固定で運用しているため、
// フロントエンドの既定タイムゾーンも明示的にJSTへ固定する。これにより、閲覧者のブラウザの
// ローカルタイムゾーン設定に関わらず、サーバーが返すISO8601文字列を常に同じ表示（JST）に揃えられる。
dayjs.tz.setDefault("Asia/Tokyo");

export { dayjs };
