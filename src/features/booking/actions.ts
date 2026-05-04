import type { BookingRequestPayload } from "./types";

export interface BookingSubmitResult {
  status: "submitted";
  bookingId: string;
  message: string;
  manageUrl: string | null;
}

function getResponseError(payload: unknown) {
  return typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
    ? payload.error
    : "Unable to submit booking request.";
}

function getSubmittedBookingId(payload: unknown) {
  return typeof payload === "object" &&
    payload !== null &&
    "bookingId" in payload &&
    typeof payload.bookingId === "string"
    ? payload.bookingId
    : null;
}

function getSubmittedManageUrl(payload: unknown) {
  return typeof payload === "object" &&
    payload !== null &&
    "manageUrl" in payload &&
    typeof payload.manageUrl === "string"
    ? payload.manageUrl
    : null;
}

export async function submitBookingRequest(
  payload: BookingRequestPayload
): Promise<BookingSubmitResult> {
  const response = await fetch("/api/bookings/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      selectedPackageIds: payload.selectedPackageIds,
      details: payload.details,
      preferredDate: payload.preferredDate,
      preferredTime: payload.preferredTime,
    }),
  });
  const responsePayload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getResponseError(responsePayload));
  }

  const bookingId = getSubmittedBookingId(responsePayload);
  if (!bookingId) {
    throw new Error("Booking request was submitted without a booking reference.");
  }

  return {
    status: "submitted",
    bookingId,
    manageUrl: getSubmittedManageUrl(responsePayload),
    message: "Booking request submitted.",
  };
}
