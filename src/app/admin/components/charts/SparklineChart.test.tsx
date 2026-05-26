import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SparklineChart } from "./SparklineChart";

describe("SparklineChart", () => {
  it("renders nothing when data is undefined", () => {
    const { container } = render(<SparklineChart data={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when data is empty (per brief §8 — no copy at 32px)", () => {
    const { container } = render(<SparklineChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a hidden wrapper when data has points", () => {
    const { container } = render(
      <SparklineChart
        data={[{ value: 1 }, { value: 2 }, { value: 3 }]}
        className="sparkline-test"
      />
    );
    const wrapper = container.querySelector(".sparkline-test");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders with a single-point series", () => {
    const { container } = render(<SparklineChart data={[{ value: 5 }]} />);
    expect(container.firstChild).not.toBeNull();
  });
});
