import { describe, it, expect } from "vitest";
import {
  statusFillForName,
  severityForDelta,
  defaultChartTheme,
} from "./theme";

describe("statusFillForName", () => {
  it("returns the canonical token for each booking status", () => {
    expect(statusFillForName("Confirmed")).toBe(
      "var(--admin-status-confirmed-text)"
    );
    expect(statusFillForName("Pending")).toBe(
      "var(--admin-status-pending-text)"
    );
    expect(statusFillForName("Completed")).toBe(
      "var(--admin-status-completed-text)"
    );
    expect(statusFillForName("Cancelled")).toBe(
      "var(--admin-status-cancelled-text)"
    );
    expect(statusFillForName("NoShow")).toBe(
      "var(--admin-status-attention-text)"
    );
  });

  it("falls back to muted text for unknown names", () => {
    expect(statusFillForName("Mystery")).toBe("var(--admin-text-muted)");
    expect(statusFillForName("")).toBe("var(--admin-text-muted)");
    expect(statusFillForName("confirmed")).toBe("var(--admin-text-muted)");
  });
});

describe("severityForDelta", () => {
  it("returns positive for positive deltas in auto mode", () => {
    expect(severityForDelta(5)).toBe("positive");
    expect(severityForDelta(0.01)).toBe("positive");
    expect(severityForDelta(100)).toBe("positive");
  });

  it("returns negative for negative deltas in auto mode", () => {
    expect(severityForDelta(-5)).toBe("negative");
    expect(severityForDelta(-0.01)).toBe("negative");
    expect(severityForDelta(-100)).toBe("negative");
  });

  it("returns neutral for zero, null, undefined, and NaN", () => {
    expect(severityForDelta(0)).toBe("neutral");
    expect(severityForDelta(null)).toBe("neutral");
    expect(severityForDelta(undefined)).toBe("neutral");
    expect(severityForDelta(Number.NaN)).toBe("neutral");
  });

  it("inverts positive/negative when tone is 'invert'", () => {
    expect(severityForDelta(5, "invert")).toBe("negative");
    expect(severityForDelta(-5, "invert")).toBe("positive");
    expect(severityForDelta(0, "invert")).toBe("neutral");
    expect(severityForDelta(null, "invert")).toBe("neutral");
  });
});

describe("defaultChartTheme", () => {
  it("uses CSS variable references (no raw hex / oklch literals)", () => {
    expect(defaultChartTheme.axisTickFill).toMatch(/^var\(--/);
    expect(defaultChartTheme.axisStroke).toMatch(/^var\(--/);
    expect(defaultChartTheme.gridStroke).toMatch(/^var\(--/);
    expect(defaultChartTheme.tooltipBg).toMatch(/^var\(--/);
    expect(defaultChartTheme.tooltipBorder).toMatch(/^var\(--/);
    expect(defaultChartTheme.primaryStroke).toMatch(/^var\(--/);
    expect(defaultChartTheme.fontFamily).toMatch(/^var\(--/);
  });

  it("provides a sane axis font size for tile-tail use", () => {
    expect(defaultChartTheme.fontSize).toBeGreaterThan(0);
    expect(defaultChartTheme.fontSize).toBeLessThan(20);
  });
});
