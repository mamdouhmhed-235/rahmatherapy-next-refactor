// SERVER ONLY - do not import from client components.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface EmailParticipant {
  label: string;
  participantGender: "male" | "female";
  requiredTherapistGender: "male" | "female";
  services: string[];
  assignedStaffName?: string | null;
}

export interface BookingEmailTemplateInput {
  companyName: string;
  clientName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  addressLines: string[];
  totalPrice: number;
  participantCount: number;
  participants: EmailParticipant[];
  manageUrl?: string;
  customerNotes?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface RescheduleRequestEmailInput extends BookingEmailTemplateInput {
  requestedDate: string;
  requestedTime: string;
  requestNote: string | null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Substitute `{varName}` placeholders inside an override template string.
// Unknown variables stay literal (e.g. `{wrongName}`) so an operator can see
// their typo in a test send. Known-but-null/undefined values render as "".
function substituteVars(
  template: string,
  vars: Record<string, unknown>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in vars)) return match;
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

// Build the variable map an override string can reference. Mirrors the
// ALLOWED_VARIABLES set in TemplateEditForm.tsx — anything in that set should
// be resolvable here. Extra `extras` lets per-template callers add fields
// (changeSummary, bookingId, requestedDate, requestedTime) without inflating
// the base BookingEmailTemplateInput.
function buildVarMap(
  input: BookingEmailTemplateInput,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    clientName: input.clientName,
    companyName: input.companyName,
    bookingDate: input.bookingDate,
    startTime: input.startTime,
    endTime: input.endTime,
    contactPhone: input.contactPhone ?? null,
    contactEmail: input.contactEmail ?? null,
    participantCount: input.participantCount,
    manageUrl: input.manageUrl ?? null,
    addressLines: (input.addressLines ?? []).join(", "),
    totalPrice: input.totalPrice,
    therapistName: input.participants[0]?.assignedStaffName ?? null,
    customerNotes: input.customerNotes ?? null,
    ...extras,
  };
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function renderLayout(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f7f3ec;color:#1f2f2b;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:680px;margin:0 auto;padding:32px 18px;">
      <div style="background:#ffffff;border:1px solid #e8dfd2;border-radius:18px;padding:28px;">
        ${body}
      </div>
    </div>
  </body>
</html>`;
}

function renderSummary(input: BookingEmailTemplateInput) {
  const address = input.addressLines.map(escapeHtml).join("<br>");

  return `
    <div style="margin:22px 0;padding:18px;border-radius:14px;background:#f7f3ec;">
      <p style="margin:0 0 10px;font-size:13px;color:#53615d;">Appointment</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#1f2f2b;">${escapeHtml(
        formatDate(input.bookingDate)
      )} at ${escapeHtml(formatTime(input.startTime))}-${escapeHtml(
        formatTime(input.endTime)
      )}</p>
      <p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#53615d;">${address}</p>
      <p style="margin:10px 0 0;font-size:14px;color:#53615d;">Total: <strong style="color:#1f2f2b;">${escapeHtml(
        formatMoney(input.totalPrice)
      )}</strong></p>
    </div>`;
}

function renderParticipants(input: BookingEmailTemplateInput) {
  const rows = input.participants
    .map((participant) => {
      const serviceList = participant.services.length
        ? participant.services.map(escapeHtml).join(", ")
        : "No service snapshots";
      const staff = participant.assignedStaffName
        ? `<br>Assigned staff: ${escapeHtml(participant.assignedStaffName)}`
        : "";

      return `<li style="margin:0 0 12px;">
        <strong>${escapeHtml(participant.label)}</strong><br>
        Client: ${escapeHtml(formatLabel(participant.participantGender))}<br>
        Required therapist: ${escapeHtml(
          formatLabel(participant.requiredTherapistGender)
        )}<br>
        Services: ${serviceList}${staff}
      </li>`;
    })
    .join("");

  return `
    <div style="margin:22px 0;">
      <p style="margin:0 0 10px;font-size:13px;color:#53615d;">Participant details</p>
      <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:#1f2f2b;">
        ${rows}
      </ul>
    </div>`;
}

function renderFooter(
  input: BookingEmailTemplateInput,
  overrides: Record<string, string> = {}
) {
  let footerLine = "";
  if (overrides.footer_contact) {
    footerLine = escapeHtml(
      substituteVars(overrides.footer_contact, buildVarMap(input))
    );
  } else {
    const contactParts = [input.contactEmail, input.contactPhone].filter(
      (value): value is string => Boolean(value)
    );
    if (contactParts.length > 0) {
      footerLine = `Questions? Contact ${escapeHtml(contactParts.join(" or "))}.`;
    }
  }

  return `<p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#53615d;">
    ${footerLine}
  </p>`;
}

export function renderBookingConfirmationEmail(
  input: BookingEmailTemplateInput,
  overrides: Record<string, string> = {}
) {
  const vars = buildVarMap(input);
  const greetingIntroHtml = overrides.greeting_intro
    ? escapeHtml(substituteVars(overrides.greeting_intro, vars))
    : `Hi ${escapeHtml(input.clientName)}, we have received your ${escapeHtml(input.companyName)} booking request.`;
  const groupCopyHtml = overrides.group_copy
    ? escapeHtml(substituteVars(overrides.group_copy, vars))
    : escapeHtml(
        input.participantCount > 1
          ? `This is a group booking for ${input.participantCount} participants.`
          : "This booking is for one participant."
      );
  const manageLink = input.manageUrl
    ? `<p style="margin:18px 0 0;"><a href="${escapeHtml(
        input.manageUrl
      )}" style="display:inline-block;border-radius:999px;background:#30463f;color:#ffffff;text-decoration:none;padding:12px 18px;font-size:14px;font-weight:700;">Manage this booking</a></p>`
    : "";

  return renderLayout(
    "Booking request received",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking request received</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${greetingIntroHtml} ${groupCopyHtml}</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${
      input.customerNotes
        ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:#53615d;"><strong style="color:#1f2f2b;">Your notes:</strong> ${escapeHtml(input.customerNotes)}</p>`
        : ""
    }
    ${manageLink}
    ${renderFooter(input, overrides)}`
  );
}

export function renderAdminBookingNotificationEmail(
  input: BookingEmailTemplateInput & {
    bookingId: string;
    clientEmail: string | null;
    clientPhone: string | null;
  },
  overrides: Record<string, string> = {}
) {
  return renderLayout(
    "New booking request",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">New booking request</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${escapeHtml(
      input.clientName
    )} submitted a booking request. Booking reference: ${escapeHtml(input.bookingId)}.</p>
    ${renderSummary(input)}
    <div style="margin:22px 0;padding:16px;border-radius:14px;background:#f7f3ec;font-size:14px;line-height:1.5;color:#53615d;">
      Email: ${escapeHtml(input.clientEmail ?? "Not provided")}<br>
      Phone: ${escapeHtml(input.clientPhone ?? "Not provided")}
    </div>
    ${renderParticipants(input)}
    ${renderFooter(input, overrides)}`
  );
}

export function renderBookingCancellationEmail(
  input: BookingEmailTemplateInput,
  overrides: Record<string, string> = {}
) {
  const greetingIntroHtml = overrides.greeting_intro
    ? escapeHtml(substituteVars(overrides.greeting_intro, buildVarMap(input)))
    : `Hi ${escapeHtml(input.clientName)}, your ${escapeHtml(input.companyName)} booking has been cancelled.`;
  return renderLayout(
    "Booking cancelled",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking cancelled</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${greetingIntroHtml}</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${renderFooter(input, overrides)}`
  );
}

export function renderBookingRestoredEmail(
  input: BookingEmailTemplateInput & { fromStatus: string },
  overrides: Record<string, string> = {}
) {
  // Only a restore out of `cancelled` warrants an apology — a no-show or a
  // reopened completed booking was never cancelled on the client.
  const defaultIntro =
    input.fromStatus === "cancelled"
      ? `Good news ${escapeHtml(input.clientName)} — your ${escapeHtml(input.companyName)} booking has been restored. We are sorry for the earlier cancellation; everything is back on.`
      : `Good news ${escapeHtml(input.clientName)} — your ${escapeHtml(input.companyName)} booking is back on.`;
  const greetingIntroHtml = overrides.greeting_intro
    ? escapeHtml(substituteVars(overrides.greeting_intro, buildVarMap(input)))
    : defaultIntro;
  return renderLayout(
    "Booking restored",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking restored</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${greetingIntroHtml}</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${renderFooter(input, overrides)}`
  );
}

export function renderAdminBookingCancellationEmail(
  input: BookingEmailTemplateInput & {
    bookingId: string;
    initiatedBy: "customer" | "admin";
    cancellationNote?: string | null;
  },
  overrides: Record<string, string> = {}
) {
  return renderLayout(
    "Booking cancellation",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking cancellation</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${escapeHtml(
      input.clientName
    )}'s booking was cancelled by ${escapeHtml(input.initiatedBy)}. Booking reference: ${escapeHtml(
      input.bookingId
    )}.</p>
    ${renderSummary(input)}
    ${
      input.cancellationNote
        ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:#53615d;"><strong style="color:#1f2f2b;">Cancellation note:</strong> ${escapeHtml(input.cancellationNote)}</p>`
        : ""
    }
    ${renderParticipants(input)}
    ${renderFooter(input, overrides)}`
  );
}

export function renderAdminRescheduleRequestEmail(
  input: RescheduleRequestEmailInput & { bookingId: string },
  overrides: Record<string, string> = {}
) {
  return renderLayout(
    "Reschedule request",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Reschedule request</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${escapeHtml(
      input.clientName
    )} requested a new appointment time. Booking reference: ${escapeHtml(input.bookingId)}.</p>
    ${renderSummary(input)}
    <div style="margin:22px 0;padding:18px;border-radius:14px;background:#f7f3ec;">
      <p style="margin:0 0 10px;font-size:13px;color:#53615d;">Requested new time</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#1f2f2b;">${escapeHtml(
        formatDate(input.requestedDate)
      )} at ${escapeHtml(formatTime(input.requestedTime))}</p>
      ${
        input.requestNote
          ? `<p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#53615d;">${escapeHtml(input.requestNote)}</p>`
          : ""
      }
    </div>
    ${renderParticipants(input)}
    ${renderFooter(input, overrides)}`
  );
}

export function renderStaffAssignmentEmail(
  input: BookingEmailTemplateInput,
  overrides: Record<string, string> = {}
) {
  const introHtml = overrides.intro
    ? escapeHtml(substituteVars(overrides.intro, buildVarMap(input)))
    : `You have been assigned to a ${escapeHtml(input.companyName)} booking.`;
  return renderLayout(
    "Booking assignment",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking assignment</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${introHtml}</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${renderFooter(input, overrides)}`
  );
}

export function renderStaffBookingChangeEmail(
  input: BookingEmailTemplateInput & { changeSummary: string },
  overrides: Record<string, string> = {}
) {
  const vars = buildVarMap(input, {
    changeSummary: input.changeSummary,
    date: input.bookingDate,
  });
  const wrapperHtml = overrides.wrapper_change_summary
    ? escapeHtml(substituteVars(overrides.wrapper_change_summary, vars))
    : escapeHtml(input.changeSummary);
  return renderLayout(
    "Assigned booking changed",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Assigned booking changed</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${wrapperHtml}</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${renderFooter(input, overrides)}`
  );
}

export function renderBookingReminderEmail(
  input: BookingEmailTemplateInput,
  overrides: Record<string, string> = {}
) {
  const introHtml = overrides.intro
    ? escapeHtml(substituteVars(overrides.intro, buildVarMap(input)))
    : `Hi ${escapeHtml(input.clientName)}, this is a reminder for your upcoming ${escapeHtml(input.companyName)} appointment.`;
  return renderLayout(
    "Booking reminder",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking reminder</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${introHtml}</p>
    ${renderSummary(input)}
    ${renderParticipants(input)}
    ${renderFooter(input, overrides)}`
  );
}

export function renderBookingPlainText(
  heading: string,
  input: BookingEmailTemplateInput,
  overrides: Record<string, string> = {}
) {
  const address = input.addressLines.join(", ");
  const participants = input.participants
    .map(
      (participant) =>
        `${participant.label}: ${formatLabel(
          participant.participantGender
        )} client, ${formatLabel(
          participant.requiredTherapistGender
        )} therapist required, services: ${participant.services.join(", ")}`
    )
    .join("\n");

  const footerLine = overrides.footer_contact
    ? substituteVars(overrides.footer_contact, buildVarMap(input))
    : `${input.contactEmail ? `Contact: ${input.contactEmail}` : ""}${input.contactPhone ? ` ${input.contactPhone}` : ""}`;

  return `${heading}

${input.companyName}
Client: ${input.clientName}
Date: ${formatDate(input.bookingDate)}
Time: ${formatTime(input.startTime)}-${formatTime(input.endTime)}
Address: ${address}
Total: ${formatMoney(input.totalPrice)}
Participants: ${input.participantCount}

${participants}

${input.manageUrl ? `Manage booking: ${input.manageUrl}\n\n` : ""}${footerLine}`;
}

// Async overlay reader — called by the manual-send action (and any future
// caller that wants override-aware rendering). Reads all override rows for a
// given templateId via the service-role client and returns a fieldKey → value
// map.
//
// Silent fallback: if the lookup throws (network error, DB unreachable, table
// missing during a transient state), we log to console.error and return {}.
// This keeps the email path resilient — the worst case is that overrides
// don't apply on this send and the hardcoded defaults render instead.
//
// `getAllOverrides()` is the bulk variant used by the templates UI to
// pre-populate every editable field on page load without a per-template
// round-trip per template.
export async function resolveTemplateOverrides(
  templateId: string
): Promise<Record<string, string>> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("email_template_overrides")
      .select("field_key, value")
      .eq("template_id", templateId);
    if (error) {
      console.error("resolveTemplateOverrides lookup failed:", error.message);
      return {};
    }
    const map: Record<string, string> = {};
    for (const row of (data ?? []) as { field_key: string; value: string }[]) {
      map[row.field_key] = row.value;
    }
    return map;
  } catch (error) {
    console.error("resolveTemplateOverrides threw:", error);
    return {};
  }
}

export async function getAllTemplateOverrides(): Promise<
  Record<string, Record<string, string>>
> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("email_template_overrides")
      .select("template_id, field_key, value");
    if (error) {
      console.error("getAllTemplateOverrides lookup failed:", error.message);
      return {};
    }
    const map: Record<string, Record<string, string>> = {};
    for (const row of (data ?? []) as {
      template_id: string;
      field_key: string;
      value: string;
    }[]) {
      if (!map[row.template_id]) map[row.template_id] = {};
      map[row.template_id][row.field_key] = row.value;
    }
    return map;
  } catch (error) {
    console.error("getAllTemplateOverrides threw:", error);
    return {};
  }
}

// ─── Review request email (C-01) ──────────────────────────────────────────

export interface ReviewRequestEmailInput extends BookingEmailTemplateInput {
  groupCategory: "massage" | "cupping" | null; // null for mixed-category bookings
  city: string | null;
}

export interface ReviewMessageVariant {
  text: string;
  source: "override" | "default";
}

interface PickReviewMessagesArgs {
  groupCategory: "massage" | "cupping" | null;
  city: string | null;
  overrides: Record<string, string>;
  random?: () => number;
}

const DEFAULT_REVIEW_VARIANTS = {
  massage: [
    "I had a brilliant home massage in {city} today — really professional setup, felt completely relaxed by the end.",
    "Booked a home massage with Rahma Therapy in {city}. The therapist was excellent, the experience felt like a proper clinic but in the comfort of home.",
    "Just had a fantastic massage at home in {city}. Highly skilled, deeply relaxing, and so easy not having to travel.",
    "Tried Rahma Therapy for a mobile massage in {city} — top quality. Will definitely book again.",
    "Excellent home massage experience in {city}. Calm, professional, and exactly what I needed.",
  ],
  cupping: [
    "Had a hijama session at home in {city} with Rahma Therapy. Very clean, hygienic, and the practitioner was knowledgeable and respectful.",
    "Booked hijama at home in {city} — proper Sunnah practice, sterile equipment, and a calming atmosphere. Highly recommend.",
    "Excellent home hijama appointment in {city}. Felt looked after from start to finish, the setup was spotless and professional.",
    "Tried Rahma Therapy for hijama in {city} and couldn't be happier. Knowledgeable practitioner, careful technique, and great aftercare.",
    "First hijama session in {city} and it was a brilliant experience. Clean, professional, and the practitioner explained every step.",
  ],
} as const;

// Picks 3 of the 5 pooled sample review sentences for the booking's service
// category, substituting an operator-configured override where present, then
// substituting {city}. Mixed-category bookings (groupCategory null) fall back
// to the massage pool (C-01 brief §5.3 — impl-time decision).
export function pickReviewMessages(
  args: PickReviewMessagesArgs
): ReviewMessageVariant[] {
  const { groupCategory, city, overrides, random = Math.random } = args;
  const category = groupCategory ?? "massage";

  const pool: ReviewMessageVariant[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = `${category}_variant_${i}`;
    const overrideValue = overrides[key];
    if (overrideValue) {
      pool.push({ text: overrideValue, source: "override" });
    } else {
      pool.push({ text: DEFAULT_REVIEW_VARIANTS[category][i - 1], source: "default" });
    }
  }

  // Shuffle and pick 3.
  const shuffled = [...pool].sort(() => random() - 0.5);
  const picked = shuffled.slice(0, 3);

  return picked.map((variant) => ({
    ...variant,
    text: substituteCity(variant.text, city),
  }));
}

// Replaces {city}; if city is null, strips the surrounding " in {city}"
// phrasing cleanly rather than leaving a dangling placeholder.
function substituteCity(text: string, city: string | null): string {
  if (city) return text.replace(/\{city\}/g, city);
  return text.replace(/\s+in\s+\{city\}/g, "").replace(/\{city\}/g, "");
}

// The six review_request_client fields an admin can override, with their
// hardcoded fallback defaults. Single source of truth for both
// renderReviewRequestEmail (HTML) and renderReviewRequestPlainText — the two
// legs previously hand-copied these and drifted (C-01 seam-review fix).
const REVIEW_REQUEST_DEFAULT_FIELDS = {
  subject: "Thank you for visiting Rahma Therapy",
  body_intro:
    "Thank you for choosing Rahma Therapy for your {service_name}. We hope you felt looked after from start to finish.",
  body_ask:
    "If you have a moment, we'd be grateful for an honest review on Google. It helps other people in {city} find us.",
  body_cta_label: "Leave a Google review",
  body_cta_url: "https://g.page/r/Ccfwk27JycKDEBM/review",
  body_signoff: "Thank you again,\nThe Rahma Therapy team",
} as const;

function resolveReviewRequestFields(overrides: Record<string, string>) {
  return {
    subject: overrides.subject ?? REVIEW_REQUEST_DEFAULT_FIELDS.subject,
    body_intro: overrides.body_intro ?? REVIEW_REQUEST_DEFAULT_FIELDS.body_intro,
    body_ask: overrides.body_ask ?? REVIEW_REQUEST_DEFAULT_FIELDS.body_ask,
    body_cta_label:
      overrides.body_cta_label ?? REVIEW_REQUEST_DEFAULT_FIELDS.body_cta_label,
    body_cta_url: overrides.body_cta_url ?? REVIEW_REQUEST_DEFAULT_FIELDS.body_cta_url,
    body_signoff: overrides.body_signoff ?? REVIEW_REQUEST_DEFAULT_FIELDS.body_signoff,
  };
}

export async function renderReviewRequestEmail(
  input: ReviewRequestEmailInput
): Promise<string> {
  const overrides = await resolveTemplateOverrides("review_request_client");
  const variants = pickReviewMessages({
    groupCategory: input.groupCategory,
    city: input.city,
    overrides,
  });

  const fields = resolveReviewRequestFields(overrides);

  const vars = buildVarMap(input, {
    city: input.city ?? "",
    service_name: input.participants[0]?.services?.[0] ?? "appointment",
  });

  const intro = substituteVars(fields.body_intro, vars);
  const ask = substituteVars(fields.body_ask, vars);
  const signoff = substituteVars(fields.body_signoff, vars);

  return renderLayout(
    fields.subject,
    `<p>${escapeHtml(intro)}</p>
      <p>${escapeHtml(ask)}</p>

      <p style="margin-top:24px;font-weight:600;">Here are a few example reviews if you'd like a starting point — or write your own, whatever feels honest:</p>
      <ul style="padding-left:18px;">
        ${variants.map((v) => `<li style="margin-bottom:8px;">${escapeHtml(v.text)}</li>`).join("")}
      </ul>

      <p style="margin:24px 0;">
        <a href="${escapeHtml(fields.body_cta_url)}" style="display:inline-block;background:#0f5e8e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          ${escapeHtml(fields.body_cta_label)}
        </a>
      </p>

      <p style="white-space:pre-line;">${escapeHtml(signoff)}</p>`
  );
}

// Plain-text equivalent of renderReviewRequestEmail. Kept as a separate
// function rather than folded into renderBookingPlainText (C-01 plan Step 8
// decision (b) — cleaner separation since the review email's shape doesn't
// match the generic booking-summary layout the shared plain-text renderer
// produces). Resolves the same six admin-editable fields as
// renderReviewRequestEmail via resolveReviewRequestFields, so the two legs
// share one source of truth for overrides and defaults (C-01 seam-review fix
// — this leg previously hardcoded intro/ask/CTA/signoff as string literals).
export function renderReviewRequestPlainText(
  input: ReviewRequestEmailInput,
  variants: ReviewMessageVariant[],
  overrides: Record<string, string> = {}
): string {
  const fields = resolveReviewRequestFields(overrides);

  const vars = buildVarMap(input, {
    city: input.city ?? "",
    service_name: input.participants[0]?.services?.[0] ?? "appointment",
  });

  // substituteCity first so an "in {city}" clause (default body_ask, or an
  // admin override that follows the same convention) drops gracefully when
  // there's no city, rather than leaving a blank gap; substituteVars then
  // fills the rest (service_name, and city itself when present) so no
  // {varName} placeholder can survive into the sent plain-text body.
  const resolveField = (template: string) =>
    substituteVars(substituteCity(template, input.city), vars);

  const intro = resolveField(fields.body_intro);
  const ask = resolveField(fields.body_ask);
  const signoff = resolveField(fields.body_signoff);

  return `${intro}

${ask}

Here are a few examples if you'd like a starting point, or write your own:
${variants.map((v) => `- ${v.text}`).join("\n")}

${fields.body_cta_label}: ${fields.body_cta_url}

${signoff}
`;
}

// ─── Booking confirmed — client email (C-08) ─────────────────────────────
// Sent when an admin moves a booking from pending → confirmed
// (quickUpdateBooking / updateBookingManagement). HTML and plain-text legs
// resolve the same three admin-editable fields through one shared defaults
// object — the C-01 seam-review lesson: a plain-text leg that hardcodes copy
// the HTML leg makes editable silently drops an admin's override on that leg.

const BOOKING_CONFIRMED_CLIENT_DEFAULT_FIELDS = {
  body_intro:
    "Hi {clientName}, your appointment on {bookingDate} at {startTime} is confirmed. We'll send a reminder closer to the day.",
  body_cta_label: "Manage your booking",
  body_signoff: "Thank you,\nThe Rahma Therapy team",
} as const;

function resolveBookingConfirmedClientFields(overrides: Record<string, string>) {
  return {
    body_intro:
      overrides.body_intro ?? BOOKING_CONFIRMED_CLIENT_DEFAULT_FIELDS.body_intro,
    body_cta_label:
      overrides.body_cta_label ?? BOOKING_CONFIRMED_CLIENT_DEFAULT_FIELDS.body_cta_label,
    body_signoff:
      overrides.body_signoff ?? BOOKING_CONFIRMED_CLIENT_DEFAULT_FIELDS.body_signoff,
  };
}

export async function renderBookingConfirmedClientEmail(
  input: BookingEmailTemplateInput
): Promise<string> {
  const overrides = await resolveTemplateOverrides("booking_confirmed_client");
  const fields = resolveBookingConfirmedClientFields(overrides);
  const vars = buildVarMap(input);

  const introHtml = escapeHtml(substituteVars(fields.body_intro, vars));
  const signoffHtml = escapeHtml(substituteVars(fields.body_signoff, vars));
  const manageLink = input.manageUrl
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(
        input.manageUrl
      )}" style="display:inline-block;background:#0f5e8e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">${escapeHtml(
        fields.body_cta_label
      )}</a></p>`
    : "";

  return renderLayout(
    "Your booking is confirmed",
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Your booking is confirmed</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${introHtml}</p>
    ${renderSummary(input)}
    ${manageLink}
    <p style="white-space:pre-line;margin:18px 0 0;font-size:14px;line-height:1.5;color:#53615d;">${signoffHtml}</p>
    ${renderFooter(input, overrides)}`
  );
}

// Plain-text equivalent of renderBookingConfirmedClientEmail. Resolves the
// same three fields via resolveBookingConfirmedClientFields, so an admin
// override applies identically to both legs (see the C-01 lesson above).
export function renderBookingConfirmedClientPlainText(
  input: BookingEmailTemplateInput,
  overrides: Record<string, string> = {}
): string {
  const fields = resolveBookingConfirmedClientFields(overrides);
  const vars = buildVarMap(input);

  const intro = substituteVars(fields.body_intro, vars);
  const signoff = substituteVars(fields.body_signoff, vars);
  const footerLine = overrides.footer_contact
    ? substituteVars(overrides.footer_contact, vars)
    : `${input.contactEmail ? `Contact: ${input.contactEmail}` : ""}${input.contactPhone ? ` ${input.contactPhone}` : ""}`;

  return `Your booking is confirmed

${intro}

${input.manageUrl ? `${fields.body_cta_label}: ${input.manageUrl}\n\n` : ""}${signoff}

${footerLine}`;
}

// ─── Password-reset email templates ──────────────────────────────────────────
// FAKE: structure only. Real Resend send wiring lands with
// BUILD-password-reset-email-templates.md (BLOCKS-REDESIGN, Phase 6 Layer 0 #2).
// The on-page voice (see /redesign/briefs/password-reset-brief.md §11) and the
// email-template voice must stay aligned; cross-brief consistency is checked at
// Phase 7 Gate 2 clarify.

export interface PasswordResetApprovedEmailInput {
  companyName: string;
  recipientName: string;
  resetLinkUrl: string;
  expiresInHours: number;
}

export interface PasswordResetRejectedEmailInput {
  companyName: string;
  recipientName: string;
  reviewerNote: string | null;
  retryUrl: string;
}

export function renderPasswordResetApprovedSubject(): string {
  return "Your password-reset request has been approved";
}

export function renderPasswordResetApprovedHtml(
  input: PasswordResetApprovedEmailInput
): string {
  // escapeHtml is already defined at the top of this file.
  const name = escapeHtml(input.recipientName);
  const company = escapeHtml(input.companyName);
  const url = escapeHtml(input.resetLinkUrl);
  return `<!DOCTYPE html>
<html lang="en">
  <body style="font-family: 'Work Sans', Arial, sans-serif; color: #313731; background: #fbf8f2; padding: 32px;">
    <div style="max-width: 480px; margin: 0 auto; background: #fffefa; border: 1px solid #e8dfd3; border-radius: 10px; padding: 32px;">
      <h1 style="font-family: 'Urbanist', Arial, sans-serif; color: #151b18; font-size: 1.5rem; margin: 0 0 16px;">Your password-reset request has been approved</h1>
      <p style="margin: 0 0 16px;">Hi ${name},</p>
      <p style="margin: 0 0 16px;">An Owner has approved your password-reset request. Use the link below to set a new password. The link works for ${input.expiresInHours} hours.</p>
      <p style="margin: 24px 0;"><a href="${url}" style="display: inline-block; background: #0f5e8e; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Set a new password</a></p>
      <p style="margin: 0 0 16px; color: #5e625e; font-size: 0.875rem;">If the button doesn't work, paste this address into your browser: ${url}</p>
      <p style="margin: 24px 0 0; color: #5e625e; font-size: 0.875rem;">${company} staff portal.</p>
    </div>
  </body>
</html>`;
}

export function renderPasswordResetApprovedText(
  input: PasswordResetApprovedEmailInput
): string {
  return `Your password-reset request has been approved

Hi ${input.recipientName},

An Owner has approved your password-reset request. Use the link below to set a new password. The link works for ${input.expiresInHours} hours.

Set a new password: ${input.resetLinkUrl}

${input.companyName} staff portal.`;
}

export function renderPasswordResetRejectedSubject(): string {
  return "Update on your password-reset request";
}

export function renderPasswordResetRejectedHtml(
  input: PasswordResetRejectedEmailInput
): string {
  const name = escapeHtml(input.recipientName);
  const company = escapeHtml(input.companyName);
  const retry = escapeHtml(input.retryUrl);
  const note = input.reviewerNote ? escapeHtml(input.reviewerNote) : null;
  const noteBlock = note
    ? `<div style="margin: 16px 0; padding: 16px; background: #fbf8f2; border: 1px solid #e8dfd3; border-radius: 8px;"><p style="margin: 0 0 8px; font-weight: 500; color: #313731;">Note from the reviewer:</p><p style="margin: 0; white-space: pre-wrap;">${note}</p></div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
  <body style="font-family: 'Work Sans', Arial, sans-serif; color: #313731; background: #fbf8f2; padding: 32px;">
    <div style="max-width: 480px; margin: 0 auto; background: #fffefa; border: 1px solid #e8dfd3; border-radius: 10px; padding: 32px;">
      <h1 style="font-family: 'Urbanist', Arial, sans-serif; color: #151b18; font-size: 1.5rem; margin: 0 0 16px;">Update on your password-reset request</h1>
      <p style="margin: 0 0 16px;">Hi ${name},</p>
      <p style="margin: 0 0 16px;">An Owner reviewed your request and decided not to approve it this time.</p>
      ${noteBlock}
      <p style="margin: 24px 0;"><a href="${retry}" style="display: inline-block; background: #0f5e8e; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Submit a new request</a></p>
      <p style="margin: 24px 0 0; color: #5e625e; font-size: 0.875rem;">${company} staff portal.</p>
    </div>
  </body>
</html>`;
}

export function renderPasswordResetRejectedText(
  input: PasswordResetRejectedEmailInput
): string {
  const noteBlock = input.reviewerNote
    ? `\n\nNote from the reviewer:\n${input.reviewerNote}`
    : "";
  return `Update on your password-reset request

Hi ${input.recipientName},

An Owner reviewed your request and decided not to approve it this time.${noteBlock}

Submit a new request: ${input.retryUrl}

${input.companyName} staff portal.`;
}
