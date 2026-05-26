import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BarChart } from "./BarChart";

describe("BarChart", () => {
  const series = [{ dataKey: "count", label: "Bookings" }];

  it("renders the error placeholder when data is undefined", () => {
    const { getByText } = render(
      <BarChart data={undefined} series={series} categoryKey="day" />
    );
    expect(getByText(/Couldn.+t load this chart/)).toBeTruthy();
  });

  it("renders the empty placeholder when data is empty", () => {
    const { getByText } = render(
      <BarChart data={[]} series={series} categoryKey="day" />
    );
    expect(getByText("No data in this window.")).toBeTruthy();
  });

  it("renders chart wrapper with aria-label when populated", () => {
    const { container } = render(
      <BarChart
        data={[{ day: "Mon", count: 3 }, { day: "Tue", count: 5 }]}
        series={series}
        categoryKey="day"
        ariaLabel="Bar chart test"
      />
    );
    expect(container.querySelector('[aria-label="Bar chart test"]')).not.toBeNull();
  });
});
