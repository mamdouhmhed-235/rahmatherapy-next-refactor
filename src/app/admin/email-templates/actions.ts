"use server";

// Real wiring for the email-templates tab — Session 2 of the engineering
// pause. Replaces the FAKE shim that Phase 6 session 21 (commit 32c668b)
// shipped alongside the UI.
//
// Companion pieces:
//   - email_template_overrides table             (migration 20260519120000)
//   - GRANT SELECT to authenticated              (migration 20260519121000)
//   - manage_email_templates permission row      (in migration 20260519120000)
//   - role grant for manage_email_templates      (TBD via Session 2 role-grant migration)

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PERMISSIONS,
  PermissionError,
  requirePermission,
} from "@/lib/auth/rbac";
import {
  getFromEmail,
  sendEmail,
  EmailDeliveryError,
  EmailConfigurationError,
} from "@/lib/email/client";
import {
  renderAdminBookingCancellationEmail,
  renderAdminBookingNotificationEmail,
  renderAdminRescheduleRequestEmail,
  renderBookingCancellationEmail,
  renderBookingConfirmationEmail,
  renderBookingPlainText,
  renderBookingReminderEmail,
  renderStaffAssignmentEmail,
  renderStaffBookingChangeEmail,
  resolveTemplateOverrides,
  type BookingEmailTemplateInput,
} from "@/lib/email/templates";
import { findTemplate, type TemplateMeta } from "../emails/components/templates-data";

export interface SaveTemplateOverrideResult {
  ok: boolean;
  error?: string;
  /** Per-field map of the values actually stored (after HTML stripping). The
   *  edit form uses this to update the textarea/input contents in place so the
   *  user sees the cleaned text immediately, without waiting for a reload. */
  cleanedValues?: Record<string, string>;
}

export interface SendTemplateManuallyResult {
  ok: boolean;
  error?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minimal HTML strip per the BUILD-email-templates-actions plan. The codebase
// has no DOMPurify/striptags equivalent and storing as plain text is the rule.
// Final defense at render time is escapeHtml — the override value is always
// passed through escapeHtml before injection into a `<p>` text body, so this
// strip is cosmetic + storage hygiene, not a security boundary.
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

// Subject lines mirror the existing render*Email() <title> values verbatim.
const SUBJECTS: Record<string, string> = {
  booking_confirmation: "Booking request received",
  booking_cancellation_client: "Booking cancelled",
  booking_reminder: "Booking reminder",
  booking_plain_text: "Booking confirmation",
  staff_assignment: "Booking assignment",
  staff_booking_change: "Assigned booking changed",
  admin_booking_notification: "New booking request",
  admin_booking_cancellation: "Booking cancellation",
  admin_reschedule_request: "Reschedule request",
  review_request_client: "Thank you for visiting Rahma Therapy",
  booking_confirmed_client: "Your booking is confirmed",
};

export async function saveTemplateOverride(
  _previousState: SaveTemplateOverrideResult | null,
  formData: FormData
): Promise<SaveTemplateOverrideResult> {
  // Permission gate — throws on unauthenticated / inactive / forbidden.
  const supabase = await createSupabaseServerClient();
  let actor;
  try {
    actor = await requirePermission(PERMISSIONS.MANAGE_EMAIL_TEMPLATES, supabase);
  } catch (error) {
    if (error instanceof PermissionError) {
      return { ok: false, error: "Insufficient permissions." };
    }
    throw error;
  }

  const templateId = String(formData.get("template_id") ?? "");
  const template = findTemplate(templateId);
  if (!template) {
    return { ok: false, error: "Unknown template." };
  }

  // Validate every submitted field before touching the DB so a single bad
  // field doesn't leave the table in a half-saved state.
  const cleanedFields: { field: (typeof template.fields)[number]; value: string }[] = [];
  for (const field of template.fields) {
    const raw = formData.get(`field:${field.kind}`);
    if (raw == null) continue;
    const cleaned = stripHtmlTags(String(raw));
    if (cleaned.length > field.maxLength) {
      return {
        ok: false,
        error: `Trim "${field.label}" to ${field.maxLength} characters or fewer.`,
      };
    }
    cleanedFields.push({ field, value: cleaned });
  }

  if (cleanedFields.length === 0) {
    // Nothing to do — treat as success (idempotent no-op).
    return { ok: true, cleanedValues: {} };
  }

  const cleanedValues: Record<string, string> = {};
  for (const { field, value } of cleanedFields) cleanedValues[field.kind] = value;

  const adminClient = createSupabaseAdminClient();

  // Per-field upsert (non-empty) or delete (empty after strip). One audit row
  // per field actually modified — matches the BUILD plan's
  // `metadata = { template_id, field_key }` shape (singular field_key).
  for (const { field, value } of cleanedFields) {
    // Read existing for before_state.
    const { data: beforeRow } = await adminClient
      .from("email_template_overrides")
      .select("id, value, updated_by, updated_at")
      .eq("template_id", templateId)
      .eq("field_key", field.kind)
      .maybeSingle();

    if (value === "") {
      // Empty after strip → user cleared the field → revert to default by
      // deleting any existing override row. If nothing existed, no-op.
      if (!beforeRow) continue;

      const { error: deleteError } = await adminClient
        .from("email_template_overrides")
        .delete()
        .eq("id", beforeRow.id);
      if (deleteError) {
        return { ok: false, error: deleteError.message };
      }

      // Audit — fire-and-forget Sentry-style fallback (never user-surfaced).
      const auditResult = await adminClient.from("audit_logs").insert({
        actor_staff_id: actor.id,
        action_type: "email_template_override_saved",
        target_type: "email_template_overrides",
        target_id: beforeRow.id,
        before_state: beforeRow,
        after_state: { template_id: templateId, field_key: field.kind, deleted: true },
      });
      if (auditResult.error) {
        console.error(
          "email_template_override_saved audit write failed (delete):",
          auditResult.error.message
        );
      }
      continue;
    }

    // Non-empty → upsert.
    const { data: upserted, error: upsertError } = await adminClient
      .from("email_template_overrides")
      .upsert(
        {
          template_id: templateId,
          field_key: field.kind,
          value,
          updated_by: actor.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "template_id,field_key" }
      )
      .select()
      .single();

    if (upsertError) {
      return { ok: false, error: upsertError.message };
    }

    const auditResult = await adminClient.from("audit_logs").insert({
      actor_staff_id: actor.id,
      action_type: "email_template_override_saved",
      target_type: "email_template_overrides",
      target_id: upserted.id,
      before_state: beforeRow ?? null,
      after_state: { template_id: templateId, field_key: field.kind, value },
    });
    if (auditResult.error) {
      console.error(
        "email_template_override_saved audit write failed (upsert):",
        auditResult.error.message
      );
    }
  }

  // Refresh the emails page so a navigation back finds the updated values.
  revalidatePath("/admin/emails");
  return { ok: true, cleanedValues };
}

export async function sendTemplateManually(
  _previousState: SendTemplateManuallyResult | null,
  formData: FormData
): Promise<SendTemplateManuallyResult> {
  const supabase = await createSupabaseServerClient();
  let actor;
  try {
    actor = await requirePermission(PERMISSIONS.MANAGE_EMAIL_TEMPLATES, supabase);
  } catch (error) {
    if (error instanceof PermissionError) {
      return { ok: false, error: "Insufficient permissions." };
    }
    throw error;
  }

  const templateId = String(formData.get("template_id") ?? "");
  const template = findTemplate(templateId);
  if (!template) {
    return { ok: false, error: "template_not_found" };
  }

  const recipient = String(formData.get("recipient_email") ?? "").trim();
  if (!EMAIL_PATTERN.test(recipient)) {
    return {
      ok: false,
      error: "That email doesn't look right. Use the format name@example.com.",
    };
  }

  // Pull var:* fields the ManualSendSheet submits per-template.
  const vars: Record<string, string> = {};
  for (const [key, val] of formData.entries()) {
    if (typeof val !== "string") continue;
    if (!key.startsWith("var:")) continue;
    vars[key.slice(4)] = val;
  }

  // Required-field check — every runtime spec in ManualSendSheet has at least
  // client_name. We mirror the per-template required set here so the server
  // catches missing context even if the client validation was bypassed.
  const requiredVars = requiredVarsFor(templateId);
  const missing = requiredVars.filter((name) => !vars[name]?.trim());
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing template variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    };
  }

  const adminClient = createSupabaseAdminClient();

  // Pull contact + company defaults from business_settings; fall back if
  // unavailable (test envs without the seed row).
  const { data: settings } = await adminClient
    .from("business_settings")
    .select("company_name, contact_email, contact_phone")
    .eq("id", 1)
    .maybeSingle();

  // Build a BookingEmailTemplateInput from the var:* fields + business
  // settings + sensible test-send defaults. Real-booking lookup is a future
  // feature; the manual-send sheet still carries a FAKE marker on its
  // booking-picker select to signal that.
  const baseInput: BookingEmailTemplateInput = {
    companyName: settings?.company_name ?? "Rahma Therapy",
    clientName: vars.client_name ?? "(test client)",
    bookingDate: vars.booking_date ?? "2026-01-01",
    startTime: vars.booking_time ?? "00:00",
    endTime: addHourClamped(vars.booking_time ?? "00:00"),
    addressLines: ["(Test send — no booking selected.)"],
    totalPrice: 0,
    participantCount: 1,
    participants: [
      {
        label: "Participant 1",
        participantGender: "female",
        requiredTherapistGender: "female",
        services: [],
        assignedStaffName: vars.therapist_name ?? null,
      },
    ],
    manageUrl: undefined,
    customerNotes: null,
    contactEmail: settings?.contact_email ?? null,
    contactPhone: settings?.contact_phone ?? null,
  };

  // Resolve overrides for THIS template only.
  let overrides: Record<string, string>;
  try {
    overrides = await resolveTemplateOverrides(templateId);
  } catch (error) {
    console.error("resolveTemplateOverrides threw inside sendTemplateManually:", error);
    overrides = {};
  }

  // Per-template HTML + plain-text bodies + subject.
  const subject = SUBJECTS[templateId] ?? template.cardName;
  let html: string;
  let text: string;
  try {
    ({ html, text } = renderForTemplate(template, baseInput, vars, overrides));
  } catch (error) {
    console.error("renderForTemplate threw:", error);
    return { ok: false, error: "Couldn't render the template. Check the logs." };
  }

  // Resend send. Failure → return error, no audit row written.
  let messageId: string | null = null;
  try {
    // Cheap startup check that the From address is configured before we burn
    // a Resend call.
    getFromEmail();
    const result = await sendEmail({ to: recipient, subject, html, text });
    messageId = result?.id ?? null;
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      return { ok: false, error: `Email configuration: ${error.message}` };
    }
    if (error instanceof EmailDeliveryError) {
      return { ok: false, error: `Email delivery failed: ${error.message}` };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Email send failed.",
    };
  }

  // Audit on success. Failure here is logged but does NOT undo the send.
  const auditResult = await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "email_template_sent_manually",
    target_type: "email_templates",
    target_id: null,
    after_state: {
      template_id: templateId,
      recipient_email: recipient,
      resend_message_id: messageId,
    },
  });
  if (auditResult.error) {
    console.error(
      "email_template_sent_manually audit write failed:",
      auditResult.error.message
    );
  }

  return { ok: true };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function requiredVarsFor(templateId: string): string[] {
  // Mirrors runtimeFieldsFor() in ManualSendSheet.tsx. Server-side defense
  // against bypassed client validation.
  switch (templateId) {
    case "booking_confirmation":
    case "booking_cancellation_client":
    case "booking_reminder":
    case "booking_plain_text":
      return ["client_name", "booking_date", "booking_time"];
    case "staff_assignment":
      return ["therapist_name", "client_name", "booking_date", "booking_time"];
    case "staff_booking_change":
      return ["therapist_name", "client_name", "booking_date", "change_summary"];
    case "admin_booking_notification":
      return ["client_name", "booking_id", "booking_date"];
    case "admin_booking_cancellation":
      return ["client_name", "booking_id"];
    case "admin_reschedule_request":
      return ["client_name", "booking_id", "requested_date", "requested_time"];
    default:
      return ["client_name"];
  }
}

function addHourClamped(time: string): string {
  // Best-effort +1h for the manual-send fallback. Format HH:MM, clamp at 23:59.
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const h = Number(match[1]);
  const m = match[2];
  const next = Math.min(h + 1, 23);
  return `${String(next).padStart(2, "0")}:${m}`;
}

function plainTextFallback(html: string): string {
  // Naive HTML → text for the Resend `text` fallback on HTML templates.
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function renderForTemplate(
  template: TemplateMeta,
  baseInput: BookingEmailTemplateInput,
  vars: Record<string, string>,
  overrides: Record<string, string>
): { html: string; text: string } {
  switch (template.id) {
    case "booking_confirmation": {
      const html = renderBookingConfirmationEmail(baseInput, overrides);
      return { html, text: plainTextFallback(html) };
    }
    case "booking_cancellation_client": {
      const html = renderBookingCancellationEmail(baseInput, overrides);
      return { html, text: plainTextFallback(html) };
    }
    case "booking_reminder": {
      const html = renderBookingReminderEmail(baseInput, overrides);
      return { html, text: plainTextFallback(html) };
    }
    case "booking_plain_text": {
      const text = renderBookingPlainText("Booking confirmation", baseInput, overrides);
      const html = `<!doctype html><html><body style="font-family:'IBM Plex Mono',Menlo,monospace;white-space:pre-wrap;">${text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</body></html>`;
      return { html, text };
    }
    case "staff_assignment": {
      const html = renderStaffAssignmentEmail(baseInput, overrides);
      return { html, text: plainTextFallback(html) };
    }
    case "staff_booking_change": {
      const html = renderStaffBookingChangeEmail(
        { ...baseInput, changeSummary: vars.change_summary ?? "" },
        overrides
      );
      return { html, text: plainTextFallback(html) };
    }
    case "admin_booking_notification": {
      const html = renderAdminBookingNotificationEmail(
        {
          ...baseInput,
          bookingId: vars.booking_id ?? "",
          clientEmail: null,
          clientPhone: null,
        },
        overrides
      );
      return { html, text: plainTextFallback(html) };
    }
    case "admin_booking_cancellation": {
      const html = renderAdminBookingCancellationEmail(
        {
          ...baseInput,
          bookingId: vars.booking_id ?? "",
          initiatedBy: "customer",
          cancellationNote: null,
        },
        overrides
      );
      return { html, text: plainTextFallback(html) };
    }
    case "admin_reschedule_request": {
      const html = renderAdminRescheduleRequestEmail(
        {
          ...baseInput,
          bookingId: vars.booking_id ?? "",
          requestedDate: vars.requested_date ?? baseInput.bookingDate,
          requestedTime: vars.requested_time ?? baseInput.startTime,
          requestNote: null,
        },
        overrides
      );
      return { html, text: plainTextFallback(html) };
    }
    default:
      throw new Error(`unknown template id: ${template.id}`);
  }
}
