// SERVER ONLY - do not import from client components.
import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/email/client";

export function getManageTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getManageTokenExpiry(bookingDate: string) {
  return new Date(`${bookingDate}T23:59:59.000Z`).toISOString();
}

export function createManageUrl(token: string) {
  return `${getSiteUrl()}/booking/manage?token=${encodeURIComponent(token)}`;
}

export async function ensureBookingManageUrl(
  booking: { id: string; booking_date: string },
  supabase: SupabaseClient
) {
  const token = randomUUID();
  const { error } = await supabase
    .from("bookings")
    .update({
      manage_token_hash: getManageTokenHash(token),
      manage_token_expires_at: getManageTokenExpiry(booking.booking_date),
    })
    .eq("id", booking.id);

  if (error) {
    throw new Error("Unable to create booking manage link.");
  }

  return createManageUrl(token);
}
