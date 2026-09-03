# コーディング規約

本ドキュメントは、[manifest.md](manifest.md) で定義された技術スタック・ディレクトリ構成に基づき、
開発チームが従うべきコーディング規約を定めるものである。

対象スタック（[技術スタック.md](技術スタック.md)より）:

| 領域 | 技術 |
|---|---|
| Monorepo管理 | pnpm workspace + turbo |
| フロントエンド | React 18 + TypeScript + Vite + TanStack Query + Tailwind CSS + React Hook Form + Zod |
| バックエンド | Node.js + TypeScript + NestJS(内部でExpress) + CASL |
| データベース | PostgreSQL + Prisma |
| ユニットテスト | Vitest（フロント）/ Jest（バック） |
| E2Eテスト | Playwright |

---

## 1. 全般的な言語規約（TypeScript共通）

### 1.1 コンパイラ / リンター推奨設定

`tsconfig.json` は `backend`・`frontend`・`packages/shared` すべてで strict モードを必須とする。

```jsonc
// tsconfig.base.json（リポジトリルート、各パッケージから extends する）
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

ESLint（`@typescript-eslint`）は`backend/.eslintrc.cjs`・`frontend/.eslintrc.cjs`の通り以下を必須ルールとする。

```jsonc
// .eslintrc.cjs（抜粋、backend/frontend共通方針）
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "import/order": ["error", { "newlines-between": "always", "alphabetize": { "order": "asc" } }]
  }
}
```

- Lint・型チェック（`tsc --noEmit`）はCIを導入しない方針（詳細要求リスト.md 8章）のため、各自コミット前に
  `pnpm lint` / `pnpm build`（backend/frontendそれぞれ）を手元で実行することを必須の習慣とする。
- `// eslint-disable` の追加はレビュー必須。理由コメントなしの抑制はNG。

### 1.2 型定義ルール

- **`any` 禁止**。外部入力・未知形状は `unknown` を使い、Zodスキーマでナローイングする。
- API・DTOの型は `packages/shared` のZodスキーマから `z.infer` で導出し、手書きの重複した型定義を作らない（3章「バリデーション」参照）。
- オブジェクトの形は `interface`、Union/Intersection/Utility型の合成は `type` を使う。
- Enumは `enum` ではなく、Prismaが生成するUnion型 or `as const` オブジェクトを優先する（TypeScriptの `enum` はTree-shakingやJS出力に難があるため）。ただしPrismaの `SystemRole`, `RegistrationStatus`, `AttendanceStatus` 等、Prisma Client由来のenumはそのまま使用してよい。

```ts
// Good: packages/shared 側でZodスキーマを一箇所に定義し、型はそこから導出する
export const CreateEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  categoryId: z.string().cuid(),
  tags: z.array(z.string().min(1)).default([]),
  startAt: z.string().datetime(),
  capacity: z.number().int().min(1),
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
```

```ts
// Bad: フロント・バックそれぞれで同じ形の型を手書きし、Zodスキーマと二重管理になる
interface CreateEventInput {
  title: string;
  capacity: number | string; // 数値のはずが文字列も許容してしまっている
}
```

```ts
// Bad: any でのすり抜け
function handleRegister(payload: any) {
  return payload.eventId; // 型安全性が失われ、リファクタ時に壊れても検知できない
}

// Good: unknown + Zodでパース
function handleRegister(payload: unknown) {
  const { eventId } = RegisterEventSchema.parse(payload);
  return eventId;
}
```

### 1.3 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| 変数・関数 | camelCase | `confirmedRegistrations`, `fetchEventDetail()` |
| React コンポーネント | PascalCase | `EventCard`, `RegistrationActionButton` |
| カスタムフック | `use` + camelCase | `useEventDetail`, `useRegisterEvent` |
| クラス（NestJS Service/Controller等） | PascalCase | `EventsService`, `EventsController` |
| 型・インターフェース・Zodスキーマ | PascalCase（スキーマ末尾は`Schema`） | `CreateEventInput`, `CreateEventSchema` |
| Enum型名 / Enum値 | PascalCase / UPPER_SNAKE_CASE | `RegistrationStatus.CONFIRMED` |
| 定数（モジュールスコープの不変値） | UPPER_SNAKE_CASE | `ACCESS_TOKEN_TTL_SECONDS` |
| ファイル名（NestJS: モジュール/サービス/コントローラ等） | kebab-case + 役割サフィックス | `events.controller.ts`, `events.service.ts`, `create-event.dto.ts` |
| ファイル名（Reactコンポーネント） | PascalCase | `EventCard.tsx`, `EventDetailPage.tsx` |
| ファイル名（フック・ユーティリティ） | kebab-case または camelCase（プロジェクト内で統一） | `useEventDetail.ts`（前プロジェクトの既存資産に合わせcamelCaseで統一する） |
| ディレクトリ名 | kebab-case | `my-page/`, `event-tags/` |

```ts
// Bad: 略語・意味不明な短縮
const evLst = await svc.getEv();

// Good: 意図が読み取れる名前
const upcomingEvents = await eventsService.findUpcoming();
```

### 1.4 インポート順序

`import/order` ルールにより以下の4グループを空行で区切り、各グループ内はアルファベット順とする。

1. Node.js標準モジュール（`node:crypto` 等）
2. 外部パッケージ（`react`, `@nestjs/common` 等）
3. モノレポ内の別パッケージ（`@eventboard/shared` 等）
4. 相対パス（`./`, `../`）

```ts
// Good
import { createHash } from "node:crypto";

import { Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type { CreateEventInput } from "@eventboard/shared";

import { PrismaService } from "../../prisma/prisma.service";
import { EventsRepository } from "./events.repository";
```

```ts
// Bad: 順不同、グループ未整理
import { EventsRepository } from "./events.repository";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { CreateEventInput } from "@eventboard/shared";
```

---

## 2. フロントエンド規約（`frontend/`）

### ディレクトリ構成

[MANIFEST.md 8章「ディレクトリ構成」](manifest.md)で定義されたfeature-based構成に従う。新規画面・モーダルは対応する
`features/*` 配下に配置し、横断的な共通コンポーネントのみ `components/ui/` に置く。

```
frontend/src/
├── features/
│   ├── auth/               # 実装済み（ログイン・プロフィール）
│   ├── events/             # 一覧・詳細・作成・編集（1機能=1ディレクトリにcomponents/hooks/api.tsをまとめる）
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api.ts
│   ├── my-page/
│   ├── attendance/
│   ├── feedbacks/
│   └── admin/
│       └── categories/
├── components/
│   ├── ui/                 # Button, Modal, Toast, ConfirmDialog(M-07) 等の汎用UI
│   └── layout/              # AppLayout, Header
├── lib/                     # APIクライアント共通部分、dayjs設定
└── router/
```

- **Good**: `events` 機能内でしか使わないコンポーネント（例: `RegistrationActionButton`）は `features/events/components/` に置く。
- **Bad**: 特定機能専用のコンポーネントを安易に `components/ui/` に置き、再利用の実態がないのに「共通」扱いする。

### コンポーネント設計

- 関数コンポーネント + Hooksのみを使用する（クラスコンポーネント禁止）。
- Props型は必ず明示的に定義し、`React.FC` は使わない（`children` の暗黙的な型付けを避けるため）。
- 1コンポーネント1責務。データ取得（TanStack Query）とプレゼンテーションを分離し、「Container（データ取得・状態管理）」と「Presentational（表示のみ、Props駆動）」を意識して分ける。

```tsx
// Good: Propsの型を明示し、表示ロジックのみに専念する
type EventCardProps = {
  event: EventSummary;
  onOpenDetail: (eventId: string) => void;
};

export function EventCard({ event, onOpenDetail }: EventCardProps) {
  return (
    <button onClick={() => onOpenDetail(event.id)} className="rounded-md border p-3 text-left">
      <p className="font-medium">{event.title}</p>
      <CategoryBadge category={event.category} />
    </button>
  );
}
```

```tsx
// Bad: コンポーネント内でAPI呼び出し・グローバル副作用・表示が混在
export function EventCard({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<any>(null);
  useEffect(() => {
    fetch(`/api/events/${eventId}`).then((r) => r.json()).then(setEvent); // TanStack Queryを使わず自前fetch
  }, [eventId]);
  if (!event) return null;
  return <div>{event.title}</div>;
}
```

```tsx
// Bad
const EventCard: React.FC<EventCardProps> = ({ event }) => { /* ... */ };

// Good
function EventCard({ event }: EventCardProps) { /* ... */ }
```

### カスタムフック

- データ取得・更新はTanStack Queryをラップした専用フックに閉じ込め、コンポーネントから直接 `useQuery`/`useMutation` を呼ばせない（キー管理・エラーハンドリングを一元化するため）。
- Query Key は配列形式で階層化し、`features/*/api.ts` に集約する（既存の`features/auth/api.ts`の`authKeys`を参照）。

```ts
// features/events/api.ts
export const eventKeys = {
  all: ["events"] as const,
  list: (filters: EventListFilters) => [...eventKeys.all, "list", filters] as const,
  detail: (eventId: string) => [...eventKeys.all, "detail", eventId] as const,
};

// features/events/hooks/useRegisterEvent.ts
export function useRegisterEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post(`/events/${eventId}/register`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) }),
  });
}
```

```tsx
// Bad: コンポーネント内に直接useMutationとエンドポイントのURLをベタ書き
function RegisterButton({ eventId }: { eventId: string }) {
  const mutation = useMutation({
    mutationFn: () => fetch(`/events/${eventId}/register`, { method: "POST" }),
  });
  // invalidateQueriesが呼ばれず画面が更新されない、他画面でも同じロジックが重複する
}
```

### スタイリング（Tailwind CSS）

- Utility-firstを徹底し、独自CSSファイル（`.css`）は原則作成しない。繰り返し使うスタイルの組み合わせは `class-variance-authority`（cva）でバリアントとして定義する。
- カラー・スペーシングは `tailwind.config.ts` のデザイントークンを使い、マジックナンバーの直書き（`w-[137px]` 等）は避ける。

```tsx
// Good: バリアントをcvaで一元管理
const categoryBadgeVariants = cva("rounded-full px-2 py-0.5 text-xs font-medium", {
  variants: {
    category: {
      勉強会: "bg-blue-100 text-blue-700",
      懇親会: "bg-pink-100 text-pink-700",
      講演会: "bg-purple-100 text-purple-700",
    },
  },
});
```

```tsx
// Bad: 条件分岐で毎回クラス名を組み立て、色の定義が各所に散らばる
function CategoryBadge({ category }: { category: string }) {
  let cls = "rounded-full px-2 py-0.5 text-xs";
  if (category === "勉強会") cls += " bg-blue-100 text-blue-700";
  // 他のコンポーネントで同じ配色を再定義してしまい、デザイン変更時に漏れが出る
  return <span className={cls}>{category}</span>;
}
```

### 状態管理

3種類の状態を明確に分離する。

| 状態の種類 | 使用する仕組み | 例 |
|---|---|---|
| サーバー状態（APIから取得するデータ） | TanStack Query | イベント一覧、参加者リスト |
| フォーム状態 | React Hook Form + Zod resolver | イベント作成/編集フォーム、フィードバック投稿フォーム |
| ローカルUI状態（画面内で完結） | `useState` / `useReducer` | モーダルの開閉、マイページのタブ選択 |

グローバルなクライアント状態管理ライブラリ（Redux, Zustand等）は導入しない（選定要素提案.md 1章）。
サーバー状態はTanStack Queryのキャッシュで十分に賄い、真にアプリ全体で共有すべきUI状態
（例: ログインユーザー情報）が出てきた場合のみ React Context を検討する。

```tsx
// Good: フォームはRHF + Zod、サーバー状態はTanStack Queryで完結
const form = useForm<CreateEventInput>({
  resolver: zodResolver(CreateEventSchema),
  defaultValues: { capacity: 10, tags: [] },
});
const { mutate: createEvent } = useCreateEvent();

const onSubmit = form.handleSubmit((data) => createEvent(data));
```

```tsx
// Bad: サーバーから取得したデータをuseStateへコピーして自前で同期・再取得を管理する
const [events, setEvents] = useState<Event[]>([]);
useEffect(() => {
  apiClient.get("/events").then((res) => setEvents(res.data));
}, []);
// キャッシュ・再検証・ローディング/エラー状態を自前実装する羽目になり、TanStack Queryの利点を捨てている
```

---

## 3. バックエンド規約（`backend/`）

### ディレクトリ構成

[MANIFEST.md 8章「ディレクトリ構成」](manifest.md)の通り、NestJSモジュールを[MANIFEST.md 6章](manifest.md)の
主要リソース区分と1:1に対応させる。

```
backend/src/
├── modules/
│   ├── auth/              # 実装済み
│   ├── users/              # 実装済み（admin向けユーザー管理）
│   ├── categories/
│   ├── events/
│   ├── registrations/      # 参加登録・キャンセル・出席マーク（events配下のサブリソース）
│   └── feedbacks/
├── common/
│   ├── auth/               # JWT発行/検証、Refresh Token管理
│   ├── casl/                # 権限マトリクスを実装するAbility定義
│   ├── guards/              # JwtAuthGuard, PoliciesGuard
│   ├── config/              # 環境変数バリデーション
│   └── filters/             # 共通エラーレスポンス変換
└── prisma/                  # PrismaService/PrismaModule
```

新しいリソースを追加する場合は、既存のリソース単位のモジュール構成を踏襲し、機能ごとにモジュールを分割しない
（例: 出席マーク機能を`events`モジュールに混在させず`registrations`モジュールとして独立させる）。

### レイヤードアーキテクチャ

Controller → Service → PrismaService（データアクセス）の3層に責務を分離する。

| 層 | 責務 | やってはいけないこと |
|---|---|---|
| Controller | ルーティング、DTO検証、認可Guardの適用、Serviceの呼び出し | ビジネスロジック・Prisma直接呼び出しを書かない |
| Service | ビジネスロジック（状態遷移、定員・締切判定等のドメインルール） | `Request`/`Response` オブジェクトに依存しない |
| PrismaService | データアクセスのみ | ビジネスルールの判定を書かない |

```ts
// Good: Controllerは薄く、委譲に徹する
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post(":id/register")
  @UseGuards(JwtAuthGuard, PoliciesGuard)
  register(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.register(id, user.id);
  }
}

// events.service.ts
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async register(eventId: string, userId: string) {
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    if (event.organizerId === userId) {
      throw new ConflictException("主催者は自身のイベントに参加登録できません");
    }
    // ... 定員・締切判定を経て Registration を作成
  }
}
```

```ts
// Bad: Controllerがビジネスロジックとデータアクセスを直接持つ
@Controller("events")
export class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(":id/register")
  async register(@Param("id") id: string, @Body() body: any) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (event.organizerId === body.userId) throw new ConflictException(); // Service層を経由せずルールが散逸する
    return this.prisma.registration.create({ data: { eventId: id, userId: body.userId, status: "CONFIRMED" } });
  }
}
```

### ルーティング

[MANIFEST.md 6章「設計方針」](manifest.md)のshallow routing方針に従う。

- 親リソースに紐づく「一覧取得・新規作成」はネスト: `/events/:eventId/registrations`
- IDだけで一意特定できる「単一リソースの取得・更新・削除」はフラット: `/events/:id`, `/feedbacks/:id`
- 単純なフィールドの部分更新は `PUT`（例: `/events/:id`）、業務ルール上の状態遷移・副作用を伴う操作は専用アクションの `POST`（例: `/events/:id/register`, `/events/:id/cancel`）。

```ts
// Good: 状態遷移は専用アクションエンドポイントとして表現
@Post(":id/cancel")
cancel(@Param("id") id: string, @CurrentUser() user: AuthUser, @Body() dto: CancelRegistrationDto) {
  return this.eventsService.cancel(id, dto.userId ?? user.id, user);
}

// Bad: 状態遷移を汎用PUTのフィールド更新に混ぜ込む
@Put(":id")
update(@Param("id") id: string, @Body() dto: { registrationStatus?: string }) {
  // "キャンセル"という業務アクション（繰り上げ処理を伴う）が単なるフィールド更新に埋没し、
  // 副作用（繰り上げ・履歴保存）の実装漏れを誘発する
  return this.eventsService.update(id, dto);
}
```

### エラーハンドリング

- NestJS標準の `HttpException` サブクラス（`NotFoundException`, `ConflictException`, `ForbiddenException` 等）を使う。`throw new Error(...)` の直接使用は禁止。
- レスポンス整形はグローバルな `Exception Filter`（`common/filters/http-exception.filter.ts`、実装済み）に一元化し、5章「API設計規約」で定める `{ success: false, error: {...} }` 形式に変換する。個々のController/Serviceでレスポンス整形をしない。

```ts
// Good
if (registration) {
  throw new ConflictException("既に参加登録済み、またはキャンセル待ち登録済みです");
}

// Bad: 汎用Errorを投げてしまい、フィルタでステータス・レスポンス形式を判別できない
if (registration) {
  throw new Error("already registered");
}
```

### バリデーション

- リクエストの検証は `packages/shared` のZodスキーマを正とし、`nestjs-zod` でDTOに変換して
  `ZodValidationPipe`（`main.ts`でグローバル設定済み）に接続する。NestJSとフロントエンドで別々に
  バリデーションルールを再実装しない。
- DTOクラスにビジネスルール（例: 「定員に達しているか」）を書かない。DTOはリクエストの形（shape）の
  検証のみを担い、業務ルールはService層で検証する。

```ts
// packages/shared/src/schemas/events.ts
export const CreateEventSchema = z.object({ title: z.string().min(1), capacity: z.number().int().min(1) /* ... */ });

// backend/src/modules/events/dto/create-event.dto.ts
export class CreateEventDto extends createZodDto(CreateEventSchema) {}
```

```ts
// Bad: Controller内でad-hocに検証し、フロントと矛盾するルールが生まれる
@Post()
create(@Body() body: { capacity?: number }) {
  if (!body.capacity || body.capacity < 1) { // Zodスキーマと無関係な独自ルール
    throw new BadRequestException();
  }
}
```

---

## 4. ORM / データベース規約（Prisma）

### スキーマ設計（命名規則）

| 対象 | 規則 | 例 |
|---|---|---|
| モデル名 | 単数形PascalCase | `model Event { ... }` |
| テーブル名（`@@map`） | 複数形snake_case | `@@map("events")` |
| フィールド名（Prisma側） | camelCase | `organizerId`, `startAt` |
| Enum型名 | PascalCase | `RegistrationStatus` |
| Enum値 | UPPER_SNAKE_CASE | `CONFIRMED`, `WAITLISTED` |
| リレーション名（複数リレーション回避用） | 用途を表す名前 | `@relation("PromotionPromotedUser")` |
| インデックス | 外部キー・検索頻度の高いカラムに `@@index` | `@@index([organizerId])` |

- 日時は原則 `@db.Timestamptz(3)`（[MANIFEST.md 5.4節](manifest.md)参照）。
- 現在時刻に依存する制約（過去日時禁止・締切判定等）はPrismaのCHECK制約では表現せず、Service層で判定する（[MANIFEST.md 5.5節](manifest.md)、詳細要求リスト.md 4章「日時に依存するバリデーション」）。

```prisma
// Good: 用途が異なる複数のUserリレーションには関係名を明示する
model PromotionHistory {
  promotedUser  User @relation("PromotionPromotedUser", fields: [promotedUserId], references: [id])
  vacatedByUser User @relation("PromotionVacatedByUser", fields: [vacatedByUserId], references: [id])
}
```

```prisma
// Bad: 同一モデルへの複数リレーションに関係名を付けず、Prismaが自動生成する曖昧な名前に頼る
model PromotionHistory {
  promotedUser  User @relation(fields: [promotedUserId], references: [id])
  vacatedByUser User @relation(fields: [vacatedByUserId], references: [id])
}
```

### クライアント設定

- `PrismaClient` はアプリ全体でシングルトンとし、NestJSの `PrismaService`（`OnModuleInit`/`OnModuleDestroy` で接続管理、実装済み）経由でのみ利用する。各Serviceで `new PrismaClient()` しない。

```ts
// Bad: Service内で個別にPrismaClientをインスタンス化し、コネクションプールを圧迫する
@Injectable()
export class EventsService {
  private prisma = new PrismaClient();
}
```

- 開発環境ではクエリログ（`log: ["query", "warn", "error"]`）を有効化し、本番相当では `warn`/`error` のみに絞る。

### クエリ設計（N+1・全件取得対策）

- ループ内で`findUnique`/`findMany`等を個別に呼ぶ実装（真性N+1）はしない。配列に対する集計・存在確認が
  必要な場合は`in`条件でまとめて取得するか、`groupBy`/`_count`で1クエリに集約する。
- 一覧系エンドポイントで各行に紐づく件数（例: `confirmedCount`）を返す場合、対象リレーションを`include`で
  行ごと丸ごと取得してアプリケーション層で`filter`/`find`する実装はしない。行数×紐づく件数でレスポンス
  サイズ・メモリ使用量が線形以上に増えるため、`groupBy`等の集計クエリでDB側に必要な件数のみを計算させる
  （[MANIFEST.md 6章「設計方針」](manifest.md)）。

```ts
// Good: confirmedCountはgroupByでDB側に集計させ、自分の登録のみ絞り込んで取得する
const events = await this.prisma.event.findMany({ where, include: { category: true } });
const eventIds = events.map((event) => event.id);
const [confirmedCounts, myRegistrations] = await Promise.all([
  this.prisma.registration.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds }, status: "CONFIRMED" },
    _count: { _all: true },
  }),
  this.prisma.registration.findMany({
    where: { eventId: { in: eventIds }, userId: user.id },
    select: { eventId: true, status: true },
  }),
]);
```

```ts
// Bad: 全イベントの参加登録行を丸ごとincludeし、JS側でfilter/findして集計する
// （イベント数×参加者数でレスポンス・メモリ使用量が増える。修正前のEventsService.findAllで実際に発生した問題）
const events = await this.prisma.event.findMany({
  where,
  include: { category: true, registrations: true },
});
return events.map((event) => ({
  confirmedCount: event.registrations.filter((r) => r.status === "CONFIRMED").length,
  myRegistration: event.registrations.find((r) => r.userId === user.id) ?? null,
}));
```

### トランザクション

- 複数テーブルへの書き込みが1つの業務操作として不可分な場合（例: キャンセル時の`Registration`削除 +
  待機者の繰り上げ + `PromotionHistory`保存）は `prisma.$transaction` でまとめる（[MANIFEST.md 3.6節](manifest.md)）。

```ts
// Good: キャンセル・繰り上げ・履歴保存をアトミックに実行
async cancel(eventId: string, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    // WHY: 同一イベントへの同時キャンセル・登録による競合を避けるため、繰り上げ判定の前に
    // イベント行をロックする（詳細要求リスト.md 4章「繰り上げの排他制御」）
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;

    await tx.registration.delete({ where: { eventId_userId: { eventId, userId } } });

    const nextInLine = await tx.registration.findFirst({
      where: { eventId, status: "WAITLISTED" },
      orderBy: { position: "asc" },
    });
    if (nextInLine) {
      await tx.registration.update({
        where: { id: nextInLine.id },
        data: { status: "CONFIRMED", position: null },
      });
      await tx.promotionHistory.create({
        data: { eventId, promotedUserId: nextInLine.userId, vacatedByUserId: userId },
      });
    }
  });
}
```

```ts
// Bad: 個別に呼び出し、途中で失敗すると不整合な状態が残る
async cancel(eventId: string, userId: string) {
  await this.prisma.registration.delete({ where: { eventId_userId: { eventId, userId } } });
  const nextInLine = await this.prisma.registration.findFirst({ where: { eventId, status: "WAITLISTED" } });
  if (nextInLine) {
    await this.prisma.registration.update({ where: { id: nextInLine.id }, data: { status: "CONFIRMED" } });
    // 繰り上げの更新が失敗しても削除は既にコミット済みで、繰り上げ漏れに気づけない
  }
}
```

---

## 5. API設計規約

### RESTful命名

- リソース名は複数形の名詞（`/events`, `/categories`）。動詞をパスに含めるのは、状態遷移用の専用アクション（`/events/:id/register` 等）のみに限定する（[MANIFEST.md 6章](manifest.md)参照）。

```
Good: GET  /events/:eventId/registrations
Good: POST /events/:id/cancel
Bad:  GET  /getRegistrationsByEvent/:eventId
Bad:  POST /events/:id/updateRegistrationStatus   （POST /events/:id/register または /cancel を使う）
```

### レスポンス形式

全APIレスポンスは共通のエンベロープ形式に従う（[MANIFEST.md 6章](manifest.md)、実装済み）。

```jsonc
// 成功時
{ "success": true, "data": { /* リソース or 配列 */ } }

// 一覧APIで集計値を併せて返す例外ケース（例: GET /events/:id/feedbacks）
{ "success": true, "data": { "averageRating": 4.2, "feedbacks": [ /* ... */ ] } }

// エラー時
{ "success": false, "error": { "code": "ConflictException", "message": "既に参加登録済みです" } }
```

- `data` は原則として配列。集計値を伴う一覧APIのみオブジェクト形式の例外を認める。むやみに例外を増やさない。
- エラーメッセージはエンドユーザー（日本語UI）にそのまま表示され得る文言とし、内部実装の詳細（スタックトレース、SQL文等）を含めない。

### HTTPステータスコード

| コード | 用途 |
|---|---|
| `200 OK` | 取得・更新成功 |
| `201 Created` | 新規作成成功（`POST /events`, `POST /categories` 等） |
| `204 No Content` | 削除成功（`DELETE /events/:id`, `DELETE /categories/:id`） |
| `400 Bad Request` | リクエストのバリデーションエラー |
| `401 Unauthorized` | 未認証・トークン無効/期限切れ |
| `403 Forbidden` | 認証済みだが権限不足（CASLの認可失敗、キャンセル期限超過等） |
| `404 Not Found` | 指定リソースが存在しない |
| `409 Conflict` | 業務ルール違反（二重登録、一意制約違反、紐づくイベントが存在するカテゴリの削除等） |

```ts
// Good: 意味に応じたステータスコードを持つ例外を選ぶ
throw new ConflictException("このカテゴリに紐づくイベントが存在するため削除できません"); // 409

// Bad: 何でも400で返し、クライアント側でエラー種別を判別できなくする
throw new BadRequestException("error"); // 本来409で表現すべき業務ルール違反
```

---

## 6. テスト規約

### ファイル構成

- ユニットテストはテスト対象と同じディレクトリに配置するコロケーション方式。
  - バックエンド（Jest）: `events.service.ts` → `events.service.spec.ts`
  - フロントエンド（Vitest）: `EventCard.tsx` → `EventCard.test.tsx`
- E2Eテスト（Playwright）は `frontend/tests/` に画面単位で配置する（例: `tests/event-registration.spec.ts`）。

### 命名規則

- `describe` は対象（クラス名・コンポーネント名・関数名）、`it`/`test` は「条件 + 期待結果」を日本語で統一して記述する（既存の`LoginPage.test.tsx`と同じ方針）。

```ts
// Good
describe("EventsService.register", () => {
  it("定員に空きがある場合、CONFIRMEDとして登録する", async () => { /* ... */ });
  it("定員に達している場合、WAITLISTEDとして登録する", async () => { /* ... */ });
  it("主催者本人が実行した場合、ConflictExceptionを投げる", async () => { /* ... */ });
});
```

```ts
// Bad: 何をテストしているかがテスト名から読み取れない
describe("test1", () => {
  it("works", async () => { /* ... */ });
});
```

### テストパターン

- Arrange-Act-Assert (AAA) の3段構成をコメントなしでも読み取れる形で保つ。
- バックエンドの単体テストではPrismaを実DBに繋がず、`PrismaService` をモック化する。業務ルールの分岐網羅を優先する。
- 状態遷移・権限まわり（[MANIFEST.md 2章権限マトリクス](manifest.md)、5章ビジネスルール）は最優先でテストを書く。特に**キャンセル待ちの繰り上げ**（3.6節）は排他制御・トランザクションの単体テストを手厚くする。

```ts
// Good: AAAが明確、Prismaはモック
it("既に登録済みのユーザーが再度registerした場合は409を返す", async () => {
  // Arrange
  const prisma = createMockPrismaService({ registration: { findUnique: () => existingRegistration } });
  const service = new EventsService(prisma);

  // Act & Assert
  await expect(service.register("event-1", "user-1")).rejects.toThrow(ConflictException);
});
```

```tsx
// Good: React Testing Libraryでユーザー操作起点のテストを書く（実装詳細に依存しない）
test("参加登録ボタン押下でregister APIが呼ばれる", async () => {
  render(<EventDetailPage />);
  await userEvent.click(screen.getByRole("button", { name: "参加登録する" }));
  expect(mockApiClient.post).toHaveBeenCalledWith("/events/event-1/register", {});
});
```

```tsx
// Bad: 内部stateやprivateメソッドを直接検証し、リファクタで壊れやすいテスト
test("state.isRegisteredがtrueになる", () => {
  const wrapper = shallow(<EventDetailPage />);
  wrapper.instance().handleRegister();
  expect(wrapper.state("isRegistered")).toBe(true);
});
```

- E2E（Playwright）は[画面設計仕様.md](画面設計仕様.md)のゴールデンパスを優先してカバーする（例: イベント作成→参加登録→出席マーク→フィードバック投稿の一連の流れ、満席時のキャンセル待ち→繰り上げの流れ）。

---

## 7. Git規約

### ブランチ命名

`<type>/<短い説明>`（英語・kebab-case）とする。

| type | 用途 |
|---|---|
| `feature/` | 新機能追加（例: `feature/event-registration`） |
| `fix/` | バグ修正（例: `fix/waitlist-promotion-race-condition`） |
| `chore/` | ビルド・依存関係・設定変更 |
| `refactor/` | 挙動を変えないリファクタ |
| `docs/` | ドキュメントのみの変更 |

```
Good: feature/waitlist-auto-promotion
Bad:  yokoe-patch-1
Bad:  fix
```

### コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) に従う。

```
<type>(<scope>): <概要（現在形・命令形）>

<必要であれば詳細説明>
```

| type | 用途 |
|---|---|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `refactor` | 挙動を変えないコード変更 |
| `test` | テストの追加・修正 |
| `docs` | ドキュメント |
| `chore` | ビルド設定・依存関係更新 |

```
Good: feat(events): 参加登録・キャンセルAPIとキャンセル待ち自動繰り上げを実装

- POST /events/:id/register, /cancel を実装
- 満席時のWAITLISTED登録、キャンセル時のトランザクション付き繰り上げ処理を追加
```

```
Bad: update
Bad: fix bug
Bad: WIP
```

- 1コミットは1つの論理的変更に留める。無関係な変更（フォーマット崩れの全体修正等）を機能追加コミットに混在させない。

---

## 8. 環境変数管理

- 秘密情報を含む `.env` はコミット禁止（`.gitignore` 対象）。新しい環境変数を追加した場合は必ず `.env.example` にキーと用途コメントを追記する。
- アプリケーションコード内で `process.env.XXX` を直接参照しない。NestJSの `ConfigService`（フロントは `import.meta.env`）経由でのみアクセスし、起動時にZodで型・必須チェックを行う（`backend/src/common/config/env.schema.ts`、実装済み）。

```ts
// backend/src/common/config/env.schema.ts（実装済み）
export const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().min(1),
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  TZ: z.string().optional().default("Asia/Tokyo"),
});
// main.ts起動時にConfigModule.forRoot({ validate: validateEnv })を通じて検証し、
// 不備があれば即座に起動を失敗させる
```

```ts
// Good
const jwtSecret = this.configService.getOrThrow<string>("JWT_ACCESS_SECRET");

// Bad: 検証されていない値を直接参照し、未設定時に実行時エラーで初めて気づく
const jwtSecret = process.env.JWT_ACCESS_SECRET;
```

- 本課題はGitHubへのコードアップロードのみが提出物であり、デプロイ環境は対象外のため
  （詳細要求リスト.md 8章）、ステージング・本番のシークレット管理方針は本ドキュメントの対象外とする。

---

## 9. セキュリティガイドライン

[選定要素提案.md 3章](選定要素提案.md)の決定事項を実装規約として再掲する。

- **パスワード**: bcryptでハッシュ化（コストファクタ10、`AuthService`に実装済み）。平文パスワードをログ・エラーメッセージに含めない。
- **認証トークン**: Access/Refresh TokenはhttpOnly Cookieのみで管理し、レスポンスボディやlocalStorageに含めない（XSS時のトークン窃取を防ぐ）。Access Tokenのペイロードは`{ sub: userId }`のみとし`role`は含めない（[MANIFEST.md 3.1節](manifest.md)）。
- **認可**: 全ての保護対象エンドポイントで `JwtAuthGuard` + CASLの `PoliciesGuard` を通す。Controllerに認可ロジックを個別実装しない（`common/casl`に集約）。
- **SQLインジェクション**: Prismaの型安全なクエリビルダを使い、生SQL（`$queryRawUnsafe`）は使用しない。CHECK制約追加等でどうしても生SQLが必要な場合は `$queryRaw`（タグ付きテンプレート）を使いプレースホルダで値を渡す。

```ts
// Bad: 文字列結合でSQLを組み立てる（インジェクションのリスク）
await prisma.$queryRawUnsafe(`SELECT * FROM events WHERE title = '${title}'`);

// Good: タグ付きテンプレートでプレースホルダ化、またはPrisma標準APIを使う
await prisma.event.findMany({ where: { title: { contains: title } } });
```

- **XSS**: Reactのデフォルトエスケープに全面的に依拠し、`dangerouslySetInnerHTML` は使用しない。イベント説明文・フィードバックコメント・タグ名はすべてプレーンテキストとして描画する。HTMLサニタイズライブラリは導入しない（選定要素提案.md 3章）。
- **入力値検証**: 全リクエストボディをZodスキーマで検証し（3章「バリデーション」）、クライアント側の検証をサーバー側で信頼しない（サーバー側の検証を必ず独立して実施する）。
- **レート制限**: `POST /auth/login`にはブルートフォース対策のレート制限をかける。それ以外のエンドポイントへの一律のレート制限は導入しない（選定要素提案.md 3章）。
- **CORS**: `APP_BASE_URL`環境変数で許可オリジンを明示的に指定し、`*` を許可しない。
- **秘密情報のログ出力禁止**: パスワード・トークンをログに出力しない。

```ts
// Bad
this.logger.debug(`login attempt: ${email} / ${password}`);

// Good
this.logger.debug(`login attempt: ${email}`);
```

---

## 10. コードレビューチェックリスト

PRを提出・レビューする際は以下を確認する。

**設計・アーキテクチャ**
- [ ] Controller/Service/PrismaServiceの責務分離が守られているか（3章）
- [ ] 状態遷移・業務ルールの分岐が[MANIFEST.md 5章「データモデリング」](manifest.md)と一致しているか
- [ ] 新規APIが[MANIFEST.md 6章](manifest.md)の命名・レスポンス形式・ステータスコード規約に沿っているか

**型・バリデーション**
- [ ] `any` を使っていないか、`packages/shared` のZodスキーマを再利用しているか（1章・3章）
- [ ] リクエストのバリデーションがサーバー側でも独立して行われているか（9章）

**セキュリティ**
- [ ] 新規/変更エンドポイントに適切なGuard（認証・CASL認可）が付与されているか
- [ ] パスワード・トークンがログに出力されていないか
- [ ] 生SQLや文字列結合によるクエリ構築が含まれていないか

**データベース**
- [ ] Prismaスキーマ変更時、命名規則（4章）に沿っているか
- [ ] 複数テーブルにまたがる書き込み（特にキャンセル待ちの繰り上げ）が `$transaction` でまとめられているか
- [ ] ループ内での個別クエリ（N+1）、一覧系エンドポイントでの行ごとのリレーション全件includeが無いか（4章「クエリ設計」）

**テスト**
- [ ] 業務ルールの分岐（特に`409`となる異常系、キャンセル待ちの繰り上げ）にテストが追加されているか（6章）
- [ ] テスト名から意図が読み取れるか、実装詳細ではなく振る舞いを検証しているか

**その他**
- [ ] コミットメッセージ・ブランチ名が規約（7章）に沿っているか
- [ ] 新しい環境変数が `.env.example` に追記されているか（8章）
- [ ] 不要なコメント・デバッグ用の `console.log` が残っていないか
