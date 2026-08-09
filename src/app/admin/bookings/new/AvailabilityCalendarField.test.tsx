// @vitest-environment jsdom
//
// C-23 Phase C, Step 5 — AvailabilityCalendarField specs.
//
// No @testing-library/jest-dom in this repo (see
// PractitionerTodaySection.test.tsx / BookingRowActions.test.tsx for the
// established convention) — assert via plain DOM properties/attributes, not
// `toBeDisabled()`-style matchers.
//
// react-day-picker renders each day as `<td data-day="yyyy-MM-dd"><button>`
// (confirmed against the installed 9.14.0 source, components/Day.js +
// DayPicker.js) — tests key off that `data-day` attribute rather than
// locale-formatted button text, which would be brittle across environments.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AvailabilityCalendarField,
  type CohortMarkers,
} from "./AvailabilityCalendarField";

const MIN = "2026-08-04"; // matches the fixed "today" this suite runs against

function dayButton(container: HTMLElement, isoDate: string) {
  return container.querySelector(`[data-day="${isoDate}"] button`) as HTMLButtonElement | null;
}

function dayCell(container: HTMLElement, isoDate: string) {
  return container.querySelector(`[data-day="${isoDate}"]`);
}

describe("AvailabilityCalendarField — disabled boundary", () => {
  it("disables only days before min, regardless of availability data", () => {
    const cohorts: CohortMarkers[] = [
      { label: "", days: new Map([["2026-08-10", false]]) },
    ];
    const { container } = render(
      <AvailabilityCalendarField
        value=""
        onChange={vi.fn()}
        cohorts={cohorts}
        loading={false}
        min={MIN}
      />
    );

    // Before min: disabled.
    expect(dayCell(container, "2026-08-01")?.getAttribute("data-disabled")).toBe("true");

    // min itself: selectable.
    expect(dayCell(container, MIN)?.getAttribute("data-disabled")).toBeNull();

    // A day with hasSlots: false is still selectable — the calendar informs,
    // it never blocks (brief finding 3).
    expect(dayCell(container, "2026-08-10")?.getAttribute("data-disabled")).toBeNull();
    expect(dayButton(container, "2026-08-10")?.disabled).toBe(false);
  });
});

describe("AvailabilityCalendarField — marker resolution with two cohorts", () => {
  const cohorts: CohortMarkers[] = [
    {
      label: "Female participants",
      days: new Map([
        ["2026-08-10", true],
        ["2026-08-12", true],
        ["2026-08-14", false],
      ]),
    },
    {
      label: "Male participants",
      days: new Map([
        ["2026-08-10", true],
        ["2026-08-12", false],
        ["2026-08-14", false],
      ]),
    },
  ];

  it("marks a day servable by both cohorts as available", () => {
    const { container } = render(
      <AvailabilityCalendarField value="" onChange={vi.fn()} cohorts={cohorts} loading={false} min={MIN} />
    );
    const button = dayButton(container, "2026-08-10");
    expect(button?.getAttribute("aria-label")).toContain("availability confirmed");
    const marker = button?.querySelector('span[aria-hidden="true"]');
    expect(marker).not.toBeNull();
    expect(marker?.className).toContain("rounded-full");
  });

  it("marks a day servable by exactly one cohort as partial — distinct from available", () => {
    const { container } = render(
      <AvailabilityCalendarField value="" onChange={vi.fn()} cohorts={cohorts} loading={false} min={MIN} />
    );
    const button = dayButton(container, "2026-08-12");
    expect(button?.getAttribute("aria-label")).toContain(
      "availability for one participant group only"
    );
    const marker = button?.querySelector('span[aria-hidden="true"]');
    expect(marker).not.toBeNull();
    expect(marker?.className).toContain("rotate-45");
    expect(marker?.className).not.toContain("rounded-full");
  });

  it("de-emphasises a day servable by neither cohort, without disabling it", () => {
    const { container } = render(
      <AvailabilityCalendarField value="" onChange={vi.fn()} cohorts={cohorts} loading={false} min={MIN} />
    );
    const button = dayButton(container, "2026-08-14");
    expect(button?.getAttribute("aria-label")).not.toMatch(
      /availability confirmed|one participant group only/
    );
    expect(button?.querySelector('span[aria-hidden="true"]')).toBeNull();
    expect(button?.disabled).toBe(false);
  });

  it("with a single cohort, only resolves available / de-emphasised (never partial)", () => {
    const singleCohort: CohortMarkers[] = [
      { label: "", days: new Map([["2026-08-10", true], ["2026-08-11", false]]) },
    ];
    const { container } = render(
      <AvailabilityCalendarField value="" onChange={vi.fn()} cohorts={singleCohort} loading={false} min={MIN} />
    );
    expect(dayButton(container, "2026-08-10")?.getAttribute("aria-label")).toContain(
      "availability confirmed"
    );
    expect(dayButton(container, "2026-08-11")?.getAttribute("aria-label")).not.toMatch(
      /availability confirmed|one participant group only/
    );
  });
});

describe("AvailabilityCalendarField — renders unmarked, not broken", () => {
  it("shows no markers when cohorts is empty", () => {
    const { container } = render(
      <AvailabilityCalendarField value="" onChange={vi.fn()} cohorts={[]} loading={false} min={MIN} />
    );
    expect(container.querySelectorAll("[data-day]").length).toBeGreaterThan(0);
    for (const isoDate of ["2026-08-10", "2026-08-12", "2026-08-14"]) {
      expect(dayButton(container, isoDate)?.querySelector('span[aria-hidden="true"]')).toBeNull();
    }
  });

  it("shows no markers while loading, even with cohort data present", () => {
    const cohorts: CohortMarkers[] = [
      { label: "", days: new Map([["2026-08-10", true]]) },
    ];
    const { container } = render(
      <AvailabilityCalendarField value="" onChange={vi.fn()} cohorts={cohorts} loading={true} min={MIN} />
    );
    expect(dayButton(container, "2026-08-10")?.querySelector('span[aria-hidden="true"]')).toBeNull();
    expect(dayButton(container, "2026-08-10")?.getAttribute("aria-label")).not.toContain(
      "availability confirmed"
    );
  });
});

describe("AvailabilityCalendarField — interaction", () => {
  it("supports keyboard selection (Enter on a focused day)", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <AvailabilityCalendarField value="" onChange={onChange} cohorts={[]} loading={false} min={MIN} />
    );
    const button = dayButton(container, "2026-08-12");
    expect(button).not.toBeNull();
    button?.focus();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-08-12");
  });

  it("supports mouse selection", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <AvailabilityCalendarField value="" onChange={onChange} cohorts={[]} loading={false} min={MIN} />
    );
    const button = dayButton(container, "2026-08-12");
    await user.click(button as HTMLButtonElement);
    expect(onChange).toHaveBeenCalledWith("2026-08-12");
  });
});

describe("AvailabilityCalendarField — month navigation", () => {
  // 2026-08-15 only ever appears in August's grid and 2026-09-15 only in
  // September's, so either one's presence identifies the displayed month
  // without depending on locale-formatted caption text.
  const nextMonthButton = () =>
    screen.getByRole("button", { name: "Go to the Next Month" });

  it("keeps month navigation uncontrolled when month/onMonthChange are omitted", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AvailabilityCalendarField value="" onChange={vi.fn()} cohorts={[]} loading={false} min={MIN} />
    );
    expect(dayCell(container, "2026-08-15")).not.toBeNull();
    expect(dayCell(container, "2026-09-15")).toBeNull();

    await user.click(nextMonthButton());

    // Behaviour with the props omitted is exactly as before they existed: the
    // library moves its own month state.
    expect(dayCell(container, "2026-09-15")).not.toBeNull();
    expect(dayCell(container, "2026-08-15")).toBeNull();
  });

  it("reports the new month and stays on the controlled one until the owner moves it", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    const { container, rerender } = render(
      <AvailabilityCalendarField
        value=""
        onChange={vi.fn()}
        cohorts={[]}
        loading={false}
        min={MIN}
        month="2026-08"
        onMonthChange={onMonthChange}
      />
    );

    await user.click(nextMonthButton());

    expect(onMonthChange).toHaveBeenCalledWith("2026-09");
    // Controlled: the owner has not moved `month`, so the grid has not moved.
    expect(dayCell(container, "2026-08-15")).not.toBeNull();
    expect(dayCell(container, "2026-09-15")).toBeNull();

    rerender(
      <AvailabilityCalendarField
        value=""
        onChange={vi.fn()}
        cohorts={[]}
        loading={false}
        min={MIN}
        month="2026-09"
        onMonthChange={onMonthChange}
      />
    );
    expect(dayCell(container, "2026-09-15")).not.toBeNull();
    expect(dayCell(container, "2026-08-15")).toBeNull();
  });

  it("never changes the selected date when the displayed month changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const props = {
      value: "2026-08-12",
      onChange,
      cohorts: [] as CohortMarkers[],
      loading: false,
      min: MIN,
      onMonthChange: vi.fn(),
    };
    const { container, rerender } = render(
      <AvailabilityCalendarField {...props} month="2026-08" />
    );

    await user.click(nextMonthButton());
    rerender(<AvailabilityCalendarField {...props} month="2026-09" />);

    expect(onChange).not.toHaveBeenCalled();
    // Back on August the selection is still exactly where the operator left it.
    rerender(<AvailabilityCalendarField {...props} month="2026-08" />);
    expect(dayCell(container, "2026-08-12")?.getAttribute("data-selected")).toBe("true");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("AvailabilityCalendarField — legend and hint", () => {
  it("always shows the available and no-confirmed-availability legend rows plus a hint", () => {
    const { getByText } = render(
      <AvailabilityCalendarField value="" onChange={vi.fn()} cohorts={[]} loading={false} min={MIN} />
    );
    expect(getByText("Available")).toBeTruthy();
    expect(getByText("No confirmed availability")).toBeTruthy();
    expect(getByText(/Every date can still be picked/)).toBeTruthy();
  });

  it("only shows the partial legend row for two-cohort (mixed-gender) callers", () => {
    const oneCohort: CohortMarkers[] = [{ label: "", days: new Map() }];
    const twoCohorts: CohortMarkers[] = [
      { label: "Female participants", days: new Map() },
      { label: "Male participants", days: new Map() },
    ];

    const single = render(
      <AvailabilityCalendarField value="" onChange={vi.fn()} cohorts={oneCohort} loading={false} min={MIN} />
    );
    expect(single.queryByText(/Partial/)).toBeNull();
    single.unmount();

    const mixed = render(
      <AvailabilityCalendarField value="" onChange={vi.fn()} cohorts={twoCohorts} loading={false} min={MIN} />
    );
    expect(mixed.queryByText(/Partial/)).not.toBeNull();
  });
});
