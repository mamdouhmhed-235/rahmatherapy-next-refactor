import { parseISO, startOfDay } from "date-fns";
import { z } from "zod/v4";
import { TIME_SLOTS } from "../data/time-slots";

const requiredString = (message: string) =>
  z.string().trim().min(1, { error: message });

export const bookingDetailsSchema = z.object({
  phone: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length >= 7, {
      error: "Enter a valid phone or WhatsApp number.",
    }),
  email: z.email({ error: "Enter a valid email address." }),
  notes: z.string(),
  clientGender: z
    .union([z.enum(["male", "female"]), z.literal("")])
    .refine((value) => value !== "", {
      error: "Select the client gender so we can arrange the right therapist.",
    }),
  postcode: requiredString("Enter your Luton postcode.").min(3, {
    error: "Enter your Luton postcode.",
  }),
  address: requiredString("Enter the home visit address.").min(5, {
    error: "Enter the home visit address.",
  }),
});

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
  preferredTime: z.enum(TIME_SLOTS, {
    error: "Choose a preferred appointment time.",
  }),
});

export const bookingAcknowledgementSchema = z.object({
  acknowledged: z.literal(true, {
    error:
      "Please confirm you understand this is a booking request, not a confirmed appointment.",
  }),
});

export type BookingDetailsFormValues = z.input<typeof bookingDetailsSchema>;
export type BookingVisitValues = z.output<typeof bookingVisitSchema>;
