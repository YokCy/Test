import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../components/ui/Toast";
import { apiClient } from "../../../lib/api-client";
import { useMe } from "../../auth/hooks/useMe";
import type { EventDetail } from "../api";

import { EventDetailPage } from "./EventDetailPage";

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

vi.mock("../../auth/hooks/useMe", () => ({
  useMe: vi.fn(),
}));

// WHY: レビュー一覧（features/feedbacks）は別機能の責務のため、EventDetailPage自身の分岐検証に
// 専念できるよう、埋め込みプレースホルダに差し替える（実体はfeedbacks配下のテストで別途検証する）。
vi.mock("../../feedbacks/components/FeedbackList", () => ({
  FeedbackList: () => <div data-testid="feedback-list-stub" />,
}));

vi.mock("../../events-form/components/DeleteEventConfirmModal", () => ({
  DeleteEventConfirmModal: ({
    isOpen,
    onDeleted,
  }: {
    isOpen: boolean;
    eventId: string;
    onCancel: () => void;
    onDeleted: () => void;
  }) =>
    isOpen ? (
      <div>
        <p>イベントの削除</p>
        <button type="button" onClick={onDeleted}>
          削除する
        </button>
      </div>
    ) : null,
}));

const baseEvent: EventDetail = {
  id: "event-1",
  title: "テスト勉強会",
  description: "説明文",
  category: { id: "cat-1", name: "勉強会" },
  tags: ["react", "frontend"],
  organizer: { id: "user-organizer", name: "主催 太郎" },
  startAt: "2026-10-01T01:00:00.000Z",
  endAt: null,
  capacity: 10,
  confirmedCount: 3,
  waitlistedCount: 0,
  registrationDeadline: null,
  cancellationDeadline: null,
  registrationState: "NOT_REGISTERED",
  position: null,
  averageRating: null,
  feedbackCount: 0,
};

function renderDetailPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/events/event-1"]}>
          <Routes>
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/events" element={<p>イベント一覧画面</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("EventDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user-member", name: "一般 花子", email: "hanako@example.com", role: "MEMBER" },
    } as ReturnType<typeof useMe>);
  });

  it("取得中はローディング表示になる", () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    renderDetailPage();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("取得失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("network error"));
    renderDetailPage();

    expect(await screen.findByText("イベント情報の取得に失敗しました。")).toBeInTheDocument();
  });

  it.each([
    ["NOT_REGISTERED", "参加登録する"],
    ["ORGANIZER", "あなたが主催者です"],
    ["CLOSED", "登録締切を過ぎました"],
    ["CONFIRMED", "キャンセルする"],
  ] as const)(
    "registrationStateが%sの場合、RegistrationActionButtonに反映され「%s」が表示される",
    async (registrationState, expectedText) => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ ...baseEvent, registrationState });
      renderDetailPage();

      expect(await screen.findByText(expectedText)).toBeInTheDocument();
    },
  );

  it("registrationStateがWAITLISTEDの場合、RegistrationActionButtonにキャンセル待ち表示が反映される", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ ...baseEvent, registrationState: "WAITLISTED" });
    renderDetailPage();

    expect(await screen.findByRole("button", { name: "キャンセル待ちをやめる" })).toBeInTheDocument();
  });

  it("WAITLISTEDかつpositionを含む場合、RegistrationActionButtonにキャンセル待ち順位が反映される", async () => {
    // WHY: GET /events/:idのレスポンスにpositionが追加される前は、P-03（詳細画面）に
    // 「キャンセル待ち中(n番目)」の順位が反映できていなかった（画面設計仕様.md 3.1.3の回帰防止）。
    vi.mocked(apiClient.get).mockResolvedValueOnce({ ...baseEvent, registrationState: "WAITLISTED", position: 3 });
    renderDetailPage();

    expect(await screen.findByText("キャンセル待ち中（3番目）")).toBeInTheDocument();
  });

  it("主催者本人の場合、編集・削除ボタンと出席管理へのリンクが表示される", async () => {
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user-organizer", name: "主催 太郎", email: "organizer@example.com", role: "MEMBER" },
    } as ReturnType<typeof useMe>);
    vi.mocked(apiClient.get).mockResolvedValueOnce(baseEvent);
    renderDetailPage();

    expect(await screen.findByRole("link", { name: "編集" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "出席管理へ" })).toBeInTheDocument();
  });

  it("adminの場合も、編集・削除ボタンと出席管理へのリンクが表示される", async () => {
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user-admin", name: "管理 次郎", email: "admin@example.com", role: "ADMIN" },
    } as ReturnType<typeof useMe>);
    vi.mocked(apiClient.get).mockResolvedValueOnce(baseEvent);
    renderDetailPage();

    expect(await screen.findByRole("link", { name: "編集" })).toBeInTheDocument();
  });

  it("主催者本人でもadminでもない場合、編集・削除ボタンと出席管理へのリンクを表示しない", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(baseEvent);
    renderDetailPage();

    await screen.findByText("テスト勉強会");
    expect(screen.queryByRole("link", { name: "編集" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "出席管理へ" })).not.toBeInTheDocument();
  });

  it("参加者一覧には確定人数と定員のみを表示し、キャンセル待ちが0件の場合はバッジを表示しない", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ ...baseEvent, confirmedCount: 3, capacity: 10, waitlistedCount: 0 });
    renderDetailPage();

    expect(await screen.findByText("参加者一覧（3/10）")).toBeInTheDocument();
    expect(screen.queryByText(/キャンセル待ち \d+名/)).not.toBeInTheDocument();
  });

  it("キャンセル待ちが1件以上ある場合、件数バッジのみを表示する", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ ...baseEvent, waitlistedCount: 2 });
    renderDetailPage();

    expect(await screen.findByText("キャンセル待ち 2名")).toBeInTheDocument();
  });

  it("「削除」クリックで削除確認モーダルが開き、削除完了でイベント一覧へ遷移する", async () => {
    const user = userEvent.setup();
    vi.mocked(useMe).mockReturnValue({
      data: { id: "user-organizer", name: "主催 太郎", email: "organizer@example.com", role: "MEMBER" },
    } as ReturnType<typeof useMe>);
    vi.mocked(apiClient.get).mockResolvedValueOnce(baseEvent);
    renderDetailPage();

    await user.click(await screen.findByRole("button", { name: "削除" }));
    expect(screen.getByText("イベントの削除")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(await screen.findByText("イベント一覧画面")).toBeInTheDocument();
  });
});
