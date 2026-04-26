import type {
  BookingPackage,
  BookingPackageId,
} from "./data/booking-packages";
import type { BookingTimeSlot } from "./data/time-slots";

export type BookingStep = "packages" | "details" | "review" | "prepared";

export const BOOKING_STEPS: BookingStep[] = [
  "packages",
  "details",
  "review",
  "prepared",
];

export const STEP_LABELS: Record<BookingStep, string> = {
  packages: "Treatments",
  details: "Visit details",
  review: "Review",
  prepared: "Ready",
};

export interface BookingDetails {
  phone: string;
  email: string;
  notes: string;
  clientGender: "male" | "female" | "";
  postcode: string;
  address: string;
}

export const emptyBookingDetails: BookingDetails = {
  phone: "",
  email: "",
  notes: "",
  clientGender: "",
  postcode: "",
  address: "",
};

export interface BookingRequestPayload {
  selectedPackageIds: BookingPackageId[];
  selectedPackages: BookingPackage[];
  details: BookingDetails;
  preferredDate: string;
  preferredTime: BookingTimeSlot;
  estimatedTotal: number;
}
