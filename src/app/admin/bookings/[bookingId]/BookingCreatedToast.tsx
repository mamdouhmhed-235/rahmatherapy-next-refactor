"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const CREATED_TOAST_KEY = "booking-new-created-toast";
const DRAFT_KEY = "booking-new-draft";
const TOAST_WINDOW_MS = 30_000;

export function BookingCreatedToast() {
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
      toast.success("Booking created.", { duration: 4000 });
    }
  }, []);

  return null;
}
