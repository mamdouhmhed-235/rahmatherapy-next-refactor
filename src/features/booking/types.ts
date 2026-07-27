import type {
  BookingPackage,
  BookingPackageId,
} from "./data/booking-packages";
import type { BookingTimeSlot } from "./data/time-slots";

export type BookingStep = "service" | "about" | "time" | "confirm";

export type BookingStage = BookingStep | "success";

export const BOOKING_STEPS: BookingStep[] = [
  "service",
  "about",
  "time",
  "confirm",
];

export const STEP_LABELS: Record<BookingStep, string> = {
  service: "Service",
  about: "About you",
  time: "Time",
  confirm: "Confirm",
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
  // C-22 honeypot. Never shown to a human, never sent to the database — it
  // exists only so a form-filling bot leaves a fingerprint.
  company_website: string;
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
  company_website: "",
};

export interface BookingRequestPayload {
  selectedPackageIds: BookingPackageId[];
  selectedPackages: BookingPackage[];
  details: BookingDetails;
  preferredDate: string;
  preferredTime: BookingTimeSlot;
  estimatedTotal: number;
  // Hoisted out of `details` so the server can read it before validating
  // anything else (the server schema strips it from `details`).
  company_website: string;
}
