import { z } from "zod/v4";
import type { BookingDetails } from "../types";

// Contact + address only. Health notes, treatment notes, participants and
// consent choices are deliberately never stored: nothing sensitive should
// sit in browser storage, and consent must always be re-confirmed.
const STORAGE_KEY = "rahma-booking-contact-v1";
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

const storedContactSchema = z.object({
  savedAt: z.number(),
  fullName: z.string(),
  phone: z.string(),
  email: z.string(),
  clientGender: z.union([z.enum(["male", "female"]), z.literal("")]),
  city: z.string(),
  area: z.string(),
  postcode: z.string(),
  address: z.string(),
  accessNotes: z.string(),
  parkingNotes: z.string(),
});

export function saveReturningCustomer(details: BookingDetails) {
  try {
    const payload: z.infer<typeof storedContactSchema> = {
      savedAt: Date.now(),
      fullName: details.fullName,
      phone: details.phone,
      email: details.email,
      clientGender: details.clientGender,
      city: details.city,
      area: details.area,
      postcode: details.postcode,
      address: details.address,
      accessNotes: details.accessNotes,
      parkingNotes: details.parkingNotes,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage unavailable (private mode, quota) — prefill is best-effort.
  }
}

export function loadReturningCustomer(): Partial<BookingDetails> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = storedContactSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.data.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const { savedAt: _savedAt, clientGender, ...contact } = parsed.data;

    return {
      ...contact,
      clientGender,
      // Mirror what selecting a gender in the UI does for a single client.
      ...(clientGender ? { participantGenders: [clientGender] } : {}),
    };
  } catch {
    return null;
  }
}

export function clearReturningCustomer() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing to clear if storage is unavailable.
  }
}
