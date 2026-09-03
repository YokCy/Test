import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { NotFoundPage } from "./NotFoundPage";

function renderNotFoundPage() {
  return render(
    <MemoryRouter initialEntries={["/unknown-path"]}>
      <Routes>
        <Route path="/events" element={<p>イベント一覧画面</p>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NotFoundPage", () => {
  it("404文言と「トップへ戻る」導線が表示されること", () => {
    renderNotFoundPage();

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByText("お探しのページが見つからないか、アクセスする権限がありません"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップへ戻る" })).toBeInTheDocument();
  });

  it("「トップへ戻る」クリックでイベント一覧（/events）へ遷移すること", async () => {
    const user = userEvent.setup();
    renderNotFoundPage();

    await user.click(screen.getByRole("link", { name: "トップへ戻る" }));

    expect(await screen.findByText("イベント一覧画面")).toBeInTheDocument();
  });
});
