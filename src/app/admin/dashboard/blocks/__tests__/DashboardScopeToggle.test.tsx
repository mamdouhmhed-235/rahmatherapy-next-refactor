// @vitest-environment jsdom
//
// C-07 Phase B2 step 11 (B-139). The toggle's whole job is to put `scope` on
// the URL — "Mine" sets `?scope=mine`, "Team" removes it — WITHOUT dropping
// the other filter params, because the server reads range/from/to from the
// same query string. A push that stripped them would silently re-window the
// whole dashboard.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DashboardScopeToggle } from "../DashboardScopeToggle";

const push = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/dashboard",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

beforeEach(() => {
  push.mockClear();
  currentSearch = "";
});

describe("DashboardScopeToggle", () => {
  it("marks the active scope pressed", () => {
    render(<DashboardScopeToggle currentScope="mine" />);
    expect(screen.getByRole("button", { name: "Mine" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Team" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("adds scope=mine while preserving the existing filter params", () => {
    currentSearch = "range=yesterday&from=2026-08-02&to=2026-08-02";
    render(<DashboardScopeToggle currentScope="team" />);

    fireEvent.click(screen.getByRole("button", { name: "Mine" }));

    expect(push).toHaveBeenCalledTimes(1);
    const [url] = push.mock.calls[0] as [string];
    const params = new URLSearchParams(url.split("?")[1] ?? "");
    expect(url.startsWith("/admin/dashboard?")).toBe(true);
    expect(params.get("scope")).toBe("mine");
    expect(params.get("range")).toBe("yesterday");
    expect(params.get("from")).toBe("2026-08-02");
    expect(params.get("to")).toBe("2026-08-02");
  });

  it("removes scope when switching back to Team and keeps the rest", () => {
    currentSearch = "scope=mine&range=today&from=2026-08-03&to=2026-08-03";
    render(<DashboardScopeToggle currentScope="mine" />);

    fireEvent.click(screen.getByRole("button", { name: "Team" }));

    const [url] = push.mock.calls[0] as [string];
    const params = new URLSearchParams(url.split("?")[1] ?? "");
    expect(params.has("scope")).toBe(false);
    expect(params.get("range")).toBe("today");
    expect(params.get("from")).toBe("2026-08-03");
  });

  it("pushes a bare pathname when clearing the only param", () => {
    currentSearch = "scope=mine";
    render(<DashboardScopeToggle currentScope="mine" />);

    fireEvent.click(screen.getByRole("button", { name: "Team" }));

    expect(push).toHaveBeenCalledWith("/admin/dashboard");
  });
});
