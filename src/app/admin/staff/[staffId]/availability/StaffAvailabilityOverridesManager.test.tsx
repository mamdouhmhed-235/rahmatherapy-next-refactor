// StaffAvailabilityOverridesManager specs.
//
// This component had NO test coverage of any kind before item 3 — not of
// ordering, not of grouping, not of its empty state. It is the staff-tree twin
// of AvailabilityOverridesManager, which is deliberately duplicated rather than
// shared (see availability-data.ts's header), so the same C-14 hazard applies
// here and was equally unguarded: since the one-row-per-date unique was dropped,
// a date holding a lunch break arrives as two rows and must still render as ONE
// adjustment showing both windows.
//
// Scope note: this file was created alongside item 3's secondary-sort change, but
// it deliberately covers more than ordering. A file containing only the ordering
// case would read as adequate coverage of a component that has none.
//
// No @testing-library/jest-dom in this repo — assert via plain DOM properties.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StaffAvailabilityOverridesManager } from "./StaffAvailabilityOverridesManager";

vi.mock("./actions", () => ({
  addStaffAvailabilityOverride: vi.fn(async () => ({ success: true })),
  deleteStaffAvailabilityOverride: vi.fn(async () => ({})),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  }),
}));

/** One date, two segment rows — 08:00–12:30 and 15:00–20:00. */
const UPCOMING = [
  {
    id: "staff-override-am",
    override_date: "2099-01-04",
    start_time: "08:00:00",
    end_time: "12:30:00",
    reason: "Training",
  },
  {
    id: "staff-override-pm",
    override_date: "2099-01-04",
    start_time: "15:00:00",
    end_time: "20:00:00",
    reason: "Training",
  },
];

/** Monday open as two segments; the rest of the week absent. */
const WEEKLY_RULES = [
  { id: "mon-am", day_of_week: 1, start_time: "08:00:00", end_time: "12:30:00", is_working_day: true },
  { id: "mon-pm", day_of_week: 1, start_time: "15:00:00", end_time: "20:00:00", is_working_day: true },
];

function renderManager(
  overrides: Partial<Parameters<typeof StaffAvailabilityOverridesManager>[0]> = {}
) {
  return render(
    <StaffAvailabilityOverridesManager
      staffId="staff-1"
      upcoming={UPCOMING}
      upcomingTotal={UPCOMING.length}
      past={[]}
      pastTotal={0}
      pastViewAll={false}
      pastAllHref="?past=all"
      pastRecentHref="?"
      weeklyRules={WEEKLY_RULES}
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StaffAvailabilityOverridesManager — a date is all of its rows", () => {
  it("groups two segment rows on the same date into a single override entry", () => {
    renderManager();

    const entries = screen.getAllByRole("listitem");
    expect(entries).toHaveLength(1);
    expect(entries[0].textContent).toContain("08:00–12:30 · 15:00–20:00");
  });

  it("renders a date's segments in start-time order even when the input rows arrive out of order", () => {
    // Item 3 adds `.order("start_time")` as a secondary key on this tree's page
    // queries. That is defence in depth — the component must render a day's
    // hours in time order whatever order the rows arrive in. PM row first.
    renderManager({ upcoming: [UPCOMING[1], UPCOMING[0]] });

    const entries = screen.getAllByRole("listitem");
    expect(entries).toHaveLength(1);
    expect(entries[0].textContent).toContain("08:00–12:30 · 15:00–20:00");
  });

  it("renders the empty state when there are no upcoming overrides", () => {
    renderManager({ upcoming: [], upcomingTotal: 0 });

    // Assert the actual copy, not merely the absence of list items — "no
    // listitems" would also pass if the section failed to render at all.
    expect(
      screen.getByText(/No overrides scheduled\. The weekly pattern applies on every working day\./)
    ).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("StaffAvailabilityOverridesManager — saturation is disclosed, never silently exact", () => {
  /** One past date, two segments. */
  const PAST = [
    { id: "past-am", override_date: "2000-01-04", start_time: "08:00:00", end_time: "12:30:00", reason: "Closed" },
    { id: "past-pm", override_date: "2000-01-04", start_time: "15:00:00", end_time: "20:00:00", reason: "Closed" },
  ];

  it("renders the past total as an exact figure when the fetch was complete", () => {
    renderManager({ past: PAST, pastTotal: 30, pastTotalIsLowerBound: false });

    expect(document.body.textContent).toContain("30 past");
    expect(document.body.textContent).not.toContain("30+ past");
  });

  it("renders the past total as a lower bound when the row ceiling truncated the fetch", () => {
    // The alternative — showing a bare "30" — is the invisible undercount the
    // plan halted an earlier attempt over: it looks authoritative and is wrong.
    renderManager({ past: PAST, pastTotal: 30, pastTotalIsLowerBound: true });

    expect(document.body.textContent).toContain("30+ past");
  });

  it("counts a two-segment past date as ONE in the disclosure summary, not two", () => {
    renderManager({ past: PAST, pastTotal: 30, pastTotalIsLowerBound: false });

    // "1 of 30", never "2 of 30" — the row/date confusion this item fixes.
    expect(document.body.textContent).toContain("1 of 30");
  });
});
