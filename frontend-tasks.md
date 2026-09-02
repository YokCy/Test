# フロントエンド実装タスクリスト

[MANIFEST.md](MANIFEST.md)「4. 画面遷移・構成」「6. API設計」および[画面設計仕様.md](画面設計仕様.md)（全10画面・8モーダルの詳細仕様、UI/UX設計方針）に基づく、
フロントエンド全体の実装タスク一覧。各タスクは概ね15分以内で完了できる粒度に分割している。
完了したタスクは `[ ]` を `[x]` に変更して更新すること。backend-tasks.mdと同じ形式・粒度に揃えている。

Phase 1〜3（環境構築・認証画面・共通UI/レイアウト）は前プロジェクトからの継承により**実装済み**。
Phase 4以降が今回新規に実装するイベントドメインの画面であり、**Phase 4〜9は並列実装可能**
（画面単位で担当者・エージェントを割り当てられる。API側は[backend-tasks.md](backend-tasks.md) Phase 6〜10に対応）。
Phase 10でルーティング・ナビゲーションを一括統合し、Phase 11で結合確認する。

---

## Phase 1: 環境構築・基本設定【直列・実装済み】

- [x] 1.1 `frontend/`（Vite + React + TypeScript + Tailwind CSSの依存関係）を作成する
- [x] 1.2 `vite.config.ts`・`tailwind.config.ts`・`postcss.config.js`を作成する
- [x] 1.3 `vitest.config.ts`・`playwright.config.ts`を作成する
- [x] 1.4 `lib/api-client.ts`（fetchラッパー、`ApiError`）・`lib/dayjs.ts`（JST変換設定）を作成する
- [x] 1.5 `router/`（`ProtectedRoute`, `AdminRoute`, `NotFoundPage`, `routes.ts`, `index.tsx`）の雛形を作成する
- [x] 1.6 `App.tsx`・`main.tsx`を作成する

## Phase 2: 共通UI・レイアウト【直列・実装済み・Phase 1完了後】

- [x] 2.1 `components/ui/Button.tsx`を作成する
- [x] 2.2 `components/ui/Modal.tsx`を作成する
- [x] 2.3 `components/ui/ConfirmDialog.tsx`（汎用確認ダイアログ、M-07の基盤）を作成する
- [x] 2.4 `components/ui/Toast.tsx`を作成する
- [x] 2.5 `components/ui/Spinner.tsx`を作成する
- [x] 2.6 `components/layout/AppLayout.tsx`・`Header.tsx`を作成する

## Phase 3: 認証画面（P-01, `/settings/profile`）【直列・実装済み・Phase 2完了後】

- [x] 3.1 `features/auth/api.ts`（`authKeys`, `MeResponse`）を作成する
- [x] 3.2 `useLogin`/`useLogout`/`useMe`/`useUpdateProfile`フックを作成する
- [x] 3.3 `LoginPage`（P-01）を作成する
- [x] 3.4 `ProfilePage`を作成する

---

## Phase 4: イベント一覧・詳細画面（P-02, P-03）【並列実装可・Phase 1〜3完了後・完了】

> 対応API: [backend-tasks.md](backend-tasks.md) Phase 7（イベント基本API）・Phase 8（参加登録・キャンセル）

- [x] 4.1 `features/events/api.ts`にquery key・レスポンス型（`EventSummary`, `EventDetail`, `RegistrationState`）を定義する
- [x] 4.2 `useEvents`（一覧取得、検索/絞り込みパラメータ対応）フックを作成する
- [x] 4.3 `EventCard`・`CategoryBadge`コンポーネントを作成する（[画面設計仕様.md 3.1.2節](画面設計仕様.md)）
- [x] 4.4 `EventsListPage`（P-02）を作成する（検索欄・カテゴリ絞り込み・タグ検索・ソート・カード一覧・新規作成導線）
- [x] 4.5 `useEventDetail`（詳細取得）フックを作成する
- [x] 4.6 `RegistrationActionButton`（`registrationState`に応じた表示切り替え、[画面設計仕様.md 3.1.3節](画面設計仕様.md)）コンポーネントを作成する
- [x] 4.7 `useRegisterEvent`/`useCancelRegistration`フックを作成する
- [x] 4.8 M-04「参加キャンセル確認モーダル」を`ConfirmDialog`ベースで実装する
- [x] 4.9 `EventDetailPage`（P-03）を作成する（基本情報・参加者リスト・レビュー一覧・登録/キャンセルボタン。統合時に編集/削除ボタン・出席管理への導線・`FeedbackList`の差し込みを追加）

## Phase 5: イベント作成・編集画面（P-04, P-05）【並列実装可・Phase 1〜3完了後・完了】

> 対応API: [backend-tasks.md](backend-tasks.md) Phase 7。実装は`features/events`とは独立した`features/events-form/`に配置（両featureは互いにimportしない設計）。

- [x] 5.1 `EventForm`共通コンポーネント（RHF + Zod、新規/編集で共有）を作成する
- [x] 5.2 タグ入力UI（追加・削除可能なチップ入力）を作成する
- [x] 5.3 `useCreateEvent`フックを作成する
- [x] 5.4 `EventCreatePage`（P-04）を作成する
- [x] 5.5 `useUpdateEvent`フックを作成する
- [x] 5.6 M-08「開催日時変更警告モーダル」を実装する（`hasRegisteredParticipants: true`応答時に表示。PUTは応答時点で既に確定済みのため「保存前の確認ゲート」ではなく「保存後の確認」として実装）
- [x] 5.7 M-02「イベント削除確認モーダル」を実装し、`useDeleteEvent`フックを作成する
- [x] 5.8 `EventEditPage`（P-05）を作成する（`EventForm`再利用＋削除ボタン）

> 統合時に修正した不具合: `endAt`/`registrationDeadline`/`cancellationDeadline`（任意項目）が未入力の場合に
> 空文字列`""`を送信しており、Zodの`z.string().datetime().optional()`が`undefined`のみ検証をスキップする
> ため「Invalid datetime」エラーになっていた。`undefined`を送るよう修正（実機ブラウザ操作で発見）。
> 統合時に`useCreateEvent`/`useUpdateEvent`/`useDeleteEvent`が`features/events`側の一覧・詳細キャッシュ
> （`eventKeys`）を無効化するよう追加（作成・編集・削除後に一覧/詳細が古いまま表示される不具合の予防）。

## Phase 6: マイページ（P-06）【並列実装可・Phase 1〜3完了後・完了】

> 対応API: [backend-tasks.md](backend-tasks.md) Phase 10

- [x] 6.1 `features/my-page/api.ts`にquery key・レスポンス型を定義する
- [x] 6.2 `useMyEvents`/`useMyStats`フックを作成する
- [x] 6.3 タブ切り替えUI（主催イベント/参加予定/参加履歴、URL非連動のローカル状態）を作成する
- [x] 6.4 累計参加数・出席率・カテゴリ別集計の表示コンポーネントを作成する
- [x] 6.5 `MyPage`（P-06）を組み立てる（[画面設計仕様.md 3.1.5節](画面設計仕様.md)）

> 既知の課題: `GET /users/me/events`の`organizing`項目に`capacity`が含まれないため、
> モックアップの「参加者17/20」表示ではなく「確定n名・キャンセル待ちn名」表示にしている（バックエンド側の対応は保留）。

## Phase 7: 出席管理画面（P-07）【並列実装可・Phase 1〜3完了後・完了】

> 対応API: [backend-tasks.md](backend-tasks.md) Phase 8

- [x] 7.1 `features/attendance/api.ts`にquery key・レスポンス型を定義する
- [x] 7.2 `useRegistrations`（参加者一覧取得）フックを作成する
- [x] 7.3 `useMarkAttendance`フックを作成する
- [x] 7.4 M-05「強制キャンセル確認モーダル」（admin向け）を実装し、`useCancelRegistration`のadmin強制版（`userId`指定）と連携する
- [x] 7.5 `AttendancePage`（P-07）を組み立てる（開催日時前はマークボタンを`disabled`表示、[画面設計仕様.md 3.1.6節](画面設計仕様.md)）

## Phase 8: フィードバック投稿画面（P-08）【並列実装可・Phase 1〜3完了後・完了】

> 対応API: [backend-tasks.md](backend-tasks.md) Phase 9

- [x] 8.1 `features/feedbacks/api.ts`にquery key・レスポンス型を定義する
- [x] 8.2 星評価入力コンポーネント（`StarRatingInput`）を作成する
- [x] 8.3 `useSubmitFeedback`/`useUpdateFeedback`フックを作成する（投稿済み時は編集モードに切り替え）
- [x] 8.4 `FeedbackPage`（P-08）を組み立てる（投稿条件未充足時はフォームの代わりに理由とP-03への戻り導線を表示）
- [x] 8.5 `EventDetailPage`（P-03）用のレビュー一覧コンポーネント（`FeedbackList`、平均評価表示、匿名投稿の表示制御）を作成する
- [x] 8.6 M-06「フィードバック非公開化確認モーダル」（admin向け）を実装し、`useHideFeedback`フックを作成する

> 既知の課題: 投稿済みかどうかの判定は`author.id === 自分のid`で行っており、一般memberが匿名投稿した
> 自分自身の投稿は`author: null`で返るため「編集モード」に切り替わらない（サーバー側に`isMine`相当の
> フラグを追加しない限り解消しない）。

## Phase 9: カテゴリマスタ管理画面（P-09）【並列実装可・Phase 1〜3完了後・完了】

> 対応API: [backend-tasks.md](backend-tasks.md) Phase 6

- [x] 9.1 `features/admin/categories/api.ts`にquery key・レスポンス型を定義する
- [x] 9.2 `useCategories`/`useCreateCategory`/`useUpdateCategory`/`useDeleteCategory`フックを作成する
- [x] 9.3 M-01「カテゴリ追加/編集モーダル」を実装する
- [x] 9.4 M-03「カテゴリ削除確認モーダル」を実装する（紐づくイベントが存在する場合のサーバー`409`エラーをモーダル内にそのまま表示）
- [x] 9.5 `CategoriesAdminPage`（P-09）を組み立てる（カテゴリ一覧＋紐づくイベント数表示）
- [x] 9.6 既存の`AdminRoute`を使ってP-09へのアクセスをadmin限定にする

> 統合時に発見・修正した不具合: `lib/api-client.ts`が`204 No Content`（`DELETE /categories/:id`等）に対して
> 無条件に`response.json()`を呼んでおり、Fetch仕様上ボディが存在しないためパースエラーになっていた。
> `204`は`undefined`を返すよう先に分岐するガードを追加。

---

## Phase 10: ルーティング・ナビゲーション統合【直列・Phase 4〜9完了後・完了】

> `router/routes.ts`・`router/index.tsx`・`Header.tsx`は全画面から参照される共有ファイルのため、
> 並列実装フェーズ中の同時編集によるコンフリクトを避け、このPhaseでまとめて統合する
> （backend-tasksのPhase 11「AppModule統合」と同じ考え方）。

- [x] 10.1 `router/routes.ts`に全URL（P-02〜P-09）を追加する
- [x] 10.2 `router/index.tsx`に全ページコンポーネントを登録する（admin配下の`P-09`は`AdminRoute`でガード）
- [x] 10.3 `Header.tsx`にイベント一覧・マイページへのナビゲーションリンク、adminのみカテゴリ管理リンクを追加する
- [x] 10.4 `ROUTES.home`を暫定の`/settings/profile`から`/events`（イベント一覧、P-02）に差し替える
- [x] 10.5 全体の型チェック・Lint（`pnpm --filter frontend build` / `lint`）を実行し、並列実装間の不整合を解消する

## Phase 11: 結合確認【直列・Phase 10完了後、backend-tasks.md Phase 12と合わせて実施】

- [x] 11.1 `docker compose`のdbコンテナ＋ローカルの`nest start`/`vite`でログイン→イベント一覧→詳細→参加登録の一連の流れをブラウザで確認する（frontend込みの`docker compose up --build`はフルビルドの確認として別途推奨）
- [x] 11.2 イベント作成→編集（開催日時変更警告モーダル）→削除の一連の流れをブラウザで確認する（この過程で5章記載の日時バリデーション不具合を発見・修正）
- [x] 11.3 満席イベント（定員1）でのキャンセル待ち登録の表示反映をブラウザで確認する（1人目CONFIRMED・2人目WAITLISTED、カード/詳細双方の`registrationState`表示を確認。自動繰り上げのトランザクション自体はbackend-tasks.md Phase 12.3でAPI直接呼び出しにより確認済み）
- [ ] 11.4 出席マーク→フィードバック投稿（匿名投稿含む）→admin非公開化の一連の流れを手動確認する（開催日時が未来のテストイベントでは出席マークがdisabledのため未実施。過去日時のイベントでの確認が必要）
- [x] 11.5 admin以外のユーザーで`/admin/categories`にアクセスし、404画面（P-10）が表示されることを確認する
