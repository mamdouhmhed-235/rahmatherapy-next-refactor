// SERVER ONLY — imports templates.ts's render functions (which themselves
// import the Supabase admin client). Do not import from client components.
//
// C-15 Phase B, Step 6 — canonical sample data for live preview (unsaved
// draft rendering, brief §2.4) and the future "Send me a test" send
// (Phase D). Fictional client ("Aisha Khan"), .example.test contact
// details, fixed date/time/price, 1 participant — never real customer or
// booking data.
//
// This module also carries the render DISPATCH TABLE (one entry per
// registered template id) — the registry-driven successor to the retired
// ManualSendSheet's renderForTemplate switch (brief §5.10). It is the
// single source preview/[id]/route.ts's GET and POST handlers both call:
// sharing one table is what stops them drifting the way the old GET-only
// switch (9 of 16 ids, silently dropping the other 7 to a placeholder)
// already had. Every entry calls the exact same render function a real
// send uses — no parallel renderer, matching the plan's own risk-table
// guarantee that draft preview can never diverge from a real send by
// construction.

import {
  renderAdminBookingCancellationEmail,
  renderAdminBookingNotificationEmail,
  renderAdminRescheduleRequestEmail,
  renderBookingCancellationEmail,
  renderBookingConfirmationEmail,
  renderBookingConfirmedClientEmail,
  renderBookingPlainText,
  renderBookingReminderEmail,
  renderBookingRestoredEmail,
  renderClaimNotificationEmail,
  renderClientAssignedTherapistEmail,
  renderEnquiryLoggedEmail,
  renderReviewRequestEmail,
  renderStaffAssignmentEmail,
  renderStaffBookingChangeEmail,
  renderStaffUnassignmentEmail,
  type BookingEmailTemplateInput,
  type EnquiryEmailTemplateInput,
} from "./templates";

export const SAMPLE_TEMPLATE_INPUT: BookingEmailTemplateInput = {
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
      services: ["Swedish massage"],
      assignedStaffName: "Fatimah Hussain",
    },
  ],
  manageUrl: "https://rahmatherapy.example.test/bookings/example",
  customerNotes: "Please park on the road, the driveway is narrow.",
  contactEmail: "bookings@rahmatherapy.example.test",
  contactPhone: "07000 000000",
};

const SAMPLE_THERAPIST_NAME = "Fatimah Hussain";
const SAMPLE_BOOKING_ID = "BK-2026-0042";

// Per-template extras (brief §5.10) — the fields a template's renderer
// needs beyond SAMPLE_TEMPLATE_INPUT, keyed by template id below via the
// dispatch table.
const SAMPLE_CHANGE_SUMMARY_INPUT = {
  ...SAMPLE_TEMPLATE_INPUT,
  changeSummary: "Time changed from 14:00 to 14:30.",
};

const SAMPLE_ADMIN_NOTIFICATION_INPUT = {
  ...SAMPLE_TEMPLATE_INPUT,
  bookingId: SAMPLE_BOOKING_ID,
  clientEmail: "aisha.khan@example.test",
  clientPhone: "07700 900042",
};

const SAMPLE_ADMIN_CANCELLATION_INPUT = {
  ...SAMPLE_TEMPLATE_INPUT,
  bookingId: SAMPLE_BOOKING_ID,
  initiatedBy: "customer" as const,
  cancellationNote: "Family emergency.",
};

const SAMPLE_RESCHEDULE_INPUT = {
  ...SAMPLE_TEMPLATE_INPUT,
  bookingId: SAMPLE_BOOKING_ID,
  requestedDate: "2026-06-19",
  requestedTime: "14:30",
  requestNote: "Could we move to next Friday?",
};

const SAMPLE_REVIEW_INPUT = {
  ...SAMPLE_TEMPLATE_INPUT,
  groupCategory: "massage" as const,
  city: "Luton",
};

const SAMPLE_THERAPIST_INPUT = {
  ...SAMPLE_TEMPLATE_INPUT,
  therapistName: SAMPLE_THERAPIST_NAME,
};

const SAMPLE_RESTORED_INPUT = {
  ...SAMPLE_TEMPLATE_INPUT,
  fromStatus: "cancelled",
};

export const SAMPLE_ENQUIRY_INPUT: EnquiryEmailTemplateInput = {
  companyName: "Rahma Therapy",
  staffName: SAMPLE_THERAPIST_NAME,
  clientName: "Aisha Khan",
  contactDetail: "aisha.khan@example.test",
  serviceInterest: "Hijama (cupping)",
  enquiryUrl: "https://admin.rahmatherapy.example.test/enquiries/example",
  contactEmail: "bookings@rahmatherapy.example.test",
  contactPhone: "07000 000000",
};

export interface SampleRenderResult {
  rendersAs: "html" | "plain_text";
  content: string;
}

type SampleRenderer = (
  overrides: Record<string, string>
) => SampleRenderResult | Promise<SampleRenderResult>;

// One render dispatch per registered template id (templates-data.ts
// TEMPLATES). `rendersAs` here always matches the registry's own
// TemplateMeta.rendersAs for the same id (asserted by sample-data.test.ts).
export const SAMPLE_RENDERERS: Record<string, SampleRenderer> = {
  booking_confirmation: (overrides) => ({
    rendersAs: "html",
    content: renderBookingConfirmationEmail(SAMPLE_TEMPLATE_INPUT, overrides),
  }),
  booking_cancellation_client: (overrides) => ({
    rendersAs: "html",
    content: renderBookingCancellationEmail(SAMPLE_TEMPLATE_INPUT, overrides),
  }),
  booking_reminder: (overrides) => ({
    rendersAs: "html",
    content: renderBookingReminderEmail(SAMPLE_TEMPLATE_INPUT, overrides),
  }),
  booking_plain_text: (overrides) => ({
    rendersAs: "plain_text",
    content: renderBookingPlainText("Booking confirmation", SAMPLE_TEMPLATE_INPUT, overrides),
  }),
  staff_assignment: (overrides) => ({
    rendersAs: "html",
    content: renderStaffAssignmentEmail(SAMPLE_TEMPLATE_INPUT, overrides),
  }),
  staff_booking_change: (overrides) => ({
    rendersAs: "html",
    content: renderStaffBookingChangeEmail(SAMPLE_CHANGE_SUMMARY_INPUT, overrides),
  }),
  admin_booking_notification: (overrides) => ({
    rendersAs: "html",
    content: renderAdminBookingNotificationEmail(SAMPLE_ADMIN_NOTIFICATION_INPUT, overrides),
  }),
  admin_booking_cancellation: (overrides) => ({
    rendersAs: "html",
    content: renderAdminBookingCancellationEmail(SAMPLE_ADMIN_CANCELLATION_INPUT, overrides),
  }),
  admin_reschedule_request: (overrides) => ({
    rendersAs: "html",
    content: renderAdminRescheduleRequestEmail(SAMPLE_RESCHEDULE_INPUT, overrides),
  }),
  review_request_client: async (overrides) => ({
    rendersAs: "html",
    content: await renderReviewRequestEmail(SAMPLE_REVIEW_INPUT, overrides),
  }),
  booking_confirmed_client: async (overrides) => ({
    rendersAs: "html",
    content: await renderBookingConfirmedClientEmail(SAMPLE_TEMPLATE_INPUT, overrides),
  }),
  staff_unassignment: async (overrides) => ({
    rendersAs: "html",
    content: await renderStaffUnassignmentEmail(SAMPLE_THERAPIST_INPUT, overrides),
  }),
  claim: async (overrides) => ({
    rendersAs: "html",
    content: await renderClaimNotificationEmail(SAMPLE_THERAPIST_INPUT, overrides),
  }),
  client_assigned_therapist: async (overrides) => ({
    rendersAs: "html",
    content: await renderClientAssignedTherapistEmail(SAMPLE_THERAPIST_INPUT, overrides),
  }),
  enquiry_logged: async (overrides) => ({
    rendersAs: "html",
    content: await renderEnquiryLoggedEmail(SAMPLE_ENQUIRY_INPUT, overrides),
  }),
  booking_restored_client: (overrides) => ({
    rendersAs: "html",
    content: renderBookingRestoredEmail(SAMPLE_RESTORED_INPUT, overrides),
  }),
};
