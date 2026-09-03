# バックエンドユニットテスト観点リスト

[docs/manifest.md](docs/manifest.md)「5. データモデリング」「6. API設計」を基に、実装コード（`backend/src/modules/*`）
と突き合わせて抽出したユニットテスト観点。正常系・認可エラー・バリデーションエラー・ビジネスルール違反を
モジュール単位で網羅する。`test-agent`がテストコードを書く際の一次チェックリストとして使う。

凡例: 【認可】=ロール・所有関係に基づくアクセス制御、【業務】=ビジネスルール違反、【入力】=バリデーション、
【正常】=正常系、【境界】=境界値・エッジケース

---

## 1. auth（`AuthService`、実装済み）

### login
- 【正常】正しいemail/passwordでAccess/Refresh Tokenが発行される
- 【業務】存在しないemail → `401`
- 【業務】パスワード不一致 → `401`
- 【業務】`isActive=false`（無効化済み） → `401`
- 【境界】上記3パターンすべて**同一のエラーメッセージ**であること（ユーザー列挙攻撃対策、CODING_STANDARDS 9章）
- 【入力】email形式不正 → `400`
- 【入力】password空文字 → `400`

### refresh
- 【正常】有効なRefresh Tokenでローテーション（新Access/Refresh Token発行、旧Refresh Tokenが`revokedAt`設定される）
- 【業務】無効・期限切れ・既に失効済みのRefresh Token → `401`

### logout
- 【正常】Refresh Tokenが失効される
- 【認可】未認証（Cookie無し） → `401`

### profile更新
- 【正常】表示名が更新される
- 【入力】name空文字 → `400`
- 【境界】更新対象は常に`@CurrentUser()`由来のuserIdのみで、bodyから他人のIDを受け取る経路が無いことの確認

---

## 2. users（`UsersService`、実装済み）

### GET /users, GET /users/:id
- 【正常】一覧・詳細取得（`passwordHash`が含まれないこと）
- 【認可】member実行 → `403`
- 【業務】存在しないid → `404`

### PUT /users/:id/role
- 【正常】MEMBER→ADMIN昇格
- 【正常】ADMIN→MEMBER降格（他に有効なADMINが残っている場合は成功）
- 【業務】**唯一の有効ADMINをMEMBERへ降格しようとした場合 → `409`**（`assertNotLastActiveAdmin`）
- 【境界】対象が既に`isActive=false`のADMINをMEMBERへ変更する場合は、残存ADMIN数の検証自体が走らないこと（`409`にならない）
- 【境界】対象がそもそもMEMBERの場合（ADMIN→ADMIN以外への変更でない）は検証が走らないこと
- 【入力】`role`が`"ADMIN"`/`"MEMBER"`以外 → `400`
- 【業務】存在しないid → `404`
- 【認可】member実行 → `403`

### POST /users/:id/deactivate
- 【正常】対象ユーザーが無効化される（`isActive=false`）
- 【業務】自分自身を対象にした場合 → `409`
- 【業務】**唯一の有効ADMINを無効化しようとした場合 → `409`**（`updateRole`と同じ`assertNotLastActiveAdmin`を共有）
- 【業務】存在しないid → `404`
- 【認可】member実行 → `403`

---

## 3. categories（`CategoriesService`、実装済み）

### GET /categories
- 【正常】一覧取得、各要素に`eventCount`が含まれる
- 【境界】`eventCount`は論理削除済み（`deletedAt`設定済み）のEventも含めてカウントすること（削除可否の参考情報としてDB制約と一致させるため）

### POST /categories
- 【正常】作成される
- 【業務】同名カテゴリが既に存在 → `409`
- 【入力】name空文字 → `400`
- 【入力】name51文字以上 → `400`
- 【認可】member実行 → `403`

### PUT /categories/:id
- 【正常】名前が更新される
- 【業務】同名カテゴリが既に存在 → `409`
- 【業務】存在しないid → `404`
- 【認可】member実行 → `403`

### DELETE /categories/:id
- 【正常】紐づくEventが無い場合、削除される（`204`）
- 【業務】**紐づくEventが1件でも存在する場合 → `409`**（`onDelete: Restrict`のFK制約違反、`P2003`→`ConflictException`変換）
- 【業務】存在しないid → `404`
- 【認可】member実行 → `403`

---

## 4. events（`EventsService`）

### GET /events
- 【正常】カテゴリ絞り込み（`?category=`）
- 【正常】キーワード検索（title/descriptionの部分一致、大文字小文字を区別しない）
- 【正常】タグ検索（複数タグ指定時はOR条件）、タグ名の大文字小文字・空白正規化との整合
- 【正常】ソート（`startAtAsc`(既定)/`startAtDesc`）
- 【境界】論理削除済み（`deletedAt`設定済み）イベントが一覧に含まれないこと
- 【正常】各要素の`confirmedCount`が`Registration.status=CONFIRMED`の件数と一致すること
- 【正常】各要素の`registrationState`が下記「registrationState計算」の全パターンで正しいこと

### POST /events
- 【正常】作成される（`organizerId`が実行者のidになる。bodyで指定した値があっても無視されること）
- 【入力】`startAt`が現在時刻以前（過去日時） → `400`
- 【入力】`capacity`が1未満 → `400`
- 【業務】存在しない`categoryId` → `404`
- 【正常】タグ: 既存タグ名を指定した場合は流用（`upsert`で重複作成されない）、新規タグ名は新規作成される
- 【境界】タグ名のtrim・小文字化後の重複除去

### GET /events/:id
- 【正常】`confirmedCount`/`waitlistedCount`がそれぞれのstatus件数と一致
- 【正常】`averageRating`: 非公開（`isHidden=true`）分を除外して算出、小数第1位に丸め
- 【境界】非公開分を除いた対象が0件の場合、`averageRating`は`null`（`0`ではない）
- 【業務】存在しない、または論理削除済み（`deletedAt`設定済み） → `404`
- **registrationState計算（一覧・詳細で共通のロジック）**:
  - 【正常】実行者が`organizerId`と一致 → `ORGANIZER`
  - 【正常】実行者に`CONFIRMED`の`Registration`がある → `CONFIRMED`
  - 【正常】実行者に`WAITLISTED`の`Registration`がある → `WAITLISTED`
  - 【正常】未登録かつ現在時刻が`registrationDeadline`（未設定時は`startAt`）を過ぎている → `CLOSED`
  - 【正常】未登録かつ現在時刻が`startAt`を過ぎている（`registrationDeadline`未到来でも開催自体が過去） → `CLOSED`
  - 【正常】未登録かつ締切前・開催前 → `NOT_REGISTERED`
  - 【境界】`ORGANIZER`判定は`Registration`の有無より優先される（主催者は`Registration`行を持たないため実質的に排他だが、優先順位として明示的にテストする）

### PUT /events/:id
- 【正常】部分更新（一部フィールドのみ送信しても他は維持される）
- 【認可】主催者本人でもadminでもない → `403`
- 【業務】`startAt`を変更し、`CONFIRMED`の登録者が1人以上いる場合 → レスポンスに`hasRegisteredParticipants: true`
- 【境界】`startAt`を変更しても`CONFIRMED`登録者が0人の場合 → `hasRegisteredParticipants: false`
- 【境界】`startAt`を変更しない更新の場合 → `hasRegisteredParticipants`の判定自体が走らない（`false`）
- 【入力】変更後の`startAt`が過去日時 → `400`
- 【業務】存在しない`categoryId`を指定 → `404`
- 【正常】`tags`を指定した場合、既存の`EventTag`が全置換される（削除→再作成）
- 【業務】存在しない、または論理削除済みのイベント → `404`

### DELETE /events/:id
- 【正常】論理削除される（`deletedAt`が設定される、物理削除されない）
- 【認可】主催者本人でもadminでもない → `403`
- 【業務】存在しない、または既に削除済み → `404`

---

## 5. registrations（`RegistrationsService`）— 最重要・最複雑な領域

### POST /events/:id/register
- 【正常】定員に空きがある → `CONFIRMED`、`position: null`
- 【正常】満席 → `WAITLISTED`、`position`は当該イベントの現在の最大`position` + 1
- 【境界】待機者が1人もいない状態での初回待機登録 → `position: 1`
- 【業務】**主催者本人が自イベントに登録しようとした場合 → `409`**
- 【業務】既に`CONFIRMED`または`WAITLISTED`で登録済み（`(eventId, userId)`一意制約） → `409`
- 【入力】イベントの`startAt`を過ぎている（開催済み） → `400`
- 【入力】登録締切（`registrationDeadline`、未設定時は`startAt`）を過ぎている → `400`
- 【業務】存在しない、または論理削除済みのイベント → `404`
- 【境界】イベント行ロック（`SELECT ... FOR UPDATE`）を経由し、トランザクション内で二重登録チェック・定員カウントが（ロック取得後に）再評価されること（モックでの呼び出し順序・トランザクション境界の検証）

### POST /events/:id/cancel
- 【正常】本人が期限内に`CONFIRMED`をキャンセル
- 【正常】本人が期限内に`WAITLISTED`をキャンセル（待機解除）
- **繰り上げトランザクション（最重要）**:
  - 【正常】`CONFIRMED`のキャンセル時、当該イベントの`WAITLISTED`のうち`position`が最小の者が`CONFIRMED`に昇格し`position: null`になる
  - 【正常】昇格と同時に`PromotionHistory`（`eventId`, `promotedUserId`=昇格者, `vacatedByUserId`=キャンセルした本人）が保存される
  - 【境界】待機者が0人の場合、削除のみで完了し`PromotionHistory`は作成されない
  - 【境界】`WAITLISTED`（待機解除）のキャンセル時は繰り上げ処理自体が発火しないこと
  - 【境界】イベント行ロックの範囲内で削除・昇格・履歴保存が1トランザクションとして実行されること
- 【業務】本人のキャンセル可能期限（`cancellationDeadline`、未設定時は`startAt`）を過ぎている（`userId`未指定＝通常キャンセル） → `403`
- 【正常】adminが`userId`指定で強制キャンセル → キャンセル可能期限を無視して成功
- 【認可】`userId`指定時、実行者がADMINでない → `403`
- 【業務】対象の`Registration`が存在しない → `404`

### GET /events/:id/registrations
- 【正常】`CONFIRMED`の登録のみ返す（`WAITLISTED`は含まれない）
- 【正常】各要素に`attendanceStatus`（未マークは`null`）が含まれる
- 【認可】主催者本人でもadminでもない → `403`
- 【業務】存在しないイベント → `404`

### PUT /events/:id/registrations/:userId/attendance
- 【正常】`ATTENDED`/`ABSENT`をマークできる
- 【正常】マーク済みの上書き変更ができる（誤操作リカバリ、追加の確認や制限が無いこと）
- 【入力】開催日時前（`now < event.startAt`） → `400`
- 【認可】主催者本人でもadminでもない → `403`
- 【業務】対象ユーザーの`CONFIRMED`登録が存在しない（未登録、または`WAITLISTED`のみ） → `404`

---

## 6. feedbacks（`FeedbacksService`）

### GET /events/:id/feedbacks
- 【正常】`averageRating`: 非公開分除外・小数第1位に丸め、対象0件時は`null`
- 【認可/表示制御】非adminには`isHidden=true`のレビューが一切含まれない
- 【認可/表示制御】非adminかつ`isAnonymous=true`の投稿は`author: null`
- 【認可/表示制御】adminには非公開分も含め全件返る。`isHidden`が各要素に含まれる。匿名投稿でも`author`は常に実名
- 【正常】`isMine`は投稿者本人の要素のみ`true`（匿名投稿かどうかとは独立に判定されること）
- 【業務】存在しない、または論理削除済みのイベント → `404`

### POST /events/:id/feedbacks
- 【正常】投稿できる（`isAnonymous: true`/`false`の両方）
- 【業務】**主催者本人が自イベントに投稿しようとした場合 → `403`**
- 【業務】イベントが未終了（`endAt`、無ければ`startAt`が未来） → `403`
- 【業務】投稿者の`attendanceStatus`が`ATTENDED`でない（`ABSENT`/未マーク/未登録） → `403`
- 【業務】既に投稿済み（`(eventId, userId)`一意制約） → `409`
- 【入力】`rating`が1〜5の範囲外（0、6等） → `400`
- 【入力】`comment`が空文字 → `400`
- 【業務】存在しないイベント → `404`

### PUT /feedbacks/:id
- 【正常】投稿者本人による更新
- 【認可】投稿者本人以外（**adminであっても**） → `403`
- 【業務】存在しないid → `404`

### POST /feedbacks/:id/hide
- 【正常】adminが非公開化できる（`isHidden: true`）
- 【認可】member実行 → `403`（`PoliciesGuard`レベルで拒否）
- 【業務】存在しないid → `404`

---

## 7. my-page（`MyPageService`）

### GET /users/me/events
- 【正常】`organizing`: 本人が主催、論理削除済みは除外、`capacity`/`confirmedCount`/`waitlistedCount`が正しく集計される
- 【正常】`upcoming`: `CONFIRMED`/`WAITLISTED`かつ`event.startAt > now`かつ論理削除済み除外
- 【正常】`history`: `event.startAt <= now`かつ論理削除済み除外、`attendanceStatus`（未マークは`null`）を含む
- 【境界】主催イベントは`Registration`を持たないため、`organizing`と`upcoming`/`history`が重複しないこと
- 【認可】常に`@CurrentUser()`由来のuserIdのみを対象とし、他人のイベントが混入しないこと

### GET /users/me/stats
- 【正常】`totalParticipations`: `CONFIRMED`かつ開催済み（`startAt <= now`）かつ論理削除済みでないイベントのみカウント
- 【正常】`attendanceRate` = 出席回数 ÷ (出席回数 + 欠席回数)、未マークは分母から除外
- 【境界】出席マーク済みの登録が1件も無い場合、`attendanceRate`は`null`（0除算しない）
- 【正常】`byCategory`: カテゴリ名ごとの件数集計、0件のカテゴリは配列に含まれない
- 【認可】常に本人分のみ集計されること

---

## 横断的な観点

- 【共通】Prismaエラー変換の網羅: `P2002`（一意制約違反）→`409`、`P2025`（対象不在）→`404`、`P2003`（FK制約違反）→`409`が、categories/events/registrations/feedbacksの各Serviceで一貫していること。
- 【認可】[MANIFEST.md 2章の権限マトリクス](docs/manifest.md)（全28エンドポイント）と実装のGuard/Service内チェックの対応が漏れなく取れているか、エンドポイント一覧と照らして横断チェックする。
- 【共通】日時比較が絡む全テスト（過去日時判定、締切判定、開催前判定）は`jest.useFakeTimers()`で現在時刻を固定してから検証し、実行タイミングに依存しないこと。
