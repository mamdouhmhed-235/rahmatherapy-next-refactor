import { describe, expect, it } from "vitest";
import {
  renderBookingMovedClientEmail,
  renderBookingMovedClientPlainText,
} from "../templates";

/**
 * ⛔ D-051 — the "your appointment has been moved" email.
 *
 * ⚠️ THIS FILE EXISTS BECAUSE OF A REAL DEFECT, CAUGHT BY INDEPENDENT REVIEW
 * BEFORE IT SHIPPED. The first plain-text version said *"the new date and time
 * are below"* and then rendered the group-participants block — which is an
 * EMPTY STRING for an ordinary single-person booking. A plain-text reader got
 * an email whose entire purpose was missing, and nothing tested it.
 *
 * ⛔ The HTML version gets the date from `renderSummary`; the plain-text one has
 * no such helper and must state it itself. That asymmetry is exactly the kind
 * of thing a test has to hold in place.
 */

const input = {
  clientName: "ZZTEST Client",
  companyName: "Rahma Therapy",
  bookingDate: "2026-11-12",
  startTime: "14:00",
  endTime: "15:00",
  contactEmail: "hello@example.test",
  contactPhone: "07000 000000",
  participantCount: 1,
  addressLines: ["1 ZZTEST Street", "Luton", "LU1 1AA"],
  totalPrice: "£45.00",
  travelFee: 0,
  participants: [{ displayName: "ZZTEST Client", assignedStaffName: null }],
  customerNotes: null,
  manageUrl: undefined,
} as unknown as Parameters<typeof renderBookingMovedClientPlainText>[0];

describe("the moved-appointment email", () => {
  it("⛔ the PLAIN TEXT version states the new date and time", () => {
    const text = renderBookingMovedClientPlainText(input);

    expect(
      text,
      "⛔ the whole point of this email is the new date. Without it the customer is told something changed and not what.",
    ).toContain("12 November 2026");
    expect(text, "and the new time").toContain("14:00");
  });

  it("says plainly that the appointment MOVED, in both versions", () => {
    // ⛔ Not "your booking is confirmed". Reusing that email was the original
    // plan and would have told a customer with a still-PENDING booking that it
    // had been confirmed — a falsehood, not a wording nit.
    expect(renderBookingMovedClientPlainText(input)).toContain("has been moved");
    expect(renderBookingMovedClientEmail(input)).toContain("has been moved");
    expect(renderBookingMovedClientEmail(input)).not.toContain("Your booking is confirmed");
  });

  it("the HTML version carries the new date and time too", () => {
    const html = renderBookingMovedClientEmail(input);
    expect(html).toContain("12 November 2026");
    expect(html).toContain("14:00");
  });

  it("tells the customer where to go", () => {
    // A home-visit clinic: the address is not decoration.
    expect(renderBookingMovedClientPlainText(input)).toContain("1 ZZTEST Street");
  });

  it("survives a booking with no address on it", () => {
    const withoutAddress = { ...input, addressLines: [] } as typeof input;
    const text = renderBookingMovedClientPlainText(withoutAddress);

    // ⛔ Still has to carry the date — the missing-address case must not take
    // the whole message down with it.
    expect(text).toContain("12 November 2026");
    expect(text).not.toContain("Where:");
  });
});
