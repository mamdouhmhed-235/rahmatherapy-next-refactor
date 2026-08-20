// ⛔ GATE 08 — persona entry and navigation, REBUILT FROM OBSERVED BEHAVIOUR.
//
// ⚠️ Every expectation in the previous version of this file was written against
// a navigation that no longer exists, and none of it had ever executed — the
// specs self-skipped without credentials and Playwright's browsers had never
// been downloaded on this machine. A green run meant "36 skipped".
//
// What the old file asserted, and what a real browser actually renders
// (censused 2026-08-20, all seven identities, against the live database):
//
//   Owner        old: 15 nav links   actual: 5  — Dashboard, Bookings, Clients,
//                                                 Enquiries, Staff
//   Admin        old: 12 visible, "Roles"+"Privacy" hidden
//                                    actual: the same 5 as Owner
//   Coordinator  old: Bookings, Calendar, Clients, Enquiries
//                                    actual: Dashboard, Bookings, Clients,
//                                            Enquiries, TEAM (not "Staff")
//   Therapist    old: Bookings, Calendar, Reports
//                                    actual: MY DAY, MY BOOKINGS, TEAM
//
// The reason is structural, not cosmetic. `AdminTopNav` renders a PRIMARY STRIP
// capped at five items per shell variant, and everything else lives in a user
// menu that is not part of `nav[aria-label="Admin navigation"]`. The labels are
// role-specific too: a therapist's own work is "My bookings", and `staff`
// renders as "Team" for anyone who is not Owner/Admin.
//
// ⛔ So "is this link in the nav?" is NOT the same question as "may this role
// reach this page?". The permission question is answered exhaustively by the
// 105-cell matrix in src/lib/auth/admin-access.test.ts (gate 07 case 3). THIS
// file asserts only what a real browser puts on screen, which is what the old
// file was trying and failing to do.
//
// ⚠️ The REPORTING persona test is DELETED. There is no Reporting role — the
// schema seeds exactly five — and `E2E_REPORTING_EMAIL` is EMPTY in .env, so
// that test could only ever self-skip. It was the silent-skip vector PRE-1b
// warned about, present in the repo.

import { expect, test } from "@playwright/test";
import {
  expectHiddenNavigation,
  expectVisibleNavigation,
  getCredentials,
  hasBaseUrl,
  loginAs,
  requireCredentials,
} from "./helpers";

test.describe("Admin persona entry and navigation", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run admin role E2E checks.");

  test("unauthenticated users are redirected away from the admin dashboard", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  // ── Owner and Admin share the owner_admin shell ────────────────────────────

  test("Owner lands on the dashboard with the owner/admin primary strip", async ({
    page,
  }) => {
    test.skip(!requireCredentials(["OWNER"]), "Set E2E_OWNER_EMAIL/PASSWORD.");
    const owner = getCredentials("OWNER");
    if (!owner) return;

    await loginAs(page, owner);
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    await expectVisibleNavigation(page, [
      "Dashboard",
      "Bookings",
      "Clients",
      "Enquiries",
      "Staff",
    ]);
  });

  test("Admin gets the same shell as Owner — the difference is not in the nav", async ({
    page,
  }) => {
    test.skip(!requireCredentials(["ADMIN"]), "Set E2E_ADMIN_EMAIL/PASSWORD.");
    const admin = getCredentials("ADMIN");
    if (!admin) return;

    await loginAs(page, admin);
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });

    await expectVisibleNavigation(page, [
      "Dashboard",
      "Bookings",
      "Clients",
      "Enquiries",
      "Staff",
    ]);

    // ⛔ The Owner/Admin boundary is real but INVISIBLE here: both get the same
    // five primary items, and Roles/Privacy live in the user menu rather than
    // this strip. The old spec asserted they were "hidden" from Admin and would
    // have passed for the wrong reason — they are absent from every role's
    // strip, Owner included. The real boundary is asserted where it exists:
    // getAdminPageAccess (gate 07 case 3) and the server actions (block B).
    await expectHiddenNavigation(page, ["Roles", "Privacy", "Audit", "Settings"]);
  });

  // ── Coordinator ────────────────────────────────────────────────────────────

  test("Booking Coordinator gets the front-desk strip, with Staff labelled Team", async ({
    page,
  }) => {
    test.skip(
      !requireCredentials(["COORDINATOR"]),
      "Set E2E_COORDINATOR_EMAIL/PASSWORD."
    );
    const coordinator = getCredentials("COORDINATOR");
    if (!coordinator) return;

    await loginAs(page, coordinator);
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });

    await expectVisibleNavigation(page, [
      "Dashboard",
      "Bookings",
      "Clients",
      "Enquiries",
      "Team",
    ]);

    // ⚠️ "Staff" is the Owner/Admin label for the same page. A coordinator sees
    // "Team", which is why asserting the string "Staff" is hidden here proves
    // nothing about access and everything about wording.
    await expectHiddenNavigation(page, [
      "Roles",
      "Audit",
      "Privacy",
      "Operations",
      "Settings",
    ]);
  });

  // ── Therapist ──────────────────────────────────────────────────────────────

  test("Therapist gets a three-item, first-person strip", async ({ page }) => {
    test.skip(!requireCredentials(["THERAPIST_A"]), "Set E2E_THERAPIST_A_EMAIL/PASSWORD.");
    const therapist = getCredentials("THERAPIST_A");
    if (!therapist) return;

    await loginAs(page, therapist);
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });

    // ⛔ Not "Bookings" — "My bookings". The therapist shell speaks in the first
    // person and carries no user-menu groups at all.
    await expectVisibleNavigation(page, ["My day", "My bookings", "Team"]);

    await expectHiddenNavigation(page, [
      "Services",
      "Roles",
      "Audit",
      "Privacy",
      "Operations",
      "Settings",
    ]);
  });

  test("Therapist can still reach their own availability and profile", async ({
    page,
  }) => {
    test.skip(!requireCredentials(["THERAPIST_A"]), "Set E2E_THERAPIST_A_EMAIL/PASSWORD.");
    const therapist = getCredentials("THERAPIST_A");
    if (!therapist) return;

    await loginAs(page, therapist);
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });

    // ⚠️ Worth pinning, because the nav alone suggests otherwise. `Availability`
    // is filtered out of the strip by `dataScopes: ["all"]` and a therapist's
    // scope is "own" — so it looked at first like a therapist could not reach
    // their own availability at all. They can: the dashboard offers it directly.
    // Checked before it was written up as a defect; it is not one.
    await expect(
      page.getByRole("link", { name: /set my availability/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /update my profile|open my profile/i }).first()
    ).toBeVisible();
  });

  // ── Blocked identities ─────────────────────────────────────────────────────

  test("an inactive staff member is bounced to the login with a reason", async ({
    browser,
  }) => {
    test.skip(!requireCredentials(["INACTIVE"]), "Set E2E_INACTIVE_* credentials.");
    const credentials = getCredentials("INACTIVE");
    if (!credentials) return;

    const context = await browser.newContext();
    const page = await context.newPage();

    await loginAs(page, credentials);
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });

    // Observed: /admin/login/?reason=inactive — the layout's null-shell redirect.
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page).toHaveURL(/reason=inactive/);
    await expect(
      page.locator("nav[aria-label='Admin navigation'] a")
    ).toHaveCount(0);

    await context.close();
  });

  test("an authenticated non-staff user reaches no admin surface at all", async ({
    browser,
  }) => {
    test.skip(!requireCredentials(["NON_STAFF"]), "Set E2E_NON_STAFF_* credentials.");
    const credentials = getCredentials("NON_STAFF");
    if (!credentials) return;

    const context = await browser.newContext();
    const page = await context.newPage();

    await loginAs(page, credentials);

    // ⛔ A valid Supabase session with NO staff_profiles row must never reach an
    // admin surface — checked on three different routes, not just the dashboard.
    for (const route of ["/admin/dashboard/", "/admin/bookings/", "/admin/clients/"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/admin\/login/);
    }
    await expect(
      page.locator("nav[aria-label='Admin navigation'] a")
    ).toHaveCount(0);

    await context.close();
  });
});
