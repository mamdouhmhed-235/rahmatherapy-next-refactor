// Static UI catalogue for the 9 templates exposed by src/lib/email/templates.ts.
// SAFE TO IMPORT FROM CLIENT COMPONENTS: metadata only — never re-exports a
// render*Email() function. The preview route handler reads templates.ts
// server-side and serves the rendered HTML; the editor reads only this file.

export type TemplateAudience = "customer" | "staff" | "admin_internal";

export type SafeFieldKind =
  | "greeting_intro"
  | "footer_contact"
  | "group_copy"
  | "intro"
  | "wrapper_change_summary"
  | "plain_text_intro"
  // C-01 — review request email (customer, 2h post-completion)
  | "subject"
  | "body_intro"
  | "body_ask"
  | "body_cta_label"
  | "body_cta_url"
  | "body_signoff"
  | "massage_variant_1"
  | "massage_variant_2"
  | "massage_variant_3"
  | "massage_variant_4"
  | "massage_variant_5"
  | "cupping_variant_1"
  | "cupping_variant_2"
  | "cupping_variant_3"
  | "cupping_variant_4"
  | "cupping_variant_5";

export interface SafeField {
  kind: SafeFieldKind;
  label: string;
  placeholder: string;
  helper: string;
  maxLength: number;
  multiline?: boolean;
}

export interface TemplateMeta {
  id: string;
  audience: TemplateAudience;
  cardName: string;
  trigger: string;
  rendersAs: "html" | "plain_text";
  fields: SafeField[];
}

const FOOTER_CONTACT: SafeField = {
  kind: "footer_contact",
  label: "Footer contact line",
  placeholder: "Questions? Reply to this email or call {contactPhone}.",
  helper: "Sourced from your clinic settings — update there to change everywhere.",
  maxLength: 200,
};

const GREETING_INTRO: SafeField = {
  kind: "greeting_intro",
  label: "Greeting intro sentence",
  placeholder: "Hi {clientName}, we have received your booking request.",
  helper: "Variables in curly braces are filled automatically.",
  maxLength: 300,
  multiline: true,
};

const GROUP_COPY: SafeField = {
  kind: "group_copy",
  label: "Group-copy sentence",
  placeholder: "This booking is for {participantCount} participants.",
  helper: "Used when the booking has more than one participant.",
  maxLength: 200,
};

const STAFF_INTRO: SafeField = {
  kind: "intro",
  label: "Intro sentence",
  placeholder: "Here are the details for your next visit.",
  helper: "Sets the tone before the booking summary. No marketing warmth.",
  maxLength: 200,
};

const CHANGE_WRAPPER: SafeField = {
  kind: "wrapper_change_summary",
  label: "Wrapper sentence around changes",
  placeholder: "Here's what changed for the booking on {date}:",
  helper: "Sits above the auto-generated change summary.",
  maxLength: 200,
};

// C-01 — review request email fields. All single-use (this template only),
// but declared as named consts to match the file's existing convention
// (STAFF_INTRO, CHANGE_WRAPPER are also single-use).
const REVIEW_SUBJECT: SafeField = {
  kind: "subject",
  label: "Subject line",
  // C-08 Phase B (security review) — corrected. This field only reaches the
  // invisible <title> tag inside the email's HTML source (renderLayout); the
  // actual "Subject:" header the recipient sees is a hardcoded literal in
  // notifications.ts / the SUBJECTS map and is unaffected by this value.
  placeholder: "Thank you for visiting Rahma Therapy",
  helper: "Not shown in the recipient's inbox — the real subject line is fixed in code. This only sets the hidden page title inside the email's HTML source.",
  maxLength: 100,
};

const REVIEW_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "Thank you for choosing Rahma Therapy for your {service_name}. We hope you felt looked after from start to finish.",
  helper: "Opens the email. {service_name} fills in automatically from the booking.",
  maxLength: 500,
  multiline: true,
};

const REVIEW_BODY_ASK: SafeField = {
  kind: "body_ask",
  label: "Ask paragraph",
  placeholder:
    "If you have a moment, we'd be grateful for an honest review on Google. It helps other people in {city} find us.",
  helper: "The review request itself. {city} fills in automatically when known.",
  maxLength: 500,
  multiline: true,
};

const REVIEW_BODY_CTA_LABEL: SafeField = {
  kind: "body_cta_label",
  label: "CTA button label",
  placeholder: "Leave a Google review",
  helper: "Text shown on the button. Keep it short and action-focused.",
  maxLength: 80,
};

const REVIEW_BODY_CTA_URL: SafeField = {
  kind: "body_cta_url",
  label: "CTA button URL",
  placeholder: "https://g.page/r/Ccfwk27JycKDEBM/review",
  helper: "Where the button links to — your Google review page.",
  maxLength: 500,
};

const REVIEW_BODY_SIGNOFF: SafeField = {
  kind: "body_signoff",
  label: "Signoff",
  placeholder: "Thank you again,\nThe Rahma Therapy team",
  helper: "Closing line, shown under the sample reviews and button.",
  maxLength: 200,
  multiline: true,
};

const REVIEW_MASSAGE_VARIANT_1: SafeField = {
  kind: "massage_variant_1",
  label: "Massage review sample 1",
  placeholder:
    "I had a brilliant home massage in {city} today — really professional setup, felt completely relaxed by the end.",
  helper: "One of 5 sample reviews shown to massage clients; 3 are picked at random. {city} fills in automatically.",
  maxLength: 400,
  multiline: true,
};

const REVIEW_MASSAGE_VARIANT_2: SafeField = {
  kind: "massage_variant_2",
  label: "Massage review sample 2",
  placeholder:
    "Booked a home massage with Rahma Therapy in {city}. The therapist was excellent, the experience felt like a proper clinic but in the comfort of home.",
  helper: "One of 5 sample reviews shown to massage clients; 3 are picked at random. {city} fills in automatically.",
  maxLength: 400,
  multiline: true,
};

const REVIEW_MASSAGE_VARIANT_3: SafeField = {
  kind: "massage_variant_3",
  label: "Massage review sample 3",
  placeholder:
    "Just had a fantastic massage at home in {city}. Highly skilled, deeply relaxing, and so easy not having to travel.",
  helper: "One of 5 sample reviews shown to massage clients; 3 are picked at random. {city} fills in automatically.",
  maxLength: 400,
  multiline: true,
};

const REVIEW_MASSAGE_VARIANT_4: SafeField = {
  kind: "massage_variant_4",
  label: "Massage review sample 4",
  placeholder:
    "Tried Rahma Therapy for a mobile massage in {city} — top quality. Will definitely book again.",
  helper: "One of 5 sample reviews shown to massage clients; 3 are picked at random. {city} fills in automatically.",
  maxLength: 400,
  multiline: true,
};

const REVIEW_MASSAGE_VARIANT_5: SafeField = {
  kind: "massage_variant_5",
  label: "Massage review sample 5",
  placeholder: "Excellent home massage experience in {city}. Calm, professional, and exactly what I needed.",
  helper: "One of 5 sample reviews shown to massage clients; 3 are picked at random. {city} fills in automatically.",
  maxLength: 400,
  multiline: true,
};

const REVIEW_CUPPING_VARIANT_1: SafeField = {
  kind: "cupping_variant_1",
  label: "Cupping review sample 1",
  placeholder:
    "Had a hijama session at home in {city} with Rahma Therapy. Very clean, hygienic, and the practitioner was knowledgeable and respectful.",
  helper: "One of 5 sample reviews shown to cupping/hijama clients; 3 are picked at random. {city} fills in automatically.",
  maxLength: 400,
  multiline: true,
};

const REVIEW_CUPPING_VARIANT_2: SafeField = {
  kind: "cupping_variant_2",
  label: "Cupping review sample 2",
  placeholder:
    "Booked hijama at home in {city} — proper Sunnah practice, sterile equipment, and a calming atmosphere. Highly recommend.",
  helper: "One of 5 sample reviews shown to cupping/hijama clients; 3 are picked at random. {city} fills in automatically.",
  maxLength: 400,
  multiline: true,
};

const REVIEW_CUPPING_VARIANT_3: SafeField = {
  kind: "cupping_variant_3",
  label: "Cupping review sample 3",
  placeholder:
    "Excellent home hijama appointment in {city}. Felt looked after from start to finish, the setup was spotless and professional.",
  helper: "One of 5 sample reviews shown to cupping/hijama clients; 3 are picked at random. {city} fills in automatically.",
  maxLength: 400,
  multiline: true,
};

const REVIEW_CUPPING_VARIANT_4: SafeField = {
  kind: "cupping_variant_4",
  label: "Cupping review sample 4",
  placeholder:
    "Tried Rahma Therapy for hijama in {city} and couldn't be happier. Knowledgeable practitioner, careful technique, and great aftercare.",
  helper: "One of 5 sample reviews shown to cupping/hijama clients; 3 are picked at random. {city} fills in automatically.",
  maxLength: 400,
  multiline: true,
};

const REVIEW_CUPPING_VARIANT_5: SafeField = {
  kind: "cupping_variant_5",
  label: "Cupping review sample 5",
  placeholder:
    "First hijama session in {city} and it was a brilliant experience. Clean, professional, and the practitioner explained every step.",
  helper: "One of 5 sample reviews shown to cupping/hijama clients; 3 are picked at random. {city} fills in automatically.",
  maxLength: 400,
  multiline: true,
};

// C-08 — booking_confirmed_client fields. Reuses the body_intro /
// body_cta_label / body_signoff kinds C-01 already added to SafeFieldKind
// (grepped before writing this — see plan §1 Sub-step 3 coordination note)
// rather than adding a second, incompatible set of kinds.
const BOOKING_CONFIRMED_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "Hi {clientName}, your appointment on {bookingDate} at {startTime} is confirmed. We'll send a reminder closer to the day.",
  helper: "Variables in curly braces are filled automatically.",
  maxLength: 500,
  multiline: true,
};

const BOOKING_CONFIRMED_BODY_CTA_LABEL: SafeField = {
  kind: "body_cta_label",
  label: "CTA button label",
  placeholder: "Manage your booking",
  helper: "Text on the action button linking to the manage-booking page.",
  maxLength: 80,
};

const BOOKING_CONFIRMED_BODY_SIGNOFF: SafeField = {
  kind: "body_signoff",
  label: "Signoff",
  placeholder: "Thank you,\nThe Rahma Therapy team",
  helper: "Closing line above the footer contact line.",
  maxLength: 200,
  multiline: true,
};

// C-08 — staff_unassignment field. No CTA (no action link in this template).
const STAFF_UNASSIGNMENT_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "Hi {therapistName}, you've been unassigned from the {bookingDate} {startTime} booking ({clientName}). Reach out to admin if you have questions.",
  helper: "Variables in curly braces are filled automatically.",
  maxLength: 500,
  multiline: true,
};

// C-08 — claim field. No CTA (internal ops notice, no action link).
const CLAIM_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "{therapistName} just claimed the {bookingDate} {startTime} slot for {clientName}.",
  helper: "Variables in curly braces are filled automatically.",
  maxLength: 500,
  multiline: true,
};

// C-08 — client_assigned_therapist fields. Has a CTA (manage-booking link),
// unlike claim/staff_unassignment.
const CLIENT_ASSIGNED_THERAPIST_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "Hi {clientName}, your appointment on {bookingDate} at {startTime} will be with {therapistName}. They'll arrive at {addressLines}. If anything changes, we'll let you know.",
  helper: "Variables in curly braces are filled automatically.",
  maxLength: 500,
  multiline: true,
};

const CLIENT_ASSIGNED_THERAPIST_BODY_CTA_LABEL: SafeField = {
  kind: "body_cta_label",
  label: "CTA button label",
  placeholder: "Manage your booking",
  helper: "Text on the action button linking to the manage-booking page.",
  maxLength: 80,
};

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "booking_confirmation",
    audience: "customer",
    cardName: "Booking confirmation",
    trigger: "Sent when a booking request is submitted",
    rendersAs: "html",
    fields: [GREETING_INTRO, GROUP_COPY, FOOTER_CONTACT],
  },
  {
    id: "booking_cancellation_client",
    audience: "customer",
    cardName: "Booking cancelled (client)",
    trigger: "Sent when a booking is cancelled",
    rendersAs: "html",
    fields: [GREETING_INTRO, FOOTER_CONTACT],
  },
  {
    id: "booking_reminder",
    audience: "customer",
    cardName: "Booking reminder",
    trigger: "Sent manually from the Reminders tab",
    rendersAs: "html",
    fields: [
      { ...GREETING_INTRO, kind: "intro", label: "Intro sentence" },
      FOOTER_CONTACT,
    ],
  },
  {
    id: "booking_plain_text",
    audience: "customer",
    cardName: "Plain-text companion",
    trigger: "Paired with HTML emails as a plain-text fallback",
    rendersAs: "plain_text",
    // Brief §Audience variants / Implementation Notes: this is a code-paired
    // companion with no independent editable greeting; only the footer contact
    // line is safe to edit.
    fields: [FOOTER_CONTACT],
  },
  {
    id: "staff_assignment",
    audience: "staff",
    cardName: "Assignment notification",
    trigger: "Sent when a therapist is assigned to a booking",
    rendersAs: "html",
    fields: [STAFF_INTRO, FOOTER_CONTACT],
  },
  {
    id: "staff_booking_change",
    audience: "staff",
    cardName: "Assignment updated",
    trigger: "Sent when an assigned booking changes",
    rendersAs: "html",
    fields: [CHANGE_WRAPPER, FOOTER_CONTACT],
  },
  {
    id: "admin_booking_notification",
    audience: "admin_internal",
    cardName: "New booking (internal)",
    trigger: "Sent to the owner when a booking is submitted",
    rendersAs: "html",
    fields: [FOOTER_CONTACT],
  },
  {
    id: "admin_booking_cancellation",
    audience: "admin_internal",
    cardName: "Cancellation (internal)",
    trigger: "Sent to the owner when a booking is cancelled",
    rendersAs: "html",
    fields: [FOOTER_CONTACT],
  },
  {
    id: "admin_reschedule_request",
    audience: "admin_internal",
    cardName: "Reschedule request (internal)",
    trigger: "Sent to the owner when a client requests a reschedule",
    rendersAs: "html",
    fields: [FOOTER_CONTACT],
  },
  {
    id: "review_request_client",
    audience: "customer",
    cardName: "Review request (2h post-completion)",
    trigger: "Sent automatically 2 hours after a booking is marked completed",
    rendersAs: "html",
    fields: [
      REVIEW_SUBJECT,
      REVIEW_BODY_INTRO,
      REVIEW_BODY_ASK,
      REVIEW_BODY_CTA_LABEL,
      REVIEW_BODY_CTA_URL,
      REVIEW_BODY_SIGNOFF,
      REVIEW_MASSAGE_VARIANT_1,
      REVIEW_MASSAGE_VARIANT_2,
      REVIEW_MASSAGE_VARIANT_3,
      REVIEW_MASSAGE_VARIANT_4,
      REVIEW_MASSAGE_VARIANT_5,
      REVIEW_CUPPING_VARIANT_1,
      REVIEW_CUPPING_VARIANT_2,
      REVIEW_CUPPING_VARIANT_3,
      REVIEW_CUPPING_VARIANT_4,
      REVIEW_CUPPING_VARIANT_5,
    ],
  },
  {
    id: "booking_confirmed_client",
    audience: "customer",
    cardName: "Booking confirmed (client)",
    trigger: "Sent when admin confirms a pending booking with the client. Fires on pending→confirmed transitions in quickUpdateBooking and updateBookingManagement.",
    rendersAs: "html",
    fields: [
      BOOKING_CONFIRMED_BODY_INTRO,
      BOOKING_CONFIRMED_BODY_CTA_LABEL,
      BOOKING_CONFIRMED_BODY_SIGNOFF,
      FOOTER_CONTACT,
    ],
  },
  {
    id: "staff_unassignment",
    audience: "staff",
    cardName: "Assignment removed",
    trigger: "Sent to the previously assigned therapist when they are unassigned or reassigned away from a booking. Fires from updateBookingAssignment.",
    rendersAs: "html",
    fields: [STAFF_UNASSIGNMENT_BODY_INTRO, FOOTER_CONTACT],
  },
  {
    id: "claim",
    audience: "admin_internal",
    cardName: "Slot claimed (internal)",
    trigger: "Sent to the admin recipient when a practitioner claims an unassigned slot. Fires from claimBookingAssignment. Interim single-recipient send — Phase D reroutes it through the business-notification resolver.",
    rendersAs: "html",
    fields: [CLAIM_BODY_INTRO, FOOTER_CONTACT],
  },
  {
    id: "client_assigned_therapist",
    audience: "customer",
    cardName: "Therapist assigned (client)",
    trigger: "Sent to the client whenever their assignment changes (assign, reassign, or claim), so they always know who is coming. Fires from claimBookingAssignment and updateBookingAssignment.",
    rendersAs: "html",
    fields: [
      CLIENT_ASSIGNED_THERAPIST_BODY_INTRO,
      CLIENT_ASSIGNED_THERAPIST_BODY_CTA_LABEL,
      FOOTER_CONTACT,
    ],
  },
];

export const AUDIENCE_GROUPS: { id: TemplateAudience; label: string }[] = [
  { id: "customer", label: "Customer" },
  { id: "staff", label: "Staff" },
  { id: "admin_internal", label: "Admin internal" },
];

export function templatesByAudience(audience: TemplateAudience) {
  return TEMPLATES.filter((t) => t.audience === audience);
}

export function findTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
