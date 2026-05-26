import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { KpiTile } from "./KpiTile";

describe("KpiTile", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  it("renders label and numeric value", () => {
    const { getByText } = render(<KpiTile label="Bookings" value={42} />);
    expect(getByText("Bookings")).toBeTruthy();
    expect(getByText("42")).toBeTruthy();
  });

  it("renders string values verbatim", () => {
    const { getByText } = render(<KpiTile label="Revenue" value="£1,234" />);
    expect(getByText("£1,234")).toBeTruthy();
  });

  it("renders value=0 without hiding (no falsy bug)", () => {
    const { getByText } = render(<KpiTile label="Hours" value={0} />);
    expect(getByText("0")).toBeTruthy();
  });

  it("renders a delta chip when delta is set", () => {
    const { getByText } = render(
      <KpiTile label="Bookings" value={42} delta={12} />
    );
    expect(getByText("+12.0%")).toBeTruthy();
  });

  it("omits the delta chip when delta is null", () => {
    const { container } = render(
      <KpiTile label="Bookings" value={42} delta={null} />
    );
    expect(container.textContent).not.toMatch(/%/);
  });

  it("renders a sparkline tail when series provided", () => {
    const { container } = render(
      <KpiTile label="Bookings" value={42} series={[1, 2, 3, 4]} />
    );
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("renders a hint when no series provided", () => {
    const { getByText } = render(
      <KpiTile label="Bookings" value={42} hint="vs 36 last month" />
    );
    expect(getByText("vs 36 last month")).toBeTruthy();
  });

  it("renders as a <Link> with href set + hover-lift classes", () => {
    const { container } = render(
      <KpiTile label="Bookings" value={42} href="/admin/reports" />
    );
    const link = container.querySelector('a[href="/admin/reports"]');
    expect(link).not.toBeNull();
    expect(link?.className).toContain("hover:-translate-y-px");
    expect(link?.getAttribute("aria-label")).toBe("Bookings");
  });

  it("renders as a <div role='group'> when href is absent", () => {
    const { container } = render(<KpiTile label="Bookings" value={42} />);
    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute("aria-label")).toBe("Bookings");
  });

  it("passes formatValue through to the CountUp numeral", () => {
    const { container } = render(
      <KpiTile
        label="Revenue"
        value={1234}
        formatValue={(n) => `£${Math.round(n).toLocaleString()}`}
      />
    );
    expect(container.textContent).toContain("£1,234");
  });
});
