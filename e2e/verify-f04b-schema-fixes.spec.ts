// ⛔ VERIFICATION OF THE F-04B SCHEMA-MISMATCH FIXES (2026-08-29)
//
// Three queries asked Supabase for columns that DO NOT EXIST. PostgREST answers
// HTTP 400 (code 42703); the calling code destructured only `data` and threw the
// `error` away, so every failure arrived as an empty result. Nothing was logged.
//
// ⛔ THIS FILE IS READ-ONLY. It signs in, loads two admin screens and asserts on
// what is rendered. It creates NOTHING and deletes NOTHING.
//
// ── WHAT THIS FILE CAN AND CANNOT PROVE ────────────────────────────────────
//
// ✅ F-04B-04 (privacy author name) — PROVEN HERE, with real signal.
//    Production holds exactly ONE `client_privacy_requests` row. It has a note
//    and its `created_by_staff_id` is `b0f79294-…` = "Phase10 OWNER".
//    The page renders `Transcribed by {authorName}.` when the author resolves,
//    and `From the customer directly.` when it does not (page.tsx:848-850).
//    ⛔ So BEFORE the fix this screen did not merely show a blank — it asserted
//    a FALSEHOOD about a GDPR request's provenance, claiming the customer filed
//    it when a staff member had transcribed it. That makes this assertion a
//    genuine before/after discriminator, not a smoke test.
//
// ⛔ F-04B-01 (availability conflict guard) — NOT PROVEN HERE, deliberately.
//    Measured on production 2026-08-29: `upcoming_assigned_bookings = 0`. With
//    no upcoming assigned booking anywhere, the guard's count is zero whether
//    the query is fixed or still broken, so a browser assertion would pass
//    either way. That is a VOID measurement (the G25/G26/G28 family) and is NOT
//    recorded as a pass. What IS proven, separately, is that the replacement
//    query is accepted by PostgREST (200) where the old one was rejected (400,
//    42703). This file only asserts the page renders without error.
//
// ⛔ F-04B-02 (manual booking therapist assignment) — NOT PROVEN HERE.
//    Proving it requires CREATING a booking, which is a production write. That
//    belongs in the single-writer lane with seed-and-teardown, not in this
//    read-only file.

import { test, expect } from "@playwright/test";
import { getCredentials, hasBaseUrl, loginAs } from "./helpers";

const owner = getCredentials("OWNER");

test.describe("F-04B schema-mismatch fixes", () => {
  test.skip(!hasBaseUrl(), "E2E_BASE_URL is required.");
  test.skip(!owner, "OWNER credentials are required.");

  test("F-04B-04: the privacy request shows its real staff author, not 'From the customer directly.'", async ({
    page,
  }) => {
    await loginAs(page, owner!);
    await page.goto("/admin/privacy");

    // Completed requests sit inside collapsed <details>, and some are nested
    // inside other collapsed <details> — so clicking each summary in turn hits
    // hidden elements. Open them all directly instead: this is a data
    // assertion, not a test of the disclosure widget.
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      document
        .querySelectorAll("details")
        .forEach((d) => d.setAttribute("open", ""));
    });

    // ✅ The fix: the author resolves through `staff_profiles.name`.
    await expect(
      page.getByText("Transcribed by Phase10 OWNER.", { exact: false })
    ).toBeVisible({ timeout: 15_000 });

    // ⛔ The old behaviour: `full_name` came back undefined and the page claimed
    // the customer filed it themselves. That string must NOT appear anywhere.
    await expect(
      page.getByText("From the customer directly.", { exact: false })
    ).toHaveCount(0);
  });

  test("F-04B-01: the staff availability screen renders (its query no longer 400s)", async ({
    page,
  }) => {
    await loginAs(page, owner!);

    // THERAPIST_A — "Test Therapist". Never the real Owner, never
    // "Test Therapist Fresh" (87e01c11-…, which is never bookable).
    await page.goto(
      "/admin/staff/884311b1-e9d0-44b9-91f3-14188a3baf59/availability"
    );

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 15_000 });

    // The page must render its blocked-dates manager rather than an error
    // boundary. ⛔ This does NOT prove the conflict guard counts correctly —
    // see the header: production has zero upcoming assigned bookings.
    await expect(page.locator("body")).not.toContainText(
      "Application error",
      { timeout: 5_000 }
    );
    await expect(page.locator("body")).not.toContainText("does not exist");
  });

  // ✅ F-04B-05 — found by the codebase-wide sweep, not by the original audit.
  // `staff-detail-data.ts:278` asked `audit_logs` for `actor_id`; the column is
  // `actor_staff_id`. Probed live 2026-08-29: the old select returns HTTP 400
  // (42703), the new one returns 200. The error was discarded, so the
  // "Last modified by … " caption in the profile header never rendered for
  // ANY staff member, and the actor-name lookup beneath it was dead code.
  //
  // Target: "Phase10 THERAPIST B" (1ae328ef-…), whose most recent audit row is
  // `staff_profile_updated` by "Phase10 OWNER" (2026-08-23). A test staff
  // profile — ⛔ never the real Owner, Minhaj rahman.
  test("F-04B-05: the staff profile header shows who last modified it", async ({
    page,
  }) => {
    await loginAs(page, owner!);
    await page.goto("/admin/staff/1ae328ef-2f33-42dd-acb4-2e541543f162");

    // page.tsx:412-417 renders `Last modified by {actor} {relative time}` only
    // when the audit row resolved. Before the fix it resolved to null and the
    // whole paragraph was omitted, so this is a real discriminator.
    // `.first()` — the responsive header renders this paragraph twice in the
    // DOM (one copy per breakpoint layout), so a bare locator is a strict-mode
    // violation on the mobile project. Both copies carry the same text.
    await expect(
      page.getByText(/Last modified by Phase10 OWNER/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
