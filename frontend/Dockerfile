# ローカル開発用イメージ（MANIFEST.md 9章の「Vite dev server」起動に対応）。
# 本番ビルド用イメージ（Vite build + 静的配信）は別途将来のPhaseで用意する。
#
# WHY: backend/Dockerfileと同じ理由で、frontendもpnpm workspaceの一員として
# `@eventboard/shared`（workspace:^）に依存するため、ビルドコンテキストは`./frontend`単体ではなく
# リポジトリルート（docker-compose.ymlの`context: .`）を前提とする。
FROM node:22-slim

WORKDIR /app

# pnpmはCorepack経由で有効化する（Node 22に同梱されているため追加インストール不要）
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY frontend ./frontend

# --filter frontend... で frontend 本体と、それが依存するworkspaceパッケージ（packages/shared）のみを対象にする
RUN pnpm install --filter frontend... --frozen-lockfile

# packages/sharedはソース（.ts）ではなくビルド後のdist/を参照する構成のため、
# ここで一度ビルドしておく（Viteの依存解決時の"Cannot find module"を防ぐ）
RUN pnpm --filter @eventboard/shared run build

WORKDIR /app/frontend

EXPOSE 5173

CMD ["pnpm", "dev"]
