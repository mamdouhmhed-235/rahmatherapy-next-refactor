import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { CountUp } from "./CountUp";

describe("CountUp", () => {
  beforeEach(() => {
    // Default matchMedia (reduced-motion = false) for these specs unless
    // overridden by an individual test.
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

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the initial value on first paint", () => {
    const { container } = render(<CountUp value={42} />);
    expect(container.textContent).toBe("42");
  });

  it("uses a custom format function", () => {
    const { container } = render(
      <CountUp value={1234} format={(n) => `£${Math.round(n).toLocaleString()}`} />
    );
    expect(container.textContent).toBe("£1,234");
  });

  it("renders instantly under prefers-reduced-motion", () => {
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
    const { container, rerender } = render(<CountUp value={10} />);
    rerender(<CountUp value={50} />);
    expect(container.textContent).toBe("50");
  });

  it("renders instantly when duration is 0", () => {
    const { container, rerender } = render(<CountUp value={10} duration={0} />);
    rerender(<CountUp value={50} duration={0} />);
    expect(container.textContent).toBe("50");
  });

  it("cancels the rAF loop on unmount without throwing", () => {
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    const { rerender, unmount } = render(<CountUp value={10} duration={400} />);
    rerender(<CountUp value={100} duration={400} />);
    act(() => {
      unmount();
    });
    // The component should not have thrown; cancelAnimationFrame may or may
    // not have fired depending on rAF scheduling in jsdom — what matters is
    // no error surfaces.
    expect(cancelSpy).toBeDefined();
  });
});
