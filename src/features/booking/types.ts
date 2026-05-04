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
  | "details"
  | "review"
  | "prepared";

export const BOOKING_STEPS: BookingStep[] = [
  "packages",
  "participants",
  "location",
  "schedule",
  "details",
  "review",
  "prepared",
];

export const STEP_LABELS: Record<BookingStep, string> = {
  packages: "Service",
  participants: "For",
  location: "Location",
  schedule: "Time",
  details: "Details",
  review: "Review",
  prepared: "Ready",
};

export type ParticipantGender = "male" | "female";
export type ParticipantGenderInput = ParticipantGender | "";
export type BookingFor = "self" | "someone_else" | "group";

export interface BookingDetails {
  bookingFor: BookingFor;
  fullName: string;
  phone: string;
  email: string;
  notes: string;
  healthNotes: string;
  clientGender: ParticipantGenderInput;
  numberOfPeople: number;
  participantGenders: ParticipantGenderInput[];
  participantNames: string[];
  participantNotes: string[];
  consentAcknowledged: boolean;
  paymentAcknowledged: boolean;
  manageAcknowledged: boolean;
  postcode: string;
  address: string;
  city: string;
  area: string;
  accessNotes: string;
  parkingNotes: string;
}

export const emptyBookingDetails: BookingDetails = {
  bookingFor: "self",
  fullName: "",
  phone: "",
  email: "",
  notes: "",
  healthNotes: "",
  clientGender: "",
  numberOfPeople: 1,
  participantGenders: [""],
  participantNames: [""],
  participantNotes: [""],
  consentAcknowledged: false,
  paymentAcknowledged: false,
  manageAcknowledged: false,
  postcode: "",
  address: "",
  city: "",
  area: "",
  accessNotes: "",
  parkingNotes: "",
};

export interface BookingRequestPayload {
  selectedPackageIds: BookingPackageId[];
  selectedPackages: BookingPackage[];
  details: BookingDetails;
  preferredDate: string;
  preferredTime: BookingTimeSlot;
  estimatedTotal: number;
}
