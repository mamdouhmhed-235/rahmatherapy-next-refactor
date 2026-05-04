import { expect, test } from "@playwright/test";
import {
  expectHiddenNavigation,
  expectVisibleNavigation,
  getCredentials,
  hasBaseUrl,
  loginAs,
  requireCredentials,
} from "./helpers";

test.describe("Phase 10 admin role journeys", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run admin role E2E checks.");

  test("unauthenticated users are redirected away from admin dashboard", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("owner/super-admin can see universal admin navigation", async ({ page }) => {
    test.skip(!requireCredentials(["OWNER"]), "Set E2E_OWNER_EMAIL/PASSWORD.");
    const owner = getCredentials("OWNER");
    if (!owner) return;

    await loginAs(page, owner);
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });

    await expectVisibleNavigation(page, [
      "Dashboard",
      "Bookings",
      "Calendar",
      "Reports",
      "Clients",
      "Enquiries",
      "Staff",
      "Services",
      "Availability",
      "Roles",
      "Audit",
      "Privacy",
      "Emails",
      "Operations",
      "Settings",
    ]);
  });

  test("admin/manager can see operational modules without owner-only privacy and role controls", async ({
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
      "Calendar",
      "Reports",
      "Clients",
      "Enquiries",
      "Staff",
      "Services",
      "Availability",
      "Emails",
      "Operations",
      "Settings",
    ]);
    await expectHiddenNavigation(page, ["Roles", "Privacy"]);
  });

  test("booking coordinator has booking/client workflow without restricted admin modules", async ({
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

    await expectVisibleNavigation(page, ["Bookings", "Calendar", "Clients", "Enquiries"]);
    await expectHiddenNavigation(page, [
      "Roles",
      "Audit",
      "Privacy",
      "Operations",
      "Settings",
    ]);
  });

  test("therapist sees scoped work without broad admin controls", async ({ page }) => {
    test.skip(!requireCredentials(["THERAPIST_A"]), "Set E2E_THERAPIST_A_EMAIL/PASSWORD.");
    const therapist = getCredentials("THERAPIST_A");
    if (!therapist) return;

    await loginAs(page, therapist);
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });

    await expectVisibleNavigation(page, ["Bookings", "Calendar", "Reports"]);
    await expectHiddenNavigation(page, [
      "Staff",
      "Services",
      "Availability",
      "Roles",
      "Audit",
      "Privacy",
      "Emails",
      "Operations",
      "Settings",
    ]);
  });

  test("read-only/reporting user cannot see booking mutation modules", async ({
    page,
  }) => {
    test.skip(!requireCredentials(["REPORTING"]), "Set E2E_REPORTING_EMAIL/PASSWORD.");
    const reporting = getCredentials("REPORTING");
    if (!reporting) return;

    await loginAs(page, reporting);
    await page.goto("/admin/reports/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /reports/i })).toBeVisible();
    await expectHiddenNavigation(page, ["Staff", "Roles", "Audit", "Privacy"]);
    await expect(page.getByRole("link", { name: /create booking/i })).toHaveCount(0);
  });

  test("inactive staff and authenticated non-staff users are blocked", async ({
    browser,
  }) => {
    test.skip(
      !requireCredentials(["INACTIVE", "NON_STAFF"]),
      "Set E2E_INACTIVE_* and E2E_NON_STAFF_* credentials."
    );

    for (const prefix of ["INACTIVE", "NON_STAFF"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const credentials = getCredentials(prefix);
      if (!credentials) return;

      await loginAs(page, credentials);
      await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });

      await expect(page).toHaveURL(/\/admin\/login/);
      if (prefix === "INACTIVE") {
        await expect(page.getByText(/account is inactive/i)).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible();
      }
      await context.close();
    }
  });
});
