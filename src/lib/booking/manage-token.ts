// SERVER ONLY - do not import from client components.
import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/email/client";

// ─── Single-live-token model (C-C fix round, drift checkpoint #2 F-2) ─────
// `bookings.manage_token_hash` stores ONLY the sha256 hash of the current
// plaintext manage token — the plaintext itself is never persisted anywhere
// and cannot be recovered from its hash. `ensureBookingManageUrl` below
// mints a fresh token and OVERWRITES that column (plus its expiry) on every
// call, so only ONE token is ever valid at a time: minting a new one
// silently invalidates every "Manage this booking" link already sitting in
// a customer's inbox. Call it ONLY from the one send path that is meant to
// own the customer's live link (booking creation). Any other notification
// send that wants a manage link must call getExistingBookingManageUrl
// instead — it never mints, so it can never break a link the customer
// already has, at the cost of not being able to hand back a link once one
// has been minted. Supporting multiple concurrently valid tokens needs a
// schema change (e.g. a separate lookup-able token table) and is out of
// scope here — a follow-up, not attempted in this fix round.

export function getManageTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getManageTokenExpiry(bookingDate: string) {
  return new Date(`${bookingDate}T23:59:59.000Z`).toISOString();
}

export function createManageUrl(token: string) {
  return `${getSiteUrl()}/booking/manage?token=${encodeURIComponent(token)}`;
}

/**
 * Mints a NEW manage token and overwrites `manage_token_hash` on the
 * booking. ROTATES the single live token — every previously-emailed manage
 * link stops working the instant this resolves. Safe to call only from the
 * one send path that owns the customer's manage link at booking creation;
 * any other caller silently breaks whatever link the customer already has.
 * See the single-live-token model note above. For any other notification
 * send, use getExistingBookingManageUrl instead.
 */
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

/**
 * Non-rotating counterpart to ensureBookingManageUrl — for any notification
 * send that must NOT invalidate a manage link the customer may already have
 * from an earlier email. Because manage_token_hash stores only a hash, the
 * plaintext of an already-minted token can never be recovered, so this can
 * never hand back a working link without minting one (which would make it
 * ensureBookingManageUrl). It therefore always resolves to `undefined`
 * today; every renderer in templates.ts already omits the manage-link CTA
 * cleanly when `manageUrl` is undefined, so callers simply lose that link
 * rather than risk breaking one already sent. Kept as its own named,
 * documented function — rather than a bare `undefined` at each call site —
 * so a real fix (e.g. a schema change adding a separate, lookup-able token)
 * has exactly one place to land.
 */
export async function getExistingBookingManageUrl(): Promise<string | undefined> {
  return undefined;
}
