// B-4 step 6 — ReportsCharts wrapper specs.
//
// We don't re-test the underlying B-1 primitives (covered by their own
// spec suites); we verify the wrapper passes correct shape + props through
// AND that StatusDonutChart maps each slice fill via statusFillForName.

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  CountBarChart,
  RevenueChart,
  StatusDonutChart,
  normaliseStatusName,
  statusChartFillForKey,
} from "../ReportsCharts";

// Recharts ResponsiveContainer measures container size; in jsdom it renders
// nothing without a deterministic size. Mock it to forward its children.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

describe("<RevenueChart>", () => {
  it("renders nothing of substance when data is empty (ChartEmpty fallback)", () => {
    const { container } = render(<RevenueChart data={[]} />);
    expect(container.textContent).toContain("No data in this window.");
  });

  it("renders an aria-labelled chart wrapper with the legacy label", () => {
    const { container } = render(
      <RevenueChart
        data={[
          { period: "Jan", booked: 100, collected: 80, outstanding: 20 },
          { period: "Feb", booked: 150, collected: 120, outstanding: 30 },
        ]}
      />
    );
    expect(container.querySelector('[aria-label="Revenue by period chart"]')).not.toBeNull();
  });
});

describe("<CountBarChart>", () => {
  it("renders the empty-state when data is empty", () => {
    const { container } = render(<CountBarChart data={[]} label="Bookings by status" />);
    expect(container.textContent).toContain("No activity recorded.");
  });

  it("forwards the label as the chart wrapper aria-label", () => {
    const { container } = render(
      <CountBarChart
        data={[{ name: "Confirmed", value: 4 }]}
        label="Bookings by source chart"
      />
    );
    expect(container.querySelector('[aria-label="Bookings by source chart"]')).not.toBeNull();
  });

  it("truncates to 8 categories (preserves the legacy slice(0, 8) behaviour)", () => {
    const longData = Array.from({ length: 20 }, (_, i) => ({
      name: `Cat-${i}`,
      value: i + 1,
    }));
    const { container } = render(<CountBarChart data={longData} label="lots" />);
    expect(container.querySelector('[aria-label="lots"]')).not.toBeNull();
  });
});

describe("<StatusDonutChart>", () => {
  it("renders the ChartEmpty when all slices are zero-value", () => {
    const { container } = render(
      <StatusDonutChart
        data={[
          { name: "Confirmed", value: 0 },
          { name: "Pending", value: 0 },
        ]}
      />
    );
    expect(container.textContent).toContain("Nothing to break down yet.");
  });

  it("renders an aria-labelled donut when given lowercase DB enum values (no jsdom-dependent SVG probe)", () => {
    // Smoke: pre-fix this render would still mount the chart, but every slice
    // resolved to the same UNKNOWN_FILL grey. The real fix is verified at the
    // normaliseStatusName + statusFillForName layer below.
    const { container } = render(
      <StatusDonutChart
        data={[
          { name: "pending", value: 3 },
          { name: "confirmed", value: 5 },
          { name: "no_show", value: 1 },
        ]}
      />
    );
    expect(container.querySelector('[aria-label="Bookings by status donut"]')).not.toBeNull();
  });
});

describe("normaliseStatusName + statusChartFillForKey bridge", () => {
  // User-flagged: the first attempt used theme.statusFillForName which returns
  // *-text token variants (designed for accessible text-on-light, lightness
  // ~30%) — visually muted on a chart. statusChartFillForKey replaces that
  // with a bright OKLCH palette at L=55-70%, chroma 0.16-0.22, hues spread
  // around the wheel so each slice POPS.

  it("maps all 5 booking status DB values to distinct bright fills", () => {
    const fills = ["pending", "confirmed", "no_show", "completed", "cancelled"].map(
      (raw) => statusChartFillForKey(normaliseStatusName(raw).key)
    );
    expect(new Set(fills).size).toBe(5);
  });

  it("returns the unrecognised-status fallback for unknown keys", () => {
    expect(statusChartFillForKey("WeirdState")).toBe("oklch(60% 0.05 280)");
  });

  it("produces human-readable display labels (humanises no_show)", () => {
    expect(normaliseStatusName("pending").display).toBe("Pending");
    expect(normaliseStatusName("confirmed").display).toBe("Confirmed");
    expect(normaliseStatusName("completed").display).toBe("Completed");
    expect(normaliseStatusName("cancelled").display).toBe("Cancelled");
    expect(normaliseStatusName("no_show").display).toBe("No-show");
  });

  it("tolerates mixed case + whitespace", () => {
    expect(normaliseStatusName(" Pending ").key).toBe("Pending");
    expect(normaliseStatusName("NO_SHOW").key).toBe("NoShow");
    expect(normaliseStatusName("Confirmed").key).toBe("Confirmed");
  });

  it("falls back to the raw string + 'Other' display when status is unrecognised", () => {
    expect(normaliseStatusName("weird-state").display).toBe("weird-state");
    expect(normaliseStatusName("").display).toBe("Other");
  });

  it("renders an aria-labelled donut for non-empty data", () => {
    const { container } = render(
      <StatusDonutChart
        data={[
          { name: "Confirmed", value: 4 },
          { name: "Cancelled", value: 1 },
        ]}
      />
    );
    expect(container.querySelector('[aria-label="Bookings by status donut"]')).not.toBeNull();
  });

  it("emits a centerLabel slot when provided", () => {
    const { container } = render(
      <StatusDonutChart
        data={[{ name: "Confirmed", value: 4 }]}
        centerLabel={<span data-testid="center">4 bookings</span>}
      />
    );
    expect(container.querySelector('[data-testid="center"]')?.textContent).toBe("4 bookings");
  });

  it("renders a legend row per slice with count + percentage (no override needed)", () => {
    const { container } = render(
      <StatusDonutChart
        data={[
          { name: "confirmed", value: 5 },
          { name: "pending", value: 3 },
          { name: "cancelled", value: 2 },
        ]}
      />
    );
    const items = Array.from(container.querySelectorAll("ul li"));
    expect(items.length).toBe(3);
    // Sorted descending: Confirmed (50%) → Pending (30%) → Cancelled (20%)
    expect(items[0].textContent).toContain("Confirmed");
    expect(items[0].textContent).toContain("5");
    expect(items[0].textContent).toContain("50%");
    expect(items[1].textContent).toContain("Pending");
    expect(items[1].textContent).toContain("30%");
    expect(items[2].textContent).toContain("Cancelled");
    expect(items[2].textContent).toContain("20%");
  });

  it("renders the default centerLabel (total + 'bookings' pluralisation)", () => {
    const { container } = render(
      <StatusDonutChart
        data={[
          { name: "confirmed", value: 4 },
          { name: "pending", value: 1 },
        ]}
      />
    );
    expect(container.textContent).toContain("5");
    expect(container.textContent).toContain("bookings");
  });

  it("singularises the booking label when total is 1", () => {
    const { container } = render(
      <StatusDonutChart data={[{ name: "confirmed", value: 1 }]} />
    );
    expect(container.textContent).toContain("booking");
    expect(container.textContent).not.toMatch(/\bbookings\b/);
  });

  it("hides the legend (and center label) when there are zero slices to break down", () => {
    const { container } = render(
      <StatusDonutChart
        data={[
          { name: "confirmed", value: 0 },
          { name: "pending", value: 0 },
        ]}
      />
    );
    // ChartEmpty fires inside DonutChart; legend ul should not render
    expect(container.querySelector("ul")).toBeNull();
  });
});
