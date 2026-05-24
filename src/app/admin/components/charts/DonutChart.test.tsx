import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DonutChart } from "./DonutChart";

describe("DonutChart", () => {
  it("renders the error placeholder when data is undefined", () => {
    const { getByText } = render(<DonutChart data={undefined} />);
    expect(getByText(/Couldn.+t load this chart/)).toBeTruthy();
  });

  it("renders the empty placeholder when data is empty", () => {
    const { getByText } = render(<DonutChart data={[]} />);
    expect(getByText("Nothing to break down yet.")).toBeTruthy();
  });

  it("renders the empty placeholder when total is zero (all-zero slices)", () => {
    const { getByText } = render(
      <DonutChart
        data={[
          { name: "Confirmed", value: 0 },
          { name: "Pending", value: 0 },
        ]}
      />
    );
    expect(getByText("Nothing to break down yet.")).toBeTruthy();
  });

  it("renders chart wrapper with aria-label when populated", () => {
    const { container } = render(
      <DonutChart
        data={[
          { name: "Confirmed", value: 3 },
          { name: "Pending", value: 1 },
        ]}
        ariaLabel="Donut test"
      />
    );
    expect(container.querySelector('[aria-label="Donut test"]')).not.toBeNull();
  });

  it("renders an overlaid center label when provided", () => {
    const { getByText } = render(
      <DonutChart
        data={[{ name: "Confirmed", value: 4 }]}
        centerLabel={<span>4 visits</span>}
      />
    );
    expect(getByText("4 visits")).toBeTruthy();
  });
});
