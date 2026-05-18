"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * FAKE backend.
 *
 * Both server actions in this file are placeholder implementations for Phase 6.
 * Real wiring lands with the following BLOCKS-REDESIGN BUILD plans (still [ ]
 * per IMPLEMENTATION-PLAN.md footer):
 *
 *   - BUILD-password-reset-request-actions.md (Layer 0 #3)
 *   - BUILD-password-reset-email-templates.md (Layer 0 #2)
 *
 * Until those plans land, these handlers:
 *   - do NOT write to `account_password_requests`
 *   - do NOT send email via Resend
 *   - do NOT call Supabase Auth admin-API
 *   - do NOT write audit_logs rows
 *
 * They DO set / clear the `rahma_password_reset_request` cookie so state 1 → 2
 * → 3 routing is end-to-end testable from the UI. Real-token state 4 / 5 / 6
 * routing is driven by the `[token]` route's static token map (see
 * `[token]/page.tsx`) so all six visible states render under FAKE backend.
 *
 * Security-by-uniform-response is preserved: every state-1 submit (valid email,
 * unknown email, malformed email re-render path) sets the same cookie shape and
 * lands on the same state-2 confirmation. The brief §10.1 trade-off + Phase 7
 * audit verification.
 */

const COOKIE_NAME = "rahma_password_reset_request";
// 7 days, matches the brief's "short TTL, ~7 days" comment.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "f••@rahmatherapy.co.uk";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const head = local.slice(0, 1) || "f";
  return `${head}••@${domain}`;
}

export async function submitPasswordResetRequest(
  formData: FormData
): Promise<void> {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim() : "";

  // Email shape check happens client-side and (in the real action) server-side.
  // FAKE handler accepts anything that has an @ — security-by-uniform-response
  // means we never branch on "is this email in the staff table?".
  if (!email || !email.includes("@")) {
    // Re-render state 1 with the error region populated. The brief's matrix
    // (§6 cross-state row 2) routes invalid email through role="alert" on the
    // field, not a separate route.
    const params = new URLSearchParams();
    if (!email) {
      params.set("error", "empty");
    } else {
      params.set("error", "format");
    }
    if (email) params.set("email", email);
    redirect(`/admin/password-reset?${params.toString()}`);
  }

  // FAKE: set the signed-cookie placeholder so state 3 routing works on
  // subsequent visits. Real implementation will hash the email + store the
  // request row id (brief §11 state 2 notes).
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: JSON.stringify({
      // FAKE: stable test value. Real action will write a hash + row id.
      maskedEmail: maskEmail(email),
      submittedAt: new Date().toISOString(),
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/password-reset",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  // Re-render state 2 (request submitted) on the same route.
  redirect("/admin/password-reset?state=submitted");
}

export async function clearPasswordResetCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/password-reset",
    maxAge: 0,
  });
  redirect("/admin/password-reset");
}

export async function setPasswordWithToken(formData: FormData): Promise<void> {
  // FAKE: validate two password fields client-side AND server-side. Real
  // action will verify the token + call supabase.auth.admin.updateUserById
  // + write the password_reset_completed audit row.

  const tokenRaw = formData.get("token");
  const newPwRaw = formData.get("new_password");
  const confirmRaw = formData.get("confirm_new_password");
  const token = typeof tokenRaw === "string" ? tokenRaw : "";
  const newPassword = typeof newPwRaw === "string" ? newPwRaw : "";
  const confirmNew = typeof confirmRaw === "string" ? confirmRaw : "";

  if (!token) {
    // Should be impossible (token comes from URL via hidden input), but the
    // brief's hostile-token rule (§6) says fall to state 5, never echo.
    redirect("/admin/password-reset");
  }

  function failBack(errorCode: string): never {
    const params = new URLSearchParams({ error: errorCode });
    redirect(`/admin/password-reset/${encodeURIComponent(token)}?${params.toString()}`);
  }

  if (newPassword.length < 12) {
    failBack("short");
  }
  if (newPassword !== confirmNew) {
    failBack("mismatch");
  }

  // FAKE success: clear the cookie + redirect to dashboard. Real implementation
  // creates a Supabase Auth session before the redirect; the dashboard is the
  // confirmation, per brief §11 state 4 "no intermediate 'password updated'".
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/password-reset",
    maxAge: 0,
  });

  // FAKE: real action sets a fresh Supabase Auth session, then redirects.
  // Without that session the dashboard would bounce back to login. Until the
  // BUILD plan lands, redirect to login with a one-shot "fake-success" reason
  // so the staff member sees an honest end-state instead of a redirect loop.
  redirect("/admin/login?reason=fake-success");
}
