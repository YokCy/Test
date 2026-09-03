import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../components/ui/Toast";
import { apiClient } from "../../../lib/api-client";
import type { RegistrationState } from "../api";

import { RegistrationActionButton } from "./RegistrationActionButton";

vi.mock("../../../lib/api-client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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

/** 「確認ダイアログ内の最後のボタン」を型安全に取得するためのヘルパー（noUncheckedIndexedAccess対応）。 */
function lastOf<T>(items: T[]): T {
  const last = items.at(-1);
  if (last === undefined) {
    throw new Error("配列が空です");
  }
  return last;
}

type RenderOptions = {
  registrationState: RegistrationState;
  position?: number | null;
};

function renderButton({ registrationState, position }: RenderOptions) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {position === undefined ? (
          <RegistrationActionButton eventId="event-1" registrationState={registrationState} />
        ) : (
          <RegistrationActionButton eventId="event-1" registrationState={registrationState} position={position} />
        )}
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("RegistrationActionButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registrationStateがORGANIZERの場合、非活性テキストのみ表示しボタンを表示しない", () => {
    renderButton({ registrationState: "ORGANIZER" });

    expect(screen.getByText("あなたが主催者です")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("registrationStateがCLOSEDの場合、disabledな「登録締切を過ぎました」ボタンを表示する", () => {
    renderButton({ registrationState: "CLOSED" });

    const button = screen.getByRole("button", { name: "登録締切を過ぎました" });
    expect(button).toBeDisabled();
  });

  it("registrationStateがNOT_REGISTEREDの場合、「参加登録する」ボタンを表示する", () => {
    renderButton({ registrationState: "NOT_REGISTERED" });

    expect(screen.getByRole("button", { name: "参加登録する" })).toBeEnabled();
  });

  it("registrationStateがWAITLISTEDかつposition指定ありの場合、「キャンセル待ち中（n番目）」を表示する", () => {
    renderButton({ registrationState: "WAITLISTED", position: 3 });

    expect(screen.getByText("キャンセル待ち中（3番目）")).toBeInTheDocument();
  });

  it("registrationStateがWAITLISTEDかつposition未指定（undefined）の場合、順位無しの「キャンセル待ち中」を表示する", () => {
    renderButton({ registrationState: "WAITLISTED" });

    expect(screen.getByText("キャンセル待ち中")).toBeInTheDocument();
  });

  it("registrationStateがWAITLISTEDかつposition未指定（null）の場合、順位無しの「キャンセル待ち中」を表示する", () => {
    renderButton({ registrationState: "WAITLISTED", position: null });

    expect(screen.getByText("キャンセル待ち中")).toBeInTheDocument();
  });

  it("registrationStateがCONFIRMEDの場合、順位表示なしで「キャンセルする」ボタンを表示する", () => {
    renderButton({ registrationState: "CONFIRMED" });

    expect(screen.getByRole("button", { name: "キャンセルする" })).toBeInTheDocument();
    expect(screen.queryByText(/キャンセル待ち中/)).not.toBeInTheDocument();
  });

  it("「参加登録する」クリックでregisterミューテーションが呼ばれる", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValueOnce({ status: "CONFIRMED", position: null });
    renderButton({ registrationState: "NOT_REGISTERED" });

    await user.click(screen.getByRole("button", { name: "参加登録する" }));

    expect(apiClient.post).toHaveBeenCalledWith("/events/event-1/register");
  });

  it("register実行中はボタンがisLoading表示になり多重送信を防止する", async () => {
    const user = userEvent.setup();
    let resolveRegister: ((value: unknown) => void) | undefined;
    vi.mocked(apiClient.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        }),
    );
    renderButton({ registrationState: "NOT_REGISTERED" });

    await user.click(screen.getByRole("button", { name: "参加登録する" }));

    expect(screen.getByRole("button", { name: /参加登録する/ })).toBeDisabled();

    resolveRegister?.({ status: "CONFIRMED", position: null });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "参加登録する" })).toBeEnabled();
    });
  });

  it("register失敗時（ApiError）はトーストを表示し、例外を再スローしない", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("../../../lib/api-client");
    vi.mocked(apiClient.post).mockRejectedValueOnce(new ApiError(409, "ConflictException", "既に登録済みです"));
    renderButton({ registrationState: "NOT_REGISTERED" });

    await user.click(screen.getByRole("button", { name: "参加登録する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("既に登録済みです");
    // WHY: トースト表示後もコンポーネントがクラッシュせず、ボタンが操作可能な状態に戻ることを確認する
    expect(screen.getByRole("button", { name: "参加登録する" })).toBeEnabled();
  });

  it("CONFIRMED時に「キャンセルする」をクリックすると確認モーダル（M-04）が開き、即座にはAPIを呼ばない", async () => {
    const user = userEvent.setup();
    renderButton({ registrationState: "CONFIRMED" });

    await user.click(screen.getByRole("button", { name: "キャンセルする" }));

    expect(
      screen.getByText("参加をキャンセルします。あなたの代わりに繰り上げが発生する場合があります。よろしいですか？"),
    ).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("WAITLISTED時に「キャンセル待ちをやめる」をクリックすると繰り上げ注記のない確認モーダルが開く", async () => {
    const user = userEvent.setup();
    renderButton({ registrationState: "WAITLISTED", position: 2 });

    await user.click(screen.getByRole("button", { name: "キャンセル待ちをやめる" }));

    expect(screen.getByText("キャンセル待ちの登録を取り消します。よろしいですか？")).toBeInTheDocument();
  });

  it("M-04で確定するとcancelミューテーションが呼ばれ、成功でモーダルが閉じる", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValueOnce({});
    renderButton({ registrationState: "CONFIRMED" });

    await user.click(screen.getByRole("button", { name: "キャンセルする" }));
    // ConfirmDialog内の確定ボタンもラベルが「キャンセルする」のため、確認ダイアログ表示後に
    // 2つ目（ダイアログ内）のボタンをクリックする。
    const confirmButtons = screen.getAllByRole("button", { name: "キャンセルする" });
    await user.click(lastOf(confirmButtons));

    expect(apiClient.post).toHaveBeenCalledWith("/events/event-1/cancel", {});
    await waitFor(() => {
      expect(
        screen.queryByText(
          "参加をキャンセルします。あなたの代わりに繰り上げが発生する場合があります。よろしいですか？",
        ),
      ).not.toBeInTheDocument();
    });
  });

  it("cancel失敗時（ApiError）はトーストを表示し、モーダルは開いたままになる", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("../../../lib/api-client");
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      new ApiError(403, "ForbiddenException", "キャンセル期限を過ぎています"),
    );
    renderButton({ registrationState: "CONFIRMED" });

    await user.click(screen.getByRole("button", { name: "キャンセルする" }));
    const confirmButtons = screen.getAllByRole("button", { name: "キャンセルする" });
    await user.click(lastOf(confirmButtons));

    expect(await screen.findByRole("alert")).toHaveTextContent("キャンセル期限を過ぎています");
    expect(
      screen.getByText("参加をキャンセルします。あなたの代わりに繰り上げが発生する場合があります。よろしいですか？"),
    ).toBeInTheDocument();
  });

  it("cancel実行中はモーダルの確定ボタンがisConfirming表示（disabled）になる", async () => {
    const user = userEvent.setup();
    let resolveCancel: ((value: unknown) => void) | undefined;
    vi.mocked(apiClient.post).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCancel = resolve;
        }),
    );
    renderButton({ registrationState: "CONFIRMED" });

    await user.click(screen.getByRole("button", { name: "キャンセルする" }));
    const confirmButtons = screen.getAllByRole("button", { name: "キャンセルする" });
    const confirmButton = lastOf(confirmButtons);
    await user.click(confirmButton);

    expect(confirmButton).toBeDisabled();

    resolveCancel?.({});
  });
});
