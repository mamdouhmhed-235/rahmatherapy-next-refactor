import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TrendTile } from "./TrendTile";

describe("TrendTile", () => {
  it("renders the label and the chart passed as a prop", () => {
    const { getByText } = render(
      <TrendTile
        label="Revenue trend"
        chart={<div>chart goes here</div>}
      />
    );
    expect(getByText("Revenue trend")).toBeTruthy();
    expect(getByText("chart goes here")).toBeTruthy();
  });

  it("renders a delta chip when delta is set", () => {
    const { getByText } = render(
      <TrendTile
        label="Revenue trend"
        chart={<div />}
        delta={4.5}
      />
    );
    expect(getByText("+4.5%")).toBeTruthy();
  });

  it("omits the delta chip when delta is null", () => {
    const { container } = render(
      <TrendTile label="Revenue trend" chart={<div />} delta={null} />
    );
    expect(container.textContent).not.toMatch(/%/);
  });

  it("renders an action link when actionLabel + actionHref are both set", () => {
    const { container } = render(
      <TrendTile
        label="Revenue"
        chart={<div />}
        actionLabel="View in Reports"
        actionHref="/admin/reports"
      />
    );
    const link = container.querySelector('a[href="/admin/reports"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe("View in Reports");
  });

  it("omits the action link when only one of label/href is set", () => {
    const { container } = render(
      <TrendTile label="Revenue" chart={<div />} actionLabel="View only" />
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("applies the minHeight style override", () => {
    const { container } = render(
      <TrendTile label="Revenue" chart={<div />} minHeight={420} />
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("style")).toContain("min-height: 420px");
  });
});
