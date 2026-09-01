# バックエンド実装タスクリスト

[MANIFEST.md](MANIFEST.md)「5. データモデリング」「6. API設計」、[画面設計仕様.md](画面設計仕様.md)に基づく、
バックエンド全体の実装タスク一覧。各タスクは概ね15分以内で完了できる粒度に分割している。
完了したタスクは `[ ]` を `[x]` に変更して更新すること。

Phase 1〜4（環境構築・認証基盤・認証API・ユーザー管理API）は前プロジェクトからの継承により**実装済み**。
Phase 5以降が今回新規に実装するイベントドメインの範囲であり、**Phase 5完了後、Phase 6〜10は並列実装可能**
（担当者・エージェントごとに1モジュールを割り当てられる）。Phase 11でモジュール登録を一括統合し、
Phase 12で結合確認する。

---

## Phase 1: 環境構築・基本設定【直列・実装済み】

- [x] 1.1 pnpm workspace（`package.json`, `pnpm-workspace.yaml`, `turbo.json`）を作成する
- [x] 1.2 `backend/`（NestJS/Prisma/CASL等の依存関係）を作成する
- [x] 1.3 `docker-compose.yml`（`db`/`backend`/`frontend`の3サービス）を作成する
- [x] 1.4 `.env.example`/`.env`（`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `APP_BASE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `TZ`）を作成する
- [x] 1.5 `packages/shared/`（Zodスキーマ・型定義の共有パッケージ）を初期化する
- [x] 1.6 `backend/prisma/schema.prisma`に`datasource`/`generator`、`SystemRole` Enum、`User`/`RefreshToken`モデルを作成する
- [x] 1.7 `backend/prisma/seed.ts`（初期Admin・サンプルmember投入）を作成する
- [x] 1.8 NestJSの`main.ts`・`AppModule`（cookie-parser, CORS, グローバル`ZodValidationPipe`）を作成する
- [x] 1.9 `PrismaModule`/`PrismaService`を作成する
- [x] 1.10 `common/filters/`に共通エラーレスポンス変換フィルター（`{ success: false, error }`）を作成する
- [x] 1.11 共通成功レスポンス整形用インターセプター（`{ success: true, data }`）を作成する

## Phase 2: 認証・認可基盤【直列・実装済み・Phase 1完了後】

- [x] 2.1 `packages/shared`にJWTペイロード型・共通レスポンス型を定義する
- [x] 2.2 Access/Refresh Token発行ユーティリティ（`TokenService`、有効期限: Access 15分 / Refresh 7日）を実装する
- [x] 2.3 `JwtStrategy`（httpOnly Cookieからトークン取得、`role`はDBから毎回引き直し）を実装する
- [x] 2.4 `JwtAuthGuard`を実装する
- [x] 2.5 `RefreshTokenService`（発行・検証・失効・ローテーション）を実装する
- [x] 2.6 `CaslAbilityFactory`（現状は`User` subjectのみ）を実装する
- [x] 2.7 `PoliciesGuard`・`@CheckPolicies`デコレータを実装する

## Phase 3: 認証API（`/auth/*`）【直列・実装済み・Phase 2完了後】

- [x] 3.1 `packages/shared`に`login`/`updateProfile`リクエストのZodスキーマを定義する
- [x] 3.2 `AuthModule`・`AuthController`・`AuthService`を実装する
- [x] 3.3 `POST /auth/login`を実装する
- [x] 3.4 `POST /auth/refresh`を実装する
- [x] 3.5 `POST /auth/logout`を実装する
- [x] 3.6 `GET /auth/me` / `PUT /auth/profile`を実装する

## Phase 4: ユーザー管理API（`/users/*`）【直列・実装済み・Phase 3完了後】

- [x] 4.1 `packages/shared`にロール更新のZodスキーマを定義する
- [x] 4.2 `UsersModule`・`UsersController`・`UsersService`を実装する
- [x] 4.3 `GET /users` / `GET /users/:id`を実装する
- [x] 4.4 `PUT /users/:id/role`を実装する
- [x] 4.5 `POST /users/:id/deactivate`を実装する

---

## Phase 5: Prismaスキーマ追加・マイグレーション【直列・Phase 6〜10全ての前提】

> このPhaseは全ての新規モジュールが依存する共通の土台のため、並列実装の前に必ず完了させる。
> 1人が担当し、完了後にPhase 6〜10を複数人/複数エージェントへ割り当てる。

- [ ] 5.1 `schema.prisma`に`RegistrationStatus`/`AttendanceStatus` Enumを追加する（[MANIFEST.md 5.4節](MANIFEST.md)）
- [ ] 5.2 `Category`モデルを追加する
- [ ] 5.3 `Tag`・`EventTag`モデルを追加する
- [ ] 5.4 `Event`モデルを追加する（`categoryId`/`organizerId`の`onDelete: Restrict`含む）
- [ ] 5.5 `Registration`モデルを追加する（`@@unique([eventId, userId])`含む）
- [ ] 5.6 `PromotionHistory`モデルを追加する（`promotedUser`/`vacatedByUser`の関係名指定含む）
- [ ] 5.7 `Feedback`モデルを追加する（`@@unique([eventId, userId])`含む）
- [ ] 5.8 `User`モデルに逆リレーション（`organizedEvents`, `registrations`, `feedbacks`, `promotionsReceived`, `promotionsCausedByCancel`）を追加する
- [ ] 5.9 `pnpm --filter backend prisma migrate dev`でマイグレーションを作成・適用する
- [ ] 5.10 `seed.ts`にカテゴリマスタ初期値（勉強会/懇親会/講演会/研修/その他）の投入処理を追加する

---

## Phase 6: カテゴリ管理API（`/categories`）【並列実装可・Phase 5完了後】

- [ ] 6.1 `packages/shared`にカテゴリ作成/更新のZodスキーマを定義する
- [ ] 6.2 `CategoriesModule`・`CategoriesController`・`CategoriesService`の雛形を作成する
- [ ] 6.3 `GET /categories`を実装する（紐づくイベント数を含める、[画面設計仕様.md 3.1.8節](画面設計仕様.md)）
- [ ] 6.4 `POST /categories`を実装する（admin限定、同名`409`）
- [ ] 6.5 `PUT /categories/:id`を実装する（admin限定、同名`409`）
- [ ] 6.6 `DELETE /categories/:id`を実装する（admin限定、`onDelete: Restrict`由来のFK制約違反をcatchし`409`へ変換）
- [ ] 6.7 `CaslAbilityFactory`に`Category` subjectの権限判定（admin=`manage`、member=`read`）を追加する

## Phase 7: イベント基本API（`/events`）【並列実装可・Phase 5完了後】

- [ ] 7.1 `packages/shared`にイベント作成/更新のZodスキーマを定義する（title/description/categoryId/tags/startAt/endAt/capacity/registrationDeadline/cancellationDeadline）
- [ ] 7.2 `EventsModule`・`EventsController`・`EventsService`の雛形を作成する
- [ ] 7.3 `GET /events`を実装する（カテゴリ絞り込み・キーワード検索・タグ検索・開催日順ソート、論理削除済み除外）
- [ ] 7.4 `POST /events`を実装する（`organizerId`=実行者自動設定、`startAt`過去日時`400`判定、タグの`upsert`）
- [ ] 7.5 `registrationState`計算ロジック（`NOT_REGISTERED`/`CONFIRMED`/`WAITLISTED`/`ORGANIZER`/`CLOSED`）を共通関数として実装する（[画面設計仕様.md 3.2節](画面設計仕様.md)）
- [ ] 7.6 `GET /events/:id`を実装する（参加者リスト・空き状況・`registrationState`・平均評価集計を含める）
- [ ] 7.7 `PUT /events/:id`を実装する（主催者本人/admin限定、`startAt`変更時の`hasRegisteredParticipants`判定含む）
- [ ] 7.8 `DELETE /events/:id`を実装する（論理削除、主催者本人/admin限定）
- [ ] 7.9 `CaslAbilityFactory`に`Event` subject（`organizerId`条件）の権限判定を追加する

## Phase 8: 参加登録・キャンセル・出席管理API【並列実装可・Phase 5完了後】

> 8.5〜8.6（繰り上げ処理）が本プロジェクトで最も複雑度の高い箇所。他タスクより時間を多めに見積もる。

- [ ] 8.1 `packages/shared`に出席マークのZodスキーマ（`attendanceStatus`）を定義する
- [ ] 8.2 `RegistrationsModule`・`RegistrationsController`・`RegistrationsService`の雛形を作成する（`/events`パス配下のサブリソースとして実装）
- [ ] 8.3 `POST /events/:id/register`を実装する（過去イベント`400`、締切超過`400`、主催者本人`409`、二重登録`409`）
- [ ] 8.4 待機登録時の`position`採番ロジック（当該イベントの現在最大`position` + 1）を実装する
- [ ] 8.5 `POST /events/:id/cancel`を実装する（本人はキャンセル期限内のみ、adminは`userId`指定で期限無視の強制キャンセル）
- [ ] 8.6 キャンセル時の繰り上げトランザクションを実装する（イベント行ロック→`Registration`削除→先頭待機者昇格→`PromotionHistory`保存、[MANIFEST.md 3.6節](MANIFEST.md)）
- [ ] 8.7 `GET /events/:id/registrations`を実装する（主催者本人/admin限定、出席状態含む）
- [ ] 8.8 `PUT /events/:id/registrations/:userId/attendance`を実装する（開催日時前`400`、主催者本人/admin限定、マーク後の変更許可）
- [ ] 8.9 `CaslAbilityFactory`に`Registration` subjectの権限判定を追加する

## Phase 9: フィードバックAPI（`/events/:id/feedbacks`, `/feedbacks/:id`）【並列実装可・Phase 5完了後】

> 投稿条件（開催終了済み＋`ATTENDED`）の判定はPhase 8の出席マーク実装と結合して初めて実地検証できるが、
> コード自体は`Registration`テーブルを直接参照するため、モジュール実装自体はPhase 8と並列に進められる。

- [ ] 9.1 `packages/shared`にフィードバック投稿/編集のZodスキーマ（`rating`(1〜5)/`comment`/`isAnonymous`）を定義する
- [ ] 9.2 `FeedbacksModule`・`FeedbacksController`・`FeedbacksService`の雛形を作成する
- [ ] 9.3 `GET /events/:id/feedbacks`を実装する（平均評価算出、非公開分除外、匿名投稿者の出し分け、adminは全件+投稿者情報表示）
- [ ] 9.4 `POST /events/:id/feedbacks`を実装する（投稿条件判定: 開催終了済み＋`ATTENDED`、1人1件`409`）
- [ ] 9.5 `PUT /feedbacks/:id`を実装する（投稿者本人限定）
- [ ] 9.6 `POST /feedbacks/:id/hide`を実装する（admin限定）
- [ ] 9.7 `CaslAbilityFactory`に`Feedback` subjectの権限判定を追加する

## Phase 10: マイページ集計API（`/users/me/events`, `/users/me/stats`）【並列実装可・Phase 5完了後】

- [ ] 10.1 `MyPageModule`（または`UsersModule`への追加）・Controller・Serviceの雛形を作成する
- [ ] 10.2 `GET /users/me/events`を実装する（主催イベント・参加予定・参加履歴の3区分クエリ）
- [ ] 10.3 `GET /users/me/stats`を実装する（累計参加数・出席率（未マーク除外）・カテゴリ別集計）

---

## Phase 11: モジュール統合【直列・Phase 6〜10完了後】

- [ ] 11.1 `AppModule`に新規モジュール（Categories/Events/Registrations/Feedbacks/MyPage）を一括登録する
- [ ] 11.2 全体の型チェック・Lint（`pnpm --filter backend build` / `lint`）を実行し、並列実装間の型不整合（Zodスキーマの重複定義等）を解消する
- [ ] 11.3 `pnpm --filter backend test`で既存＋新規テストを一括実行し、モジュール間結合の問題がないか確認する

## Phase 12: 結合確認【直列・Phase 11完了後、frontend-tasks.md Phase 12と合わせて実施】

- [ ] 12.1 `docker compose up --build`でdb/backend/frontend一式が起動することを確認する
- [ ] 12.2 seedデータ投入後、主要フロー（ログイン→イベント作成→参加登録→出席マーク→フィードバック投稿）を手動で一通り疎通確認する
- [ ] 12.3 満席時のキャンセル待ち登録→キャンセル→自動繰り上げのシナリオを手動確認する
- [ ] 12.4 カテゴリ削除（紐づくイベントあり）が`409`になることを確認する
