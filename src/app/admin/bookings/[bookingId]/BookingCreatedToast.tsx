"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const CREATED_TOAST_KEY = "booking-new-created-toast";
// Legacy unscoped key — pre-dates C-03 Phase C Step 10, which moved the live
// draft cache onto `bookings-new-draft:{enquiry,client,scratch}:<id>` keys
// (ManualBookingForm.tsx). Nothing writes this literal key anymore, so the
// removal below is inert; kept only so a draft saved by a pre-C-03 session
// still gets swept up if one happens to still be sitting in storage.
const DRAFT_KEY = "booking-new-draft";
const TOAST_WINDOW_MS = 30_000;

interface BookingCreatedToastProps {
  /**
   * C-03 Phase D, Step 14 — set when `?just_converted=1` is present, i.e. the
   * source-aware redirect from `createManualBooking` (bookings/actions.ts)
   * after converting an enquiry.
   */
  justConverted?: boolean;
  /**
   * C-03 Phase D, Step 14 — set when `?from_enquiry=already_converted` is
   * present, i.e. the re-conversion guard in `bookings/new/page.tsx` bounced
   * a stale enquiry URL to this, its already-existing, booking.
   */
  fromEnquiryRedirect?: boolean;
  /**
   * C-07 Step 4 (W02-V-2) — set when `?just_created=1` is present, i.e. the
   * source-aware redirect from `createManualBooking` for the no-prefill or
   * `?client_id=` prefill paths (mirrors `justConverted` above, which owns
   * the enquiry path).
   */
  justCreated?: boolean;
  /**
   * C-07 Step 4 — accompanies `justCreated` when the booking was created via
   * `?client_id=` prefill; drives the toast's "View client" action.
   */
  clientId?: string | null;
}

export function BookingCreatedToast({
  justConverted = false,
  fromEnquiryRedirect = false,
  justCreated = false,
  clientId = null,
}: BookingCreatedToastProps = {}) {
  const router = useRouter();

  useEffect(() => {
    const rawTimestamp = sessionStorage.getItem(CREATED_TOAST_KEY);
    if (!rawTimestamp) return;

    sessionStorage.removeItem(CREATED_TOAST_KEY);
    sessionStorage.removeItem(DRAFT_KEY);

    const timestamp = Number(rawTimestamp);
    if (
      Number.isFinite(timestamp) &&
      Date.now() - timestamp <= TOAST_WINDOW_MS
    ) {
      toast("Booking request submitted.", {
        duration: 4000,
        icon: "📋",
      });
    }
  }, []);

  // C-03 Phase D — the page already read `just_converted` / `from_enquiry`
  // server-side (no `useSearchParams` needed here), same pattern as
  // `ClientFlashToast` (admin/clients/components/DeleteClientButton.tsx):
  // fire once, then strip the params so a refresh doesn't replay the toast.
  const conversionFired = useRef(false);
  useEffect(() => {
    if (conversionFired.current) return;
    if (!justConverted && !fromEnquiryRedirect && !justCreated) return;
    conversionFired.current = true;

    if (justConverted) {
      toast.success("Booking created from enquiry.", {
        duration: 5000,
        action: {
          label: "Back to enquiries",
          onClick: () => router.push("/admin/enquiries"),
        },
      });
    } else if (fromEnquiryRedirect) {
      toast.info(
        "This enquiry was already converted. Showing the existing booking.",
        { duration: 5000 }
      );
    } else if (justCreated) {
      // C-07 Step 4 (W02-V-2) — no-prefill / `?client_id=` prefill paths.
      toast.success("Booking created.", {
        duration: 5000,
        action: clientId
          ? {
              label: "View client",
              onClick: () => router.push(`/admin/clients/${clientId}`),
            }
          : undefined,
      });
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("just_converted");
    url.searchParams.delete("enquiry_id");
    url.searchParams.delete("from_enquiry");
    url.searchParams.delete("just_created");
    url.searchParams.delete("client_id");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [justConverted, fromEnquiryRedirect, justCreated, clientId, router]);

  return null;
}
