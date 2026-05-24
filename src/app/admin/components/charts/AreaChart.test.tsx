import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AreaChart } from "./AreaChart";

describe("AreaChart", () => {
  const series = [{ dataKey: "value", label: "Revenue" }];

  it("renders the error placeholder when data is undefined", () => {
    const { getByText } = render(
      <AreaChart data={undefined} series={series} categoryKey="period" />
    );
    expect(getByText(/Couldn.+t load this chart/)).toBeTruthy();
  });

  it("renders the empty placeholder when data is empty", () => {
    const { getByText } = render(
      <AreaChart data={[]} series={series} categoryKey="period" />
    );
    expect(getByText("No data in this window.")).toBeTruthy();
  });

  it("renders chart wrapper with aria-label when populated", () => {
    const { container } = render(
      <AreaChart
        data={[{ period: "Jan", value: 100 }, { period: "Feb", value: 120 }]}
        series={series}
        categoryKey="period"
        ariaLabel="Area chart test"
      />
    );
    expect(container.querySelector('[aria-label="Area chart test"]')).not.toBeNull();
  });
});
