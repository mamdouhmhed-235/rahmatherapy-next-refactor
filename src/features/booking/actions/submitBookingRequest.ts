import type { BookingRequestPayload } from "../types";

export interface BookingSubmitResult {
  status: "prepared";
  payload: BookingRequestPayload;
  message: string;
}

export async function submitBookingRequest(
  payload: BookingRequestPayload
): Promise<BookingSubmitResult> {
  return {
    status: "prepared",
    payload,
    message:
      "Booking request details are prepared locally. Backend submission is intentionally deferred.",
  };
}
