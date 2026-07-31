// Server route handler — renders an email template for the preview iframe
// in the email-templates tab.
//
// SERVER ONLY by design: this is the boundary that lets the preview iframe
// load templates.ts without any client-side import. The iframe `src` (GET)
// or a fetch (POST) points here; this handler imports templates.ts on the
// server, renders, and ships the resulting HTML string with a safe
// Content-Security-Policy.
//
// GET renders the template's SAVED overrides (C-15 Phase B — previously
// always rendered hardcoded defaults, resolving nothing; now resolves
// `resolveTemplateOverrides(id)` first, matching brief §1.2's description of
// GET as "server-rendered from SAVED overrides"). POST (C-15 Phase B, new)
// renders an unsaved draft merged over the saved overrides — see brief
// §2.4/§5.7/§5.8 — for the editor's live preview, without persisting
// anything. Both share the SAME dispatch table (sample-data.ts's
// SAMPLE_RENDERERS) and the same auth check, so they cannot silently drift
// apart the way the old GET-only switch (9 of 16 ids covered) already had.
//
// Remaining FAKE marker:
//   - BUILD-rbac-permission-email-templates.md (real permission gate — the
//     `manage_email_templates` PERMISSIONS key exists and actions.ts already
//     gates saves/resets on it via requirePermission; this route still gates
//     on the broader edit-OR-view-only check below, unchanged by C-15 Phase B
//     — RBAC-matrix changes are out of this plan's scope).

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageEmailSettings,
  canResendBookingEmails,
  canViewEmailLogs,
  getStaffProfile,
  type StaffProfile,
} from "@/lib/auth/rbac";
import { resolveTemplateOverrides } from "@/lib/email/templates";
import { SAMPLE_RENDERERS } from "@/lib/email/sample-data";
import { findTemplate } from "@/app/admin/emails/components/templates-data";

function canSeePreview(profile: StaffProfile) {
  return (
    canManageEmailSettings(profile) ||
    canViewEmailLogs(profile) ||
    canResendBookingEmails(profile)
  );
}

// Shared auth gate for GET and POST — same check, same order, so the two
// handlers can never drift into different access rules (brief §5.8's "POST
// requires the same auth as GET").
async function authorizePreviewRequest(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const profile = await getStaffProfile(supabase);
  if (!profile) {
    return { ok: false, response: new NextResponse("Unauthorized", { status: 401 }) };
  }
  if (!canSeePreview(profile)) {
    return { ok: false, response: new NextResponse("Forbidden", { status: 403 }) };
  }
  return { ok: true };
}

function jsonError(message: string, status: number) {
  return new NextResponse(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Shared render step for both handlers — looks up the sample-data dispatch
// table entry for `id` and renders it with `overrides` through the exact
// same render functions real sends use. `booking_plain_text` is the one
// registered template whose true output is plain text; wrapped in the same
// monospace HTML envelope GET has always used so the iframe (`srcdoc`)
// keeps rendering it consistently for both the initial GET paint and every
// later POST draft update (brief §2.4 — "same draft-merge path").
async function renderTemplateForPreview(
  id: string,
  overrides: Record<string, string>
): Promise<string> {
  const renderer = SAMPLE_RENDERERS[id];
  if (!renderer) {
    throw new Error(`unknown template id: ${id}`);
  }
  const result = await renderer(overrides);
  return result.rendersAs === "plain_text"
    ? renderPlainTextEnvelope(result.content)
    : result.content;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const auth = await authorizePreviewRequest();
  if (!auth.ok) return auth.response;

  let html: string;
  try {
    const overrides = await resolveTemplateOverrides(id);
    html = await renderTemplateForPreview(id, overrides);
  } catch {
    return new NextResponse(renderPlaceholder(id), {
      status: 200,
      headers: previewHeaders(),
    });
  }

  return new NextResponse(html, {
    status: 200,
    headers: previewHeaders(),
  });
}

// C-15 Phase B, Step 7 — draft-preview handler. `{ draftValues }` is
// render-time only: merged over the saved overrides and rendered with
// sample data, never written to `email_template_overrides` (brief §5.8).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const auth = await authorizePreviewRequest();
  if (!auth.ok) return auth.response;

  const template = findTemplate(id);
  if (!template) {
    return jsonError("Unknown template.", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const draftValuesRaw = (body as { draftValues?: unknown } | null)?.draftValues;
  if (
    typeof draftValuesRaw !== "object" ||
    draftValuesRaw === null ||
    Array.isArray(draftValuesRaw)
  ) {
    return jsonError("draftValues must be an object of field key to string value.", 400);
  }

  // Validate every key against the registry AND enforce each field's
  // maxLength before touching a renderer — an oversize or unknown-key draft
  // is rejected outright (400), never silently truncated.
  const draftValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(draftValuesRaw as Record<string, unknown>)) {
    const field = template.fields.find((f) => f.kind === key);
    if (!field) {
      return jsonError(`Unknown field "${key}" for template "${id}".`, 400);
    }
    if (typeof value !== "string") {
      return jsonError(`"${field.label}" must be a string.`, 400);
    }
    if (value.length > field.maxLength) {
      return jsonError(`"${field.label}" exceeds ${field.maxLength} characters.`, 400);
    }
    draftValues[key] = value;
  }

  // Draft wins over saved for any key it carries; fields the draft doesn't
  // mention keep the saved value (or the registry default, resolved by the
  // renderer itself, if there's no saved override either).
  const savedOverrides = await resolveTemplateOverrides(id);
  const merged = { ...savedOverrides, ...draftValues };

  let html: string;
  try {
    html = await renderTemplateForPreview(id, merged);
  } catch {
    return jsonError("Couldn't render the template.", 500);
  }

  return new NextResponse(html, {
    status: 200,
    headers: previewHeaders(),
  });
}

function renderPlainTextEnvelope(plain: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fbf8f2;padding:24px;font-family:'IBM Plex Mono',Menlo,monospace;font-size:14px;line-height:1.55;color:#1f2f2b;white-space:pre-wrap;">${plain
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</body></html>`;
}

function renderPlaceholder(id: string): string {
  // Fallback used when render fails outright (e.g. a stale/garbage id that
  // isn't in the registry at all — every registered template renders
  // through SAMPLE_RENDERERS, sample-data.test.ts asserts the two stay in
  // sync).
  return `<!doctype html><html><body style="margin:0;padding:32px;font-family:system-ui,sans-serif;background:#fbf8f2;color:#1f2f2b;">
    <div style="max-width:520px;margin:48px auto;padding:24px;border-radius:12px;border:1px solid #e8dfd2;background:#ffffff;">
      <h1 style="margin:0;font-size:18px;">Preview placeholder</h1>
      <p style="margin:12px 0 0;color:#53615d;line-height:1.55;font-size:14px;">Real preview for <code>${id
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</code> isn't available right now.</p>
    </div>
  </body></html>`;
}

function previewHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    // Belt and braces: even though the iframe carries `sandbox="allow-same-origin"`
    // (no allow-scripts), forbid scripts at the response layer too.
    "Content-Security-Policy":
      "default-src 'self'; script-src 'none'; style-src 'unsafe-inline' 'self'; img-src data: https:; frame-ancestors 'self';",
    "Cache-Control": "no-store",
  };
}
