import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MetricRow } from "./MetricRow";

describe("MetricRow", () => {
  it("renders label and value", () => {
    const { getByText } = render(<MetricRow label="Visits" value={42} />);
    expect(getByText("Visits")).toBeTruthy();
    expect(getByText("42")).toBeTruthy();
  });

  it("renders zero values without hiding them", () => {
    const { getByText } = render(<MetricRow label="Hours" value={0} />);
    expect(getByText("0")).toBeTruthy();
  });

  it("renders a delta chip when delta provided", () => {
    const { getByText } = render(
      <MetricRow label="Revenue" value="£1,200" delta={8} />
    );
    expect(getByText("+8.0%")).toBeTruthy();
  });

  it("omits the delta chip when delta is null or undefined", () => {
    const { container } = render(
      <MetricRow label="Revenue" value="£1,200" delta={null} />
    );
    expect(container.textContent).not.toContain("%");
  });

  it("renders a sparkline when series provided", () => {
    const { container } = render(
      <MetricRow label="Trend" value={7} series={[1, 2, 3]} />
    );
    // Sparkline wrapper has aria-hidden="true"
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("omits the sparkline when series is empty", () => {
    const { container } = render(
      <MetricRow label="Trend" value={7} series={[]} />
    );
    // There should be no aria-hidden wrapper from Sparkline (the row itself
    // is not aria-hidden).
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBe(0);
  });

  it("passes tone='invert' to the delta chip", () => {
    const { container } = render(
      <MetricRow label="NoShow rate" value="3%" delta={2} tone="invert" />
    );
    const chip = container.querySelector('[class*="admin-danger-bg"]');
    expect(chip).not.toBeNull();
  });
});
