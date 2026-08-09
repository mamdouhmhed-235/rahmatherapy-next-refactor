import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePickerField } from "./DatePickerField";

// C-14 Phase D — the picker's clickable range must equal the range the slots
// API accepts, so these assert the exact boundary days rather than "roughly a
// month". Dates are built with the local-time Date constructor because that is
// what the component compares against (startOfDay(new Date()) / parseISO of a
// date-only string are both local midnight).
//
// react-day-picker marks each day cell <td data-day="yyyy-MM-dd"
// data-disabled="true">, which is what these read.

const TODAY = new Date(2026, 7, 9, 9, 0, 0); // 2026-08-09, 09:00 local
const AUGUST = new Date(2026, 7, 1);
const SEPTEMBER = new Date(2026, 8, 1);

function renderPicker(props: Partial<Parameters<typeof DatePickerField>[0]> = {}) {
  return render(
    <DatePickerField
      selected={undefined}
      onSelect={() => {}}
      month={AUGUST}
      onMonthChange={() => {}}
      monthDays={null}
      monthLoading={false}
      monthEmpty={false}
      {...props}
    />
  );
}

function dayState(container: HTMLElement, isoDate: string) {
  const cell = container.querySelector(`[data-day="${isoDate}"]`);
  if (!cell) return "absent";
  return cell.getAttribute("data-disabled") === "true" ? "disabled" : "enabled";
}

describe("DatePickerField booking-window bounds", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function freezeToday() {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TODAY);
  }

  it("keeps the last in-window day clickable and disables the one after it", () => {
    freezeToday();
    // booking_window_days = 29 from 2026-08-09 → last bookable day 2026-09-07.
    const { container } = renderPicker({
      month: SEPTEMBER,
      earliestBookable: new Date(2026, 7, 9),
      latestBookable: new Date(2026, 8, 7),
    });

    expect(dayState(container, "2026-09-06")).toBe("enabled");
    expect(dayState(container, "2026-09-07")).toBe("enabled");
    expect(dayState(container, "2026-09-08")).toBe("disabled");
    expect(dayState(container, "2026-09-30")).toBe("disabled");
  });

  it("keeps the earliest bookable day clickable and disables the day before", () => {
    freezeToday();
    const { container } = renderPicker({
      earliestBookable: new Date(2026, 7, 9),
      latestBookable: new Date(2026, 8, 7),
    });

    expect(dayState(container, "2026-08-08")).toBe("disabled");
    expect(dayState(container, "2026-08-09")).toBe("enabled");
    expect(dayState(container, "2026-08-31")).toBe("enabled");
  });

  it("disables today when the minimum-notice floor has moved to tomorrow", () => {
    freezeToday();
    const { container } = renderPicker({
      earliestBookable: new Date(2026, 7, 10),
      latestBookable: new Date(2026, 8, 7),
    });

    expect(dayState(container, "2026-08-09")).toBe("disabled");
    expect(dayState(container, "2026-08-10")).toBe("enabled");
  });

  it("leaves out-of-window days clickable when no bounds are supplied", () => {
    // The settings read can fail; the picker must then behave exactly as it did
    // before the bounds existed — past days disabled, nothing else.
    freezeToday();
    const { container } = renderPicker({ month: SEPTEMBER });

    expect(dayState(container, "2026-09-08")).toBe("enabled");
    expect(dayState(container, "2026-09-30")).toBe("enabled");
  });

  it("still disables past days when no bounds are supplied", () => {
    freezeToday();
    const { container } = renderPicker();

    expect(dayState(container, "2026-08-08")).toBe("disabled");
    expect(dayState(container, "2026-08-09")).toBe("enabled");
  });

  it("keeps disabling fully-booked days alongside the window bounds", () => {
    freezeToday();
    const { container } = renderPicker({
      earliestBookable: new Date(2026, 7, 9),
      latestBookable: new Date(2026, 8, 7),
      monthDays: [
        { date: "2026-08-11", hasSlots: false, slotCount: 0 },
        { date: "2026-08-12", hasSlots: true, slotCount: 3 },
      ],
    });

    expect(dayState(container, "2026-08-11")).toBe("disabled");
    expect(dayState(container, "2026-08-12")).toBe("enabled");
  });
});
