import { z } from "zod/v4";
import { isDateInBusinessWindow } from "@/lib/time/london";
import type { BookingDetails } from "../types";

export const BOOKING_ALLOWED_CITIES = [
  "luton",
  "dunstable",
  "houghton regis",
  "harpenden",
  "st albans",
] as const;

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
  fullName: requiredString("Enter your full name."),
  phone: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length >= 7, {
      error: "Enter a valid phone or WhatsApp number.",
    }),
  email: z.email({ error: "Enter a valid email address." }),
  notes: z.string(),
  healthNotes: z.string(),
  clientGender: genderInputSchema,
  numberOfPeople: z.coerce.number().int().min(1).max(10, {
    error: "Maximum 10 people for group bookings.",
  }),
  participantGenders: z.array(genderInputSchema),
  participantNames: z.array(z.string()),
  participantNotes: z.array(z.string()),
  consentAcknowledged: z.boolean(),
  paymentAcknowledged: z.boolean(),
  manageAcknowledged: z.boolean(),
});

export const bookingParticipantSchema =
  bookingParticipantFieldsSchema.superRefine(validateParticipantGenders);

const bookingLocationFieldsSchema = z.object({
  postcode: requiredString("Enter your postcode.").min(3, {
    error: "Enter your postcode.",
  }),
  address: requiredString("Enter the home visit address.").min(5, {
    error: "Enter the home visit address.",
  }),
  city: requiredString("Enter your city or town.").min(2, {
    error: "Enter your city or town.",
  }),
  area: requiredString("Enter your area or county (e.g., Bedfordshire).").min(2, {
    error: "Enter your area or county.",
  }),
  accessNotes: z.string(),
  parkingNotes: z.string(),
});

function validateServiceArea(
  value: { city: string },
  context: z.RefinementCtx
) {
  const normalizedCity = value.city.trim().toLowerCase();
  if (normalizedCity.length < 2) {
    return;
  }

  const covered = BOOKING_ALLOWED_CITIES.some(
    (allowed) =>
      normalizedCity === allowed || normalizedCity.includes(allowed)
  );

  if (!covered) {
    context.addIssue({
      code: "custom",
      path: ["city"],
      message:
        "This location is outside our current home visit area. Please use a covered town before choosing a time.",
    });
  }
}

export const bookingLocationSchema =
  bookingLocationFieldsSchema.superRefine(validateServiceArea);

export const bookingDetailsSchema = bookingParticipantFieldsSchema
  .merge(bookingLocationFieldsSchema)
  .superRefine(validateServiceArea)
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
