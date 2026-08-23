// ⛔ GATE 08 — P3, FAMILY D, SCENARIO D1: NEW THERAPIST ONBOARDING.
//
//   ⛔ The Owner's question: "Can I actually take on a new member of staff with
//    what's here?"
//
// ── ⛔ THE HONEST ANSWER, WHICH THIS TEST PINS RATHER THAN DISCOVERS ─────
//
// Mostly yes, with ONE gap the app is already honest about.
//
// `createStaffProfile` writes a `staff_profiles` row and an audit entry. ⛔ It
// creates NO sign-in account — `auth_user_id` stays null — so the new person
// exists, can be given a role, can be made bookable and can be offered work,
// but cannot log in until somebody provisions their account separately.
//
// ⚠️ THIS IS NOT A NEW FINDING AND MUST NOT BE REPORTED AS ONE. The dialog used
// to promise "They'll receive a sign-in invitation by email", which was false.
// That was found and corrected on 2026-08-17 (F4) — the screen now says sign-in
// is set up separately, and the remaining work (making an invitation real) is
// recorded as F4 option A.
//
// ⛔ SO STEP 1 GUARDS THAT FIX. A screen that goes back to promising an email
// nobody sends would leave a new therapist waiting for an invitation that never
// arrives, and the Owner believing the hire was finished.
//
// ── ⛔ WHAT THE FOUR STEPS PROVE ─────────────────────────────────────────
//
//   1. the Owner can create the person, and the screen tells the truth
//   2. the person can be made bookable
//   3. the clinic can actually offer them work — the real test of "bookable"
//   4. and, recorded not judged, they still cannot sign in
//
// ── ⚠️ THIS CREATES A REAL STAFF RECORD ─────────────────────────────────
// `afterAll` deletes the profile and its audit rows, then RE-READS to confirm.
// ⛔ A leftover bookable therapist would sit in the assignment chooser for ever.
//
// ── ⛔ EMAIL COST: ZERO ──────────────────────────────────────────────────
// Nothing here sends. The fixture's own address is `@example.test`, which is a
// reserved undeliverable domain, and step 3 stops at being OFFERED the work
// rather than accepting it.

import { expect, test } from "@playwright/test";
import {
  destroyScenarioFixtures,
  gotoAdmin,
  pageAs,
  RUN_TAG,
  seedWebsiteBooking,
  serviceClient,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const NEW_NAME = `ZZTEST D1 Newstarter ${RUN_TAG}`;
const NEW_EMAIL = `zztest.d1.${RUN_TAG}@example.test`;

const clientIds: string[] = [];
let newStaffId = "";
let jobForHer: SeededBooking;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const db = serviceClient();

  if (clientIds.length > 0) {
    await destroyScenarioFixtures(db, clientIds);
  }

  // ⛔ The staff row goes LAST and is verified, because a leftover bookable
  // therapist would keep appearing in the assignment chooser for ever.
  const { data: found } = await db
    .from("staff_profiles")
    .select("id")
    .eq("email", NEW_EMAIL);
  const ids = ((found ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return;

  await db.from("audit_logs").delete().in("target_id", ids);
  await db.from("staff_profiles").delete().in("id", ids);

  const { data: survivors } = await db
    .from("staff_profiles")
    .select("id")
    .eq("email", NEW_EMAIL);
  if ((survivors ?? []).length > 0) {
    throw new Error(
      `⛔ TEARDOWN FAILED: the test therapist ${NEW_EMAIL} is still on the roster and will keep being offered real work.`,
    );
  }
});

test.describe("D1 — new therapist onboarding: can the Owner actually take somebody on?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ✅ the Owner creates the person, and the screen tells the truth", async ({
    browser,
  }) => {
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "owner");
    await gotoAdmin(page, "/admin/staff/", "the staff page");
    await page.waitForTimeout(2_000);

    await page.getByRole("button", { name: /^Add staff member$/ }).first().click();
    await page.waitForTimeout(1_500);

    const dialog = page.getByRole("dialog");
    await expect(
      dialog,
      "⛔ the Owner must be able to open the add-staff form",
    ).toBeVisible({ timeout: 15_000 });

    // ⛔ THE REGRESSION GUARD (F4, 2026-08-17). This screen once promised an
    // email invitation that nothing sends. If it ever says that again, a new
    // therapist waits for a message that never arrives while the Owner believes
    // the hire is done.
    const dialogText = (await dialog.innerText()).replace(/\s+/g, " ");
    expect(
      /invitation by email|sign-in invitation|invite/i.test(dialogText),
      `⛔ THE ADD-STAFF SCREEN IS PROMISING AN EMAIL AGAIN. Nothing sends one — creating a staff member writes a profile row and no sign-in account. It said: "${dialogText.slice(0, 400)}"`,
    ).toBe(false);
    expect(
      /set up separately|separately/i.test(dialogText),
      `⛔ the screen must SAY that sign-in is arranged separately, not stay silent about it. It said: "${dialogText.slice(0, 400)}"`,
    ).toBe(true);

    await page.locator("#staff-name").fill(NEW_NAME);
    await page.locator("#staff-email").fill(NEW_EMAIL);
    await page.locator("#staff-role").selectOption({ label: "Therapist" });
    await page.locator("#staff-gender").selectOption("female");
    await page.waitForTimeout(500);

    await dialog.getByRole("button", { name: /^Add staff member$/ }).click();
    await page.waitForTimeout(4_000);
    await context.close();

    // ⛔ The database is the truth.
    const { data } = await db
      .from("staff_profiles")
      .select("*")
      .eq("email", NEW_EMAIL)
      .maybeSingle();
    const created = data as {
      id: string;
      name: string;
      active: boolean;
      gender: string;
      auth_user_id: string | null;
      can_take_bookings: boolean;
    } | null;

    expect(created, "⛔ the new member of staff must actually exist").not.toBeNull();
    newStaffId = created!.id;
    expect(created!.name).toBe(NEW_NAME);
    expect(created!.gender, "the gender chosen must be what was saved").toBe("female");
    expect(created!.active, "a new hire should arrive active").toBe(true);

    console.log(
      `[D1] step 1 — created ${NEW_NAME}: active=${created!.active}, can_take_bookings=${created!.can_take_bookings}, auth_user_id=${created!.auth_user_id}`,
    );
  });

  test("step 2 — ✅ the Owner can make them bookable", async ({ browser }) => {
    expect(newStaffId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "owner");
    await gotoAdmin(page, `/admin/staff/${newStaffId}/`, "the new therapist's record");
    await page.waitForTimeout(2_500);

    // ⚠️ By form name, not label — these toggles have no accessible name at
    // all. See FIND-08-D5-01.
    const toggle = page.locator('[role="switch"][name="can_take_bookings"]');
    await expect(
      toggle,
      "⛔ the Owner must be able to find the Can take bookings control",
    ).toBeVisible({ timeout: 30_000 });

    if ((await toggle.getAttribute("aria-checked")) !== "true") {
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      await page.waitForTimeout(3_000);
    }
    await context.close();

    const { data } = await db
      .from("staff_profiles")
      .select("can_take_bookings, active")
      .eq("id", newStaffId)
      .single();
    const now = data as { can_take_bookings: boolean; active: boolean };

    expect(
      now.can_take_bookings,
      "⛔ a new therapist must be able to be marked as taking bookings",
    ).toBe(true);
    expect(now.active, "and must still be active").toBe(true);

    console.log(`[D1] step 2 — she is now bookable.`);
  });

  test("step 3 — ⛔ THE REAL TEST OF 'BOOKABLE': the clinic can offer her work", async ({
    browser,
  }) => {
    expect(newStaffId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    // ⛔ An unassigned, female-required visit on a working weekday — the exact
    // situation in which a new female therapist should become an option.
    jobForHer = await seedWebsiteBooking(db, "D1-FORHER", {
      dayOffset: 11,
      startTime: "11:00:00",
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
    });
    clientIds.push(jobForHer.clientId);

    const { context, page } = await pageAs(browser, "owner");
    await gotoAdmin(page, `/admin/bookings/${jobForHer.bookingId}/`, "the unstaffed booking");
    await page.waitForTimeout(2_000);

    await page.getByRole("button", { name: /^Assign therapist$/i }).first().click();
    await page.waitForTimeout(2_000);

    const chooser = page.getByRole("dialog");
    await expect(
      chooser.getByText(/Assign a therapist/i),
      "⛔ the assignment chooser must open",
    ).toBeVisible({ timeout: 15_000 });

    const offeredText = (await chooser.innerText()).replace(/\s+/g, " ");

    // ⛔ THE CONTROL: somebody is offered at all. If the chooser were empty this
    // step would "fail to find her" for a reason that has nothing to do with
    // her.
    expect(
      offeredText.length,
      "⛔ the chooser must actually list candidates",
    ).toBeGreaterThan(20);

    // ⛔ NOTHING IS CLICKED. Being OFFERED is the claim under test, and
    // accepting would send staff notifications for no extra proof.
    await context.close();

    expect(
      offeredText,
      `⛔ A BRAND-NEW BOOKABLE THERAPIST IS NOT OFFERED WORK SHE MATCHES. Hiring somebody would then be pointless — she would sit on the roster and never be given anything. The chooser said: "${offeredText.slice(0, 400)}"`,
    ).toContain(NEW_NAME);

    console.log(`[D1] step 3 — she is offered the job, so the hire is real to the system.`);
  });

  test("step 4 — ⚠️ RECORDED, NOT JUDGED: she still cannot sign in", async () => {
    expect(newStaffId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    const { data } = await db
      .from("staff_profiles")
      .select("auth_user_id")
      .eq("id", newStaffId)
      .single();
    const linked = (data as { auth_user_id: string | null }).auth_user_id;

    // ⛔ This is a TRIPWIRE on known, documented behaviour, not an accusation.
    // Creating a staff profile provisions no sign-in account (F4 option A). The
    // screen says so. If that ever changes, it should be because somebody built
    // the invitation, and this assertion is where they will find out.
    expect(
      linked,
      "⚠️ a sign-in account now exists for a newly created staff member. That is very likely GOOD NEWS — F4 option A may have been built — but it changes what onboarding means, so it must be a deliberate change rather than a surprise.",
    ).toBeNull();

    console.log(
      `\n[D1] COMPLETE. The Owner can create a therapist, give her a role, make her bookable and have the system offer her real work. ⚠️ The last mile — actually signing in — is still provisioned separately, and the screen says so.\n`,
    );
  });
});
