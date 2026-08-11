import { expect, test } from "@playwright/test";
import { getCredentials, hasBaseUrl, loginAs, requireCredentials } from "./helpers";

/**
 * Item 8 Phase 1 — the owner-only mileage origin, checked in a real browser.
 *
 * The unit tests prove the server action rejects an origin change from an actor
 * without `manage_travel_origin`, and that an absent field is treated as
 * unchanged. What they cannot prove is the browser half of that contract: a
 * DISABLED input is omitted from FormData entirely, which is exactly why an
 * Admin's save is not mistaken for an attempt to edit the origin. That
 * omission is a browser behaviour, so it is asserted here rather than in jsdom.
 *
 * Credentials are never handled by this spec: `getCredentials` reads
 * E2E_<ROLE>_EMAIL/_PASSWORD from the environment and `loginAs` exchanges them
 * for a session cookie in Node, so no password is ever typed into a page.
 */
// The bundled Chromium revision is missing on this machine; system Chrome is
// what the other admin specs pin too. Must be file-level: Playwright rejects a
// channel override inside a describe group because it forces a new worker.
test.use({ channel: "chrome" });

test.describe("Admin settings — free-travel areas and the owner-only origin", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the admin settings checks.");

  test("the owner can edit the mileage origin", async ({ page }) => {
    test.skip(!requireCredentials(["OWNER"]), "Set E2E_OWNER_EMAIL/PASSWORD.");
    const owner = getCredentials("OWNER");
    if (!owner) return;

    await loginAs(page, owner);
    await page.goto("/admin/settings/", { waitUntil: "domcontentloaded" });

    const origin = page.locator('input[name="mileage_origin"]');
    await expect(origin).toHaveCount(1);
    await expect(origin).toBeVisible();
    await expect(origin).toBeEnabled();
    await expect(page.getByText("Mileage origin")).toHaveCount(1);

    await page.screenshot({
      path: "test-results/item8-settings-owner.png",
      fullPage: true,
    });
  });

  test("an admin sees the mileage origin but cannot edit it, and it is omitted from the form payload", async ({
    page,
  }) => {
    test.skip(!requireCredentials(["ADMIN"]), "Set E2E_ADMIN_EMAIL/PASSWORD.");
    const admin = getCredentials("ADMIN");
    if (!admin) return;

    await loginAs(page, admin);
    await page.goto("/admin/settings/", { waitUntil: "domcontentloaded" });

    const origin = page.locator('input[name="mileage_origin"]');
    await expect(origin).toHaveCount(1);
    await expect(origin).toBeVisible();
    await expect(origin).toBeDisabled();

    // The whole partial-save guarantee rests on this: a disabled control is not
    // a successful control, so the browser leaves `mileage_origin` out of the
    // submitted FormData and the action treats it as unchanged.
    const submittedKeys = await page.evaluate(() => {
      const field = document.querySelector('[name="mileage_origin"]');
      const form = field?.closest("form");
      return form ? Array.from(new FormData(form).keys()) : [];
    });
    expect(submittedKeys).not.toContain("mileage_origin");
    expect(submittedKeys).toContain("free_travel_cities");

    await page.screenshot({
      path: "test-results/item8-settings-admin.png",
      fullPage: true,
    });
  });

  test("the service-area panel is presented as free travel, not as a gate", async ({
    page,
  }) => {
    test.skip(!requireCredentials(["OWNER"]), "Set E2E_OWNER_EMAIL/PASSWORD.");
    const owner = getCredentials("OWNER");
    if (!owner) return;

    await loginAs(page, owner);
    await page.goto("/admin/settings/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Free-travel areas" })
    ).toBeVisible();

    // The renamed wire contract, asserted end to end in a real document.
    await expect(page.locator('input[name="free_travel_cities"]')).toHaveCount(1);
    await expect(page.locator('input[name="allowed_cities"]')).toHaveCount(0);

    // The old copy promised a gate that no longer exists.
    await expect(page.getByText("Customers within this area can book.")).toHaveCount(0);
  });
});
