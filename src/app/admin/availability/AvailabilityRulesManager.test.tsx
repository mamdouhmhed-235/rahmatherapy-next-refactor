// C-14 Phase A, Step 8 — AvailabilityRulesManager specs.
//
// Every spec here guards the same failure. A day is now SEVERAL rows, one per
// bookable segment, and the break is the gap between them — so any path that
// still treats a day as one row silently DISCARDS the break: the editor accepts
// it, the toast says the hours saved, and the schedule that reaches customers
// has no break in it. That is invisible from the screen, which is why it is
// tested rather than eyeballed.
//
// No @testing-library/jest-dom in this repo (see WorkingHoursDayEditor.test.tsx)
// — assert via plain DOM properties.

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveAvailabilityDay } from "./actions";
import { AvailabilityRulesManager } from "./AvailabilityRulesManager";

vi.mock("./actions", () => ({
  saveAvailabilityDay: vi.fn(async () => ({ success: true })),
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

/** Monday carries a 12:30–15:00 break as two segment rows; Tuesday does not. */
const RULES = [
  { id: "mon-am", day_of_week: 1, start_time: "08:00:00", end_time: "12:30:00", is_working_day: true },
  { id: "mon-pm", day_of_week: 1, start_time: "15:00:00", end_time: "20:00:00", is_working_day: true },
  { id: "tue", day_of_week: 2, start_time: "09:00:00", end_time: "17:00:00", is_working_day: true },
];

function values(label: string) {
  return screen
    .getAllByLabelText(label)
    .map((element) => (element as HTMLInputElement).value);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.mocked(saveAvailabilityDay).mockResolvedValue({ success: true });
});

describe("AvailabilityRulesManager — loading a day's segments", () => {
  it("reads every row of a day, so a stored break comes back as a break", () => {
    render(<AvailabilityRulesManager initialRules={RULES} />);

    // Exactly one break in the whole week, and it is Monday's.
    expect(values("Break 1 starts")).toEqual(["12:30"]);
    expect(values("Break 1 ends")).toEqual(["15:00"]);

    // The day still spans the outer hours, not just its first segment.
    expect(values("Opens")[0]).toBe("08:00");
    expect(values("Closes")[0]).toBe("20:00");
  });

  it("keeps the open-except-Sunday default for days with no stored rows", () => {
    render(<AvailabilityRulesManager initialRules={[]} />);

    const switches = screen.getAllByRole("switch");
    // WEEK_ORDER renders Mon→Sun, so Sunday is last.
    expect(switches[6].getAttribute("aria-checked")).toBe("false");
    expect(switches[0].getAttribute("aria-checked")).toBe("true");
    expect(values("Opens")[0]).toBe("09:00");
    expect(values("Closes")[0]).toBe("18:00");
  });
});

describe("AvailabilityRulesManager — copy Monday", () => {
  it("copies Monday's breaks, not just its opens and closes", async () => {
    const user = userEvent.setup();
    render(<AvailabilityRulesManager initialRules={RULES} />);

    expect(values("Break 1 starts")).toEqual(["12:30"]);

    await user.click(screen.getByRole("button", { name: /Copy Monday to Tue–Sat/ }));

    // Monday plus the five days copied to, all carrying the same break.
    expect(values("Break 1 starts")).toEqual(Array(6).fill("12:30"));
    expect(values("Break 1 ends")).toEqual(Array(6).fill("15:00"));
    expect(values("Closes").slice(0, 6)).toEqual(Array(6).fill("20:00"));
  });

  it("gives each copied day its own break objects", async () => {
    const user = userEvent.setup();
    render(<AvailabilityRulesManager initialRules={RULES} />);

    await user.click(screen.getByRole("button", { name: /Copy Monday to Tue–Sat/ }));
    fireEvent.change(screen.getAllByLabelText("Break 1 ends")[1], {
      target: { value: "14:00" },
    });

    // Tuesday moved; Monday did not.
    expect(values("Break 1 ends")).toEqual([
      "15:00",
      "14:00",
      "15:00",
      "15:00",
      "15:00",
      "15:00",
    ]);
  });
});

describe("AvailabilityRulesManager — saving", () => {
  it("sends the whole schedule of a broken-up day, not just its first segment", async () => {
    const user = userEvent.setup();
    render(<AvailabilityRulesManager initialRules={RULES} />);

    await user.click(screen.getByRole("button", { name: "Save hours" }));

    const monday = vi
      .mocked(saveAvailabilityDay)
      .mock.calls.find(([dayOfWeek]) => dayOfWeek === 1);

    expect(monday?.[1]).toEqual({
      isWorkingDay: true,
      opens: "08:00",
      closes: "20:00",
      breaks: [{ start: "12:30", end: "15:00" }],
    });
    expect(vi.mocked(saveAvailabilityDay).mock.calls).toHaveLength(7);
  });

  it("saves a newly added break", async () => {
    const user = userEvent.setup();
    render(<AvailabilityRulesManager initialRules={RULES} />);

    // Tuesday is the second day rendered, so its "Add break" is index 1.
    await user.click(screen.getAllByRole("button", { name: "Add break" })[1]);
    await user.click(screen.getByRole("button", { name: "Save hours" }));

    const tuesday = vi
      .mocked(saveAvailabilityDay)
      .mock.calls.find(([dayOfWeek]) => dayOfWeek === 2);

    // Middle of 09:00–17:00 is 13:00, so the appended break is 12:30–13:30.
    expect(tuesday?.[1].breaks).toEqual([{ start: "12:30", end: "13:30" }]);
  });

  it("blocks the save while a day's breaks are invalid", async () => {
    const user = userEvent.setup();
    render(<AvailabilityRulesManager initialRules={RULES} />);

    // Push Monday's break past its closing time.
    fireEvent.change(screen.getByLabelText("Break 1 ends"), {
      target: { value: "23:00" },
    });

    await user.click(screen.getByRole("button", { name: "Save hours" }));

    expect(saveAvailabilityDay).not.toHaveBeenCalled();
    expect(
      screen.getByText("Fix the highlighted days before saving.")
    ).toBeTruthy();
  });
});
