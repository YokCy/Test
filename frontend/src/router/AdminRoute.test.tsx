import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useMe } from "../features/auth/hooks/useMe";

import { AdminRoute } from "./AdminRoute";

vi.mock("../features/auth/hooks/useMe", () => ({
  useMe: vi.fn(),
}));

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={["/admin/categories"]}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin/categories" element={<p>カテゴリ管理画面</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminRoute", () => {
  it("role !== \"ADMIN\"の場合、404/エラー画面（NotFoundPage）が表示されること", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user_1", name: "山田太郎", email: "yamada@example.com", role: "MEMBER" },
    } as ReturnType<typeof useMe>);

    renderAdminRoute();

    expect(
      screen.getByText("お探しのページが見つからないか、アクセスする権限がありません"),
    ).toBeInTheDocument();
    expect(screen.queryByText("カテゴリ管理画面")).not.toBeInTheDocument();
  });

  it("role === \"ADMIN\"の場合、子要素（Outlet）が描画されること", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user_1", name: "管理者", email: "admin@example.com", role: "ADMIN" },
    } as ReturnType<typeof useMe>);

    renderAdminRoute();

    expect(screen.getByText("カテゴリ管理画面")).toBeInTheDocument();
  });
});
