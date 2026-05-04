import { expect, test } from "@playwright/test";
import { getCredentials, hasBaseUrl, loginAs, requireCredentials } from "./helpers";

test.describe("Phase 10 role-based booking visibility and claiming", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run booking claim E2E checks.");
  test.skip(
    !process.env.E2E_CLAIMABLE_BOOKING_PATH,
    "Set E2E_CLAIMABLE_BOOKING_PATH to a booking detail path with an unassigned claimable assignment."
  );
  test.skip(
    !requireCredentials(["THERAPIST_A", "THERAPIST_B", "OWNER"]),
    "Set E2E_THERAPIST_A_*, E2E_THERAPIST_B_*, and E2E_OWNER_* credentials."
  );

  test("claimable assignment disappears for another therapist after it is claimed", async ({
    browserName,
    browser,
  }) => {
    test.skip(
      browserName !== "chromium" || test.info().project.name !== "chromium",
      "The claim handoff test mutates one shared assignment and runs once on desktop chromium."
    );

    const bookingPath = process.env.E2E_CLAIMABLE_BOOKING_PATH;
    const therapistA = getCredentials("THERAPIST_A");
    const therapistB = getCredentials("THERAPIST_B");
    const owner = getCredentials("OWNER");
    if (!bookingPath || !therapistA || !therapistB || !owner) return;

    const therapistAContext = await browser.newContext();
    const therapistAPage = await therapistAContext.newPage();
    await loginAs(therapistAPage, therapistA);
    await therapistAPage.goto(bookingPath, { waitUntil: "domcontentloaded" });
    const therapistAClaimButton = therapistAPage.getByRole("button", {
      name: /claim assignment/i,
    });
    await expect(therapistAClaimButton).toBeVisible();
    await expect(therapistAClaimButton).toBeEnabled();

    const therapistBContext = await browser.newContext();
    const therapistBPage = await therapistBContext.newPage();
    await loginAs(therapistBPage, therapistB);
    await therapistBPage.goto(bookingPath, { waitUntil: "domcontentloaded" });
    const therapistBClaimButton = therapistBPage.getByRole("button", {
      name: /claim assignment/i,
    });
    await expect(therapistBClaimButton).toBeVisible();
    await expect(therapistBClaimButton).toBeEnabled();

    const claimRequest = therapistAPage
      .waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/admin/bookings/"),
        { timeout: 30_000 }
      )
      .catch(() => null);
    await therapistAClaimButton.click();
    await claimRequest;
    await therapistAPage.reload({ waitUntil: "domcontentloaded" });
    await expect(
      therapistAPage.getByRole("button", { name: /claim assignment/i })
    ).toHaveCount(0);

    await therapistBPage.reload();
    await expect(
      therapistBPage.getByRole("button", { name: /claim assignment/i })
    ).toHaveCount(0);

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginAs(ownerPage, owner);
    await ownerPage.goto(bookingPath, { waitUntil: "domcontentloaded" });
    await expect(
      ownerPage.getByRole("heading", { name: /participants & assignments/i })
    ).toBeVisible();
    await expect(ownerPage.getByText(/booking assignment claimed/i)).toBeVisible();

    await therapistAContext.close();
    await therapistBContext.close();
    await ownerContext.close();
  });
});
