// C-15 Phase A — canonical sample inputs shared by the throwaway pre-change
// fixture capture and the permanent render-parity spec (registry-defaults.test.ts).
// Pure data only — no imports from templates.ts — so this file is safe to
// create once, before any renderer/registry change, and never needs editing
// again for the parity gate to remain meaningful.
//
// Do NOT change any value in this file after the pre-change fixture has been
// captured: every value here feeds the "before" JSON fixture byte-for-byte.
// Changing it later would silently invalidate the parity gate.

import type {
  BookingEmailTemplateInput,
  RescheduleRequestEmailInput,
  EnquiryEmailTemplateInput,
} from "../../templates";

export const BASE_INPUT: BookingEmailTemplateInput = {
  companyName: "Rahma Therapy",
  clientName: "Aisha Khan",
  bookingDate: "2026-06-12",
  startTime: "14:30",
  endTime: "15:30",
  addressLines: ["12 Oak Lane", "Luton LU2 3AB"],
  totalPrice: 65,
  participantCount: 1,
  participants: [
    {
      label: "Participant 1",
      participantGender: "female",
      requiredTherapistGender: "female",
      services: ["hijama_back"],
      assignedStaffName: "Fatimah Hussain",
    },
  ],
  manageUrl: "https://rahmatherapy.example.test/bookings/example",
  customerNotes: "Please park on the road, the driveway is narrow.",
  contactEmail: "bookings@rahmatherapy.example.test",
  contactPhone: "07000 000000",
};

export const ADMIN_NOTIFICATION_INPUT = {
  ...BASE_INPUT,
  bookingId: "BK-2026-0042",
  clientEmail: "aisha.khan@example.test",
  clientPhone: "07700 900042",
};

export const ADMIN_CANCELLATION_INPUT = {
  ...BASE_INPUT,
  bookingId: "BK-2026-0042",
  initiatedBy: "customer" as const,
  cancellationNote: "Family emergency.",
};

export const RESCHEDULE_INPUT: RescheduleRequestEmailInput & { bookingId: string } = {
  ...BASE_INPUT,
  bookingId: "BK-2026-0042",
  requestedDate: "2026-06-19",
  requestedTime: "14:30",
  requestNote: "Could we move to next Friday?",
};

export const CHANGE_SUMMARY_INPUT = {
  ...BASE_INPUT,
  changeSummary: "Time changed from 14:00 to 14:30.",
};

export const THERAPIST_NAME = "Fatimah Hussain";

export const THERAPIST_INPUT = {
  ...BASE_INPUT,
  therapistName: THERAPIST_NAME,
};

export const RESTORED_FROM_CANCELLED_INPUT = {
  ...BASE_INPUT,
  fromStatus: "cancelled",
};

export const RESTORED_FROM_COMPLETED_INPUT = {
  ...BASE_INPUT,
  fromStatus: "completed",
};

export const REVIEW_INPUT = {
  ...BASE_INPUT,
  groupCategory: "massage" as const,
  city: "Luton",
};

export const ENQUIRY_INPUT: EnquiryEmailTemplateInput = {
  companyName: "Rahma Therapy",
  staffName: "Fatimah Hussain",
  clientName: "Aisha Khan",
  contactDetail: "aisha.khan@example.test",
  serviceInterest: "Hijama (cupping)",
  enquiryUrl: "https://rahmatherapy.example.test/admin/enquiries/example",
  contactEmail: "bookings@rahmatherapy.example.test",
  contactPhone: "07000 000000",
};
