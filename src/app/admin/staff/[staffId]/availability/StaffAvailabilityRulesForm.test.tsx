// C-14 Phase B, Step 10 — StaffAvailabilityRulesForm specs.
//
// Same failure these guard as the clinic-wide editor's: a staff day is now
// SEVERAL rows, one per bookable segment, and the break is the gap between
// them — so any path that still treats a day as one row silently DISCARDS the
// break. The editor accepts it, the toast says the hours saved, and the
// schedule the slot engine reads has no break in it.
//
// The one thing that differs from the global editor is the closed-day default:
// for a staff member on custom hours the engine reads "no rows for this day"
// as closed, so a day with no stored rows must render closed, not open.
//
// No @testing-library/jest-dom in this repo — assert via plain DOM properties.

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveStaffAvailabilityDay } from "../../actions";
import { StaffAvailabilityRulesForm } from "./StaffAvailabilityRulesForm";

vi.mock("../../actions", () => ({
  saveStaffAvailabilityDay: vi.fn(async () => ({ success: true })),
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

const STAFF_ID = "staff-1";

/** Monday carries a 12:30–15:00 break as two segment rows; Tuesday does not. */
const RULES = [
  { id: "mon-am", day_of_week: 1, start_time: "08:00:00", end_time: "12:30:00", is_working_day: true },
  { id: "mon-pm", day_of_week: 1, start_time: "15:00:00", end_time: "20:00:00", is_working_day: true },
  { id: "tue", day_of_week: 2, start_time: "09:00:00", end_time: "17:00:00", is_working_day: true },
];

const GLOBAL_SEED = [
  { day_of_week: 1, start_time: "10:00:00", end_time: "13:00:00", is_working_day: true },
  { day_of_week: 1, start_time: "14:00:00", end_time: "18:00:00", is_working_day: true },
];

function values(label: string) {
  return screen
    .getAllByLabelText(label)
    .map((element) => (element as HTMLInputElement).value);
}

function renderForm(props: Partial<Parameters<typeof StaffAvailabilityRulesForm>[0]> = {}) {
  return render(
    <StaffAvailabilityRulesForm
      staffId={STAFF_ID}
      initialRules={RULES}
      canEdit
      globalModeLocked={false}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.mocked(saveStaffAvailabilityDay).mockResolvedValue({ success: true });
});

describe("StaffAvailabilityRulesForm — loading a day's segments", () => {
  it("reads every row of a day, so a stored break comes back as a break", () => {
    renderForm();

    expect(values("Break 1 starts")).toEqual(["12:30"]);
    expect(values("Break 1 ends")).toEqual(["15:00"]);

    // The day spans the outer hours, not just its first segment.
    expect(values("Opens")[0]).toBe("08:00");
    expect(values("Closes")[0]).toBe("20:00");
  });

  it("renders a day with no stored rows as CLOSED (absence = closed for staff)", () => {
    renderForm({ initialRules: [] });

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(7);
    expect(switches.map((s) => s.getAttribute("aria-checked"))).toEqual(
      Array(7).fill("false")
    );
  });

  it("counts open days, not stored rows, in the badge", () => {
    // Monday is two rows but one open day; Tuesday is the other.
    renderForm();
    expect(screen.getByText("2 open days")).toBeTruthy();
  });
});

describe("StaffAvailabilityRulesForm — saving", () => {
  it("sends the whole schedule of a broken-up day, not just its first segment", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Save hours" }));

    const monday = vi
      .mocked(saveStaffAvailabilityDay)
      .mock.calls.find(([, dayOfWeek]) => dayOfWeek === 1);

    expect(monday?.[0]).toBe(STAFF_ID);
    expect(monday?.[2]).toEqual({
      isWorkingDay: true,
      opens: "08:00",
      closes: "20:00",
      breaks: [{ start: "12:30", end: "15:00" }],
    });
    expect(vi.mocked(saveStaffAvailabilityDay).mock.calls).toHaveLength(7);
  });

  it("saves a newly added break", async () => {
    const user = userEvent.setup();
    renderForm();

    // Tuesday is the second day rendered, so its "Add break" is index 1.
    await user.click(screen.getAllByRole("button", { name: "Add break" })[1]);
    await user.click(screen.getByRole("button", { name: "Save hours" }));

    const tuesday = vi
      .mocked(saveStaffAvailabilityDay)
      .mock.calls.find(([, dayOfWeek]) => dayOfWeek === 2);

    // Middle of 09:00–17:00 is 13:00, so the appended break is 12:30–13:30.
    expect(tuesday?.[2].breaks).toEqual([{ start: "12:30", end: "13:30" }]);
  });

  it("blocks the save while a day's breaks are invalid", async () => {
    const user = userEvent.setup();
    renderForm();

    // Push Monday's break past its closing time.
    fireEvent.change(screen.getByLabelText("Break 1 ends"), {
      target: { value: "23:00" },
    });

    await user.click(screen.getByRole("button", { name: "Save hours" }));

    expect(saveStaffAvailabilityDay).not.toHaveBeenCalled();
    expect(
      screen.getByText("Fix the highlighted days before saving.")
    ).toBeTruthy();
  });
});

describe("StaffAvailabilityRulesForm — copy and seed", () => {
  it("copies Monday's breaks, not just its opens and closes", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /Copy Monday to Tue–Sat/ }));

    expect(values("Break 1 starts")).toEqual(Array(6).fill("12:30"));
    expect(values("Break 1 ends")).toEqual(Array(6).fill("15:00"));
  });

  it("gives each copied day its own break objects", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /Copy Monday to Tue–Sat/ }));
    fireEvent.change(screen.getAllByLabelText("Break 1 ends")[1], {
      target: { value: "14:00" },
    });

    expect(values("Break 1 ends")).toEqual([
      "15:00",
      "14:00",
      "15:00",
      "15:00",
      "15:00",
      "15:00",
    ]);
  });

  it("loads the clinic-wide pattern — breaks included — without saving it", async () => {
    const user = userEvent.setup();
    renderForm({ initialRules: [], globalRulesSeed: GLOBAL_SEED });

    await user.click(
      screen.getByRole("button", { name: /Start from clinic-wide hours/ })
    );

    expect(values("Opens")[0]).toBe("10:00");
    expect(values("Closes")[0]).toBe("18:00");
    expect(values("Break 1 starts")).toEqual(["13:00"]);
    expect(saveStaffAvailabilityDay).not.toHaveBeenCalled();
  });
});

describe("StaffAvailabilityRulesForm — use_global mode", () => {
  it("shows the clinic-wide notice and offers no save when no custom rows exist", () => {
    renderForm({ initialRules: [], globalModeLocked: true });

    expect(screen.queryByRole("button", { name: "Save hours" })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(
      screen.getByText("Clinic-wide hours apply. No custom weekly rules are set.")
    ).toBeTruthy();
  });

  it("shows stored custom rows read-only when the mode is locked", () => {
    renderForm({ globalModeLocked: true });

    expect(screen.queryByRole("button", { name: "Save hours" })).toBeNull();
    for (const control of screen.getAllByLabelText("Opens")) {
      expect((control as HTMLInputElement).disabled).toBe(true);
    }
  });

  it("is read-only for a viewer without edit rights", () => {
    renderForm({ canEdit: false });

    expect(screen.queryByRole("button", { name: "Save hours" })).toBeNull();
    for (const control of screen.getAllByLabelText("Opens")) {
      expect((control as HTMLInputElement).disabled).toBe(true);
    }
  });
});
