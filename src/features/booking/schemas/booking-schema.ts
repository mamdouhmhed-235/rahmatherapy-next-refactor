import { parseISO, startOfDay } from "date-fns";
import { z } from "zod/v4";
import type { BookingDetails } from "../types";

const requiredString = (message: string) =>
  z.string().trim().min(1, { error: message });
const genderInputSchema = z.union([z.enum(["male", "female"]), z.literal("")]);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  error: "Choose a preferred appointment time.",
});

function validateParticipantGenders(
  value: {
    clientGender: "male" | "female" | "";
    numberOfPeople: number;
    participantGenders: Array<"male" | "female" | "">;
  },
  context: z.RefinementCtx
) {
  if (value.numberOfPeople === 1) {
    if (value.clientGender === "") {
      context.addIssue({
        code: "custom",
        path: ["clientGender"],
        message: "Select the client gender so we can arrange the right therapist.",
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
}

const bookingParticipantFieldsSchema = z.object({
  fullName: requiredString("Enter your full name."),
  phone: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length >= 7, {
      error: "Enter a valid phone or WhatsApp number.",
    }),
  email: z.email({ error: "Enter a valid email address." }),
  notes: z.string(),
  clientGender: genderInputSchema,
  numberOfPeople: z.coerce.number().int().min(1).max(10, {
    error: "Maximum 10 people for group bookings.",
  }),
  participantGenders: z.array(genderInputSchema),
});

export const bookingParticipantSchema =
  bookingParticipantFieldsSchema.superRefine(validateParticipantGenders);

export const bookingLocationSchema = z.object({
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
});

export const bookingDetailsSchema = bookingParticipantFieldsSchema
  .merge(bookingLocationSchema)
  .superRefine(validateParticipantGenders);

export const bookingVisitSchema = bookingDetailsSchema.extend({
  preferredDate: z
    .string()
    .trim()
    .min(1, { error: "Choose a preferred appointment date." })
    .refine(
      (value) => {
        try {
          return startOfDay(parseISO(value)) >= startOfDay(new Date());
        } catch {
          return false;
        }
      },
      { error: "Choose a valid future appointment date." }
    ),
  preferredTime: timeSchema,
});

export const bookingAcknowledgementSchema = z.object({
  acknowledged: z.literal(true, {
    error:
      "Please confirm you understand this is a booking request, not a confirmed appointment.",
  }),
});

export type BookingDetailsFormValues = BookingDetails;
export type BookingVisitValues = z.output<typeof bookingVisitSchema>;
