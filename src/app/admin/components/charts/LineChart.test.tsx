import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LineChart } from "./LineChart";

describe("LineChart", () => {
  const series = [{ dataKey: "value", label: "Revenue" }];
  const categoryKey = "period";

  it("renders the error placeholder when data is undefined", () => {
    const { getByRole, getByText } = render(
      <LineChart data={undefined} series={series} categoryKey={categoryKey} />
    );
    expect(getByRole("status")).toBeTruthy();
    expect(getByText(/Couldn.+t load this chart/)).toBeTruthy();
  });

  it("renders the empty placeholder when data is an empty array", () => {
    const { getByRole, getByText } = render(
      <LineChart data={[]} series={series} categoryKey={categoryKey} />
    );
    expect(getByRole("status")).toBeTruthy();
    expect(getByText("No data in this window.")).toBeTruthy();
  });

  it("renders the chart wrapper with aria-label when data has points", () => {
    const { container } = render(
      <LineChart
        data={[{ period: "Jan", value: 1 }, { period: "Feb", value: 2 }]}
        series={series}
        categoryKey={categoryKey}
        ariaLabel="Test revenue trend"
      />
    );
    const wrapper = container.querySelector('[aria-label="Test revenue trend"]');
    expect(wrapper).not.toBeNull();
  });
});
