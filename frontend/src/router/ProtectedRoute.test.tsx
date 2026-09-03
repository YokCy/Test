import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useMe } from "../features/auth/hooks/useMe";

import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("../features/auth/hooks/useMe", () => ({
  useMe: vi.fn(),
}));

function renderProtectedRoute() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/events"]}>
        <Routes>
          <Route path="/login" element={<p>ログイン画面</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/events" element={<p>イベント一覧画面</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProtectedRoute", () => {
  it("useMeのロード中は、ローディング表示になり子要素もリダイレクトも描画されないこと", () => {
    vi.mocked(useMe).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useMe>);

    renderProtectedRoute();

    expect(screen.getByRole("status", { name: "読み込み中" })).toBeInTheDocument();
    expect(screen.queryByText("イベント一覧画面")).not.toBeInTheDocument();
    expect(screen.queryByText("ログイン画面")).not.toBeInTheDocument();
  });

  it("未ログイン（isErrorがtrue）の場合、/loginへリダイレクトすること", () => {
    vi.mocked(useMe).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useMe>);

    renderProtectedRoute();

    expect(screen.getByText("ログイン画面")).toBeInTheDocument();
  });

  it("未ログイン（dataがnull相当でuser未取得）の場合、/loginへリダイレクトすること", () => {
    vi.mocked(useMe).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMe>);

    renderProtectedRoute();

    expect(screen.getByText("ログイン画面")).toBeInTheDocument();
  });

  it("ログイン済みの場合、子要素（Outlet）が描画されること", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user_1", name: "山田太郎", email: "yamada@example.com", role: "MEMBER" },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMe>);

    renderProtectedRoute();

    expect(screen.getByText("イベント一覧画面")).toBeInTheDocument();
  });
});
