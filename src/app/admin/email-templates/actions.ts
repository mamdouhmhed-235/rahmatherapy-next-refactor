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
  hasControlChars,
  isHttpsUrl,
  resolveTemplateOverrides,
} from "@/lib/email/templates";
import { SAMPLE_RENDERERS } from "@/lib/email/sample-data";
import { findTemplate, type SafeField, type TemplateMeta } from "../emails/components/templates-data";

export interface SaveTemplateOverrideResult {
  ok: boolean;
  error?: string;
  /** Per-field map of the values actually stored (after HTML stripping). The
   *  edit form uses this to update the textarea/input contents in place so the
   *  user sees the cleaned text immediately, without waiting for a reload. */
  cleanedValues?: Record<string, string>;
}

export interface ResetTemplateToDefaultResult {
  ok: boolean;
  error?: string;
}

export interface SendTestEmailResult {
  ok: boolean;
  error?: string;
}

// Minimal HTML strip per the BUILD-email-templates-actions plan. The codebase
// has no DOMPurify/striptags equivalent and storing as plain text is the rule.
// Final defense at render time is escapeHtml — the override value is always
// passed through escapeHtml before injection into a `<p>` text body, so this
// strip is cosmetic + storage hygiene, not a security boundary.
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

// C-15 Phase A — the hardcoded SUBJECTS map is gone; every template's
// default subject now lives in the registry (`TemplateMeta.subjectDefault`),
// read at the one call site below.

interface CleanedField {
  field: SafeField;
  value: string;
}

// C-15 Phase D — shared by saveTemplateOverride AND sendTestEmail (dispatch
// item 5: "reuse saveTemplateOverride's validation rather than writing a
// parallel copy that can drift"). Extracted verbatim from the loop that used
// to live inline in saveTemplateOverride — same order, same guards, same
// error strings — so a test send can never accept something save would
// reject, or vice versa. Validates every submitted field BEFORE either
// caller touches the DB or sends anything, so a single bad field never
// leaves half-applied work behind.
function validateTemplateFields(
  template: TemplateMeta,
  formData: FormData
): { ok: true; cleanedFields: CleanedField[] } | { ok: false; error: string } {
  const cleanedFields: CleanedField[] = [];
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
    // C-08 Phase B (security review) — body_cta_url lands in a real <a href>
    // (templates.ts). escapeHtml blocks attribute breakout but not scheme, so
    // reject anything that isn't https:// here; empty is still allowed
    // through (clears the override, reverting to the hardcoded https default).
    if (field.kind === "body_cta_url" && cleaned !== "" && !isHttpsUrl(cleaned)) {
      return {
        ok: false,
        error: `"${field.label}" must be a valid https:// URL.`,
      };
    }
    // C-15 Phase A (item 1, security review) — subjects become editable on
    // every template, reopening a header-injection surface C-08 Phase B
    // deliberately left closed (subjects were hardcoded literals, so \r/\n
    // couldn't reach anything). Reject C0 control characters at save time;
    // templates.ts's resolveSubject() carries the matching render-time
    // fallback guard — two-sided, mirroring the body_cta_url precedent
    // above. stripHtmlTags().trim() above only strips leading/trailing
    // whitespace, not an embedded \r/\n, so this check is still needed.
    if (field.kind === "subject" && hasControlChars(cleaned)) {
      return {
        ok: false,
        error: `"${field.label}" can't contain line breaks.`,
      };
    }
    cleanedFields.push({ field, value: cleaned });
  }
  return { ok: true, cleanedFields };
}

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
  const validation = validateTemplateFields(template, formData);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const { cleanedFields } = validation;

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

// ─── C-15 Phase D — reset to default (brief §2.5, plan Step 13) ───────────

export async function resetTemplateToDefault(
  _previousState: ResetTemplateToDefaultResult | null,
  formData: FormData
): Promise<ResetTemplateToDefaultResult> {
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

  const adminClient = createSupabaseAdminClient();

  // Capture every override row for this template BEFORE deleting anything —
  // this is the audit's before_state, and (field_key + value, plus who/when)
  // per row is enough for a human to reconstruct the customisation by hand
  // if the reset ever needs undoing.
  const { data: existingRows, error: fetchError } = await adminClient
    .from("email_template_overrides")
    .select("id, field_key, value, updated_by, updated_at")
    .eq("template_id", templateId);

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  if (!existingRows || existingRows.length === 0) {
    // Server-side mirror of the client's disabled button (brief §5.4) — a
    // bypassed client or a stale page can't reset a template that's already
    // at its defaults and produce a misleading "reset" audit row.
    return { ok: false, error: "This template is already using its defaults." };
  }

  const { error: deleteError } = await adminClient
    .from("email_template_overrides")
    .delete()
    .eq("template_id", templateId);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  const auditResult = await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "email_template_reset",
    target_type: "email_templates",
    target_id: null,
    before_state: {
      template_id: templateId,
      overrides: existingRows.map((row) => ({
        field_key: row.field_key,
        value: row.value,
        updated_by: row.updated_by,
        updated_at: row.updated_at,
      })),
    },
    after_state: { template_id: templateId, deleted: true },
  });
  if (auditResult.error) {
    console.error("email_template_reset audit write failed:", auditResult.error.message);
  }

  revalidatePath("/admin/emails");
  revalidatePath(`/admin/emails/templates/${templateId}`);
  return { ok: true };
}

// ─── C-15 Phase D — send me a test (brief §2.6, plan Step 14) ─────────────

const TEST_SEND_RATE_LIMIT_SECONDS = 60;

// Mirrors templates.ts's private resolveSubject() (not exported — kept
// server-internal to that file). Duplicated here deliberately rather than
// widening templates.ts's export surface for one caller: same "" -> default
// fallback semantics (C-15 Phase B's `||`, not `??`) and the same
// render-time control-character guard, so a test send's Subject: header can
// never disagree with what the live preview's <title> would show for the
// same draft.
function resolveTestSubject(template: TemplateMeta, overrides: Record<string, string>): string {
  const value = overrides.subject;
  if (value && !hasControlChars(value)) return value;
  return template.subjectDefault;
}

// Resend's `sendEmail` always wants both an html and a text body, and the
// one plain_text-rendering template needs an html leg synthesized from its
// text.
function plainTextEnvelope(text: string): string {
  return `<!doctype html><html><body style="font-family:'IBM Plex Mono',Menlo,monospace;white-space:pre-wrap;">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</body></html>`;
}

/**
 * 60s-per-template rate limit, checked against the latest
 * `email_template_test_sent` audit row for this template (in-action
 * timestamp check, not a DB-side window filter) — audit rows for this action
 * are written on success only (see sendTestEmail below), so a failed send
 * never consumes the window.
 */
async function checkTestSendRateLimit(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  templateId: string
): Promise<{ limited: true; error: string } | { limited: false }> {
  const { data: latest } = await adminClient
    .from("audit_logs")
    .select("created_at")
    .eq("action_type", "email_template_test_sent")
    .eq("after_state->>template_id", templateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return { limited: false };

  const elapsedMs = Date.now() - new Date((latest as { created_at: string }).created_at).getTime();
  if (elapsedMs < TEST_SEND_RATE_LIMIT_SECONDS * 1000) {
    return {
      limited: true,
      error: `A test email for this template was sent recently. Wait ${TEST_SEND_RATE_LIMIT_SECONDS} seconds and try again.`,
    };
  }
  return { limited: false };
}

export async function sendTestEmail(
  _previousState: SendTestEmailResult | null,
  formData: FormData
): Promise<SendTestEmailResult> {
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

  // Same validation rules as save (brief §5.5) — reused, not re-implemented,
  // so a test send can never accept something save would reject.
  const validation = validateTemplateFields(template, formData);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const draftValues: Record<string, string> = {};
  for (const { field, value } of validation.cleanedFields) {
    draftValues[field.kind] = value;
  }

  const adminClient = createSupabaseAdminClient();

  const rateLimit = await checkTestSendRateLimit(adminClient, templateId);
  if (rateLimit.limited) {
    return { ok: false, error: rateLimit.error };
  }

  // Recipient is derived server-side from the AUTHENTICATED actor's own
  // profile only — the `requirePermission` result above, never a form
  // value (brief §3 RBAC matrix: "to own address only"; brief §4's
  // highest-severity risk row). notification_email is C-08 Phase D's
  // personal-alert address; falls back to the login email when unset (or
  // pre-C-08-Phase-D).
  const recipient = actor.notification_email ?? actor.email;
  if (!recipient) {
    return { ok: false, error: "Your account has no email address on file." };
  }

  // Same Phase B merge path the live preview uses (draft over saved,
  // rendered through the exact same dispatch table as a real send) — so a
  // test send can never drift from what the preview already showed.
  let savedOverrides: Record<string, string>;
  try {
    savedOverrides = await resolveTemplateOverrides(templateId);
  } catch (error) {
    console.error("resolveTemplateOverrides threw inside sendTestEmail:", error);
    savedOverrides = {};
  }
  const merged = { ...savedOverrides, ...draftValues };

  const renderer = SAMPLE_RENDERERS[templateId];
  if (!renderer) {
    return { ok: false, error: "No preview renderer registered for this template." };
  }

  let html: string;
  let text: string;
  try {
    const rendered = await renderer(merged);
    if (rendered.rendersAs === "plain_text") {
      text = rendered.content;
      html = plainTextEnvelope(text);
    } else {
      html = rendered.content;
      text = plainTextFallback(html);
    }
  } catch (error) {
    console.error("SAMPLE_RENDERERS render threw inside sendTestEmail:", error);
    return { ok: false, error: "Couldn't render the template." };
  }

  const subject = `[Test] ${resolveTestSubject(template, merged)}`;

  // Resend send. `sendEmail` DIRECTLY — never `sendTrackedEmail` — a test
  // send must not write an `email_delivery_events` row (brief §2.6: "test
  // sends don't pollute the delivery log"; C-08's Resend tooling and the
  // delivery-log event-type histogram would otherwise treat a test send as
  // a real one). Failure → return error, no audit row written (audit is
  // success-only, see below).
  let messageId: string | null = null;
  try {
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

  // Audit on success ONLY — this is also what the rate limit above reads,
  // so a failed send never consumes the 60s window.
  const auditResult = await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "email_template_test_sent",
    target_type: "email_templates",
    target_id: null,
    after_state: {
      template_id: templateId,
      recipient_email: recipient,
      resend_message_id: messageId,
    },
  });
  if (auditResult.error) {
    console.error("email_template_test_sent audit write failed:", auditResult.error.message);
  }

  return { ok: true };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

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
