// The browser-secret scanner had no test of its own, and its key-classification
// rule IS the product: everything else in the script is file walking. Gate 02
// recorded the consequence — the pattern omitted PASSWORD and CREDENTIAL
// entirely, and an exemption for `NEXT_PUBLIC_` ran BEFORE the sensitivity check,
// so the one prefix Next.js actually inlines into browser bundles was the one
// prefix guaranteed to be skipped.
//
// ⛔ These cases are the rule. If you change SENSITIVE_KEY_PATTERN, change them
// deliberately — do not loosen a case to make a run go green.

import { describe, expect, it } from "vitest";
import { isSecretKey, SENSITIVE_KEY_PATTERN } from "./scan-browser-secrets.mjs";

describe("scan-browser-secrets — which env keys count as secrets", () => {
  it.each([
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "SENTRY_AUTH_TOKEN",
    "CLOUDFLARE_API_TOKEN",
    "SOME_PRIVATE_KEY",
    "BOOKING_MANAGE_TOKEN_SECRET",
    // added 2026-08-20 — neither word was in the pattern before
    "ADMIN_PASSWORD",
    "DB_PASSWORD",
    "SOME_CREDENTIAL",
    // ⛔ the case the old ordering skipped, and the worst name of all:
    // NEXT_PUBLIC_ is the prefix Next.js inlines into the client bundle
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_ADMIN_PASSWORD",
  ])("treats %s as a secret", (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each([
    // genuinely publishable — these are MEANT to reach the browser
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SENTRY_DSN",
    "NEXT_PUBLIC_SITE_URL",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NODE_ENV",
    "PORT",
  ])("treats %s as publishable", (key) => {
    expect(isSecretKey(key)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isSecretKey("supabase_service_role_key")).toBe(true);
    expect(isSecretKey("admin_password")).toBe(true);
    expect(isSecretKey("next_public_supabase_url")).toBe(false);
  });

  it("still matches every word the pattern claims to cover", () => {
    // ⛔ Guards the guard. If someone rewrites SENSITIVE_KEY_PATTERN and drops a
    // word, the lists above might still pass by accident through another word in
    // the same key name. This checks each word in isolation.
    for (const word of [
      "SERVICE_ROLE",
      "SECRET",
      "TOKEN",
      "RESEND",
      "SENTRY_AUTH",
      "CLOUDFLARE",
      "PRIVATE",
      "API_KEY",
      "PASSWORD",
      "CREDENTIAL",
    ]) {
      expect(SENSITIVE_KEY_PATTERN.test(`ZZ_${word}_ZZ`), word).toBe(true);
    }
  });

  it("does not fire on an unrelated name", () => {
    // Non-vacuity: proves the pattern discriminates rather than matching all.
    expect(isSecretKey("COMPLETELY_UNRELATED_SETTING")).toBe(false);
  });
});
