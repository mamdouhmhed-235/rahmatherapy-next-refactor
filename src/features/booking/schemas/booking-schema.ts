import { z } from "zod/v4";
import { isDateInBusinessWindow } from "@/lib/time/london";
import type { BookingDetails } from "../types";

// ─── F5 (2026-08-17): input length ceilings ──────────────────────────────────
// Every free-text field on the public booking form was previously uncapped, and
// the route parsed the body with no size check either — so a single request
// could carry unbounded text straight into the database.
//
// These are PRODUCT limits, not technical ones: the underlying columns are
// Postgres `text` and impose no ceiling of their own. They are deliberately
// generous. A customer describing a health condition, access instructions or a
// group's needs must never hit these; only abuse should.
export const FREE_TEXT_MAX = 2000;
export const NAME_MAX = 120;
export const SHORT_TEXT_MAX = 200;

const requiredString = (message: string) =>
  z.string().trim().min(1, { error: message });
const genderInputSchema = z.union([z.enum(["male", "female"]), z.literal("")]);
const bookingForSchema = z.enum(["self", "someone_else", "group"]);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  error: "Choose a preferred appointment time.",
});

function validateParticipantGenders(
  value: {
    bookingFor: "self" | "someone_else" | "group";
    clientGender: "male" | "female" | "";
    numberOfPeople: number;
    participantGenders: Array<"male" | "female" | "">;
    participantNames: string[];
  },
  context: z.RefinementCtx
) {
  if (value.bookingFor !== "group" && value.numberOfPeople !== 1) {
    context.addIssue({
      code: "custom",
      path: ["numberOfPeople"],
      message: "Choose group booking if more than one person needs treatment.",
    });
  }

  if (value.bookingFor === "group" && value.numberOfPeople < 2) {
    context.addIssue({
      code: "custom",
      path: ["numberOfPeople"],
      message: "Choose at least two people for a group booking.",
    });
  }

  if (value.numberOfPeople === 1) {
    if (value.clientGender === "") {
      context.addIssue({
        code: "custom",
        path: ["clientGender"],
        message: "Select the client gender so we can arrange the right therapist.",
      });
    }

    if (
      value.bookingFor === "someone_else" &&
      !value.participantNames[0]?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["participantNames"],
        message: "Enter the participant name or label.",
      });
    }
    return;
  }

  const participantGenders = value.participantGenders.slice(
    0,
    value.numberOfPeople
  );
  const missingGender = participantGenders.some((gender) => gender === "");

  if (participantGenders.length !== value.numberOfPeople || missingGender) {
    context.addIssue({
      code: "custom",
      path: ["participantGenders"],
      message: "Select a gender for every person in the group.",
    });
  }

  const participantNames = value.participantNames.slice(0, value.numberOfPeople);
  const missingName = participantNames.some((name) => !name.trim());

  if (participantNames.length !== value.numberOfPeople || missingName) {
    context.addIssue({
      code: "custom",
      path: ["participantNames"],
      message: "Enter a name or clear label for every participant.",
    });
  }
}

const bookingParticipantFieldsSchema = z.object({
  bookingFor: bookingForSchema,
  fullName: requiredString("Enter your full name.").max(NAME_MAX, {
    error: `Please keep your name under ${NAME_MAX} characters.`,
  }),
  phone: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length >= 7, {
      error: "Enter a valid phone or WhatsApp number.",
    }),
  email: z.email({ error: "Enter a valid email address." }),
  // F5 (2026-08-17): every free-text field was uncapped. The DB columns are
  // `text`, so these limits are a product decision, not a technical one —
  // deliberately generous, because the goal is stopping abuse, not constraining
  // a customer describing a health condition.
  notes: z.string().max(FREE_TEXT_MAX, {
    error: `Please keep this under ${FREE_TEXT_MAX} characters.`,
  }),
  healthNotes: z.string().max(FREE_TEXT_MAX, {
    error: `Please keep this under ${FREE_TEXT_MAX} characters.`,
  }),
  clientGender: genderInputSchema,
  numberOfPeople: z.coerce.number().int().min(1).max(10, {
    error: "Maximum 10 people for group bookings.",
  }),
  participantGenders: z.array(genderInputSchema),
  participantNames: z.array(
    z.string().max(NAME_MAX, {
      error: `Please keep names under ${NAME_MAX} characters.`,
    })
  ),
  participantNotes: z.array(
    z.string().max(FREE_TEXT_MAX, {
      error: `Please keep this under ${FREE_TEXT_MAX} characters.`,
    })
  ),
  consentAcknowledged: z.boolean(),
  paymentAcknowledged: z.boolean(),
  manageAcknowledged: z.boolean(),
});

export const bookingParticipantSchema =
  bookingParticipantFieldsSchema.superRefine(validateParticipantGenders);

const bookingLocationFieldsSchema = z.object({
  postcode: requiredString("Enter your postcode.").min(3, {
    error: "Enter your postcode.",
  }).max(SHORT_TEXT_MAX, {
    error: `Please keep your postcode under ${SHORT_TEXT_MAX} characters.`,
  }),
  address: requiredString("Enter the home visit address.").min(5, {
    error: "Enter the home visit address.",
  }).max(SHORT_TEXT_MAX, {
    error: `Please keep your address under ${SHORT_TEXT_MAX} characters.`,
  }),
  city: requiredString("Enter your city or town.").min(2, {
    error: "Enter your city or town.",
  }).max(SHORT_TEXT_MAX, {
    error: `Please keep your city or town under ${SHORT_TEXT_MAX} characters.`,
  }),
  area: requiredString("Enter your area or county (e.g., Bedfordshire).").min(2, {
    error: "Enter your area or county.",
  }).max(SHORT_TEXT_MAX, {
    error: `Please keep your area or county under ${SHORT_TEXT_MAX} characters.`,
  }),
  accessNotes: z.string().max(FREE_TEXT_MAX, {
    error: `Please keep this under ${FREE_TEXT_MAX} characters.`,
  }),
  parkingNotes: z.string().max(FREE_TEXT_MAX, {
    error: `Please keep this under ${FREE_TEXT_MAX} characters.`,
  }),
});

// Item 8 Phase 2 — there is deliberately no service-area refinement here.
// Addresses outside the free-travel areas are BOOKABLE: they arrive as
// `pending` and an admin sets the travel charge by hand. The free-travel town
// list lives in business_settings and is threaded to AboutYouStep for display
// only; it must never come back as a hardcoded constant in this module.
export const bookingLocationSchema = bookingLocationFieldsSchema;

export const bookingDetailsSchema = bookingParticipantFieldsSchema
  .merge(bookingLocationFieldsSchema)
  .extend({
    // C-22 honeypot — a pass-through so client validation never flags it.
    // Optional on purpose: a missing key must never be able to block a real
    // booking. The server reads the hoisted top-level copy, not this one.
    company_website: z.string().optional(),
  })
  .superRefine(validateParticipantGenders);

export const bookingVisitSchema = bookingDetailsSchema.extend({
  preferredDate: z
    .string()
    .trim()
    .min(1, { error: "Choose a preferred appointment date." })
    .refine(
      (value) => {
        return /^\d{4}-\d{2}-\d{2}$/.test(value)
          && isDateInBusinessWindow({ date: value, bookingWindowDays: 365 });
      },
      { error: "Choose a valid future appointment date." }
    ),
  preferredTime: timeSchema,
});

export const bookingAcknowledgementSchema = z.object({
  consentAcknowledged: z.literal(true, {
    error:
      "Please confirm you consent to treatment and have shared relevant health information.",
  }),
  paymentAcknowledged: z.literal(true, {
    error: "Please confirm you understand payment is taken in person.",
  }),
  manageAcknowledged: z.literal(true, {
    error:
      "Please confirm you understand how confirmation, changes, and cancellation are handled.",
  }),
});

export type BookingDetailsFormValues = BookingDetails;
export type BookingVisitValues = z.output<typeof bookingVisitSchema>;
