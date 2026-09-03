import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../lib/api-client";

import { LoginPage } from "./LoginPage";

vi.mock("../../../lib/api-client", () => ({
  apiClient: { post: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

function renderLoginPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/events" element={<p>イベント一覧画面</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  it("未入力のまま送信すると、バリデーションエラーを表示しAPIを呼び出さない", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByText("パスワードは必須です")).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("ログインに成功すると、イベント一覧画面（ROUTES.home）へ遷移する", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      id: "user_1",
      name: "山田太郎",
      email: "yamada@example.com",
      role: "MEMBER",
    });

    renderLoginPage();

    await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByText("イベント一覧画面")).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith("/auth/login", {
      email: "yamada@example.com",
      password: "password123",
    });
  });

  it("401エラー時、フォーム全体のエラーとしてサーバーのメッセージを表示する", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("../../../lib/api-client");
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      new ApiError(401, "UnauthorizedException", "メールアドレスまたはパスワードが正しくありません"),
    );

    renderLoginPage();

    await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
    await user.type(screen.getByLabelText("パスワード"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "メールアドレスまたはパスワードが正しくありません",
    );
  });
});
