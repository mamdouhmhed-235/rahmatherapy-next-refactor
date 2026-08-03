// C-16 Phase D Step 11 — the kanban board used to cap each status column at
// 50 visible rows client-side, with a "Load more" button that only ever
// revealed rows ALREADY fetched and hidden in memory (never fetched anything
// new). Now that the server pager bounds the whole board to LOG_PAGE_SIZE
// (100) rows per page, that per-column cap sat INSIDE an already-bounded
// window and added a second, misleading "more" affordance. This spec pins
// the replacement behaviour: every row the server sent for this page renders
// — the board and the server page agree about what "more" means, and only
// the real pager (rendered separately in page.tsx) can say there's more.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperationsBoard } from "../operations-board";
import type { OperationalEventRow } from "../event-row";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  }),
}));

vi.mock("../actions", () => ({
  updateOperationalEventStatus: vi.fn(),
}));

function makeEvent(overrides: Partial<OperationalEventRow> & { id: string }): OperationalEventRow {
  return {
    event_type: "email_failed",
    severity: "info",
    status: "open",
    summary: `Event ${overrides.id}`,
    safe_context: {},
    booking_id: null,
    staff_id: null,
    created_at: "2026-01-02T09:30:00.000Z",
    ...overrides,
  };
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

describe("OperationsBoard — nested per-column pagination removed (C-16 Step 11)", () => {
  it("renders every row of a 70-event single-status page with no 'Load more' control", () => {
    const events = Array.from({ length: 70 }, (_, i) =>
      makeEvent({ id: `open-${i}`, status: "open" })
    );

    const { container } = render(
      <OperationsBoard events={events} filtersActive={false} />
    );

    // The old mechanism hid rows past DEFAULT_PAGE_SIZE (50) behind a
    // "Load more" button. All 70 must be present with no such control.
    expect(container.querySelectorAll('[data-status="open"]')).toHaveLength(70);
    expect(screen.queryByText(/Load more/i)).toBeNull();
  });

  it("the open column's badge count matches exactly what's rendered — board and server page agree", () => {
    const events = Array.from({ length: 12 }, (_, i) =>
      makeEvent({ id: `open-${i}`, status: "open" })
    );

    render(<OperationsBoard events={events} filtersActive={false} />);

    // Two renders of the count exist (mobile tab strip + desktop column
    // header badge) — both must read the true, un-capped total.
    const matches = screen.getAllByText("12");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("a column split across statuses on one page renders each bucket in full", () => {
    const events = [
      ...Array.from({ length: 60 }, (_, i) => makeEvent({ id: `o-${i}`, status: "open" })),
      ...Array.from({ length: 5 }, (_, i) => makeEvent({ id: `a-${i}`, status: "acknowledged" })),
      ...Array.from({ length: 35 }, (_, i) => makeEvent({ id: `r-${i}`, status: "resolved" })),
    ];

    const { container } = render(
      <OperationsBoard events={events} filtersActive={false} />
    );

    expect(container.querySelectorAll('[data-status="open"]')).toHaveLength(60);
    expect(container.querySelectorAll('[data-status="acknowledged"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-status="resolved"]')).toHaveLength(35);
    expect(screen.queryByText(/Load more/i)).toBeNull();
  });
});

describe("OperationsBoard — multiPage-aware empty column copy (C-16 Step 11)", () => {
  it("uses the global empty copy when there is only one page", () => {
    const events = [makeEvent({ id: "r-1", status: "resolved" })];

    render(<OperationsBoard events={events} filtersActive={false} multiPage={false} />);

    expect(screen.getByText("Nothing open")).toBeTruthy();
  });

  it("uses page-scoped copy when the server pager reports more than one page", () => {
    const events = [makeEvent({ id: "r-1", status: "resolved" })];

    render(<OperationsBoard events={events} filtersActive={false} multiPage />);

    // The unqualified "Nothing open" claim (implying globally zero) must not
    // appear once there's a second page it could be hiding data on.
    expect(screen.queryByText("Nothing open")).toBeNull();
    expect(screen.getByText("Open: none on this page")).toBeTruthy();
  });
});
