import { describe, expect, it } from "vitest";
import { composeBookingIdentity } from "../_helpers";

/**
 * C-13 Phase C (brief §2.3, plan Step 8b) — locks the composite-identity
 * phrasing for group bookings ("Aisha Khan + 2 others") and the fallback
 * chain when the main contact is missing or unnamed. No group fixture exists
 * in the database (progress file §0.2), so these are synthetic
 * `booking_participants` arrays, same convention as Phase A's spec.
 */
describe("composeBookingIdentity", () => {
  it("single participant with a display_name — primary is the participant's name", () => {
    const identity = composeBookingIdentity({
      contact_full_name: "Aisha Khan",
      clients: null,
      booking_participants: [
        { display_name: "Aisha Khan", is_main_contact: true },
      ],
    });
    expect(identity).toEqual({ primary: "Aisha Khan", participantCount: 1 });
  });

  it("single participant without a display_name — falls back to contact_full_name", () => {
    const identity = composeBookingIdentity({
      contact_full_name: "Aisha Khan",
      clients: null,
      booking_participants: [{ display_name: null, is_main_contact: true }],
    });
    expect(identity).toEqual({ primary: "Aisha Khan", participantCount: 1 });
  });

  it("2 participants (main + 1 other) — '+ 1 other'", () => {
    const identity = composeBookingIdentity({
      contact_full_name: "Aisha Khan",
      clients: null,
      booking_participants: [
        { display_name: "Aisha Khan", is_main_contact: true },
        { display_name: "Yusuf Khan", is_main_contact: false },
      ],
    });
    expect(identity).toEqual({
      primary: "Aisha Khan + 1 other",
      participantCount: 2,
    });
  });

  it("3 participants — '+ 2 others'", () => {
    const identity = composeBookingIdentity({
      contact_full_name: "Aisha Khan",
      clients: null,
      booking_participants: [
        { display_name: "Aisha Khan", is_main_contact: true },
        { display_name: "Yusuf Khan", is_main_contact: false },
        { display_name: "Maryam Khan", is_main_contact: false },
      ],
    });
    expect(identity).toEqual({
      primary: "Aisha Khan + 2 others",
      participantCount: 3,
    });
  });

  it("5 participants — '+ 4 others'", () => {
    const identity = composeBookingIdentity({
      contact_full_name: "Aisha Khan",
      clients: null,
      booking_participants: [
        { display_name: "Aisha Khan", is_main_contact: true },
        { display_name: "Yusuf Khan", is_main_contact: false },
        { display_name: "Maryam Khan", is_main_contact: false },
        { display_name: "Omar Khan", is_main_contact: false },
        { display_name: "Layla Khan", is_main_contact: false },
      ],
    });
    expect(identity).toEqual({
      primary: "Aisha Khan + 4 others",
      participantCount: 5,
    });
  });

  it("main contact flagged but blank display_name — falls back to contact_full_name, other participants still counted", () => {
    const identity = composeBookingIdentity({
      contact_full_name: "Aisha Khan",
      clients: null,
      booking_participants: [
        { display_name: null, is_main_contact: true },
        { display_name: "Yusuf Khan", is_main_contact: false },
      ],
    });
    expect(identity).toEqual({
      primary: "Aisha Khan + 1 other",
      participantCount: 2,
    });
  });

  it("no participant flagged is_main_contact — falls back to contact_full_name (documented anomaly: otherCount counts everyone)", () => {
    const identity = composeBookingIdentity({
      contact_full_name: "Aisha Khan",
      clients: null,
      booking_participants: [
        { display_name: "Yusuf Khan", is_main_contact: false },
        { display_name: "Maryam Khan", is_main_contact: false },
      ],
    });
    expect(identity).toEqual({
      primary: "Aisha Khan + 2 others",
      participantCount: 3,
    });
  });

  it("empty booking_participants with a contact_full_name present", () => {
    const identity = composeBookingIdentity({
      contact_full_name: "Aisha Khan",
      clients: null,
      booking_participants: [],
    });
    expect(identity).toEqual({ primary: "Aisha Khan", participantCount: 0 });
  });

  it("empty booking_participants and no contact_full_name — 'Unknown client'", () => {
    const identity = composeBookingIdentity({
      contact_full_name: null,
      clients: null,
      booking_participants: [],
    });
    expect(identity).toEqual({ primary: "Unknown client", participantCount: 0 });
  });

  it("falls back to clients.full_name when contact_full_name is absent", () => {
    const identity = composeBookingIdentity({
      contact_full_name: null,
      clients: { full_name: "Aisha Khan" },
      booking_participants: [
        { display_name: null, is_main_contact: true },
        { display_name: "Yusuf Khan", is_main_contact: false },
      ],
    });
    expect(identity).toEqual({
      primary: "Aisha Khan + 1 other",
      participantCount: 2,
    });
  });
});
