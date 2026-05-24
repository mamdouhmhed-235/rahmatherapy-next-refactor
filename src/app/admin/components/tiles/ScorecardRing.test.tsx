import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ScorecardRing } from "./ScorecardRing";

describe("ScorecardRing", () => {
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

  it("renders label + numeric value text", () => {
    const { getByText } = render(
      <ScorecardRing label="Utilisation" value={70} target={80} />
    );
    expect(getByText("Utilisation")).toBeTruthy();
    expect(getByText("70%")).toBeTruthy();
  });

  it("renders 0/0 (no target) without dividing by zero", () => {
    const { container } = render(
      <ScorecardRing label="Empty" value={0} target={0} />
    );
    // No crash; the SVG still renders.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("colours the ring with the Confirmed family when value >= target", () => {
    const { container } = render(
      <ScorecardRing label="On track" value={80} target={80} />
    );
    const ring = container.querySelectorAll("circle")[1];
    expect(ring.getAttribute("stroke")).toBe(
      "var(--admin-status-confirmed-text)"
    );
  });

  it("colours the ring with the Pending family at 75-99% of target", () => {
    const { container } = render(
      <ScorecardRing label="Approaching" value={60} target={80} />
    );
    const ring = container.querySelectorAll("circle")[1];
    expect(ring.getAttribute("stroke")).toBe(
      "var(--admin-status-pending-text)"
    );
  });

  it("colours the ring with the Attention family below 75% of target", () => {
    const { container } = render(
      <ScorecardRing label="Behind" value={40} target={80} />
    );
    const ring = container.querySelectorAll("circle")[1];
    expect(ring.getAttribute("stroke")).toBe(
      "var(--admin-status-attention-text)"
    );
  });

  it("renders an sr-only description with the absolute reading + percentage", () => {
    const { container } = render(
      <ScorecardRing label="Utilisation" value={70} target={80} />
    );
    const srOnly = container.querySelector(".sr-only");
    expect(srOnly?.textContent).toContain("70% of 80% target");
    expect(srOnly?.textContent).toContain("88%");
  });

  it("disables the dashoffset transition under prefers-reduced-motion", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const { container } = render(
      <ScorecardRing label="Util" value={50} target={80} />
    );
    const ring = container.querySelectorAll("circle")[1];
    expect(ring.getAttribute("style") ?? "").not.toContain("transition");
  });
});
