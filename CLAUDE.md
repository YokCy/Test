## プロジェクト概要

社内イベント運営プラットフォーム「EventBoard」。社員が勉強会・懇親会・講演会・研修などの
イベントを主催・告知し、他の社員が参加登録できるアプリ。詳細な機能要件は要件定義（別途共有）を参照。

前プロジェクト（タスク管理アプリ「UniteBoard」）と同じ技術スタック・ディレクトリ構成・共通基盤を引き継いでいる。
イベント・カテゴリ・参加登録・出席・フィードバックといったドメインモデル自体は未設計のため、
[初期選定要素リスト.md](./初期選定要素リスト.md) の論点を踏まえて今後詰めていく。

## 技術スタック（前プロジェクトから継承）

- モノレポ: pnpm workspace + turbo（`backend` / `frontend` / `packages/shared`）
- バックエンド: NestJS + Prisma + PostgreSQL
  - 認証: JWT（Access/Refresh Token、httpOnly Cookie） + passport-jwt
  - 認可: CASL（`backend/src/common/casl/ability.factory.ts`）
  - バリデーション: Zod（`packages/shared`で共有） + nestjs-zod
  - パスワードハッシュ: bcrypt
- フロントエンド: Vite + React + TypeScript + Tailwind CSS
  - ルーティング: React Router
  - サーバー状態管理: TanStack Query
  - フォーム: React Hook Form + Zod
- テスト: バックエンド=Jest、フロントエンド=Vitest（ユニット）+ Playwright（E2E）
- ローカル開発: docker-compose（db / backend / frontend）

前プロジェクトで使っていたBullMQ/Redis/Nodemailer（通知メール送信基盤）は、
通知機能の実装可否が未確定のため今回は含めていない。必要になった時点で追加する。

## 認証方針

招待制ではなく、メールアドレス+パスワードによるシンプルなログインのみ実装する
（初期ユーザーは`backend/prisma/seed.ts`で作成、register APIは提供しない）。

## ロール

| ロール | 説明 |
|---|---|
| member | 全社員のデフォルトロール。イベントを作成した時点で当該イベントの主催者権限も持つ（独立したロールではない） |
| admin | 全イベント・全ユーザーを操作可能。カテゴリマスタの管理も担当 |

## ディレクトリ構成

```
backend/
  src/
    common/        # 認証(JWT)・認可(CASL)・設定・フィルタ・ガード等の共通基盤
    modules/        # リソースごとのモジュール（auth, users は実装済み。event等は今後追加）
    prisma/         # PrismaService/PrismaModule
  prisma/
    schema.prisma   # Prismaスキーマ（User/RefreshTokenのみ実装済み）
    seed.ts
frontend/
  src/
    components/ui/  # 汎用UIコンポーネント（Button, Modal, Toast等）
    components/layout/ # AppLayout, Header
    features/       # 機能単位のディレクトリ（api.ts, components/, hooks/）。auth のみ実装済み
    router/         # ルート定義・認証ガード
    lib/            # APIクライアント等
packages/shared/
  src/
    schemas/        # フロント・バック共有のZodスキーマ
    types/          # 共有型定義
```

## Prisma Schema（現状）

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum SystemRole {
  ADMIN
  MEMBER
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  role         SystemRole @default(MEMBER)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime @updatedAt @db.Timestamptz(3)

  refreshTokens RefreshToken[]

  @@map("users")
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime  @db.Timestamptz(3)
  revokedAt DateTime? @db.Timestamptz(3)
  createdAt DateTime  @default(now()) @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}
```

Event / Category / Registration / Waitlist / Attendance / Feedback 等のモデルは、
要件の業務ルール（定員・締切・キャンセル待ちの繰り上げ・出席率計算・フィードバックの匿名/非公開化 等）を
踏まえて設計確定後にこのファイルへ追記する。

## コーディング規約

[CODING_STANDARDS.md](./CODING_STANDARDS.md) を参照すること。
