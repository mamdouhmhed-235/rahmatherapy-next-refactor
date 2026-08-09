// C-14 Phase A, Step 7 — WorkingHoursDayEditor specs.
//
// No @testing-library/jest-dom in this repo (see AvailabilityCalendarField.test.tsx
// for the established convention) — assert via plain DOM properties, not
// `toBeDisabled()`-style matchers.

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkingHoursDayEditor } from "./WorkingHoursDayEditor";
import type { DaySchedule } from "@/lib/booking/working-hours-segments";

const OPEN_DAY: DaySchedule = {
  isWorkingDay: true,
  opens: "08:00",
  closes: "20:00",
  breaks: [],
};

function input(label: string) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

/** Controlled harness — the component holds no state of its own. */
function Harness({ initial }: { initial: DaySchedule }) {
  const [schedule, setSchedule] = useState(initial);
  return <WorkingHoursDayEditor schedule={schedule} onChange={setSchedule} />;
}

describe("WorkingHoursDayEditor — rendering", () => {
  it("shows the day's opening and closing times", () => {
    render(<WorkingHoursDayEditor schedule={OPEN_DAY} onChange={vi.fn()} />);

    expect(input("Opens").value).toBe("08:00");
    expect(input("Closes").value).toBe("20:00");
  });

  it("renders one row per break with its own start, end and remove control", () => {
    render(
      <WorkingHoursDayEditor
        schedule={{
          ...OPEN_DAY,
          breaks: [
            { start: "12:30", end: "15:00" },
            { start: "17:00", end: "17:30" },
          ],
        }}
        onChange={vi.fn()}
      />
    );

    expect(input("Break 1 starts").value).toBe("12:30");
    expect(input("Break 2 ends").value).toBe("17:30");
    expect(screen.getAllByRole("button", { name: /^Remove break/ })).toHaveLength(2);
  });

  it("lists the resulting bookable windows", () => {
    const { container } = render(
      <WorkingHoursDayEditor
        schedule={{
          ...OPEN_DAY,
          breaks: [
            { start: "12:30", end: "15:00" },
            { start: "17:00", end: "17:30" },
          ],
        }}
        onChange={vi.fn()}
      />
    );

    expect(container.textContent).toContain(
      "Bookable: 08:00–12:30 · 15:00–17:00 · 17:30–20:00"
    );
  });

  it("locks every control and hides the bookable line on a closed day", () => {
    const { container } = render(
      <WorkingHoursDayEditor
        schedule={{ ...OPEN_DAY, isWorkingDay: false, breaks: [{ start: "12:00", end: "13:00" }] }}
        onChange={vi.fn()}
      />
    );

    expect(input("Opens").disabled).toBe(true);
    expect(input("Break 1 starts").disabled).toBe(true);
    expect(
      screen.getByRole("button", { name: "Add break" }) as HTMLButtonElement
    ).toHaveProperty("disabled", true);
    expect(container.textContent).not.toContain("Bookable:");
  });

  it("locks the controls while the parent is saving", () => {
    render(<WorkingHoursDayEditor schedule={OPEN_DAY} onChange={vi.fn()} disabled />);

    expect(input("Opens").disabled).toBe(true);
    expect(
      screen.getByRole("button", { name: "Add break" }) as HTMLButtonElement
    ).toHaveProperty("disabled", true);
  });
});

describe("WorkingHoursDayEditor — editing", () => {
  it("reports a changed opening time to the parent", () => {
    const onChange = vi.fn();
    render(<WorkingHoursDayEditor schedule={OPEN_DAY} onChange={onChange} />);

    fireEvent.change(input("Opens"), { target: { value: "09:30" } });

    expect(onChange).toHaveBeenCalledWith({ ...OPEN_DAY, opens: "09:30" });
  });

  it("appends a break that sits inside the working day", async () => {
    const user = userEvent.setup();
    render(<Harness initial={OPEN_DAY} />);

    await user.click(screen.getByRole("button", { name: "Add break" }));

    // Middle of 08:00–20:00 is 14:00, so the new break is 13:30–14:30.
    expect(input("Break 1 starts").value).toBe("13:30");
    expect(input("Break 1 ends").value).toBe("14:30");
    expect(screen.getByText(/^Bookable:/).parentElement?.textContent).toContain(
      "08:00–13:30 · 14:30–20:00"
    );
  });

  it("removes only the break whose control was pressed", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          ...OPEN_DAY,
          breaks: [
            { start: "12:30", end: "15:00" },
            { start: "17:00", end: "17:30" },
          ],
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Remove break 1" }));

    expect(screen.getAllByRole("button", { name: /^Remove break/ })).toHaveLength(1);
    expect(input("Break 1 starts").value).toBe("17:00");
  });

  it("updates the bookable line as a break time is edited", () => {
    const { container } = render(
      <Harness initial={{ ...OPEN_DAY, breaks: [{ start: "12:30", end: "15:00" }] }} />
    );

    fireEvent.change(input("Break 1 ends"), { target: { value: "14:00" } });

    expect(container.textContent).toContain("Bookable: 08:00–12:30 · 14:00–20:00");
  });
});

describe("WorkingHoursDayEditor — validation surface", () => {
  it("shows the validateSchedule error when closing is not after opening", () => {
    render(
      <WorkingHoursDayEditor
        schedule={{ ...OPEN_DAY, opens: "20:00", closes: "08:00" }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "The closing time has to be after the opening time."
    );
    expect(input("Opens").getAttribute("aria-invalid")).toBe("true");
  });

  it("shows an error for a break outside the working day", () => {
    render(
      <WorkingHoursDayEditor
        schedule={{ ...OPEN_DAY, breaks: [{ start: "07:00", end: "09:00" }] }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Break 1 has to sit between 08:00 and 20:00."
    );
  });

  it("shows a non-blocking warning for a stretch too short to book", () => {
    render(
      <WorkingHoursDayEditor
        schedule={{
          ...OPEN_DAY,
          breaks: [
            { start: "12:30", end: "15:00" },
            { start: "15:15", end: "17:00" },
          ],
        }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(
      "The 15-minute stretch from 15:00 to 15:15 is too short for most services to book."
    );
  });

  it("says nothing when the schedule is valid", () => {
    render(
      <WorkingHoursDayEditor
        schedule={{ ...OPEN_DAY, breaks: [{ start: "12:30", end: "15:00" }] }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
