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
      error: "Enter a valid phone number.",
    }),
  email: z.email({ error: "Enter a valid email address." }),
  notes: z.string(),
  clientGender: z
    .union([z.enum(["male", "female"]), z.literal("")])
    .refine((value) => value !== "", { error: "Select male or female." }),
  postcode: requiredString("Enter your postcode.").min(3, {
    error: "Enter your postcode.",
  }),
  address: requiredString("Enter the visit address.").min(5, {
    error: "Enter the visit address.",
  }),
});

export const bookingVisitSchema = bookingDetailsSchema.extend({
  preferredDate: z
    .string()
    .trim()
    .min(1, { error: "Choose a preferred visit date." })
    .refine(
      (value) => {
        try {
          return startOfDay(parseISO(value)) >= startOfDay(new Date());
        } catch {
          return false;
        }
      },
      { error: "Choose a valid future visit date." }
    ),
  preferredTime: z.enum(TIME_SLOTS, {
    error: "Choose a preferred visit time.",
  }),
});

export const bookingAcknowledgementSchema = z.object({
  acknowledged: z.literal(true, {
    error:
      "Confirm that you understand this is a booking request, not a confirmed appointment.",
  }),
});

export type BookingDetailsFormValues = z.input<typeof bookingDetailsSchema>;
export type BookingVisitValues = z.output<typeof bookingVisitSchema>;
