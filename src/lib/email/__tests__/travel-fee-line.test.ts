import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_INPUT } from "./__fixtures__/parity-sample-inputs";
import {
  renderBookingConfirmationEmail,
  renderBookingPlainText,
} from "../templates";

/**
 * Item 8 Phase 5 — the labelled travel-charge line.
 *
 * The render-parity fixture (registry-defaults.test.ts) already proves a
 * FEE-LESS booking renders byte-identically to before item 8. What it cannot
 * prove is the other half: that a booking WITH a fee actually shows one. Both
 * halves matter — an "always emit the block" implementation passes this file
 * and fails parity, and a "never emit it" implementation does the reverse.
 *
 * The line lives inside the fixed renderSummary/renderBookingPlainText bodies,
 * never as an overridable SafeField: overrides replace a field's whole rendered
 * text, so a template carrying a saved override would silently drop the charge.
 */
describe("travel-charge line in booking emails", () => {
  const WITH_FEE = { ...BASE_INPUT, travelFee: 14 };

  it("prints a labelled travel charge in the HTML summary when one applies", () => {
    const html = renderBookingConfirmationEmail(WITH_FEE);

    expect(html).toContain("Travel charge:");
    expect(html).toContain("£14.00");
  });

  it("prints it in the plain-text summary too", () => {
    const text = renderBookingPlainText("Booking confirmation", WITH_FEE);

    expect(text).toContain("Travel charge: £14.00");
  });

  it("says nothing at all when there is no travel charge", () => {
    const html = renderBookingConfirmationEmail(BASE_INPUT);
    const text = renderBookingPlainText("Booking confirmation", BASE_INPUT);

    expect(html).not.toContain("Travel charge");
    expect(text).not.toContain("Travel charge");
  });

  it("treats a zero fee as no charge rather than printing £0.00", () => {
    const html = renderBookingConfirmationEmail({ ...BASE_INPUT, travelFee: 0 });

    expect(html).not.toContain("Travel charge");
  });

  // The fee is ALREADY folded into total_price by the time an email renders,
  // so the labelled line is a breakdown of the total, never an addition to it.
  // Printing a total that excludes it would understate what the customer owes.
  it("leaves the total alone — the line explains it, it does not add to it", () => {
    const withFee = renderBookingPlainText("Booking confirmation", WITH_FEE);
    const withoutFee = renderBookingPlainText("Booking confirmation", BASE_INPUT);

    const totalLine = (body: string) =>
      body.split("\n").find((line) => line.startsWith("Total:"));

    expect(totalLine(withFee)).toBe(totalLine(withoutFee));
  });

  // ⛔ SOURCE-TEXT GUARD, and it is load-bearing rather than belt-and-braces.
  //
  // Every email test stubs Supabase with a hand-built object that returns the
  // whole mock row regardless of what the select string asked for. So removing
  // `travel_fee` from BOOKING_EMAIL_SELECT changes NOTHING in any test — it was
  // verified by mutation that the behavioural tests above all stay green — while
  // in production every confirmation email silently loses the travel charge.
  //
  // A select string that no stub honours can only be guarded by reading it.
  it("keeps travel_fee in the booking email select", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/email/notifications.ts"),
      "utf8"
    );
    const select = source.split("const BOOKING_EMAIL_SELECT = `")[1]?.split("`")[0];

    expect(select).toBeDefined();
    expect(select).toContain("travel_fee");
  });
});
