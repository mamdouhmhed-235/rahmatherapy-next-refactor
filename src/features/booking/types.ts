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
  packages: "Package",
  details: "Home visit",
  review: "Review",
  prepared: "Ready",
};

export interface BookingDetails {
  phone: string;
  email: string;
  notes: string;
  clientGender: "male" | "female" | "";
  numberOfPeople: number;
  postcode: string;
  address: string;
  city: string;
  area: string;
}

export const emptyBookingDetails: BookingDetails = {
  phone: "",
  email: "",
  notes: "",
  clientGender: "" as any,
  numberOfPeople: 1,
  postcode: "",
  address: "",
  city: "",
  area: "",
};

export interface BookingRequestPayload {
  selectedPackageIds: BookingPackageId[];
  selectedPackages: BookingPackage[];
  details: BookingDetails;
  preferredDate: string;
  preferredTime: BookingTimeSlot;
  estimatedTotal: number;
}
