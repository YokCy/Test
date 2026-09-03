import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { MyEventsResponse } from "../api";

import { MyPageTabs } from "./MyPageTabs";

const CATEGORY = { id: "cat_1", name: "勉強会" };

const EVENTS: MyEventsResponse = {
  organizing: [
    {
      id: "event_organizing_1",
      title: "主催イベントA",
      startAt: "2026-10-01T10:00:00.000Z",
      category: CATEGORY,
      capacity: 10,
      confirmedCount: 3,
      waitlistedCount: 0,
    },
  ],
  upcoming: [
    {
      id: "event_upcoming_1",
      title: "参加予定イベントB",
      startAt: "2026-10-02T10:00:00.000Z",
      category: CATEGORY,
      status: "CONFIRMED",
      position: null,
    },
  ],
  history: [
    {
      id: "event_history_1",
      title: "参加履歴イベントC",
      startAt: "2026-09-01T10:00:00.000Z",
      category: CATEGORY,
      attendanceStatus: "ATTENDED",
    },
  ],
};

const EMPTY_EVENTS: MyEventsResponse = {
  organizing: [],
  upcoming: [],
  history: [],
};

/** 現在の`useLocation().pathname + search`を画面上に描画し、タブ切り替え前後で不変であることを検証するためのプローブ。 */
function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location-probe">{`${location.pathname}${location.search}`}</p>;
}

function renderTabs(events: MyEventsResponse) {
  return render(
    <MemoryRouter initialEntries={["/my-page"]}>
      <LocationProbe />
      <MyPageTabs events={events} />
    </MemoryRouter>,
  );
}

describe("MyPageTabs", () => {
  it("初期表示では主催イベントタブのデータが描画されること", () => {
    renderTabs(EVENTS);

    expect(screen.getByText("主催イベントA")).toBeInTheDocument();
    expect(screen.queryByText("参加予定イベントB")).not.toBeInTheDocument();
    expect(screen.queryByText("参加履歴イベントC")).not.toBeInTheDocument();
  });

  it("「参加予定」タブクリックでURLを変えずにローカル状態のみで参加予定イベントが表示されること", async () => {
    const user = userEvent.setup();
    renderTabs(EVENTS);
    const locationBefore = screen.getByTestId("location-probe").textContent;

    await user.click(screen.getByRole("button", { name: "参加予定" }));

    expect(await screen.findByText("参加予定イベントB")).toBeInTheDocument();
    expect(screen.queryByText("主催イベントA")).not.toBeInTheDocument();
    expect(screen.getByTestId("location-probe").textContent).toBe(locationBefore);
    expect(screen.getByTestId("location-probe").textContent).toBe("/my-page");
  });

  it("「参加履歴」タブクリックで参加履歴イベントが表示されること", async () => {
    const user = userEvent.setup();
    renderTabs(EVENTS);

    await user.click(screen.getByRole("button", { name: "参加履歴" }));

    expect(await screen.findByText("参加履歴イベントC")).toBeInTheDocument();
  });

  it("主催イベントが0件の場合、空表示になること", () => {
    renderTabs(EMPTY_EVENTS);

    expect(screen.getByText("主催しているイベントはまだありません")).toBeInTheDocument();
  });

  it("参加予定イベントが0件の場合、空表示になること", async () => {
    const user = userEvent.setup();
    renderTabs(EMPTY_EVENTS);

    await user.click(screen.getByRole("button", { name: "参加予定" }));

    expect(await screen.findByText("参加予定のイベントはまだありません")).toBeInTheDocument();
  });

  it("参加履歴が0件の場合、空表示になること", async () => {
    const user = userEvent.setup();
    renderTabs(EMPTY_EVENTS);

    await user.click(screen.getByRole("button", { name: "参加履歴" }));

    expect(await screen.findByText("参加履歴はまだありません")).toBeInTheDocument();
  });
});
