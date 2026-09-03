import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../lib/api-client";
import type { EventSummary } from "../api";

import { EventsListPage } from "./EventsListPage";

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

function makeEvent(overrides: Partial<EventSummary>): EventSummary {
  return {
    id: "event-1",
    title: "既定イベント",
    category: { id: "cat-1", name: "勉強会" },
    startAt: "2026-10-01T01:00:00.000Z",
    capacity: 10,
    confirmedCount: 3,
    registrationState: "NOT_REGISTERED",
    ...overrides,
  };
}

function renderListPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/events"]}>
        <Routes>
          <Route path="/events" element={<EventsListPage />} />
          <Route path="/events/:eventId" element={<p>イベント詳細画面</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EventsListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("空き状況表示をconfirmedCount/capacityから「残り n/capacity名」として導出する", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      makeEvent({ id: "event-1", title: "空きあり勉強会", capacity: 10, confirmedCount: 3 }),
    ]);
    renderListPage();

    expect(await screen.findByText("残り 7/10名")).toBeInTheDocument();
  });

  it("confirmedCountがcapacity以上の場合「満席(キャンセル待ち)」と表示する", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      makeEvent({ id: "event-1", title: "満席勉強会", capacity: 5, confirmedCount: 5 }),
    ]);
    renderListPage();

    expect(await screen.findByText("満席(キャンセル待ち)")).toBeInTheDocument();
  });

  it("0件の場合、空表示になる", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce([]);
    renderListPage();

    expect(await screen.findByText("該当するイベントがありません。")).toBeInTheDocument();
  });

  it("取得に失敗した場合、エラーメッセージを表示する", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("network error"));
    renderListPage();

    expect(await screen.findByText("イベント一覧の取得に失敗しました。")).toBeInTheDocument();
  });

  it("カードクリックで該当イベント詳細へ遷移する", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValueOnce([
      makeEvent({ id: "event-42", title: "遷移確認イベント" }),
    ]);
    renderListPage();

    await user.click(await screen.findByText("遷移確認イベント"));

    expect(await screen.findByText("イベント詳細画面")).toBeInTheDocument();
  });

  it("キーワード入力に応じてGET /eventsのkeywordクエリが更新される", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue([]);
    renderListPage();

    await screen.findByText("該当するイベントがありません。");
    await user.type(screen.getByLabelText("キーワード検索"), "React");

    expect(apiClient.get).toHaveBeenLastCalledWith("/events?keyword=React&sort=startAtAsc");
  });

  it("タグ入力に応じてGET /eventsのtagsクエリが更新される", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue([]);
    renderListPage();

    await screen.findByText("該当するイベントがありません。");
    await user.type(screen.getByLabelText("タグ検索"), "react");

    expect(apiClient.get).toHaveBeenLastCalledWith("/events?tags=react&sort=startAtAsc");
  });

  it("開催日順ソートの選択に応じてGET /eventsのsortクエリが切り替わる", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue([]);
    renderListPage();

    await screen.findByText("該当するイベントがありません。");
    await user.selectOptions(screen.getByLabelText("開催日順ソート"), "startAtDesc");

    expect(apiClient.get).toHaveBeenLastCalledWith("/events?sort=startAtDesc");
  });
});
