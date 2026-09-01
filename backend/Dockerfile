# ローカル開発用イメージ（MANIFEST.md 9章の「watchモード」起動に対応）。
# 本番ビルド用イメージは別途Phase 13以降で用意する。
#
# WHY: backendはpnpm workspaceの一員であり、package.jsonが`@eventboard/shared`を
# `workspace:^`で参照している。ビルドコンテキストが`./backend`単体だとworkspace解決に必要な
# ルートのpnpm-workspace.yaml・packages/sharedが見えず`pnpm install`が失敗するため、
# ビルドコンテキストはリポジトリルート（docker-compose.ymlの`context: .`）を前提とする。
#
# WHY(alpineではなくslim): node:22-alpineはmusl libcベースで、Prismaのクエリエンジンが要求する
# OpenSSL 1.1系ライブラリ（libssl.so.1.1）を標準で持たず、実行時に
# 「Error loading shared library libssl.so.1.1: No such file or directory」で起動不能になる
# （Prisma+Alpineでの既知の問題）。glibc/OpenSSL標準搭載のDebianベース`slim`イメージを使うことで
# 追加パッケージなしにこの問題を回避する。
FROM node:22-slim

WORKDIR /app

# WHY: node:22-slimにはOpenSSLが含まれておらず、Prismaが対象のopenssl系列を検出できないと
# 警告を出しつつ古い既定値（1.1.x）にフォールバックしてしまう。正しいクエリエンジンを
# 取得させるため、Prisma公式の案内に従い明示的にインストールする。
# また、`nest start --watch`はファイル変更検知時の再起動処理で内部的に`ps`コマンドを実行するが、
# procpsパッケージが無いと`Error: spawn ps ENOENT`でプロセスごと落ちるため、あわせて導入する。
RUN apt-get update -y && apt-get install -y openssl procps && rm -rf /var/lib/apt/lists/*

# pnpmはCorepack経由で有効化する（Node 22に同梱されているため追加インストール不要）
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY backend ./backend

# --filter backend... で backend 本体と、それが依存するworkspaceパッケージ（packages/shared）のみを対象にする
RUN pnpm install --filter backend... --frozen-lockfile

# packages/sharedはソース（.ts）ではなくビルド後のdist/を`require`する構成のため、
# ここで一度ビルドしておく（backend/src/main.ts 起動時の"Cannot find module"を防ぐ）
RUN pnpm --filter @eventboard/shared run build

# Prisma Clientはschema.prisma変更のたびに再生成が必要なため、起動前に必ず実行する
RUN pnpm --filter backend exec prisma generate

WORKDIR /app/backend

EXPOSE 3000

CMD ["pnpm", "start:dev"]
