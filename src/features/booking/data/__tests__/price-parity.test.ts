// F6 (2026-08-17) — price parity across every hand-maintained copy.
//
// THE PROBLEM THIS GUARDS
// Prices are duplicated across five files. They all agree today, so nobody is
// being mis-quoted — the risk is entirely in the future: the first time someone
// edits a price in one place and not the other four, the site quotes two
// different numbers to the same customer and nothing anywhere complains.
//
// A single source of truth would be the real fix, and remains the better answer
// (F6 option A). This is option B: it does not prevent the duplication, but it
// makes shipping a divergence impossible. That trade was chosen deliberately —
// ~15 bookings and one engineer do not justify a refactor across five files and
// the public marketing surface when a test converts the risk to a failing build
// for a fraction of the cost.
//
// WHEN THIS TEST FAILS
// You changed a price in one file. Change it in ALL of them, or do option A
// properly and delete this test.

import { describe, expect, it } from "vitest";
import { BOOKING_PACKAGES } from "../booking-packages";
import { servicePackages } from "@/content/pages/services";
import { homePackages } from "@/content/pages/home";
// D7 (2026-08-17): packagePages.ts was MISSING from the first version of
// this test — the file the plan lists first, with 30 price literals, the most
// of any source. A price changed there alone kept the suite green while the
// public package landing pages quoted the old number.
import { packagePages } from "@/content/pages/packagePages";
import {
  PACKAGE_OPTIONS,
  MASSAGE_OPTIONS,
} from "@/app/admin/bookings/new/ManualBookingForm";

/** "£55" -> 55. Throws loudly rather than silently yielding NaN. */
function poundsToNumber(value: string): number {
  const match = /^£(\d+(?:\.\d{1,2})?)$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Price "${value}" is not in the expected "£NN" form. If the format ` +
        `changed, update this parser — do not loosen the assertion.`
    );
  }
  return Number(match[1]);
}

/** Sorted ascending so the comparison ignores per-file ordering. */
function sortedPrices(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

// The booking flow is the authority: BOOKING_PACKAGES.price is what a customer
// is actually charged. Every other copy is display-only and must match it.
const CANONICAL = sortedPrices(BOOKING_PACKAGES.map((p) => p.price));

describe("price parity across the five hand-maintained sources", () => {
  it("the canonical booking source has the expected shape", () => {
    // Guards the guard: if BOOKING_PACKAGES were ever emptied or restructured,
    // every comparison below would trivially pass against an empty array.
    expect(CANONICAL.length).toBeGreaterThanOrEqual(5);
    expect(CANONICAL.every((n) => Number.isFinite(n) && n > 0)).toBe(true);
  });

  it("services.ts matches the booking prices", () => {
    const prices = sortedPrices(
      servicePackages.map((pkg) => poundsToNumber(pkg.price))
    );
    expect(prices).toEqual(CANONICAL);
  });

  it("home.ts matches the booking prices", () => {
    const prices = sortedPrices(
      homePackages.map((pkg) => poundsToNumber(pkg.price))
    );
    expect(prices).toEqual(CANONICAL);
  });

  it("packagePages.ts matches the booking prices — top level, summary and related", () => {
    // ⛔ The original version of this case mapped `pkg.price` only, reaching 5 of
    // this file's 25 price literals. Proven 2026-08-19: setting the
    // relatedPackages price on line 258 to "£999" left all six cases GREEN. The
    // other 20 live in `summary` and `relatedPackages`.
    //
    // ⛔ A set comparison is NOT sufficient either, and a draft of this test got
    // it wrong twice over: it compared a DE-DUPLICATED set against CANONICAL,
    // which contains 40 twice (two packages cost £40), so it would have failed on
    // correct data. And a set passes when two prices are SWAPPED between
    // packages, which is the likelier human error.
    //
    // So this asserts the real invariant instead: a box that links to a package
    // must quote THAT package's own price. Every relatedPackages `href` ends in
    // a slug that exists in this file, which is what makes it checkable.
    // Explicitly <string, number>: packagePages narrows `slug` to a literal
    // union, so an inferred Map would reject the plain `string` pulled out of a
    // relatedPackages href below.
    const bySlug = new Map<string, number>(
      packagePages.map((pkg) => [pkg.slug, poundsToNumber(pkg.price)])
    );

    // (a) the five top-level prices are still exactly the canonical set
    expect(sortedPrices([...bySlug.values()])).toEqual(CANONICAL);

    // (b) each package's own summary quotes its own price
    for (const pkg of packagePages) {
      expect(
        poundsToNumber(pkg.summary.price),
        `${pkg.slug} summary.price`
      ).toBe(bySlug.get(pkg.slug));
    }

    // (c) each related-package box quotes the price of the package it links to
    let relatedChecked = 0;
    for (const pkg of packagePages) {
      for (const related of pkg.relatedPackages ?? []) {
        const target = related.href.replace(/^\/services\//, "");
        expect(
          bySlug.has(target),
          `${pkg.slug} links to unknown package "${target}"`
        ).toBe(true);
        expect(
          poundsToNumber(related.price),
          `${pkg.slug} → ${target}`
        ).toBe(bySlug.get(target));
        relatedChecked += 1;
      }
    }

    // ⛔ Guards the guard. Without these, a refactor that renamed `summary` or
    // `relatedPackages` would make both loops iterate zero times and this test
    // would pass while checking nothing — the exact silent-pass mode that put
    // every other item on this list.
    expect(bySlug.size, "top-level packages").toBe(5);
    expect(relatedChecked, "related-package prices checked").toBe(15);
  });

  it("the admin manual-booking form matches the booking prices", () => {
    // The admin form splits the same five across two lists: three cupping
    // packages and two massage durations.
    const prices = sortedPrices([
      ...PACKAGE_OPTIONS.map((opt) => poundsToNumber(opt.price)),
      ...MASSAGE_OPTIONS.map((opt) => poundsToNumber(opt.price)),
    ]);
    expect(prices).toEqual(CANONICAL);
  });

  it("every source agrees package-for-package, not just as a set", () => {
    // A set comparison alone would miss two prices being SWAPPED between
    // packages — identical numbers, wrong products, and a customer quoted £40
    // for the £60 treatment. Joining on the shared id/slug catches that.
    const canonicalById = new Map(BOOKING_PACKAGES.map((p) => [p.id, p.price]));

    // At least one id must actually join, or this test would pass vacuously by
    // skipping everything.
    let matched = 0;

    const check = (id: string, price: string, source: string) => {
      const expected = canonicalById.get(id as never);
      if (expected === undefined) return;
      matched += 1;
      expect(
        poundsToNumber(price),
        `${source}: price for "${id}" disagrees with the booking flow`
      ).toBe(expected);
    };

    for (const pkg of servicePackages) check(pkg.id, pkg.price, "services.ts");
    for (const pkg of homePackages) check(pkg.id, pkg.price, "home.ts");
    for (const opt of PACKAGE_OPTIONS) {
      check(opt.slug, opt.price, "ManualBookingForm PACKAGE_OPTIONS");
    }
    for (const opt of MASSAGE_OPTIONS) {
      check(opt.slug, opt.price, "ManualBookingForm MASSAGE_OPTIONS");
    }

    expect(
      matched,
      "No id joined against BOOKING_PACKAGES — the shared identifiers changed " +
        "and this test silently stopped comparing anything."
    ).toBeGreaterThan(0);
  });
});
