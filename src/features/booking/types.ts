import type {
  BookingPackage,
  BookingPackageId,
} from "./data/booking-packages";
import type { BookingTimeSlot } from "./data/time-slots";

export type BookingStep =
  | "packages"
  | "participants"
  | "location"
  | "schedule"
  | "review"
  | "prepared";

export const BOOKING_STEPS: BookingStep[] = [
  "packages",
  "participants",
  "location",
  "schedule",
  "review",
  "prepared",
];

export const STEP_LABELS: Record<BookingStep, string> = {
  packages: "Service",
  participants: "Clients",
  location: "Location",
  schedule: "Time",
  review: "Review",
  prepared: "Ready",
};

export type ParticipantGender = "male" | "female";
export type ParticipantGenderInput = ParticipantGender | "";

export interface BookingDetails {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
  healthNotes: string;
  clientGender: ParticipantGenderInput;
  numberOfPeople: number;
  participantGenders: ParticipantGenderInput[];
  consentAcknowledged: boolean;
  postcode: string;
  address: string;
  city: string;
  area: string;
}

export const emptyBookingDetails: BookingDetails = {
  fullName: "",
  phone: "",
  email: "",
  notes: "",
  healthNotes: "",
  clientGender: "",
  numberOfPeople: 1,
  participantGenders: [""],
  consentAcknowledged: false,
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
