import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { OrganizingItem } from "../api";

import { OrganizingEventRow } from "./OrganizingEventRow";

const BASE_EVENT: OrganizingItem = {
  id: "event_1",
  title: "主催イベントA",
  startAt: "2026-10-01T01:00:00.000Z",
  category: { id: "cat_1", name: "勉強会" },
  capacity: 20,
  confirmedCount: 8,
  waitlistedCount: 0,
};

function renderRow(event: OrganizingItem) {
  return render(
    <MemoryRouter initialEntries={["/my-page"]}>
      <Routes>
        <Route path="/my-page" element={<OrganizingEventRow event={event} />} />
        <Route path="/events/:eventId" element={<p>イベント詳細画面</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OrganizingEventRow", () => {
  it("「参加者{confirmedCount}/{capacity}」の形式で表示されること", () => {
    renderRow(BASE_EVENT);

    expect(screen.getByText(/参加者8\/20/)).toBeInTheDocument();
  });

  it("キャンセル待ちが1件以上ある場合、待機件数の補足が付くこと", () => {
    renderRow({ ...BASE_EVENT, waitlistedCount: 3 });

    expect(screen.getByText(/（キャンセル待ち 3名）/)).toBeInTheDocument();
  });

  it("キャンセル待ちが0件の場合、待機件数の補足が付かないこと", () => {
    renderRow({ ...BASE_EVENT, waitlistedCount: 0 });

    expect(screen.queryByText(/キャンセル待ち/)).not.toBeInTheDocument();
  });

  it("「管理」ボタンクリックでイベント詳細画面へ遷移すること", async () => {
    const user = userEvent.setup();
    renderRow(BASE_EVENT);

    await user.click(screen.getByRole("link", { name: "管理" }));

    expect(await screen.findByText("イベント詳細画面")).toBeInTheDocument();
  });
});
