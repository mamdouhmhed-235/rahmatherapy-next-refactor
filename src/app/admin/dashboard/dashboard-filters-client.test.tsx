// @vitest-environment jsdom
//
// C-07 B1 fix — "Clear all" (inside the advanced-filters sheet) used to keep
// `range` in the URL while dropping `from`/`to`. The server's
// `parseReportFilters` then falls through `getRangeDefaults`, which has no
// case for "yesterday" (or the pre-existing "last_30"), landing on its
// catch-all ~2-month window while the URL still reads the original range key.
// This spec pins: select Yesterday -> clear all -> the resulting URL still
// carries the dates that make that range key resolve correctly.
//
// C-07 B2 fix — the same function also silently dropped `scope` (the
// Team/Mine toggle's URL state) because it started from an empty
// URLSearchParams and re-added only range/from/to. It now starts from the
// CURRENT params and deletes only the advanced-filter keys, so `scope` (and
// anything else in the URL) survives untouched — see the third describe
// block below.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DashboardFiltersClient } from "./dashboard-filters-client";
import { parseReportFilters } from "../reports/reporting";

const push = vi.fn();

// A mutable holder rather than a fixed literal: in production, `searchParams`
// (this hook) and the `filters` prop are both derived from the SAME request
// URL, so they always agree on range/from/to. Each test below sets this to
// match the `filters` it renders with, same as a real navigation would.
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

function renderClearAll() {
  currentSearch = "range=yesterday&from=2026-08-02&to=2026-08-02";
  return render(
    <DashboardFiltersClient
      staff={[]}
      serviceOptions={[]}
      today="2026-08-03"
      filters={{
        range: "yesterday",
        from: "2026-08-02",
        to: "2026-08-02",
        staffId: "",
        service: "",
        source: "",
        status: "",
        paymentStatus: "",
        city: "",
      }}
    />
  );
}

describe("DashboardFiltersClient — Clear all range/date sync (C-07 B1 fix)", () => {
  it("selecting Yesterday then Clear all keeps from/to alongside range in the pushed URL", async () => {
    renderClearAll();

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^clear all$/i }));

    expect(push).toHaveBeenCalledTimes(1);
    const [pushedUrl] = push.mock.calls[0] as [string];
    const params = new URLSearchParams(pushedUrl.split("?")[1] ?? "");

    expect(params.get("range")).toBe("yesterday");
    expect(params.get("from")).toBe("2026-08-02");
    expect(params.get("to")).toBe("2026-08-02");

    // The resolved range must agree with the URL: parseReportFilters must NOT
    // fall through to getRangeDefaults's catch-all — from === to === yesterday,
    // not a ~2-month window.
    const resolved = parseReportFilters(Object.fromEntries(params.entries()));
    expect(resolved.range).toBe("yesterday");
    expect(resolved.from).toBe("2026-08-02");
    expect(resolved.to).toBe("2026-08-02");
  });

  it("pre-existing last_30 gap: the same fix preserves its dates too", async () => {
    push.mockClear();
    currentSearch = "range=last_30&from=2026-07-05&to=2026-08-03";
    render(
      <DashboardFiltersClient
        staff={[]}
        serviceOptions={[]}
        today="2026-08-03"
        filters={{
          range: "last_30",
          from: "2026-07-05",
          to: "2026-08-03",
          staffId: "",
          service: "",
          source: "",
          status: "",
          paymentStatus: "",
          city: "",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^clear all$/i }));

    const [pushedUrl] = push.mock.calls[0] as [string];
    const params = new URLSearchParams(pushedUrl.split("?")[1] ?? "");
    const resolved = parseReportFilters(Object.fromEntries(params.entries()));
    expect(resolved.range).toBe("last_30");
    expect(resolved.from).toBe("2026-07-05");
    expect(resolved.to).toBe("2026-08-03");
  });
});

describe("DashboardFiltersClient — Clear all preserves scope (C-07 B2 fix)", () => {
  it("keeps ?scope=mine in the pushed URL — clear-all must only drop the advanced-filter keys", async () => {
    push.mockClear();
    currentSearch = "range=yesterday&from=2026-08-02&to=2026-08-02&scope=mine&city=Bedford";
    render(
      <DashboardFiltersClient
        staff={[]}
        serviceOptions={[]}
        today="2026-08-03"
        filters={{
          range: "yesterday",
          from: "2026-08-02",
          to: "2026-08-02",
          staffId: "",
          service: "",
          source: "",
          status: "",
          paymentStatus: "",
          city: "Bedford",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^clear all$/i }));

    expect(push).toHaveBeenCalledTimes(1);
    const [pushedUrl] = push.mock.calls[0] as [string];
    const params = new URLSearchParams(pushedUrl.split("?")[1] ?? "");

    // scope survives — this is the B2 regression: it used to be dropped.
    expect(params.get("scope")).toBe("mine");
    // range/from/to still survive (B1 fix, unaffected by this change).
    expect(params.get("range")).toBe("yesterday");
    expect(params.get("from")).toBe("2026-08-02");
    expect(params.get("to")).toBe("2026-08-02");
    // the advanced filter (city) IS cleared — that's the button's actual job.
    expect(params.get("city")).toBeNull();
  });
});
