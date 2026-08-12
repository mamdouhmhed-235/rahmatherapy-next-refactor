import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Item 8 Phase 5 — the customer-facing travel-charge copy, Owner-approved.
 *
 * ⛔ THESE STRINGS ARE NOT FREE TO EDIT. The plan carries the final wording as
 * a stop condition: it was drafted, reviewed and signed off by the Owner
 * because it is the only place a customer is told a charge may apply before
 * they commit. Changing any of it needs the same sign-off — this file exists to
 * make a silent drift impossible, not to make the copy immutable.
 *
 * Source-text assertions rather than render assertions, deliberately: neither
 * ConfirmStep nor the manage page has a test harness, and standing one up for
 * react-hook-form + a signed-token route would be a far larger change than the
 * copy it guards. Where a harness DOES exist the assertion is a real render —
 * see AboutYouStep.test.tsx.
 *
 * A deliberate omission, also Owner-decided: none of this copy mentions the
 * mileage origin. It is descriptive only and nothing computes from it, so
 * telling a customer we measure from a point would imply a calculation we do
 * not perform. It stays an admin-only field.
 */

/**
 * Line endings are normalised because this repo holds a mix of CRLF and LF —
 * most sources are CRLF, but the Edit tooling rewrites working copies to LF.
 * A multi-line assertion that did not normalise would pass or fail depending on
 * which tool last touched the file, which is worse than no assertion.
 */
function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n"
  );
}

describe("travel-charge copy — the booking form", () => {
  // Collapsed to single spaces so the assertions are about WORDS rather than
  // formatting: JSX wraps these sentences across lines, and a reflow is not a
  // copy change. An assertion that broke on one would be noise, and noisy
  // guards get deleted.
  const confirmStep = source(
    "src/features/booking/components/ConfirmStep.tsx"
  ).replace(/\s+/g, " ");

  it("names the travel charge in the payment acknowledgement", () => {
    // The customer ticks this box to say they understand what they will owe.
    // Omitting the charge here makes the acknowledgement incomplete.
    expect(confirmStep).toContain(
      "the amount due is based on the selected service, the participant count, and any travel charge for my area."
    );
  });

  it("carries a reassurance block that does not over-promise a charge", () => {
    expect(confirmStep).toContain(
      "Visits outside our free-travel areas may include a travel charge."
    );
    // "may" and "if one applies" are load-bearing: an admin can waive the fee,
    // and copy that promises one would then be wrong.
    expect(confirmStep).toContain(
      "If one applies, it&rsquo;s shown on your confirmation email and included in the total."
    );
  });

  it("still describes the request as a request, not a purchase", () => {
    // Pre-existing copy the travel-charge edits must not have disturbed.
    expect(confirmStep).toContain("Online checkout is not part of this request.");
    expect(confirmStep).toContain("I understand this is a booking request.");
  });
});

describe("travel-charge copy — the request-received email", () => {
  it("warns that the total is not final when a travel charge may apply", async () => {
    // Asserted against the REGISTRY, not the file. A source-text version of
    // this passed while the rendered default had lost the sentence, because the
    // same wording also sits in the field's `placeholder` — which is editor
    // affordance, not customer copy. `defaultValue` is what actually renders.
    const { findTemplate } = await import(
      "@/app/admin/emails/components/templates-data"
    );
    const template = findTemplate("booking_confirmation");
    const greeting = template?.fields.find(
      (field) => field.kind === "greeting_intro"
    );

    expect(greeting?.defaultValue).toContain(
      "If your address is outside our free-travel areas, we'll add a travel charge and confirm the final total when we get back to you."
    );
  });
});

describe("travel-charge copy — the manage-booking page", () => {
  it("breaks the charge out as its own row, only when there is one", () => {
    const managePage = source("src/app/booking/manage/page.tsx");

    expect(managePage).toContain('<Row label="Travel charge">');
    // Conditional: a £0.00 travel-charge row on an in-area booking would be
    // noise, and would imply a charge that does not exist.
    expect(managePage).toContain("booking.travelFee > 0");
  });
});
