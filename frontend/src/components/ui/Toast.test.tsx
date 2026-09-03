import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "./Toast";

function TriggerButton({ message, variant }: { message: string; variant?: "success" | "error" }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(message, variant)}>
      トースト表示
    </button>
  );
}

describe("ToastProvider / useToast", () => {
  it('showToast(message, "error")呼び出しでエラー用スタイルのトーストが表示されること', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TriggerButton message="更新に失敗しました" variant="error" />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "トースト表示" }));

    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveTextContent("更新に失敗しました");
    expect(toast.className).toContain("bg-red-600");
  });

  it("一定時間後にトーストが非表示になること", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <TriggerButton message="更新しました" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "トースト表示" }));
      expect(screen.getByTestId("toast")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
