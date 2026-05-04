import { describe, expect, it } from "vitest";
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
  it("accepts a supported service area before time selection", () => {
    expect(bookingLocationSchema.safeParse(baseLocation).success).toBe(true);
  });

  it("rejects unsupported service areas before time selection", () => {
    const result = bookingLocationSchema.safeParse({
      ...baseLocation,
      city: "Manchester",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/outside our current/i);
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
