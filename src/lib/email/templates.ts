// SERVER ONLY - do not import from client components.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
// templates-data.ts is client-safe (metadata only) — server files may import
// it freely; the reverse (templates.ts from a client component) is what's
// forbidden.
import { findTemplate } from "@/app/admin/emails/components/templates-data";

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

// C-08 Phase B (security review) — `body_cta_url` is the one admin-editable
// field that lands in a real `<a href>`. escapeHtml blocks attribute
// breakout but does not constrain the scheme, so an unvalidated override
// could point a transactional email's button at `javascript:` or any other
// destination. Used both here as render-time defence-in-depth (a value
// already in the DB cannot bypass this) and by saveTemplateOverride as the
// save-time gate.
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
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

// Build the variable map an override string can reference. Extra `extras`
// lets per-template callers add fields (changeSummary, bookingId,
// requestedDate, requestedTime) without inflating the base
// BookingEmailTemplateInput.
//
// C-15 closeout fix round — exported so notifications.ts can pass
// resolveSubject() the SAME vars object a template's body fields get,
// rather than a second, hand-picked subset (brief §10 AC2: "an override
// should go through the same substituteVars treatment the body fields
// get"). Each notifications.ts call site passes the identical `extras` its
// neighbouring render*Email(...) call already builds for that template.
export function buildVarMap(
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

// C-15 Phase A — single source of truth for a field's default text. Reads
// the registry (templates-data.ts) rather than a locally-duplicated literal,
// so the editor/preview/reset UI (later phases) and real sends can never
// disagree. Only used where a field's true runtime default is a single
// deterministic string (see the per-field comments in templates-data.ts for
// the handful of fields — group_copy, footer_contact, booking_restored's
// greeting_intro — whose default genuinely branches on data and stays
// inline instead).
//
// C-15 Phase B fix — every call site below reads `overrides.x || fieldDefault(...)`,
// NOT `??`. `??` only falls back on null/undefined, so a stored/draft override
// of "" would win and render a blank paragraph. "Empty means default" is the
// established semantic everywhere else (saveTemplateOverride deletes the row
// on an empty value rather than storing ""), and the Phase B draft-merge path
// can hand this function a live "" the moment a user clears a field in the
// editor — so the fallback here must treat "" the same as missing.
function fieldDefault(templateId: string, fieldKind: string): string {
  const field = findTemplate(templateId)?.fields.find((f) => f.kind === fieldKind);
  if (!field) {
    throw new Error(
      `fieldDefault: no registry field '${fieldKind}' on template '${templateId}'`
    );
  }
  return field.defaultValue;
}

// C-15 Phase A (item 1) — subjects become editable on every template, which
// reopens a header-injection surface C-08 Phase B deliberately left closed
// (subjects were hardcoded literals, so \r/\n in an override couldn't reach
// anything). saveTemplateOverride rejects C0 control characters at save
// time (mirrors body_cta_url's save-time scheme check); this is the
// render-time fallback guard so a row already in the DB — pre-dating that
// guard, or written by any future direct-write path — still can't carry a
// control character into rendered output. Mirrors isHttpsUrl's
// defence-in-depth pattern above.
export function hasControlChars(value: string): boolean {
  return /[\x00-\x1f]/.test(value);
}

// Renamed from `resolveSubject` in the C-15 closeout fix round (see the
// exported `resolveSubject` below) — this one feeds ONLY `renderLayout()`'s
// `<title>` argument. Its fallback (`fieldDefault`, i.e. the SafeField-level
// `defaultValue` a `subjectField()` call sets) is deliberately untouched by
// the closeout round: that string is captured byte-for-byte in the
// render-parity fixture (registry-defaults.test.ts), which this fix round
// must not change. Left exactly as Phase A shipped it.
function resolveTitleSubject(templateId: string, overrides: Record<string, string>): string {
  const value = overrides.subject;
  if (value && !hasControlChars(value)) return value;
  return fieldDefault(templateId, "subject");
}

// C-15 closeout fix round (blocking finding — brief §10 AC2) — the subject
// real sends (notifications.ts) and "Send me a test" (email-templates/
// actions.ts's sendTestEmail) actually use. Previously both hardcoded their
// own literal/duplicate logic and ignored the admin's override entirely;
// see the C-15 progress file for the full audit.
//
// Deliberately reads `TemplateMeta.subjectDefault` (the top-level registry
// field), NOT `fieldDefault(templateId, "subject")` above. The two used to
// hold identical text by convention (both set from the same string passed
// to `subjectField(...)` in templates-data.ts) but that was never load-
// bearing until now — `subjectDefault` was read only by the now-deleted
// `resolveTestSubject()` duplicate. This closeout round corrects
// `subjectDefault` ALONE to match each template's live Subject: header
// (including the parts that were already dynamic, e.g. "{companyName}
// booking request received") — correcting `fieldDefault`'s SafeField value
// instead would also change `<title>`'s default text and break the parity
// fixture. See templates-data.ts's TemplateMeta.subjectDefault doc comment.
//
// Same override-or-default + control-character guard as
// `resolveTitleSubject` above (mirrors `isHttpsUrl`'s defence-in-depth
// pattern: saveTemplateOverride rejects C0 control characters at save time;
// this is the render-time fallback so a row already in the DB — pre-dating
// that guard — still can't carry one into a real Subject: header). The
// picked raw string then runs through the SAME `substituteVars` treatment
// body fields get, via the caller-supplied `vars`, so an admin-authored
// override (or the corrected default) can reference `{clientName}`,
// `{companyName}`, `{bookingDate}`, `{therapistName}` etc. exactly like any
// other field. An unrecognised `{token}` — one not present in `vars` — is
// left literal (brief §5.3), matching every other substituteVars call site.
export function resolveSubject(
  templateId: string,
  overrides: Record<string, string>,
  vars: Record<string, unknown> = {}
): string {
  const template = findTemplate(templateId);
  if (!template) {
    throw new Error(`resolveSubject: unknown template '${templateId}'`);
  }
  const value = overrides.subject;
  const raw = value && !hasControlChars(value) ? value : template.subjectDefault;
  return substituteVars(raw, vars);
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
  const greetingIntroHtml = escapeHtml(
    substituteVars(
      overrides.greeting_intro || fieldDefault("booking_confirmation", "greeting_intro"),
      vars
    )
  );
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

  const subject = resolveTitleSubject("booking_confirmation", overrides);
  return renderLayout(
    subject,
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
    resolveTitleSubject("admin_booking_notification", overrides),
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
  const greetingIntroHtml = escapeHtml(
    substituteVars(
      overrides.greeting_intro || fieldDefault("booking_cancellation_client", "greeting_intro"),
      buildVarMap(input)
    )
  );
  return renderLayout(
    resolveTitleSubject("booking_cancellation_client", overrides),
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
    resolveTitleSubject("booking_restored_client", overrides),
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
    resolveTitleSubject("admin_booking_cancellation", overrides),
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
    resolveTitleSubject("admin_reschedule_request", overrides),
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
  const introHtml = escapeHtml(
    substituteVars(overrides.intro || fieldDefault("staff_assignment", "intro"), buildVarMap(input))
  );
  return renderLayout(
    resolveTitleSubject("staff_assignment", overrides),
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
  const wrapperHtml = escapeHtml(
    substituteVars(
      overrides.wrapper_change_summary || fieldDefault("staff_booking_change", "wrapper_change_summary"),
      vars
    )
  );
  return renderLayout(
    resolveTitleSubject("staff_booking_change", overrides),
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
  const introHtml = escapeHtml(
    substituteVars(overrides.intro || fieldDefault("booking_reminder", "intro"), buildVarMap(input))
  );
  return renderLayout(
    resolveTitleSubject("booking_reminder", overrides),
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

// C-15 Phase E — gallery badge data (brief §2.2, plan Step 17). ONE grouped
// query over email_template_overrides, not one lookup per card: reads
// template_id/updated_at/updated_by for every row, ordered newest-first, and
// keeps only the first (= most recent) row seen per template_id. A template
// with zero rows here is "Default"; presence in the returned map is the sole
// "Customised" signal — the same definition the gallery badge and Phase D's
// resetTemplateToDefault (its own "already using its defaults" check) both
// key off, so the two can never visually disagree.
export interface TemplateOverrideSummary {
  updatedAt: string;
  updatedBy: string | null;
}

export async function getTemplateOverrideSummaries(): Promise<
  Record<string, TemplateOverrideSummary>
> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("email_template_overrides")
      .select("template_id, updated_at, updated_by")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("getTemplateOverrideSummaries lookup failed:", error.message);
      return {};
    }
    const map: Record<string, TemplateOverrideSummary> = {};
    for (const row of (data ?? []) as {
      template_id: string;
      updated_at: string;
      updated_by: string | null;
    }[]) {
      // Rows are ordered updated_at DESC, so the first row seen per
      // template_id is already its most recent — grouping happens here, in
      // one pass over one result set, never via a second per-template query.
      if (!map[row.template_id]) {
        map[row.template_id] = { updatedAt: row.updated_at, updatedBy: row.updated_by };
      }
    }
    return map;
  } catch (error) {
    console.error("getTemplateOverrideSummaries threw:", error);
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

// Picks 3 of the 5 pooled sample review sentences for the booking's service
// category, substituting an operator-configured override where present, then
// substituting {city}. Mixed-category bookings (groupCategory null) fall back
// to the massage pool (C-01 brief §5.3 — impl-time decision).
//
// C-15 Phase A: the 10 pooled defaults now read from the registry
// (fieldDefault) instead of a locally-duplicated DEFAULT_REVIEW_VARIANTS
// object — same literal strings, single source of truth.
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
      pool.push({ text: fieldDefault("review_request_client", key), source: "default" });
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

// The six review_request_client fields an admin can override. C-15 Phase A:
// defaults now read from the registry (fieldDefault) instead of a
// locally-duplicated REVIEW_REQUEST_DEFAULT_FIELDS object — single source of
// truth for both renderReviewRequestEmail (HTML) and
// renderReviewRequestPlainText — the two legs previously hand-copied these
// and drifted (C-01 seam-review fix).
function resolveReviewRequestFields(overrides: Record<string, string>) {
  const id = "review_request_client";
  return {
    subject: resolveTitleSubject(id, overrides),
    body_intro: overrides.body_intro || fieldDefault(id, "body_intro"),
    body_ask: overrides.body_ask || fieldDefault(id, "body_ask"),
    body_cta_label: overrides.body_cta_label || fieldDefault(id, "body_cta_label"),
    // Defence-in-depth: saveTemplateOverride already rejects non-https values
    // at save time, but a row already in the DB (pre-dating that guard) must
    // not reach the href either — fall back to the default rather than trust
    // stored data.
    body_cta_url:
      overrides.body_cta_url && isHttpsUrl(overrides.body_cta_url)
        ? overrides.body_cta_url
        : fieldDefault(id, "body_cta_url"),
    body_signoff: overrides.body_signoff || fieldDefault(id, "body_signoff"),
  };
}

// C-15 Phase B — `providedOverrides` is optional so the live-preview
// draft-merge path (preview/[id]/route.ts) can inject an unsaved draft
// without a DB round-trip; every existing caller passes nothing and falls
// back to the original resolveTemplateOverrides(templateId) read, so
// behaviour at every notifications.ts call site is unchanged.
export async function renderReviewRequestEmail(
  input: ReviewRequestEmailInput,
  providedOverrides?: Record<string, string>
): Promise<string> {
  const overrides = providedOverrides ?? (await resolveTemplateOverrides("review_request_client"));
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

// C-15 Phase A: defaults read from the registry (fieldDefault) instead of a
// locally-duplicated BOOKING_CONFIRMED_CLIENT_DEFAULT_FIELDS object.
function resolveBookingConfirmedClientFields(overrides: Record<string, string>) {
  const id = "booking_confirmed_client";
  return {
    subject: resolveTitleSubject(id, overrides),
    body_intro: overrides.body_intro || fieldDefault(id, "body_intro"),
    body_cta_label: overrides.body_cta_label || fieldDefault(id, "body_cta_label"),
    body_signoff: overrides.body_signoff || fieldDefault(id, "body_signoff"),
  };
}

// C-15 Phase B — optional providedOverrides, see renderReviewRequestEmail's
// comment above for the rationale; every existing caller is unaffected.
export async function renderBookingConfirmedClientEmail(
  input: BookingEmailTemplateInput,
  providedOverrides?: Record<string, string>
): Promise<string> {
  const overrides = providedOverrides ?? (await resolveTemplateOverrides("booking_confirmed_client"));
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
    fields.subject,
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

// ─── Staff unassignment email (C-08) ─────────────────────────────────────
// Sent to the therapist previously assigned to a booking when that
// assignment is removed — either unassigned outright, or reassigned to a
// different therapist (updateBookingAssignment). Same shared-defaults shape
// as the template above.

// C-15 Phase A: defaults read from the registry (fieldDefault) instead of a
// locally-duplicated STAFF_UNASSIGNMENT_DEFAULT_FIELDS object.
function resolveStaffUnassignmentFields(overrides: Record<string, string>) {
  const id = "staff_unassignment";
  return {
    subject: resolveTitleSubject(id, overrides),
    body_intro: overrides.body_intro || fieldDefault(id, "body_intro"),
  };
}

// C-15 Phase B — optional providedOverrides, see renderReviewRequestEmail's
// comment above for the rationale; every existing caller is unaffected.
export async function renderStaffUnassignmentEmail(
  input: BookingEmailTemplateInput & { therapistName: string },
  providedOverrides?: Record<string, string>
): Promise<string> {
  const overrides = providedOverrides ?? (await resolveTemplateOverrides("staff_unassignment"));
  const fields = resolveStaffUnassignmentFields(overrides);
  const vars = buildVarMap(input, { therapistName: input.therapistName });

  const introHtml = escapeHtml(substituteVars(fields.body_intro, vars));

  return renderLayout(
    fields.subject,
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Booking assignment removed</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${introHtml}</p>
    ${renderSummary(input)}
    ${renderFooter(input, overrides)}`
  );
}

// Plain-text equivalent of renderStaffUnassignmentEmail. Resolves the same
// field via resolveStaffUnassignmentFields, so an admin override applies
// identically to both legs (see the C-01 lesson above).
export function renderStaffUnassignmentPlainText(
  input: BookingEmailTemplateInput & { therapistName: string },
  overrides: Record<string, string> = {}
): string {
  const fields = resolveStaffUnassignmentFields(overrides);
  const vars = buildVarMap(input, { therapistName: input.therapistName });

  const intro = substituteVars(fields.body_intro, vars);
  const footerLine = overrides.footer_contact
    ? substituteVars(overrides.footer_contact, vars)
    : `${input.contactEmail ? `Contact: ${input.contactEmail}` : ""}${input.contactPhone ? ` ${input.contactPhone}` : ""}`;

  return `Booking assignment removed

${intro}

${footerLine}`;
}

// ─── Claim notification email — admin (C-08) ─────────────────────────────
// Sent to the admin recipient when a practitioner claims an unassigned slot
// (claimBookingAssignment). Same shared-defaults shape as the templates
// above. The recipient itself is Phase-A-interim — see sendClaimNotificationEmail
// in notifications.ts for the Phase D reroute note.

// C-15 Phase A: defaults read from the registry (fieldDefault) instead of a
// locally-duplicated CLAIM_DEFAULT_FIELDS object.
function resolveClaimFields(overrides: Record<string, string>) {
  const id = "claim";
  return {
    subject: resolveTitleSubject(id, overrides),
    body_intro: overrides.body_intro || fieldDefault(id, "body_intro"),
  };
}

// C-15 Phase B — optional providedOverrides, see renderReviewRequestEmail's
// comment above for the rationale; every existing caller is unaffected.
export async function renderClaimNotificationEmail(
  input: BookingEmailTemplateInput & { therapistName: string },
  providedOverrides?: Record<string, string>
): Promise<string> {
  const overrides = providedOverrides ?? (await resolveTemplateOverrides("claim"));
  const fields = resolveClaimFields(overrides);
  const vars = buildVarMap(input, { therapistName: input.therapistName });

  const introHtml = escapeHtml(substituteVars(fields.body_intro, vars));

  return renderLayout(
    fields.subject,
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Slot claimed</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${introHtml}</p>
    ${renderSummary(input)}
    ${renderFooter(input, overrides)}`
  );
}

// Plain-text equivalent of renderClaimNotificationEmail. Resolves the same
// field via resolveClaimFields, so an admin override applies identically to
// both legs (see the C-01 lesson above).
export function renderClaimNotificationPlainText(
  input: BookingEmailTemplateInput & { therapistName: string },
  overrides: Record<string, string> = {}
): string {
  const fields = resolveClaimFields(overrides);
  const vars = buildVarMap(input, { therapistName: input.therapistName });

  const intro = substituteVars(fields.body_intro, vars);
  const footerLine = overrides.footer_contact
    ? substituteVars(overrides.footer_contact, vars)
    : `${input.contactEmail ? `Contact: ${input.contactEmail}` : ""}${input.contactPhone ? ` ${input.contactPhone}` : ""}`;

  return `Slot claimed

${intro}

${footerLine}`;
}

// ─── Client assigned therapist email (C-08) ──────────────────────────────
// Sent to the client whenever their assignment changes (assign, reassign, or
// claim), so they always know who is coming. Fires from
// claimBookingAssignment and updateBookingAssignment. Same shared-defaults
// shape as the templates above.

// C-15 Phase A: defaults read from the registry (fieldDefault) instead of a
// locally-duplicated CLIENT_ASSIGNED_THERAPIST_DEFAULT_FIELDS object.
function resolveClientAssignedTherapistFields(overrides: Record<string, string>) {
  const id = "client_assigned_therapist";
  return {
    subject: resolveTitleSubject(id, overrides),
    body_intro: overrides.body_intro || fieldDefault(id, "body_intro"),
    body_cta_label: overrides.body_cta_label || fieldDefault(id, "body_cta_label"),
  };
}

// C-15 Phase B — optional providedOverrides, see renderReviewRequestEmail's
// comment above for the rationale; every existing caller is unaffected.
export async function renderClientAssignedTherapistEmail(
  input: BookingEmailTemplateInput & { therapistName: string },
  providedOverrides?: Record<string, string>
): Promise<string> {
  const overrides = providedOverrides ?? (await resolveTemplateOverrides("client_assigned_therapist"));
  const fields = resolveClientAssignedTherapistFields(overrides);
  const vars = buildVarMap(input, { therapistName: input.therapistName });

  const introHtml = escapeHtml(substituteVars(fields.body_intro, vars));
  const manageLink = input.manageUrl
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(
        input.manageUrl
      )}" style="display:inline-block;background:#0f5e8e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">${escapeHtml(
        fields.body_cta_label
      )}</a></p>`
    : "";

  return renderLayout(
    fields.subject,
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">Your therapist is confirmed</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${introHtml}</p>
    ${renderSummary(input)}
    ${manageLink}
    ${renderFooter(input, overrides)}`
  );
}

// Plain-text equivalent of renderClientAssignedTherapistEmail. Resolves the
// same fields via resolveClientAssignedTherapistFields, so an admin override
// applies identically to both legs (see the C-01 lesson above).
export function renderClientAssignedTherapistPlainText(
  input: BookingEmailTemplateInput & { therapistName: string },
  overrides: Record<string, string> = {}
): string {
  const fields = resolveClientAssignedTherapistFields(overrides);
  const vars = buildVarMap(input, { therapistName: input.therapistName });

  const intro = substituteVars(fields.body_intro, vars);
  const footerLine = overrides.footer_contact
    ? substituteVars(overrides.footer_contact, vars)
    : `${input.contactEmail ? `Contact: ${input.contactEmail}` : ""}${input.contactPhone ? ` ${input.contactPhone}` : ""}`;

  return `Your therapist is confirmed

${intro}

${input.manageUrl ? `${fields.body_cta_label}: ${input.manageUrl}\n\n` : ""}${footerLine}`;
}

// ─── Enquiry logged email — admin (C-08 Phase D Step 16) ─────────────────
// Sent to opted-in Owner/Admin recipients when a staff member logs a new
// enquiry (createEnquiry), skipping the logging staff member (skip-self,
// brief §2.7). Not a booking email — enquiries have no booking_id, so this
// template gets its own input shape rather than BookingEmailTemplateInput,
// and the render skips renderSummary/renderParticipants (no booking to
// summarise). Same shared-defaults + resolve*Fields() shape as the
// templates above, so HTML and plain-text legs read one source of truth.

export interface EnquiryEmailTemplateInput {
  companyName: string;
  staffName: string;
  clientName: string;
  contactDetail: string;
  serviceInterest: string | null;
  enquiryUrl: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

// C-15 Phase A: defaults read from the registry (fieldDefault) instead of a
// locally-duplicated ENQUIRY_LOGGED_DEFAULT_FIELDS object.
function resolveEnquiryLoggedFields(overrides: Record<string, string>) {
  const id = "enquiry_logged";
  return {
    subject: resolveTitleSubject(id, overrides),
    body_intro: overrides.body_intro || fieldDefault(id, "body_intro"),
  };
}

// C-15 closeout fix round — exported for the same reason as buildVarMap()
// above: sendEnquiryLoggedEmail (notifications.ts) needs the identical vars
// object renderEnquiryLoggedEmail's body already uses, for resolveSubject().
export function buildEnquiryVarMap(input: EnquiryEmailTemplateInput): Record<string, unknown> {
  return {
    companyName: input.companyName,
    staffName: input.staffName,
    clientName: input.clientName,
    contactDetail: input.contactDetail,
    // A blank fallback here would render "...interested in . View it..." —
    // ungrammatical rather than merely absent — so this one field gets a
    // words fallback instead of buildVarMap's usual null-to-"" behaviour.
    serviceInterest: input.serviceInterest ?? "an unspecified service",
    enquiryUrl: input.enquiryUrl,
  };
}

// Small dedicated footer, not a reuse of renderFooter() above — that helper
// is typed to BookingEmailTemplateInput (requires clientName, bookingDate,
// etc. that an enquiry doesn't have), so widening it would touch a shared,
// working function for every other template's sake. Same visual shape and
// override contract (footer_contact), scoped to this template only.
function renderEnquiryFooter(
  input: EnquiryEmailTemplateInput,
  overrides: Record<string, string>
) {
  let footerLine = "";
  if (overrides.footer_contact) {
    footerLine = escapeHtml(
      substituteVars(overrides.footer_contact, buildEnquiryVarMap(input))
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

// C-15 Phase B — optional providedOverrides, see renderReviewRequestEmail's
// comment above for the rationale; every existing caller is unaffected.
export async function renderEnquiryLoggedEmail(
  input: EnquiryEmailTemplateInput,
  providedOverrides?: Record<string, string>
): Promise<string> {
  const overrides = providedOverrides ?? (await resolveTemplateOverrides("enquiry_logged"));
  const fields = resolveEnquiryLoggedFields(overrides);
  const vars = buildEnquiryVarMap(input);

  const introHtml = escapeHtml(substituteVars(fields.body_intro, vars));

  return renderLayout(
    fields.subject,
    `<h1 style="margin:0;font-size:24px;line-height:1.2;color:#1f2f2b;">New enquiry logged</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#53615d;">${introHtml}</p>
    ${renderEnquiryFooter(input, overrides)}`
  );
}

// Plain-text equivalent of renderEnquiryLoggedEmail. Resolves the same field
// via resolveEnquiryLoggedFields, so an admin override applies identically
// to both legs (see the C-01 lesson above).
export function renderEnquiryLoggedPlainText(
  input: EnquiryEmailTemplateInput,
  overrides: Record<string, string> = {}
): string {
  const fields = resolveEnquiryLoggedFields(overrides);
  const vars = buildEnquiryVarMap(input);

  const intro = substituteVars(fields.body_intro, vars);
  const footerLine = overrides.footer_contact
    ? substituteVars(overrides.footer_contact, vars)
    : `${input.contactEmail ? `Contact: ${input.contactEmail}` : ""}${input.contactPhone ? ` ${input.contactPhone}` : ""}`;

  return `New enquiry logged

${intro}

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
