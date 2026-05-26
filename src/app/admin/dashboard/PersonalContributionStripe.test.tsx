// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  PersonalContributionStripe,
  parseStripeRange,
  STRIPE_RANGES,
} from "./PersonalContributionStripe";
import type { PersonalStripeTile } from "./dashboard-helpers-b5";

function tiles(): PersonalStripeTile[] {
  return [
    { label: "Bookings today", value: "3" },
    { label: "My contribution", value: "12", delta: 4 },
    { label: "Revenue this week", value: "£540.00" },
    { label: "Open attention", value: "2", tone: "invert" },
  ];
}

describe("parseStripeRange", () => {
  it("defaults to this_week for undefined / null / unknown values", () => {
    expect(parseStripeRange(undefined)).toBe("this_week");
    expect(parseStripeRange(null)).toBe("this_week");
    expect(parseStripeRange("garbage")).toBe("this_week");
    expect(parseStripeRange("")).toBe("this_week");
  });

  it("preserves valid values", () => {
    expect(parseStripeRange("today")).toBe("today");
    expect(parseStripeRange("this_week")).toBe("this_week");
    expect(parseStripeRange("this_month")).toBe("this_month");
  });
});

describe("STRIPE_RANGES", () => {
  it("exposes the canonical 3-range list in display order", () => {
    expect(STRIPE_RANGES).toEqual(["today", "this_week", "this_month"]);
  });
});

describe("PersonalContributionStripe", () => {
  it("renders all 4 tile labels + values", () => {
    const { getByText } = render(
      <PersonalContributionStripe
        tiles={tiles()}
        activeRange="this_week"
        variant="business"
      />
    );
    expect(getByText("Bookings today")).toBeTruthy();
    expect(getByText("My contribution")).toBeTruthy();
    expect(getByText("Revenue this week")).toBeTruthy();
    expect(getByText("Open attention")).toBeTruthy();
    expect(getByText("£540.00")).toBeTruthy();
  });

  it("renders the eyebrow with active range label", () => {
    const { getByText } = render(
      <PersonalContributionStripe
        tiles={tiles()}
        activeRange="this_month"
        variant="business"
      />
    );
    expect(getByText("My contribution · This month")).toBeTruthy();
  });

  it("exposes a fieldset + sr-only legend for the period picker (SHARED-NOTES §3 a11y)", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={tiles()}
        activeRange="this_week"
        variant="business"
      />
    );
    const fieldset = container.querySelector("fieldset");
    expect(fieldset).not.toBeNull();
    const legend = container.querySelector("legend");
    expect(legend?.textContent).toBe("My contribution period");
    expect(legend?.className).toContain("sr-only");
  });

  it("renders 3 picker chips with active chip carrying aria-current", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={tiles()}
        activeRange="this_week"
        variant="coordinator"
      />
    );
    const chips = container.querySelectorAll("fieldset a");
    expect(chips.length).toBe(3);
    const active = container.querySelector("a[aria-current='page']");
    expect(active?.textContent).toBe("This week");
  });

  it("picker links preserve unrelated URL params", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={tiles()}
        activeRange="today"
        variant="business"
        preservedSearchParams={{ range: "today", from: "2026-05-25", city: "Luton" }}
      />
    );
    const links = container.querySelectorAll<HTMLAnchorElement>("fieldset a");
    for (const link of Array.from(links)) {
      expect(link.href).toContain("range=today");
      expect(link.href).toContain("from=2026-05-25");
      expect(link.href).toContain("city=Luton");
      expect(link.href).toMatch(/contribStripeRange=(today|this_week|this_month)/);
    }
  });

  it("picker links drop empty values from preservedSearchParams", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={tiles()}
        activeRange="this_week"
        variant="business"
        preservedSearchParams={{ range: "this_week", city: "" }}
      />
    );
    const firstLink = container.querySelector<HTMLAnchorElement>("fieldset a");
    expect(firstLink?.href).not.toContain("city=");
  });

  it("data-variant attribute mirrors the variant prop", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={tiles()}
        activeRange="today"
        variant="therapist"
      />
    );
    const section = container.querySelector("section[data-variant]");
    expect(section?.getAttribute("data-variant")).toBe("therapist");
  });

  // ── Mobile-first tile rendering (user-found bug 2026-05-25) ───────────────
  // The original implementation composed <MetricRow> (single-line truncate)
  // inside a 2×2 grid. At 375px viewport "Hours this week" → "Hours this …",
  // "Clients this month" → "Cl…", and "Nothing scheduled" wrapped into the
  // value slot. The fix is a custom stacked tile (label / value / delta+spark).

  it("each tile carries a data-tile-label hook for Playwright targeting", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={tiles()}
        activeRange="this_week"
        variant="therapist"
      />
    );
    const tileNodes = container.querySelectorAll("[data-tile-label]");
    expect(tileNodes).toHaveLength(4);
    expect(
      Array.from(tileNodes).map((n) => n.getAttribute("data-tile-label"))
    ).toEqual([
      "Bookings today",
      "My contribution",
      "Revenue this week",
      "Open attention",
    ]);
  });

  it("label is NOT truncate-class (long labels wrap on narrow tiles)", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={[
          { label: "Hours this week", value: "0h" },
          { label: "Clients this month", value: "0" },
          { label: "Next visit", value: "Nothing scheduled" },
          { label: "Open attention", value: "0", tone: "invert" },
        ]}
        activeRange="this_week"
        variant="therapist"
      />
    );
    const labels = container.querySelectorAll("[data-tile-label] > p:first-child");
    for (const label of Array.from(labels)) {
      expect(label.className).not.toContain("truncate");
    }
  });

  it("value is break-words so long strings like 'Nothing scheduled' wrap", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={[
          { label: "Next visit", value: "Nothing scheduled" },
          { label: "Today's visits", value: "0" },
          { label: "Hours this week", value: "0h" },
          { label: "Clients this month", value: "0" },
        ]}
        activeRange="this_week"
        variant="therapist"
      />
    );
    const valueP = container.querySelector("[data-tile-label='Next visit'] > p:nth-child(2)");
    expect(valueP?.textContent).toBe("Nothing scheduled");
    expect(valueP?.className).toContain("break-words");
    expect(valueP?.className).not.toContain("truncate");
  });

  it("delta chip is HIDDEN when delta is exactly 0 (no '→ 0.0%' noise)", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={[
          { label: "Clients this month", value: "0", delta: 0 },
        ]}
        activeRange="this_month"
        variant="therapist"
      />
    );
    const tile = container.querySelector("[data-tile-label='Clients this month']");
    expect(tile?.textContent).not.toContain("0.0%");
    expect(tile?.textContent).not.toContain("→");
  });

  it("delta chip renders when delta is positive", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={[{ label: "Hours this week", value: "8h", delta: 3 }]}
        activeRange="this_week"
        variant="therapist"
      />
    );
    expect(container.textContent).toContain("+3.0%");
  });

  it("delta chip renders when delta is negative", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={[{ label: "Hours this week", value: "8h", delta: -2 }]}
        activeRange="this_week"
        variant="therapist"
      />
    );
    expect(container.textContent).toContain("-2.0%");
  });

  it("delta chip hidden when delta is null (existing DeltaChip behaviour)", () => {
    const { container } = render(
      <PersonalContributionStripe
        tiles={[{ label: "Hours this week", value: "8h", delta: null }]}
        activeRange="this_week"
        variant="therapist"
      />
    );
    expect(container.textContent).not.toContain("%");
  });
});
