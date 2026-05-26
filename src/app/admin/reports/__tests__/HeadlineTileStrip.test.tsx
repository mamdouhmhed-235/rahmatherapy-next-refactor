// B-4 step 4 — HeadlineTileStrip specs.
//
// Renders pure pass-through to KpiTile; minimal mocking required.

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HeadlineTileStrip } from "../HeadlineTileStrip";
import type { TileSpec } from "../reports-helpers";

const OWNER_TILES: TileSpec[] = [
  { key: "bookings", label: "Bookings", value: "50", delta: 25, href: "/admin/bookings?range=month" },
  { key: "collected_revenue", label: "Collected revenue", value: "£5,000", delta: 25 },
  { key: "outstanding", label: "Outstanding", value: "£1,200", delta: 50, hint: "Of which completed but unpaid" },
  { key: "new_clients", label: "New clients", value: "8", delta: 60, href: "/admin/clients?range=month" },
  { key: "utilisation", label: "Utilisation rate", value: "65%", delta: 15, hint: "26h of 40h available" },
  { key: "no_show", label: "No-show rate", value: "8%", delta: 3, deltaTone: "invert", hint: "2 no-show · 2 cancelled of 50 bookings" },
];

const COORD_TILES: TileSpec[] = OWNER_TILES.filter(
  (t) => t.key !== "collected_revenue" && t.key !== "outstanding"
);

describe("<HeadlineTileStrip>", () => {
  it("renders 6 tiles for owner_admin scope (one per TileSpec)", () => {
    const { container } = render(<HeadlineTileStrip tiles={OWNER_TILES} />);
    const tiles = container.querySelectorAll('a[aria-label], div[aria-label]');
    // Each KpiTile renders an aria-labelled container (Link or div) — 6 expected.
    expect(tiles.length).toBe(6);
  });

  it("renders 4 tiles for coordinator/therapist scope", () => {
    const { container } = render(<HeadlineTileStrip tiles={COORD_TILES} />);
    const tiles = container.querySelectorAll('a[aria-label], div[aria-label]');
    expect(tiles.length).toBe(4);
  });

  it("uses Bookings as the first tile (matches brief §4 order)", () => {
    const { container } = render(<HeadlineTileStrip tiles={OWNER_TILES} />);
    const first = container.querySelector('a[aria-label], div[aria-label]');
    expect(first?.getAttribute("aria-label")).toBe("Bookings");
  });

  it("emits the section aria-label 'Headline metrics' for screen readers", () => {
    const { container } = render(<HeadlineTileStrip tiles={OWNER_TILES} />);
    expect(container.querySelector("section")?.getAttribute("aria-label")).toBe(
      "Headline metrics"
    );
  });

  it("renders tile values verbatim in the DOM", () => {
    const { container } = render(<HeadlineTileStrip tiles={OWNER_TILES} />);
    expect(container.textContent).toContain("£5,000");
    expect(container.textContent).toContain("£1,200");
    expect(container.textContent).toContain("65%");
    expect(container.textContent).toContain("8%");
  });

  it("renders tiles with href as <Link> (clickable) and without href as <div>", () => {
    const { container } = render(<HeadlineTileStrip tiles={OWNER_TILES} />);
    // Bookings tile → <Link>
    const bookings = container.querySelector('a[aria-label="Bookings"]');
    expect(bookings?.getAttribute("href")).toBe("/admin/bookings?range=month");
    // Collected revenue → no href → <div>
    const collected = container.querySelector('[aria-label="Collected revenue"]');
    expect(collected?.tagName).toBe("DIV");
  });

  it("applies the min-h-[14rem] equal-height class to every tile (brief §5)", () => {
    const { container } = render(<HeadlineTileStrip tiles={OWNER_TILES} />);
    const tiles = container.querySelectorAll('a[aria-label], div[aria-label]');
    tiles.forEach((tile) => {
      expect(tile.className).toContain("min-h-[14rem]");
    });
  });
});
