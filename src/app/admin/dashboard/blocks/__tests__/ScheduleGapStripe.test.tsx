// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ScheduleGapStripe } from "../ScheduleGapStripe";

describe("blocks/ScheduleGapStripe", () => {
  it("renders each gap (happy path)", () => {
    const { getByText } = render(
      <ScheduleGapStripe
        gaps={[{ dateLabel: "Mon 3 Aug", periodLabel: "Morning", city: "Bury Park" }]}
      />
    );
    expect(getByText("Mon 3 Aug · Morning")).toBeTruthy();
    expect(getByText("Bury Park")).toBeTruthy();
  });

  it("renders the well-covered empty state when there are no gaps", () => {
    const { getByText } = render(<ScheduleGapStripe gaps={[]} />);
    expect(getByText("No coverage gaps")).toBeTruthy();
  });

  it("uses the supplied range label in the description copy", () => {
    const { getByText } = render(
      <ScheduleGapStripe
        gaps={[{ dateLabel: "Tue 4 Aug", periodLabel: "Afternoon", city: null }]}
        rangeLabel="This week"
      />
    );
    expect(getByText("This week: 1 gap in coverage.")).toBeTruthy();
  });
});
