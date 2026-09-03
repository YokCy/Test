import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../components/ui/Toast";
import { apiClient } from "../../../lib/api-client";
import type { CategoryOption, EventForEdit, EventMutationResult } from "../api";

import { EventEditPage } from "./EventEditPage";

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

const CATEGORY_ID = "clcategory0000000000000";

const categoryOptions: CategoryOption[] = [{ id: CATEGORY_ID, name: "勉強会", eventCount: 2 }];

const eventForEdit: EventForEdit = {
  id: "event-1",
  title: "既存の勉強会",
  description: "既存の説明",
  category: { id: CATEGORY_ID, name: "勉強会" },
  tags: ["typescript"],
  startAt: "2026-11-01T01:00:00.000Z",
  endAt: null,
  capacity: 20,
  registrationDeadline: null,
  cancellationDeadline: null,
};

/**
 * `apiClient.get`は「GET /events/:id（編集フォーム初期化）」「GET /categories（選択肢）」の
 * 2エンドポイントで呼ばれるため、パスに応じて出し分けるモックにする。
 */
function mockGetByPath() {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path === "/categories") {
      return Promise.resolve(categoryOptions);
    }
    if (path === "/events/event-1") {
      return Promise.resolve(eventForEdit);
    }
    return Promise.reject(new Error(`unexpected path: ${path}`));
  });
}

function renderEditPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/events/event-1/edit"]}>
          <Routes>
            <Route path="/events/:eventId/edit" element={<EventEditPage />} />
            <Route path="/events/:eventId" element={<p>イベント詳細画面</p>} />
            <Route path="/events" element={<p>イベント一覧画面</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("EventEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初期値がイベント情報で埋まる（未設定の日時項目は空欄になる）", async () => {
    mockGetByPath();
    renderEditPage();

    expect(await screen.findByLabelText("タイトル")).toHaveValue("既存の勉強会");
    expect(screen.getByLabelText("定員")).toHaveValue(20);
    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(screen.getByLabelText("終了日時(任意)")).toHaveValue("");
    expect(screen.getByLabelText("登録締切(任意)")).toHaveValue("");
    expect(screen.getByLabelText("キャンセル期限(任意)")).toHaveValue("");
  });

  it("hasRegisteredParticipants: trueで更新した場合、M-08警告モーダルが自動表示される", async () => {
    const user = userEvent.setup();
    mockGetByPath();
    const result: EventMutationResult = { ...eventForEdit, hasRegisteredParticipants: true };
    vi.mocked(apiClient.put).mockResolvedValueOnce(result);
    renderEditPage();

    await screen.findByLabelText("タイトル");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(
      await screen.findByText("既に参加登録済みのメンバーがいます。開催日時の変更を続行しますか？"),
    ).toBeInTheDocument();
    // WHY: モーダル表示時点でまだP-03へは遷移していないこと（続行操作を待つ）を確認する
    expect(screen.queryByText("イベント詳細画面")).not.toBeInTheDocument();
  });

  it("M-08で「続行」をクリックすると、イベント詳細画面へ遷移する", async () => {
    const user = userEvent.setup();
    mockGetByPath();
    const result: EventMutationResult = { ...eventForEdit, hasRegisteredParticipants: true };
    vi.mocked(apiClient.put).mockResolvedValueOnce(result);
    renderEditPage();

    await screen.findByLabelText("タイトル");
    await user.click(screen.getByRole("button", { name: "保存する" }));
    await screen.findByText("既に参加登録済みのメンバーがいます。開催日時の変更を続行しますか？");

    await user.click(screen.getByRole("button", { name: "続行" }));

    expect(await screen.findByText("イベント詳細画面")).toBeInTheDocument();
  });

  it("M-08で「戻る」をクリックすると、モーダルのみ閉じてフォーム入力を保持し、再送信しない", async () => {
    const user = userEvent.setup();
    mockGetByPath();
    const result: EventMutationResult = { ...eventForEdit, hasRegisteredParticipants: true };
    vi.mocked(apiClient.put).mockResolvedValueOnce(result);
    renderEditPage();

    await screen.findByLabelText("タイトル");
    await user.click(screen.getByRole("button", { name: "保存する" }));
    await screen.findByText("既に参加登録済みのメンバーがいます。開催日時の変更を続行しますか？");

    await user.click(screen.getByRole("button", { name: "戻る" }));

    expect(
      screen.queryByText("既に参加登録済みのメンバーがいます。開催日時の変更を続行しますか？"),
    ).not.toBeInTheDocument();
    // WHY: 「戻る」時点で画面遷移はせず、フォームの入力内容（タイトル）がそのまま残っていることを確認する
    expect(screen.getByLabelText("タイトル")).toHaveValue("既存の勉強会");
    expect(screen.queryByText("イベント詳細画面")).not.toBeInTheDocument();
    expect(apiClient.put).toHaveBeenCalledTimes(1);
  });

  it("hasRegisteredParticipantsが未含有の場合、M-08を経由せずそのままイベント詳細画面へ遷移する", async () => {
    const user = userEvent.setup();
    mockGetByPath();
    vi.mocked(apiClient.put).mockResolvedValueOnce(eventForEdit);
    renderEditPage();

    await screen.findByLabelText("タイトル");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByText("イベント詳細画面")).toBeInTheDocument();
    expect(
      screen.queryByText("既に参加登録済みのメンバーがいます。開催日時の変更を続行しますか？"),
    ).not.toBeInTheDocument();
  });

  it("hasRegisteredParticipants: falseの場合も、M-08を経由せずそのままイベント詳細画面へ遷移する", async () => {
    const user = userEvent.setup();
    mockGetByPath();
    vi.mocked(apiClient.put).mockResolvedValueOnce({ ...eventForEdit, hasRegisteredParticipants: false });
    renderEditPage();

    await screen.findByLabelText("タイトル");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByText("イベント詳細画面")).toBeInTheDocument();
  });

  it("「このイベントを削除」クリックで削除確認モーダルが開き、確定でDELETEが呼ばれ一覧へ遷移する", async () => {
    const user = userEvent.setup();
    mockGetByPath();
    vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);
    renderEditPage();

    await screen.findByLabelText("タイトル");
    await user.click(screen.getByRole("button", { name: "このイベントを削除" }));

    expect(screen.getByText("イベントの削除")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(apiClient.delete).toHaveBeenCalledWith("/events/event-1");
    await waitFor(() => {
      expect(screen.getByText("イベント一覧画面")).toBeInTheDocument();
    });
  });
});
