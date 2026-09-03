import type { Page } from "@playwright/test";

/**
 * `Date`を`<input type="datetime-local">`（`EventForm.tsx`）が期待する`YYYY-MM-DDTHH:mm`形式へ、
 * 実行環境のタイムゾーンに関係なくJST（Asia/Tokyo）で変換する。分未満は素直に切り捨てる
 * （`datetime-local`が分単位までしか表現できないため）。
 * WHY: CI等、実行環境のタイムゾーンがJSTでない場合でも常に同じ入力値になるようにするため、
 * `Date`のロケール依存メソッドではなく`Intl.DateTimeFormat`でタイムゾーンを明示指定する。
 * WHY(ここでは丸めない): 以前はこの関数内で分単位に切り上げていたが、そうすると「送信される
 * 実際のstartAt」と「呼び出し元がwaitMs計算に使うDateオブジェクト」がズレてしまい
 * （切り上げ分だけ実際のstartAtが遅くなるのに、待機時間の計算は元のDateを使うため待ちが不足する）、
 * 別の回帰を生んだ。`startAt`の待機時間計算が絡む呼び出し元は、この関数ではなく
 * `futureMinuteAligned`で最初から分境界に揃った`Date`を作ることで、丸め自体を発生させない。
 */
export function toJstDatetimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** 現在時刻から指定ミリ秒後の`Date`を返す。テストの日時条件を常に実行時刻からの相対値にするため。 */
export function futureDate(msFromNow: number): Date {
  return new Date(Date.now() + msFromNow);
}

/**
 * 現在時刻から指定ミリ秒後を、分境界に切り上げた`Date`として返す。
 * WHY: `startAt`のように「実際に時間が経過するのを待ってから操作する」シナリオ（0.3節）で、
 * 待機時間をこの関数の返り値から計算すれば、`toJstDatetimeLocal`（分単位切り捨て）を経由しても
 * 情報が失われない（既に分境界なので丸めが発生しない）。`futureDate`をそのまま使うと、
 * `datetime-local`送信時に最大59秒切り捨てられ、待機時間の計算とズレて開催前判定のままになる
 * （実際に発生した回帰）。
 */
export function futureMinuteAligned(msFromNow: number): Date {
  const target = Date.now() + msFromNow;
  return new Date(Math.ceil(target / 60_000) * 60_000);
}

export interface CreateEventOptions {
  title: string;
  startAt: Date;
  /** 既定は"勉強会"（seedのINITIAL_CATEGORY_NAMESに存在する既定カテゴリ）。 */
  categoryName?: string;
  /** 既定は10。 */
  capacity?: number;
  endAt?: Date;
  description?: string;
  /**
   * キャンセル可能期限。未指定時は未入力（サーバー側でstartAtがデフォルトとして扱われる）。
   * WHY: `startAt`と異なりサーバー側は未来日時であることを検証しないため
   * （`RegistrationsService.cancel`参照）、過去日時を明示指定して「キャンセル可能期限を既に過ぎた
   * 確定参加者」の状態を、実際に時間経過を待つことなく再現できる（e2e-test-perspectives.md 6章#2）。
   */
  cancellationDeadline?: Date;
  /**
   * 登録締切。`cancellationDeadline`と同様にサーバー側は未来日時を検証しないため
   * （`EventsService.assertFutureStartAt`は`startAt`専用）、過去日時を指定して即座に`CLOSED`状態
   * （`registrationState`）を再現できる（e2e-test-perspectives.md 8章#1）。
   */
  registrationDeadline?: Date;
}

/**
 * ログイン済みの`page`から、P-04イベント作成画面を実際にUI操作で送信してイベントを1件作成し、
 * 作成後に遷移するイベント詳細画面（P-03）のURLからeventIdを取り出して返す。
 * WHY: バックエンドは作成・更新どちらも`startAt`が未来日時であることを検証するため
 * （`EventsService.assertFutureStartAt`）、APIを直接叩いても過去日時のイベントは作れない。
 * 各E2Eテストは本ヘルパーで自分専用のイベントを作成し、他テストの残存データに依存しない
 * （e2e-test-perspectives.md 0.3節）。
 */
export async function createEventViaUi(page: Page, options: CreateEventOptions): Promise<string> {
  await page.goto("/events/new");

  await page.getByLabel("タイトル").fill(options.title);
  if (options.description !== undefined) {
    await page.getByLabel("説明").fill(options.description);
  }
  await page.getByLabel("カテゴリ").selectOption({ label: options.categoryName ?? "勉強会" });
  await page.getByLabel("開催日時").fill(toJstDatetimeLocal(options.startAt));
  if (options.endAt !== undefined) {
    await page.getByLabel("終了日時(任意)").fill(toJstDatetimeLocal(options.endAt));
  }
  await page.getByLabel("定員").fill(String(options.capacity ?? 10));
  if (options.registrationDeadline !== undefined) {
    await page.getByLabel("登録締切(任意)").fill(toJstDatetimeLocal(options.registrationDeadline));
  }
  if (options.cancellationDeadline !== undefined) {
    await page.getByLabel("キャンセル期限(任意)").fill(toJstDatetimeLocal(options.cancellationDeadline));
  }

  await page.getByRole("button", { name: "保存する" }).click();
  // WHY: `page.goto("/events/new")`した時点で既に`/events/new`自体が`/\/events\/[^/]+$/`という
  // 単純な正規表現にマッチしてしまうため、送信後の遷移を待たずに`waitForURL`が即座に解決してしまい、
  // eventIdとして文字列"new"を誤って掴んでしまう不具合があった（複数E2Eテストが原因不明のまま
  // "イベントを作成"画面に迷い込む形で失敗する、という形で顕在化した）。`/events/new`自体を
  // 明示的に除外する条件にする。
  await page.waitForURL((url) => /^\/events\/[^/]+$/.test(url.pathname) && url.pathname !== "/events/new");

  const match = /\/events\/([^/]+)$/.exec(page.url());
  const eventId = match?.[1];
  if (!eventId || eventId === "new") {
    throw new Error(`イベント作成後の遷移先URLからeventIdを取得できませんでした: ${page.url()}`);
  }
  return eventId;
}
