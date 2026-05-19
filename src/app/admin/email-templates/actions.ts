"use server";

// New server actions for the email-templates tab.
// Distinct from src/app/admin/emails/actions.ts (which owns
// sendManualBookingReminder and must NOT be edited here).
//
// Each action is a FAKE shim until the matching BLOCKS-REDESIGN BUILD lands:
//   - BUILD-email-template-overrides-table.md  (the email_template_overrides table)
//   - BUILD-email-templates-actions.md         (the real save + send + audit writes)
//   - BUILD-rbac-permission-email-templates.md (the manage_email_templates permission)
//
// When the BUILDs land, the FAKE blocks below are replaced with:
//   1. Real Supabase upsert into email_template_overrides
//   2. Real Resend dispatch via the existing email sender helpers
//   3. audit_logs writes for `email_template_override_saved` /
//      `email_template_sent_manually`

import { findTemplate } from "../emails/components/templates-data";

export interface SaveTemplateOverrideResult {
  ok: boolean;
  error?: string;
}

export interface SendTemplateManuallyResult {
  ok: boolean;
  error?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveTemplateOverride(
  _previousState: SaveTemplateOverrideResult | null,
  formData: FormData
): Promise<SaveTemplateOverrideResult> {
  // FAKE: BUILD-email-template-overrides-table + BUILD-email-templates-actions
  // Until both BUILDs land, this returns the documented sentinel so the UI's
  // Save-error toast and inline alert region render without crashing the tab.
  const templateId = String(formData.get("template_id") ?? "");
  const template = findTemplate(templateId);
  if (!template) {
    return { ok: false, error: "Unknown template." };
  }

  // Validate copy fields against documented limits + variable shape.
  for (const field of template.fields) {
    const raw = formData.get(`field:${field.kind}`);
    if (raw == null) continue;
    const value = String(raw);
    if (value.length > field.maxLength) {
      return {
        ok: false,
        error: `Trim this to ${field.maxLength} characters or fewer.`,
      };
    }
    if (/<script|<\/script|<iframe/i.test(value)) {
      return {
        ok: false,
        error: "Plain text only — HTML and script tags will be stripped.",
      };
    }
  }

  // FAKE early-return: surface the documented copy.
  return {
    ok: false,
    error: "Couldn't save the override — table not yet provisioned.",
  };

  // Once BUILDs land, replace the early-return with:
  //   await supabase.from("email_template_overrides").upsert({ ... });
  //   await writeAudit({ action_type: "email_template_override_saved", ... });
  //   return { ok: true };
}

export async function sendTemplateManually(
  _previousState: SendTemplateManuallyResult | null,
  formData: FormData
): Promise<SendTemplateManuallyResult> {
  // FAKE: BUILD-email-templates-actions
  const templateId = String(formData.get("template_id") ?? "");
  const recipient = String(formData.get("recipient_email") ?? "");
  const template = findTemplate(templateId);
  if (!template) {
    return { ok: false, error: "Unknown template." };
  }
  if (!EMAIL_PATTERN.test(recipient)) {
    return {
      ok: false,
      error: "That email doesn't look right. Use the format name@example.com.",
    };
  }

  // FAKE early-return: surface the documented Cancelled-family copy.
  return {
    ok: false,
    error: "Couldn't send. Try again.",
  };

  // Once BUILDs land:
  //   await sendEmailViaResend({ ... });
  //   await writeAudit({ action_type: "email_template_sent_manually", ... });
  //   return { ok: true };
}
