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
  | "plain_text_intro";

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
