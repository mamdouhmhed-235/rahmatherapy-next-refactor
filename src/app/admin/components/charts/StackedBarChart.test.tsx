import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StackedBarChart } from "./StackedBarChart";

describe("StackedBarChart", () => {
  const series = [
    { dataKey: "confirmed", label: "Confirmed" },
    { dataKey: "pending", label: "Pending" },
  ];

  it("renders the error placeholder when data is undefined", () => {
    const { getByText } = render(
      <StackedBarChart data={undefined} series={series} categoryKey="day" />
    );
    expect(getByText(/Couldn.+t load this chart/)).toBeTruthy();
  });

  it("renders the empty placeholder (StackedBar copy variant) when data is empty", () => {
    const { getByText } = render(
      <StackedBarChart data={[]} series={series} categoryKey="day" />
    );
    expect(getByText("No activity recorded.")).toBeTruthy();
  });

  it("renders chart wrapper with aria-label when populated", () => {
    const { container } = render(
      <StackedBarChart
        data={[
          { day: "Mon", confirmed: 3, pending: 1 },
          { day: "Tue", confirmed: 5, pending: 0 },
        ]}
        series={series}
        categoryKey="day"
        ariaLabel="Stacked test"
      />
    );
    expect(container.querySelector('[aria-label="Stacked test"]')).not.toBeNull();
  });

  it("supports vertical layout with hideAxes for workload-row variant", () => {
    const { container } = render(
      <StackedBarChart
        data={[
          { staff: "Aisha", confirmed: 3, pending: 1 },
        ]}
        series={series}
        categoryKey="staff"
        layout="vertical"
        hideAxes
        height={18}
        ariaLabel="Workload row test"
      />
    );
    expect(container.querySelector('[aria-label="Workload row test"]')).not.toBeNull();
  });
});
