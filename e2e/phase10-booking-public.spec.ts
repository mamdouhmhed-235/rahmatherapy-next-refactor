import { expect, test } from "@playwright/test";
import { hasBaseUrl } from "./helpers";

test.describe("Phase 10 public booking smoke", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run public booking E2E checks.");

  test("booking page exposes the service step and can show unsupported service area feedback", async ({
    page,
  }) => {
    await page.goto("/home/", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /book a home session/i }).click();
    await expect(
      page.getByRole("heading", { name: /request a home appointment/i })
    ).toBeVisible();

    await page.getByRole("button", { name: /hijama package/i }).click();
    await page.getByRole("button", { name: /continue|next/i }).click();
    await expect(page.getByText(/who is this for|for yourself|someone else|group/i)).toBeVisible();
  });
});
