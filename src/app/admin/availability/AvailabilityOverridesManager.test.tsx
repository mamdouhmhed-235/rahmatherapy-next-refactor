// C-14 Phase C, Step 14 — AvailabilityOverridesManager specs.
//
// The migration lets one date hold several rows, so this list can no longer
// render one entry per row: a date with a lunch break would appear as two
// unrelated "adjustments" for the same day, and the Remove button would delete
// half of it, leaving the afternoon standing as if it were the whole day's
// hours. These specs guard the grouping and the delete-by-DATE that replaces
// delete-by-row-id.
//
// No @testing-library/jest-dom in this repo — assert via plain DOM properties.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteAvailabilityOverride,
  saveAvailabilityOverride,
} from "./actions";
import { AvailabilityOverridesManager } from "./AvailabilityOverridesManager";

vi.mock("./actions", () => ({
  saveAvailabilityOverride: vi.fn(async () => ({ success: true })),
  deleteAvailabilityOverride: vi.fn(async () => ({})),
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
    id: "override-am",
    override_date: "2099-01-04",
    start_time: "08:00:00",
    end_time: "12:30:00",
    reason: "Staff meeting",
  },
  {
    id: "override-pm",
    override_date: "2099-01-04",
    start_time: "15:00:00",
    end_time: "20:00:00",
    reason: "Staff meeting",
  },
];

/** Monday open as two segments; the rest of the week absent. */
const RULES = [
  { id: "mon-am", day_of_week: 1, start_time: "08:00:00", end_time: "12:30:00", is_working_day: true },
  { id: "mon-pm", day_of_week: 1, start_time: "15:00:00", end_time: "20:00:00", is_working_day: true },
];

function renderManager(overrides: Partial<Parameters<typeof AvailabilityOverridesManager>[0]> = {}) {
  return render(
    <AvailabilityOverridesManager
      upcoming={UPCOMING}
      upcomingTotal={UPCOMING.length}
      past={[]}
      pastTotal={0}
      pastViewAll={false}
      pastAllHref="?past=all"
      pastRecentHref="?"
      rules={RULES}
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AvailabilityOverridesManager — a date is all of its rows", () => {
  it("renders two rows for one date as ONE entry showing both windows", () => {
    renderManager();

    const entries = screen.getAllByRole("listitem");
    expect(entries).toHaveLength(1);
    expect(entries[0].textContent).toContain("08:00–12:30 · 15:00–20:00");
  });

  it("renders a date's segments in start-time order even when the input rows arrive out of order", () => {
    // Item 3 adds `.order("start_time")` as a secondary key on the page queries,
    // because dropping the one-row-per-date unique made `ORDER BY override_date`
    // alone a non-total ordering. That is defence in depth, not the guarantee:
    // this component must render a day's hours in time order regardless of the
    // order rows arrive in. Feed the PM segment first to prove it.
    renderManager({ upcoming: [UPCOMING[1], UPCOMING[0]] });

    const entries = screen.getAllByRole("listitem");
    expect(entries).toHaveLength(1);
    expect(entries[0].textContent).toContain("08:00–12:30 · 15:00–20:00");
  });

  it("names the gap between the windows as the break", () => {
    renderManager();

    expect(screen.getAllByRole("listitem")[0].textContent).toContain("Break: 12:30–15:00");
  });

  it("removes the whole DATE, not one row", async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(
      screen.getByRole("button", { name: /Remove hour adjustment for/ })
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));

    // The date, never a row id — deleting "override-am" would leave the
    // afternoon behind as the date's only hours.
    expect(vi.mocked(deleteAvailabilityOverride)).toHaveBeenCalledWith("2099-01-04");
  });

  it("still renders a single-window date as one plain entry", () => {
    renderManager({
      upcoming: [UPCOMING[0]],
      upcomingTotal: 1,
    });

    const entry = screen.getAllByRole("listitem")[0];
    expect(entry.textContent).toContain("08:00–12:30");
    expect(entry.textContent).not.toContain("Break");
  });
});

describe("AvailabilityOverridesManager — adding an adjustment with breaks", () => {
  it("sends the whole schedule, breaks included", async () => {
    const user = userEvent.setup();
    renderManager({ upcoming: [], upcomingTotal: 0 });

    // 2099-01-05 is a Monday, which RULES has open.
    const date = screen.getByLabelText(/Date/) as HTMLInputElement;
    await user.type(date, "2099-01-05");

    await user.click(screen.getByRole("button", { name: "Add break" }));
    await user.click(screen.getByRole("button", { name: "Add adjustment" }));

    expect(vi.mocked(saveAvailabilityOverride)).toHaveBeenCalledTimes(1);
    const [sentDate, sentSchedule] = vi.mocked(saveAvailabilityOverride).mock.calls[0];
    expect(sentDate).toBe("2099-01-05");
    expect(sentSchedule.opens).toBe("08:00");
    expect(sentSchedule.closes).toBe("20:00");
    expect(sentSchedule.breaks).toHaveLength(1);
  });

  it("refuses a second adjustment for a date that already has one", async () => {
    const user = userEvent.setup();
    renderManager();

    const date = screen.getByLabelText(/Date/) as HTMLInputElement;
    await user.type(date, "2099-01-04");
    await user.click(screen.getByRole("button", { name: "Add adjustment" }));

    // Grouped, so the check runs against the DATE rather than each row.
    expect(vi.mocked(saveAvailabilityOverride)).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "That date already has an adjustment."
    );
  });
});
