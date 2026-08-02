// Static UI catalogue for the 16 templates exposed by src/lib/email/templates.ts.
// SAFE TO IMPORT FROM CLIENT COMPONENTS: metadata only — never re-exports a
// render*Email() function. The preview route handler reads templates.ts
// server-side and serves the rendered HTML; the editor reads only this file.
//
// C-15 Phase A (registry expansion): every field now carries a `defaultValue`
// (the single source of truth for reset/preview/render — templates.ts reads
// these back via `fieldDefault()` wherever the default is a single
// deterministic string) and an optional `tokens` catalogue (the chip list a
// future editor UI offers — one entry per `{varName}` placeholder that
// appears in the field's own defaultValue text). Every template also carries
// a `subjectDefault` (the registry's single source for the old hardcoded
// `SUBJECTS` map, now removed from email-templates/actions.ts) and a
// `fixedParts` legend (the "Filled automatically" panel's source data —
// auto-generated content this template sends that isn't an editable field).

export type TemplateAudience = "customer" | "staff" | "admin_internal";

// Widened in C-15 Phase A from a closed union to `string` — per-template
// field kinds are allowed going forward (Step 1). The kinds already in use
// across the registry (documented here, not enforced by the type checker):
// greeting_intro, footer_contact, group_copy, intro, wrapper_change_summary,
// plain_text_intro, subject, body_intro, body_ask, body_cta_label,
// body_cta_url, body_signoff, massage_variant_1..5, cupping_variant_1..5.
export type SafeFieldKind = string;

export interface TemplateToken {
  token: string; // canonical stored form, e.g. "{clientName}"
  label: string; // chip label, e.g. "Client name"
  sample: string; // sample-data value used in preview, e.g. "Aisha Khan"
}

export interface FixedPart {
  label: string; // "Booking summary"
  source: string; // "Built from the booking's date, time, address and price."
}

export interface SafeField {
  kind: SafeFieldKind;
  label: string;
  placeholder: string;
  helper: string;
  maxLength: number;
  multiline?: boolean;
  // NEW (C-15 Phase A) — the canonical default. Single source for reset,
  // preview, and (where the default is a single deterministic string)
  // rendering itself via templates.ts's fieldDefault() helper.
  defaultValue: string;
  // NEW (C-15 Phase A) — which variables this field may embed, derived from
  // the `{varName}` placeholders that appear in this field's own
  // defaultValue. A field with no listed tokens still accepts a hand-typed
  // `{varName}` from the shared variable set (existing substituteVars
  // behaviour, brief §5.3) — this list only drives the chip row.
  tokens?: TemplateToken[];
}

export interface TemplateMeta {
  id: string;
  audience: TemplateAudience;
  cardName: string;
  trigger: string;
  rendersAs: "html" | "plain_text";
  // NEW (C-15 Phase A) — lifts the old hardcoded SUBJECTS map
  // (email-templates/actions.ts) into the registry, one field per template.
  // C-15 closeout fix round — this is the default real sends
  // (notifications.ts) and "Send me a test" actually fall back to
  // (src/lib/email/templates.ts's exported resolveSubject()), corrected to
  // match each template's live Subject: header byte-for-byte, including the
  // parts that were already dynamic (e.g. "{companyName} booking request
  // received", substituted the same way a body field would be). It is
  // DELIBERATELY independent of the "subject" SafeField's own `defaultValue`
  // below (which still feeds the <title> tag and the editor's "Use default"
  // preview, unchanged, to protect the render-parity fixture) — the two
  // happen to read identically for templates whose subject was already
  // static.
  subjectDefault: string;
  fields: SafeField[];
  // NEW (C-15 Phase A) — the "Filled automatically" legend: auto-generated
  // content this template sends that isn't an editable field, with a
  // one-line explanation of where it comes from.
  fixedParts: FixedPart[];
}

// Shared token-sample values, reused wherever a field's defaultValue
// references the same variable — keeps chip preview text consistent.
const SAMPLE = {
  clientName: "Aisha Khan",
  companyName: "Rahma Therapy",
  bookingDate: "12 June 2026",
  startTime: "2:30pm",
  contactPhone: "07000 000000",
  participantCount: "3",
  changeSummary: "Time changed from 2:00pm to 2:30pm.",
  therapistName: "Fatimah Hussain",
  addressLines: "12 Oak Lane, Luton LU2 3AB",
  serviceName: "Swedish massage",
  city: "Luton",
  staffName: "Fatimah Hussain",
  contactDetail: "aisha.khan@example.test",
  serviceInterest: "Hijama (cupping)",
  enquiryUrl: "https://admin.rahmatherapy.example.test/enquiries/example",
} as const;

// Subject field factory (C-15 Phase A, item 1 — editable subjects). Shared
// shape across every template: tight maxLength (D13's blanket 500 is NOT
// used here — 100 matches the pre-existing REVIEW_SUBJECT convention,
// chosen because long subjects render badly in inboxes). No `tokens`: this
// `defaultValue` (the SafeField-level one, passed in by each TEMPLATES
// entry below) never references a variable — it only ever feeds the
// <title> tag and the "Use default" preview (see resolveTitleSubject() in
// templates.ts). The real Subject: header's default is the DIFFERENT,
// closeout-round-corrected TemplateMeta.subjectDefault (some of which now
// do reference variables, e.g. "{companyName} booking request received"),
// resolved via templates.ts's exported resolveSubject(). A hand-typed
// {clientName} etc. in an admin's subject override still resolves — the
// same substituteVars() every body field goes through — even without a
// chip button for it here.
function subjectField(defaultValue: string): SafeField {
  return {
    kind: "subject",
    label: "Subject line",
    placeholder: defaultValue,
    // C-15 closeout fix round — corrected. Real sends now read this field's
    // override (see src/lib/email/templates.ts's exported resolveSubject()),
    // so it is no longer true that the inbox line is "fixed in code and not
    // yet editable here".
    helper:
      "Sets the subject line shown in the recipient's inbox, and the hidden page title inside the email's HTML source.",
    maxLength: 100,
    defaultValue,
  };
}

const BOOKING_SUMMARY_FIXED_PART: FixedPart = {
  label: "Booking summary",
  source: "Built from the booking's date, time, address and total price.",
};

const PARTICIPANT_DETAILS_FIXED_PART: FixedPart = {
  label: "Participant details",
  source: "Built from each participant's gender preference and booked services.",
};

const FOOTER_CONTACT: SafeField = {
  kind: "footer_contact",
  label: "Footer contact line",
  placeholder: "Questions? Reply to this email or call {contactPhone}.",
  helper: "Sourced from your clinic settings — update there to change everywhere.",
  maxLength: 200,
  // Illustrative only — the true runtime default is settings-derived
  // (contact email/phone from business_settings, or blank if neither is
  // set), not a single fixed string. templates.ts's renderFooter() keeps
  // that conditional logic inline; this defaultValue only feeds the "Use
  // default" preview text.
  defaultValue: "Questions? Reply to this email or call {contactPhone}.",
  tokens: [{ token: "{contactPhone}", label: "Clinic phone", sample: SAMPLE.contactPhone }],
};

const GREETING_INTRO: SafeField = {
  kind: "greeting_intro",
  label: "Greeting intro sentence",
  placeholder: "Hi {clientName}, we have received your booking request.",
  helper: "Insert names and dates with the buttons above.",
  maxLength: 300,
  multiline: true,
  defaultValue:
    "Hi {clientName}, we have received your {companyName} booking request.",
  tokens: [
    { token: "{clientName}", label: "Client name", sample: SAMPLE.clientName },
    { token: "{companyName}", label: "Company name", sample: SAMPLE.companyName },
  ],
};

const GROUP_COPY: SafeField = {
  kind: "group_copy",
  label: "Group-copy sentence",
  placeholder: "This booking is for {participantCount} participants.",
  helper: "Used when the booking has more than one participant.",
  maxLength: 200,
  // Illustrative only — the true runtime default branches on participant
  // count ("This booking is for one participant." vs "This is a group
  // booking for N participants."), not a single fixed string. templates.ts
  // keeps that conditional logic inline.
  defaultValue: "This booking is for {participantCount} participants.",
  tokens: [
    { token: "{participantCount}", label: "Participant count", sample: SAMPLE.participantCount },
  ],
};

const STAFF_INTRO: SafeField = {
  kind: "intro",
  label: "Intro sentence",
  placeholder: "Here are the details for your next visit.",
  helper: "Sets the tone before the booking summary. No marketing warmth.",
  maxLength: 200,
  defaultValue: "You have been assigned to a {companyName} booking.",
  tokens: [{ token: "{companyName}", label: "Company name", sample: SAMPLE.companyName }],
};

const CHANGE_WRAPPER: SafeField = {
  kind: "wrapper_change_summary",
  label: "Wrapper sentence around changes",
  placeholder: "Here's what changed for the booking on {date}:",
  helper: "Sits above the auto-generated change summary.",
  maxLength: 200,
  // "{changeSummary}" reproduces the current default exactly (no wrapping —
  // just the raw auto-generated change summary) once run through the same
  // substituteVars() substitution every override already uses.
  defaultValue: "{changeSummary}",
  tokens: [
    { token: "{changeSummary}", label: "Change summary", sample: SAMPLE.changeSummary },
    { token: "{date}", label: "Booking date", sample: SAMPLE.bookingDate },
  ],
};

// C-01 — review request email fields. All single-use (this template only),
// but declared as named consts to match the file's existing convention
// (STAFF_INTRO, CHANGE_WRAPPER are also single-use).
const REVIEW_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "Thank you for choosing Rahma Therapy for your {service_name}. We hope you felt looked after from start to finish.",
  helper: "Opens the email. {service_name} fills in automatically from the booking.",
  maxLength: 500,
  multiline: true,
  defaultValue:
    "Thank you for choosing Rahma Therapy for your {service_name}. We hope you felt looked after from start to finish.",
  tokens: [{ token: "{service_name}", label: "Service name", sample: SAMPLE.serviceName }],
};

const REVIEW_BODY_ASK: SafeField = {
  kind: "body_ask",
  label: "Ask paragraph",
  placeholder:
    "If you have a moment, we'd be grateful for an honest review on Google. It helps other people in {city} find us.",
  helper: "The review request itself. {city} fills in automatically when known.",
  maxLength: 500,
  multiline: true,
  defaultValue:
    "If you have a moment, we'd be grateful for an honest review on Google. It helps other people in {city} find us.",
  tokens: [{ token: "{city}", label: "City", sample: SAMPLE.city }],
};

const REVIEW_BODY_CTA_LABEL: SafeField = {
  kind: "body_cta_label",
  label: "CTA button label",
  placeholder: "Leave a Google review",
  helper: "Text shown on the button. Keep it short and action-focused.",
  maxLength: 80,
  defaultValue: "Leave a Google review",
};

const REVIEW_BODY_CTA_URL: SafeField = {
  kind: "body_cta_url",
  label: "CTA button URL",
  placeholder: "https://g.page/r/Ccfwk27JycKDEBM/review",
  helper: "Where the button links to — your Google review page.",
  maxLength: 500,
  defaultValue: "https://g.page/r/Ccfwk27JycKDEBM/review",
};

const REVIEW_BODY_SIGNOFF: SafeField = {
  kind: "body_signoff",
  label: "Signoff",
  placeholder: "Thank you again,\nThe Rahma Therapy team",
  helper: "Closing line, shown under the sample reviews and button.",
  maxLength: 200,
  multiline: true,
  defaultValue: "Thank you again,\nThe Rahma Therapy team",
};

function reviewVariantField(
  kind: string,
  label: string,
  text: string,
  category: "massage" | "cupping"
): SafeField {
  return {
    kind,
    label,
    placeholder: text,
    helper: `One of 5 sample reviews shown to ${category === "massage" ? "massage" : "cupping/hijama"} clients; 3 are picked at random. {city} fills in automatically.`,
    maxLength: 400,
    multiline: true,
    defaultValue: text,
    tokens: [{ token: "{city}", label: "City", sample: SAMPLE.city }],
  };
}

const REVIEW_MASSAGE_VARIANT_1 = reviewVariantField(
  "massage_variant_1",
  "Massage review sample 1",
  "I had a brilliant home massage in {city} today — really professional setup, felt completely relaxed by the end.",
  "massage"
);
const REVIEW_MASSAGE_VARIANT_2 = reviewVariantField(
  "massage_variant_2",
  "Massage review sample 2",
  "Booked a home massage with Rahma Therapy in {city}. The therapist was excellent, the experience felt like a proper clinic but in the comfort of home.",
  "massage"
);
const REVIEW_MASSAGE_VARIANT_3 = reviewVariantField(
  "massage_variant_3",
  "Massage review sample 3",
  "Just had a fantastic massage at home in {city}. Highly skilled, deeply relaxing, and so easy not having to travel.",
  "massage"
);
const REVIEW_MASSAGE_VARIANT_4 = reviewVariantField(
  "massage_variant_4",
  "Massage review sample 4",
  "Tried Rahma Therapy for a mobile massage in {city} — top quality. Will definitely book again.",
  "massage"
);
const REVIEW_MASSAGE_VARIANT_5 = reviewVariantField(
  "massage_variant_5",
  "Massage review sample 5",
  "Excellent home massage experience in {city}. Calm, professional, and exactly what I needed.",
  "massage"
);
const REVIEW_CUPPING_VARIANT_1 = reviewVariantField(
  "cupping_variant_1",
  "Cupping review sample 1",
  "Had a hijama session at home in {city} with Rahma Therapy. Very clean, hygienic, and the practitioner was knowledgeable and respectful.",
  "cupping"
);
const REVIEW_CUPPING_VARIANT_2 = reviewVariantField(
  "cupping_variant_2",
  "Cupping review sample 2",
  "Booked hijama at home in {city} — proper Sunnah practice, sterile equipment, and a calming atmosphere. Highly recommend.",
  "cupping"
);
const REVIEW_CUPPING_VARIANT_3 = reviewVariantField(
  "cupping_variant_3",
  "Cupping review sample 3",
  "Excellent home hijama appointment in {city}. Felt looked after from start to finish, the setup was spotless and professional.",
  "cupping"
);
const REVIEW_CUPPING_VARIANT_4 = reviewVariantField(
  "cupping_variant_4",
  "Cupping review sample 4",
  "Tried Rahma Therapy for hijama in {city} and couldn't be happier. Knowledgeable practitioner, careful technique, and great aftercare.",
  "cupping"
);
const REVIEW_CUPPING_VARIANT_5 = reviewVariantField(
  "cupping_variant_5",
  "Cupping review sample 5",
  "First hijama session in {city} and it was a brilliant experience. Clean, professional, and the practitioner explained every step.",
  "cupping"
);

// C-08 — booking_confirmed_client fields. Reuses the body_intro /
// body_cta_label / body_signoff kinds C-01 already added to SafeFieldKind
// (grepped before writing this — see plan §1 Sub-step 3 coordination note)
// rather than adding a second, incompatible set of kinds.
const BOOKING_CONFIRMED_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "Hi {clientName}, your appointment on {bookingDate} at {startTime} is confirmed. We'll send a reminder closer to the day.",
  helper: "Insert names and dates with the buttons above.",
  maxLength: 500,
  multiline: true,
  defaultValue:
    "Hi {clientName}, your appointment on {bookingDate} at {startTime} is confirmed. We'll send a reminder closer to the day.",
  tokens: [
    { token: "{clientName}", label: "Client name", sample: SAMPLE.clientName },
    { token: "{bookingDate}", label: "Booking date", sample: SAMPLE.bookingDate },
    { token: "{startTime}", label: "Start time", sample: SAMPLE.startTime },
  ],
};

const BOOKING_CONFIRMED_BODY_CTA_LABEL: SafeField = {
  kind: "body_cta_label",
  label: "CTA button label",
  placeholder: "Manage your booking",
  helper: "Text on the action button linking to the manage-booking page.",
  maxLength: 80,
  defaultValue: "Manage your booking",
};

const BOOKING_CONFIRMED_BODY_SIGNOFF: SafeField = {
  kind: "body_signoff",
  label: "Signoff",
  placeholder: "Thank you,\nThe Rahma Therapy team",
  helper: "Closing line above the footer contact line.",
  maxLength: 200,
  multiline: true,
  defaultValue: "Thank you,\nThe Rahma Therapy team",
};

// C-08 — staff_unassignment field. No CTA (no action link in this template).
const STAFF_UNASSIGNMENT_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "Hi {therapistName}, you've been unassigned from the {bookingDate} {startTime} booking ({clientName}). Reach out to admin if you have questions.",
  helper: "Insert names and dates with the buttons above.",
  maxLength: 500,
  multiline: true,
  defaultValue:
    "Hi {therapistName}, you've been unassigned from the {bookingDate} {startTime} booking ({clientName}). Reach out to admin if you have questions.",
  tokens: [
    { token: "{therapistName}", label: "Therapist name", sample: SAMPLE.therapistName },
    { token: "{bookingDate}", label: "Booking date", sample: SAMPLE.bookingDate },
    { token: "{startTime}", label: "Start time", sample: SAMPLE.startTime },
    { token: "{clientName}", label: "Client name", sample: SAMPLE.clientName },
  ],
};

// C-08 — claim field. No CTA (internal ops notice, no action link).
const CLAIM_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "{therapistName} just claimed the {bookingDate} {startTime} slot for {clientName}.",
  helper: "Insert names and dates with the buttons above.",
  maxLength: 500,
  multiline: true,
  defaultValue:
    "{therapistName} just claimed the {bookingDate} {startTime} slot for {clientName}.",
  tokens: [
    { token: "{therapistName}", label: "Therapist name", sample: SAMPLE.therapistName },
    { token: "{bookingDate}", label: "Booking date", sample: SAMPLE.bookingDate },
    { token: "{startTime}", label: "Start time", sample: SAMPLE.startTime },
    { token: "{clientName}", label: "Client name", sample: SAMPLE.clientName },
  ],
};

// C-08 — client_assigned_therapist fields. Has a CTA (manage-booking link),
// unlike claim/staff_unassignment.
const CLIENT_ASSIGNED_THERAPIST_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "Hi {clientName}, your appointment on {bookingDate} at {startTime} will be with {therapistName}. They'll arrive at {addressLines}. If anything changes, we'll let you know.",
  helper: "Insert names and dates with the buttons above.",
  maxLength: 500,
  multiline: true,
  defaultValue:
    "Hi {clientName}, your appointment on {bookingDate} at {startTime} will be with {therapistName}. They'll arrive at {addressLines}. If anything changes, we'll let you know.",
  tokens: [
    { token: "{clientName}", label: "Client name", sample: SAMPLE.clientName },
    { token: "{bookingDate}", label: "Booking date", sample: SAMPLE.bookingDate },
    { token: "{startTime}", label: "Start time", sample: SAMPLE.startTime },
    { token: "{therapistName}", label: "Therapist name", sample: SAMPLE.therapistName },
    { token: "{addressLines}", label: "Address", sample: SAMPLE.addressLines },
  ],
};

const CLIENT_ASSIGNED_THERAPIST_BODY_CTA_LABEL: SafeField = {
  kind: "body_cta_label",
  label: "CTA button label",
  placeholder: "Manage your booking",
  helper: "Text on the action button linking to the manage-booking page.",
  maxLength: 80,
  defaultValue: "Manage your booking",
};

// C-08 Phase D Step 16 — enquiry_logged field. No CTA (internal ops notice,
// same shape as claim; {enquiryUrl} is inline text in the intro rather than
// a button field).
const ENQUIRY_LOGGED_BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder:
    "{staffName} logged a new enquiry from {clientName} ({contactDetail}) interested in {serviceInterest}. View it here: {enquiryUrl}.",
  helper: "Insert names and dates with the buttons above.",
  maxLength: 500,
  multiline: true,
  defaultValue:
    "{staffName} logged a new enquiry from {clientName} ({contactDetail}) interested in {serviceInterest}. View it here: {enquiryUrl}.",
  tokens: [
    { token: "{staffName}", label: "Staff name", sample: SAMPLE.staffName },
    { token: "{clientName}", label: "Client name", sample: SAMPLE.clientName },
    { token: "{contactDetail}", label: "Contact detail", sample: SAMPLE.contactDetail },
    { token: "{serviceInterest}", label: "Service interest", sample: SAMPLE.serviceInterest },
    { token: "{enquiryUrl}", label: "Enquiry link", sample: SAMPLE.enquiryUrl },
  ],
};

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "booking_confirmation",
    audience: "customer",
    cardName: "Booking confirmation",
    trigger: "Sent when a booking request is submitted",
    rendersAs: "html",
    // C-15 closeout fix round — corrected to match the live literal in
    // notifications.ts's sendBookingCreatedEmails (customer leg): the
    // company name has always been prefixed on the real Subject: header.
    subjectDefault: "{companyName} booking request received",
    fields: [
      subjectField("Booking request received"),
      GREETING_INTRO,
      GROUP_COPY,
      FOOTER_CONTACT,
    ],
    fixedParts: [BOOKING_SUMMARY_FIXED_PART, PARTICIPANT_DETAILS_FIXED_PART],
  },
  {
    id: "booking_cancellation_client",
    audience: "customer",
    cardName: "Booking cancelled (client)",
    trigger: "Sent when a booking is cancelled",
    rendersAs: "html",
    // C-15 closeout fix round — corrected to match the live literal in
    // notifications.ts's sendBookingCancellationEmails (customer leg).
    subjectDefault: "{companyName} booking cancelled",
    fields: [
      subjectField("Booking cancelled"),
      {
        ...GREETING_INTRO,
        defaultValue: "Hi {clientName}, your {companyName} booking has been cancelled.",
      },
      FOOTER_CONTACT,
    ],
    fixedParts: [BOOKING_SUMMARY_FIXED_PART, PARTICIPANT_DETAILS_FIXED_PART],
  },
  {
    id: "booking_reminder",
    audience: "customer",
    cardName: "Booking reminder",
    trigger: "Sent manually from the Reminders tab",
    rendersAs: "html",
    // C-15 closeout fix round — corrected to match the live literal in
    // notifications.ts's sendBookingReminderEmail.
    subjectDefault: "{companyName} booking reminder",
    fields: [
      subjectField("Booking reminder"),
      {
        ...GREETING_INTRO,
        kind: "intro",
        label: "Intro sentence",
        defaultValue:
          "Hi {clientName}, this is a reminder for your upcoming {companyName} appointment.",
      },
      FOOTER_CONTACT,
    ],
    fixedParts: [BOOKING_SUMMARY_FIXED_PART, PARTICIPANT_DETAILS_FIXED_PART],
  },
  {
    id: "booking_plain_text",
    audience: "customer",
    cardName: "Plain-text companion",
    trigger: "Paired with HTML emails as a plain-text fallback",
    rendersAs: "plain_text",
    subjectDefault: "Booking confirmation",
    // Brief §Audience variants / Implementation Notes: this is a code-paired
    // companion with no independent editable greeting; only the footer
    // contact line (and now the subject) is safe to edit.
    fields: [subjectField("Booking confirmation"), FOOTER_CONTACT],
    fixedParts: [
      {
        label: "Booking details block",
        source:
          "Plain-text summary built from the booking's date, time, address, price and participants.",
      },
    ],
  },
  {
    id: "staff_assignment",
    audience: "staff",
    cardName: "Assignment notification",
    trigger: "Sent when a therapist is assigned to a booking",
    rendersAs: "html",
    // C-15 closeout fix round — corrected to match the live literal in
    // notifications.ts's sendStaffAssignmentEmail.
    subjectDefault: "{companyName} booking assignment",
    fields: [subjectField("Booking assignment"), STAFF_INTRO, FOOTER_CONTACT],
    fixedParts: [BOOKING_SUMMARY_FIXED_PART, PARTICIPANT_DETAILS_FIXED_PART],
  },
  {
    id: "staff_booking_change",
    audience: "staff",
    cardName: "Assignment updated",
    trigger: "Sent when an assigned booking changes",
    rendersAs: "html",
    // C-15 closeout fix round — corrected to match the live literal in
    // notifications.ts's sendAssignedStaffBookingChangeEmails.
    subjectDefault: "{companyName} assigned booking changed",
    fields: [subjectField("Assigned booking changed"), CHANGE_WRAPPER, FOOTER_CONTACT],
    fixedParts: [BOOKING_SUMMARY_FIXED_PART, PARTICIPANT_DETAILS_FIXED_PART],
  },
  {
    id: "admin_booking_notification",
    audience: "admin_internal",
    cardName: "New booking (internal)",
    trigger: "Sent to the owner when a booking is submitted",
    rendersAs: "html",
    // C-15 closeout fix round — corrected to match the live literal in
    // notifications.ts's sendBookingCreatedEmails (admin leg).
    subjectDefault: "New booking request - {clientName}",
    fields: [subjectField("New booking request"), FOOTER_CONTACT],
    fixedParts: [
      BOOKING_SUMMARY_FIXED_PART,
      { label: "Client contact block", source: "Built from the client's email and phone on file." },
      PARTICIPANT_DETAILS_FIXED_PART,
    ],
  },
  {
    id: "admin_booking_cancellation",
    audience: "admin_internal",
    cardName: "Cancellation (internal)",
    trigger: "Sent to the owner when a booking is cancelled",
    rendersAs: "html",
    // C-15 closeout fix round — corrected. The registry previously said
    // "Booking cancellation"; the live literal in notifications.ts's
    // sendBookingCancellationEmails (admin leg) has always been "Booking
    // cancelled - {clientName}" — both wording and the client-name suffix
    // differed from the registry.
    subjectDefault: "Booking cancelled - {clientName}",
    fields: [subjectField("Booking cancellation"), FOOTER_CONTACT],
    fixedParts: [
      BOOKING_SUMMARY_FIXED_PART,
      {
        label: "Cancellation note",
        source: "Shown when the customer or admin left a note while cancelling — not editable here.",
      },
      PARTICIPANT_DETAILS_FIXED_PART,
    ],
  },
  {
    id: "admin_reschedule_request",
    audience: "admin_internal",
    cardName: "Reschedule request (internal)",
    trigger: "Sent to the owner when a client requests a reschedule",
    rendersAs: "html",
    // C-15 closeout fix round — corrected to match the live literal in
    // notifications.ts's sendBookingRescheduleRequestEmails.
    subjectDefault: "Reschedule request - {clientName}",
    fields: [subjectField("Reschedule request"), FOOTER_CONTACT],
    fixedParts: [
      BOOKING_SUMMARY_FIXED_PART,
      {
        label: "Requested new time",
        source: "Built from the client's requested date and time, plus their note if left.",
      },
      PARTICIPANT_DETAILS_FIXED_PART,
    ],
  },
  {
    id: "review_request_client",
    audience: "customer",
    cardName: "Review request (2h post-completion)",
    trigger: "Sent automatically 2 hours after a booking is marked completed",
    rendersAs: "html",
    subjectDefault: "Thank you for visiting Rahma Therapy",
    fields: [
      subjectField("Thank you for visiting Rahma Therapy"),
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
    fixedParts: [
      {
        label: "Which 3 review samples are shown",
        source: "Chosen at random from the 5 configured samples each time this email sends.",
      },
    ],
  },
  {
    id: "booking_confirmed_client",
    audience: "customer",
    cardName: "Booking confirmed (client)",
    trigger: "Sent when admin confirms a pending booking with the client. Fires on pending→confirmed transitions in quickUpdateBooking and updateBookingManagement.",
    rendersAs: "html",
    subjectDefault: "Your booking is confirmed",
    fields: [
      subjectField("Your booking is confirmed"),
      BOOKING_CONFIRMED_BODY_INTRO,
      BOOKING_CONFIRMED_BODY_CTA_LABEL,
      BOOKING_CONFIRMED_BODY_SIGNOFF,
      FOOTER_CONTACT,
    ],
    fixedParts: [BOOKING_SUMMARY_FIXED_PART],
  },
  {
    id: "staff_unassignment",
    audience: "staff",
    cardName: "Assignment removed",
    trigger: "Sent to the previously assigned therapist when they are unassigned or reassigned away from a booking. Fires from updateBookingAssignment.",
    rendersAs: "html",
    subjectDefault: "Booking assignment removed",
    fields: [
      subjectField("Booking assignment removed"),
      STAFF_UNASSIGNMENT_BODY_INTRO,
      FOOTER_CONTACT,
    ],
    fixedParts: [BOOKING_SUMMARY_FIXED_PART],
  },
  {
    id: "claim",
    audience: "admin_internal",
    cardName: "Slot claimed (internal)",
    trigger: "Sent to the admin recipient when a practitioner claims an unassigned slot. Fires from claimBookingAssignment. Interim single-recipient send — Phase D reroutes it through the business-notification resolver.",
    rendersAs: "html",
    // C-15 closeout fix round — corrected to match the live literal in
    // notifications.ts's sendClaimNotificationEmail.
    subjectDefault: "Slot claimed: {therapistName} → {bookingDate}",
    fields: [subjectField("Slot claimed"), CLAIM_BODY_INTRO, FOOTER_CONTACT],
    fixedParts: [BOOKING_SUMMARY_FIXED_PART],
  },
  {
    id: "client_assigned_therapist",
    audience: "customer",
    cardName: "Therapist assigned (client)",
    trigger: "Sent to the client whenever their assignment changes (assign, reassign, or claim), so they always know who is coming. Fires from claimBookingAssignment and updateBookingAssignment.",
    rendersAs: "html",
    // C-15 closeout fix round — corrected. The registry previously said
    // "Your therapist is confirmed"; the live literal in notifications.ts's
    // sendClientAssignedTherapistEmail has always been "Your therapist for
    // {bookingDate}".
    subjectDefault: "Your therapist for {bookingDate}",
    fields: [
      subjectField("Your therapist is confirmed"),
      CLIENT_ASSIGNED_THERAPIST_BODY_INTRO,
      CLIENT_ASSIGNED_THERAPIST_BODY_CTA_LABEL,
      FOOTER_CONTACT,
    ],
    fixedParts: [BOOKING_SUMMARY_FIXED_PART],
  },
  {
    id: "enquiry_logged",
    audience: "admin_internal",
    cardName: "Enquiry logged (internal)",
    trigger: "Sent to opted-in Owner/Admin recipients when a staff member logs a new enquiry. Fires from createEnquiry; the logging staff member is excluded (skip-self).",
    rendersAs: "html",
    // C-15 Phase A set subjectDefault to "New enquiry logged", matching the
    // <title> tag (renderer's <title> literal — the only place a subject
    // reached at the time). C-15 closeout fix round — real sends were never
    // touched by that Phase A pass, and notifications.ts's
    // sendEnquiryLoggedEmail has always sent "New enquiry: {clientName}" as
    // the actual Subject: header — the legacy SUBJECTS map value Phase A
    // set aside as "stale" was in fact what real customers' admin alerts
    // used all along. subjectDefault is corrected to match it; the SafeField
    // defaultValue below (which still drives <title>, parity-fixture-frozen)
    // is untouched.
    subjectDefault: "New enquiry: {clientName}",
    fields: [subjectField("New enquiry logged"), ENQUIRY_LOGGED_BODY_INTRO, FOOTER_CONTACT],
    fixedParts: [],
  },
  {
    // C-15 Phase A, SIX THINGS item 3 — the one customer-facing email the
    // Templates tab could not reach. renderBookingRestoredEmail already
    // accepts overrides.greeting_intro + footer_contact via renderFooter;
    // only this registry entry was missing (no renderer/kind change).
    id: "booking_restored_client",
    audience: "customer",
    cardName: "Booking restored (client)",
    trigger: "Sent when a cancelled, no-show, or reopened booking is restored to an active status. Fires from sendBookingRestoredClientEmail.",
    rendersAs: "html",
    // C-15 closeout fix round — corrected to match the live literal in
    // notifications.ts's sendBookingRestoredClientEmail.
    subjectDefault: "{companyName} — your booking is back on",
    fields: [
      subjectField("Booking restored"),
      {
        ...GREETING_INTRO,
        // Illustrative only — the true runtime default branches on
        // fromStatus (an apology line only when restoring out of
        // "cancelled"); templates.ts keeps that conditional logic inline.
        defaultValue:
          "Good news {clientName} — your {companyName} booking has been restored. We are sorry for the earlier cancellation; everything is back on.",
      },
      FOOTER_CONTACT,
    ],
    fixedParts: [BOOKING_SUMMARY_FIXED_PART, PARTICIPANT_DETAILS_FIXED_PART],
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
