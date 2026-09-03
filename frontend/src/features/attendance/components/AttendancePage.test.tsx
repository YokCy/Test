import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../lib/api-client";
import type { RegistrationRow } from "../api";

import { AttendancePage } from "./AttendancePage";

vi.mock("../../../lib/api-client", () => ({
  apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

const EVENT_ID = "event_1";
// WHY: イベント開催日時を固定し、`vi.setSystemTime`で現在時刻を前後に動かして
// マーク操作ボタンの活性/非活性を検証する（フレーキー防止のため実時刻に依存しない）。
const EVENT_START_AT = "2026-09-10T10:00:00.000Z"; // JST 19:00

const MEMBER_ME = { id: "user_organizer", name: "主催 太郎", email: "organizer@example.com", role: "MEMBER" as const };
const ADMIN_ME = { id: "user_admin", name: "管理 花子", email: "admin@example.com", role: "ADMIN" as const };

const REGISTRATIONS: RegistrationRow[] = [
  { userId: "user_a", name: "参加者A", status: "CONFIRMED", attendanceStatus: null },
  { userId: "user_b", name: "参加者B", status: "CONFIRMED", attendanceStatus: null },
];

function mockApiGet(options: {
  me?: typeof MEMBER_ME | typeof ADMIN_ME;
  registrations?: RegistrationRow[] | "error";
  eventHeader?: "error";
}) {
  const { me = MEMBER_ME, registrations = REGISTRATIONS, eventHeader } = options;
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === "/auth/me") {
      return Promise.resolve(me);
    }
    if (path === `/events/${EVENT_ID}/registrations`) {
      return registrations === "error"
        ? Promise.reject(new Error("failed"))
        : Promise.resolve(registrations);
    }
    if (path === `/events/${EVENT_ID}`) {
      return eventHeader === "error"
        ? Promise.reject(new Error("failed"))
        : Promise.resolve({ title: "テストイベント", startAt: EVENT_START_AT });
    }
    return Promise.reject(new Error(`unexpected path: ${path}`));
  });
}

function renderAttendancePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/events/${EVENT_ID}/attendance`]}>
        <Routes>
          <Route path="/events/:eventId/attendance" element={<AttendancePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AttendancePage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.put).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("取得中はローディング表示になること", () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));

    renderAttendancePage();

    expect(screen.getByRole("status", { name: "読み込み中" })).toBeInTheDocument();
  });

  it("参加者一覧の取得に失敗した場合、エラー表示になること", async () => {
    mockApiGet({ registrations: "error" });

    renderAttendancePage();

    expect(await screen.findByText("出席管理情報の取得に失敗しました。")).toBeInTheDocument();
  });

  it("イベントヘッダーの取得に失敗した場合、エラー表示になること", async () => {
    mockApiGet({ eventHeader: "error" });

    renderAttendancePage();

    expect(await screen.findByText("出席管理情報の取得に失敗しました。")).toBeInTheDocument();
  });

  it("参加者が0件の場合、「参加者がいません。」の表示になること", async () => {
    mockApiGet({ registrations: [] });

    renderAttendancePage();

    expect(await screen.findByText("参加者がいません。")).toBeInTheDocument();
  });

  it("開催日時より前の現在時刻の場合、マーク操作ボタンがdisabledになること", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-10T09:00:00.000Z")); // 開催1時間前
    mockApiGet({});

    renderAttendancePage();

    const buttons = await screen.findAllByRole("button", { name: "出席" });
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => expect(button).toBeDisabled());
  });

  it("開催日時を過ぎている場合、マーク操作ボタンが活性になること", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-10T11:00:00.000Z")); // 開催1時間後
    mockApiGet({});

    renderAttendancePage();

    const buttons = await screen.findAllByRole("button", { name: "出席" });
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => expect(button).toBeEnabled());
  });

  it("adminの場合、「強制キャンセル」ボタンが表示されること", async () => {
    mockApiGet({ me: ADMIN_ME });

    renderAttendancePage();

    expect(await screen.findAllByRole("button", { name: "強制キャンセル" })).toHaveLength(2);
  });

  it("adminでない場合、「強制キャンセル」ボタンが表示されないこと", async () => {
    mockApiGet({ me: MEMBER_ME });

    renderAttendancePage();

    expect(await screen.findByText("参加者A")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "強制キャンセル" })).not.toBeInTheDocument();
  });

  it("isMarkPendingは操作対象の行のみに反映され、他の行のボタンには影響しないこと", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-10T11:00:00.000Z")); // 開催後（マーク操作可能な時刻）
    mockApiGet({});
    vi.mocked(apiClient.put).mockImplementation(() => new Promise(() => {})); // 送信中の状態を維持する
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderAttendancePage();

    const rowA = (await screen.findByText("参加者A")).closest("div");
    const rowB = screen.getByText("参加者B").closest("div");
    if (!rowA || !rowB) {
      throw new Error("行の取得に失敗しました");
    }

    await user.click(within(rowA).getByRole("button", { name: "出席" }));

    await waitFor(() => {
      expect(within(rowA).getByRole("button", { name: "出席" })).toBeDisabled();
    });
    expect(within(rowB).getByRole("button", { name: "出席" })).toBeEnabled();
    expect(within(rowB).getByRole("button", { name: "欠席" })).toBeEnabled();
  });
});
