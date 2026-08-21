// ⛔ D-033 — the customer booking form must not OFFER a hidden service.
//
// Owner ruling: "it should not show nor be bookable" in the create booking
// page, while its cards and info may still appear on the marketing pages.
//
// ⛔ WHY THIS FILE EXISTS AT ALL: it was written because a mutation proved it
// was missing. Deleting the filter entirely from PackageSelectionStep left the
// whole 3,002-test suite GREEN. The server guard was covered, the helper was
// covered, and the thing the customer actually SEES was covered by nothing.
//
// ⚠️ This is the presentation half only. It is NOT the security boundary — a
// hidden service is refused server-side in createBookingTransaction even if it
// somehow reached the form. Both halves are asserted, in their own files,
// because a missing option over a permissive server would be a FAIL, and so
// would a refusing server that still advertises the option.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PackageSelectionStep } from "./PackageSelectionStep";

function renderStep(bookableSlugs?: string[] | null) {
  render(
    <PackageSelectionStep
      selectedPackageIds={[]}
      bookableSlugs={bookableSlugs}
      onToggle={vi.fn()}
      onClear={vi.fn()}
    />
  );
}

/** The card is a button carrying the package name. */
function offered(name: RegExp) {
  return screen.queryByRole("button", { name });
}

describe("PackageSelectionStep — which services a customer may book (D-033)", () => {
  it("offers every package when the list is not restricted", () => {
    renderStep(["supreme-combo", "hijama-package", "fire-package", "massage-30", "massage-60"]);

    expect(offered(/Hijama Package/i)).not.toBeNull();
    expect(offered(/30-Min Massage Therapy/i)).not.toBeNull();
  });

  it("⛔ does NOT offer a package that is not bookable", () => {
    // hijama-package omitted — this is what "Hide from website" produces.
    renderStep(["supreme-combo", "fire-package", "massage-30", "massage-60"]);

    expect(
      offered(/Hijama Package/i),
      "a hidden service must not be offered to a customer"
    ).toBeNull();

    // ⛔ NON-VACUITY. Without this the assertion above would also pass if the
    // component rendered nothing at all, or if the card were not a button.
    expect(
      offered(/Fire Package/i),
      "and the rest of the list still renders"
    ).not.toBeNull();
  });

  it("⛔ FAILS OPEN — shows everything when the lookup failed (null)", () => {
    // null means "could not determine", NOT "none are bookable". Blanking the
    // booking form on a transient database error would be far worse than
    // briefly offering a service that was just hidden — and the server guard
    // still refuses it.
    renderStep(null);

    expect(offered(/Hijama Package/i)).not.toBeNull();
    expect(offered(/Fire Package/i)).not.toBeNull();
  });

  it("⛔ FAILS OPEN — shows everything when the prop is absent entirely", () => {
    // An older caller, or a test, that never passes the prop must keep the
    // pre-D-033 behaviour rather than silently rendering an empty form.
    renderStep(undefined);

    expect(offered(/Hijama Package/i)).not.toBeNull();
  });

  it("hides a whole group heading once nothing in it is bookable", () => {
    // Both cupping packages hidden; the "Hijama & cupping" heading should go
    // with them rather than sit above an empty row.
    renderStep(["massage-30", "massage-60"]);

    // ⛔ queryAllByText, not queryByText. "Massage therapy" appears more than
    // once in this step (the group heading and other copy), so the singular
    // query THROWS on multiple matches rather than returning one — it was
    // failing on ambiguity, not on the behaviour under test.
    expect(
      screen.queryAllByText("Hijama & cupping"),
      "the emptied group takes its heading with it"
    ).toHaveLength(0);
    expect(
      screen.queryAllByText("Massage therapy").length,
      "while the group that still has packages keeps its heading"
    ).toBeGreaterThan(0);
  });
});
