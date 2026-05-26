import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DeltaChip } from "./DeltaChip";

describe("DeltaChip", () => {
  it("renders nothing when value is null, undefined, or NaN", () => {
    const { container: a } = render(<DeltaChip value={null} />);
    const { container: b } = render(<DeltaChip value={undefined} />);
    const { container: c } = render(<DeltaChip value={Number.NaN} />);
    expect(a.firstChild).toBeNull();
    expect(b.firstChild).toBeNull();
    expect(c.firstChild).toBeNull();
  });

  it("renders +X% with up arrow + success class for positive auto mode", () => {
    const { getByText, container } = render(<DeltaChip value={12} />);
    expect(getByText("+12.0%")).toBeTruthy();
    expect(container.textContent).toContain("↑");
    expect(container.querySelector(".sr-only")?.textContent).toBe("up");
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain("admin-success-bg");
    expect(chip.className).toContain("admin-success");
  });

  it("renders -X% with down arrow + danger class for negative auto mode", () => {
    const { getByText, container } = render(<DeltaChip value={-3.2} />);
    expect(getByText("-3.2%")).toBeTruthy();
    expect(container.textContent).toContain("↓");
    expect(container.querySelector(".sr-only")?.textContent).toBe("down");
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain("admin-danger-bg");
    expect(chip.className).toContain("admin-danger");
  });

  it("renders 0.0% with neutral arrow + muted class for zero", () => {
    const { getByText, container } = render(<DeltaChip value={0} />);
    expect(getByText("0.0%")).toBeTruthy();
    expect(container.textContent).toContain("→");
    expect(container.querySelector(".sr-only")?.textContent).toBe("unchanged");
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain("admin-panel-muted");
    expect(chip.className).toContain("admin-text-muted");
  });

  it("inverts severity when tone='invert' (positive becomes danger, negative becomes success)", () => {
    const { container: positiveInvert } = render(
      <DeltaChip value={5} tone="invert" />
    );
    expect((positiveInvert.firstChild as HTMLElement).className).toContain(
      "admin-danger-bg"
    );
    const { container: negativeInvert } = render(
      <DeltaChip value={-5} tone="invert" />
    );
    expect((negativeInvert.firstChild as HTMLElement).className).toContain(
      "admin-success-bg"
    );
  });

  it("adds the period-label title attribute when periodLabel is provided", () => {
    const { container } = render(<DeltaChip value={5} periodLabel="month" />);
    expect((container.firstChild as HTMLElement).getAttribute("title")).toBe(
      "+5.0% vs prior month"
    );
  });
});
