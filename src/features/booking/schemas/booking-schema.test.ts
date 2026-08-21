import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bookingDetailsSchema,
  bookingLocationSchema,
  bookingParticipantSchema,
} from "./booking-schema";

const baseParticipant = {
  bookingFor: "self" as const,
  fullName: "Aisha Khan",
  phone: "07123 456 789",
  email: "aisha@example.test",
  notes: "",
  healthNotes: "",
  clientGender: "female" as const,
  numberOfPeople: 1,
  participantGenders: ["female" as const],
  participantNames: [""],
  participantNotes: [""],
  consentAcknowledged: false,
  paymentAcknowledged: false,
  manageAcknowledged: false,
};

const baseLocation = {
  postcode: "LU1 1AA",
  address: "10 Test Street",
  city: "Luton",
  area: "Bedfordshire",
  accessNotes: "",
  parkingNotes: "",
};

describe("booking schema", () => {
  // ⛔ THE CUSTOMER-FACING FORM REQUIRES AN EMAIL ADDRESS, AND THAT ASYMMETRY IS
  // DELIBERATE. Owner ruling, 2026-08-21 (D-028): the ADMIN side must accept a
  // booking or an enquiry with no email — a receptionist takes phone calls, and a
  // caller who won't give an address must still be written down — but a customer
  // booking themselves online has no receptionist to take their number down, so
  // the public form keeps requiring one.
  //
  // ⚠️ This was UNGUARDED. Nothing asserted the public rule at all, so a future
  // tidy-up that "made email optional everywhere for consistency" would have
  // sailed through green and silently let customers book with no way to send
  // them a confirmation. That is what these two cases exist to stop.
  //
  // The admin side of the same asymmetry is guarded in
  // e2e/enquiry-lifecycle.spec.ts (E08-101i).
  describe("email — required for CUSTOMERS, optional for ADMIN (D-028)", () => {
    it("rejects a customer booking with no email address", () => {
      const result = bookingDetailsSchema.safeParse({
        ...baseParticipant,
        ...baseLocation,
        email: "",
      });

      expect(result.success, "a customer must leave a way to be confirmed").toBe(false);
    });

    it("rejects a customer booking with a malformed email address", () => {
      const result = bookingDetailsSchema.safeParse({
        ...baseParticipant,
        ...baseLocation,
        email: "aisha-at-example",
      });

      expect(result.success).toBe(false);
    });
  });

  it("accepts a supported service area before time selection", () => {
    expect(bookingLocationSchema.safeParse(baseLocation).success).toBe(true);
  });

  // Item 8 Phase 2 — this assertion is inverted on purpose. It is the canonical
  // proof the client-side service-area gate is gone: an out-of-zone address is
  // now bookable, arrives as `pending`, and an admin sets the travel charge.
  it("accepts an out-of-zone city and lets the customer continue to time selection", () => {
    const result = bookingLocationSchema.safeParse({
      ...baseLocation,
      city: "Manchester",
    });

    expect(result.success).toBe(true);
  });

  it("accepts an out-of-zone city on the full details schema too", () => {
    // bookingLocationSchema and bookingDetailsSchema each carried their own
    // copy of the refine. Removing only one would leave the other rejecting,
    // so both wire points are asserted.
    const result = bookingDetailsSchema.safeParse({
      ...baseParticipant,
      ...baseLocation,
      city: "Manchester",
    });

    expect(result.success).toBe(true);
  });

  it("no longer exports a hardcoded town list or a service-area refinement", async () => {
    // Anti-drift guard, mirroring src/content/site/__tests__/canonical-domain.test.ts:
    // the free-travel towns live in business_settings and reach the form as a
    // prop. A constant reappearing here would silently recreate the three-way
    // disagreement item 8 exists to remove.
    const moduleExports = await import("./booking-schema");
    expect(Object.keys(moduleExports)).not.toContain("BOOKING_ALLOWED_CITIES");

    const source = readFileSync(
      join(process.cwd(), "src/features/booking/schemas/booking-schema.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/validateServiceArea/);
    expect(source).not.toMatch(/houghton regis/i);
  });

  it("requires a participant label when booking for someone else", () => {
    const result = bookingParticipantSchema.safeParse({
      ...baseParticipant,
      bookingFor: "someone_else",
      participantNames: [""],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "participantNames")).toBe(
      true
    );
  });

  it("requires every group participant to have gender and a clear label", () => {
    const result = bookingParticipantSchema.safeParse({
      ...baseParticipant,
      bookingFor: "group",
      numberOfPeople: 2,
      participantGenders: ["female", ""],
      participantNames: ["Aisha", ""],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["participantGenders", "participantNames"])
    );
  });

  it("accepts complete mixed-gender group details", () => {
    const result = bookingDetailsSchema.safeParse({
      ...baseParticipant,
      ...baseLocation,
      bookingFor: "group",
      numberOfPeople: 2,
      participantGenders: ["female", "male"],
      participantNames: ["Aisha", "Omar"],
      participantNotes: ["Prefers evening", "Shoulder pain"],
    });

    expect(result.success).toBe(true);
  });
});
