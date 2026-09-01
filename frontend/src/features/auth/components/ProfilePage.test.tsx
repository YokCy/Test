import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../components/ui/Toast";
import { apiClient } from "../../../lib/api-client";

import { ProfilePage } from "./ProfilePage";

vi.mock("../../../lib/api-client", () => ({
  apiClient: { get: vi.fn(), put: vi.fn() },
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

function renderProfilePage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ProfilePage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("ProfilePage", () => {
  it("現在の表示名を初期値としてフォームに表示する", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      id: "user_1",
      name: "山田太郎",
      email: "yamada@example.com",
      role: "MEMBER",
    });

    renderProfilePage();

    expect(await screen.findByLabelText("表示名")).toHaveValue("山田太郎");
    expect(screen.getByLabelText("メールアドレス")).toHaveValue("yamada@example.com");
  });

  it("表示名を更新すると PUT /auth/profile を呼び出し、成功トーストを表示する", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      id: "user_1",
      name: "山田太郎",
      email: "yamada@example.com",
      role: "MEMBER",
    });
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      id: "user_1",
      name: "山田次郎",
      email: "yamada@example.com",
      role: "MEMBER",
    });

    renderProfilePage();

    const nameInput = await screen.findByLabelText("表示名");
    await user.clear(nameInput);
    await user.type(nameInput, "山田次郎");
    await user.click(screen.getByRole("button", { name: "更新する" }));

    expect(await screen.findByText("プロフィールを更新しました")).toBeInTheDocument();
    expect(apiClient.put).toHaveBeenCalledWith("/auth/profile", { name: "山田次郎" });
  });
});
