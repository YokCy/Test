import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { ToastProvider } from "./components/ui/Toast";
import "./index.css";

// WHY: サーバー状態管理はTanStack Queryに一元化する方針（CODING_STANDARDS.md 2章「状態管理」）。
// QueryClientはアプリ全体で単一インスタンスを共有する必要があるため、モジュールスコープで生成する。
// WHY(staleTime): 本アプリはWebSocket等によるリアルタイム同期を採用せず（画面仕様書.md 3.3節）、
// データ更新は各ミューテーションの成功時にinvalidateQueries/setQueryDataで明示的に反映する設計のため、
// 既定のstaleTime:0（常にstale）のままだと、タブ切り替えや画面遷移で戻るだけの操作でも
// 変化していないデータを毎回再フェッチしてしまう。30秒は許容し、無駄な再フェッチを減らす。
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('ルート要素(id="root")が見つかりません');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
