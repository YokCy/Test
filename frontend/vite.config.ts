import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // WHY: `@eventboard/shared`はpnpm workspaceのシンボリックリンク経由で参照されるCommonJS
  // （`dist/index.js`、複数ファイルの名前付き再exportを`Object.defineProperty`で行う構成）のため、
  // 本番ビルド（Rollup）に直接渡すと名前付きexportを検出できず"is not exported by"エラーになる
  // （`vite`のdevサーバはesbuildの事前バンドルを通すため問題が顕在化しない）。
  // 明示的に`optimizeDeps`対象に含め、esbuildで一度ESM化してからRollupに渡すようにする。
  optimizeDeps: {
    include: ["@eventboard/shared"],
  },
  build: {
    commonjsOptions: {
      include: [/packages\/shared/, /node_modules/],
    },
  },
  server: {
    // WHY: docker-composeのfrontendコンテナ内（0.0.0.0）でリッスンさせないと、
    // ホストからポート5173へアクセスできない（Vite既定値はlocalhostのみ）。
    host: true,
    port: 5173,
    // WHY: Windowsホスト→Linuxコンテナへのbind mountではファイル変更のinotifyイベントが
    // 伝播しないため、既定のwatcherではホスト側の編集をVite開発サーバが検知できない
    // （HMRが効かず、コンテナ起動時点のコードのままになる）。ポーリング監視に切り替えて確実に検知する。
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
});
