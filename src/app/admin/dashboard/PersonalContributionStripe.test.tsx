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
});
