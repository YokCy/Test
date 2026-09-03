import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useLogout } from "../../features/auth/hooks/useLogout";
import { useMe } from "../../features/auth/hooks/useMe";

import { Header } from "./Header";

vi.mock("../../features/auth/hooks/useMe", () => ({
  useMe: vi.fn(),
}));

vi.mock("../../features/auth/hooks/useLogout", () => ({
  useLogout: vi.fn(),
}));

function renderHeader() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/events"]}>
        <Routes>
          <Route path="/events" element={<Header />} />
          <Route path="/login" element={<p>ログイン画面</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Header", () => {
  it("useMeが未取得（undefined）の場合、何も描画されないこと", () => {
    vi.mocked(useMe).mockReturnValue({ data: undefined } as ReturnType<typeof useMe>);
    vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<
      typeof useLogout
    >);

    const { container } = renderHeader();

    expect(container).toBeEmptyDOMElement();
  });

  it("user.role === \"MEMBER\"の場合、「カテゴリ管理」リンクが表示されないこと", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user_1", name: "山田太郎", email: "yamada@example.com", role: "MEMBER" },
    } as ReturnType<typeof useMe>);
    vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<
      typeof useLogout
    >);

    renderHeader();

    expect(screen.queryByRole("link", { name: "カテゴリ管理" })).not.toBeInTheDocument();
  });

  it("user.role === \"ADMIN\"の場合、「カテゴリ管理」リンクが表示されること", () => {
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user_1", name: "管理者", email: "admin@example.com", role: "ADMIN" },
    } as ReturnType<typeof useMe>);
    vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<
      typeof useLogout
    >);

    renderHeader();

    expect(screen.getByRole("link", { name: "カテゴリ管理" })).toBeInTheDocument();
  });

  it("ユーザーメニューのトグルボタンクリックでメニューの開閉が切り替わること", async () => {
    const user = userEvent.setup();
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user_1", name: "山田太郎", email: "yamada@example.com", role: "MEMBER" },
    } as ReturnType<typeof useMe>);
    vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<
      typeof useLogout
    >);

    renderHeader();

    expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /山田太郎/ }));
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /山田太郎/ }));
    expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
  });

  it("「ログアウト」クリックでログアウトAPIが呼ばれ、成功後/loginへreplace遷移すること", async () => {
    const user = userEvent.setup();
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user_1", name: "山田太郎", email: "yamada@example.com", role: "MEMBER" },
    } as ReturnType<typeof useMe>);
    const mutate = vi.fn((_variables: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    vi.mocked(useLogout).mockReturnValue({ mutate } as unknown as ReturnType<typeof useLogout>);

    renderHeader();

    await user.click(screen.getByRole("button", { name: /山田太郎/ }));
    await user.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("ログイン画面")).toBeInTheDocument();
  });
});
