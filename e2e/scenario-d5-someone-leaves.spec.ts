// ⛔ GATE 08 — P3, FAMILY D, SCENARIO D5: SOMEONE LEAVES.
//
//   ⛔ The Owner's question: "What happens to their bookings — and can they
//    still get in?"
//
// ── ⛔ WHY THE SECOND HALF IS THE DANGEROUS ONE ──────────────────────────
//
// The toggle in the admin says, in plain words, "Inactive staff can't sign in."
// ⚠️ But somebody who leaves on bad terms is not sitting at a login page — they
// already have a browser open, signed in, from this morning.
//
// ⛔ SO THIS TEST DOES NOT SIGN IN AFTER THE DEACTIVATION. It reuses the SESSION
// THAT WAS ALREADY OPEN, which is the only version of this question that matters.
// A test that logged in fresh would prove the login form works and would say
// nothing at all about the person who never logged out.
//
// ── ⛔ WHAT DEACTIVATION ACTUALLY DOES, READ FROM THE CODE ───────────────
//
// `updateStaffProfile` sets `active: false` and FORCES `can_take_bookings: false`
// alongside it. ⚠️ It does NOT touch their existing assignments. So a therapist
// who leaves today is still the named therapist on next month's visits.
//
// That is not obviously wrong — silently orphaning real bookings would be worse.
// ⛔ But it means the clinic MUST still be able to see those visits, or somebody
// will simply not turn up at a customer's house. Step 4 checks exactly that.
//
// ── ⚠️ THIS TEST CHANGES A REAL STAFF RECORD, SO IT PUTS IT BACK ─────────
//
// Therapist B is deactivated here on purpose. `afterAll` restores BOTH flags
// unconditionally and throws if the restore did not take — because leaving a
// therapist deactivated would silently break every other scenario that signs in
// as her, and the failure would look like something else entirely.
//
// ⛔ `can_take_bookings` must be restored EXPLICITLY. Reactivating an account
// does not turn it back on by itself, since deactivation forced it off.
//
// ── ⛔ EMAIL COST: ZERO ──────────────────────────────────────────────────

import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  gotoAdmin,
  pageAs,
  readAssignments,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_B_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
let hersUntilToday: SeededBooking;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const db = serviceClient();

  // ⛔ PUT THE PERSON BACK FIRST, before any fixture cleanup can fail and skip it.
  await db
    .from("staff_profiles")
    .update({ active: true, can_take_bookings: true })
    .eq("id", THERAPIST_B_STAFF_ID);

  const { data } = await db
    .from("staff_profiles")
    .select("active, can_take_bookings")
    .eq("id", THERAPIST_B_STAFF_ID)
    .single();
  const restored = data as { active: boolean; can_take_bookings: boolean } | null;

  if (!restored?.active || !restored?.can_take_bookings) {
    throw new Error(
      "⛔ THERAPIST B WAS LEFT DEACTIVATED. Every other scenario that signs in as her will now fail for a reason that looks like something else. Restore her by hand.",
    );
  }

  if (clientIds.length > 0) {
    await destroyScenarioFixtures(db, clientIds);
  }
});

/** What this browser can actually reach, without throwing on a refusal. */
async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_500);
  return {
    signedOut: /\/admin\/login/.test(page.url()),
    refused: (await page.locator("[data-admin-access-denied]").count()) > 0,
    text: (await page.locator("body").innerText()).replace(/\s+/g, " "),
  };
}

test.describe("D5 — someone leaves: what happens to their bookings, and can they still get in?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ THE CONTROL: while she still works here, it all works", async ({
    browser,
  }) => {
    const db = serviceClient();

    hersUntilToday = await seedWebsiteBooking(db, "D5-LEAVER", {
      dayOffset: 12,
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
      assignTo: THERAPIST_B_STAFF_ID,
    });
    clientIds.push(hersUntilToday.clientId);

    const seeded = await readAssignments(db, hersUntilToday.bookingId);
    expect(
      seeded[0].assigned_staff_id,
      "⛔ the fixture must be HER future work",
    ).toBe(THERAPIST_B_STAFF_ID);

    const { context, page } = await pageAs(browser, "therapist_b");
    const seen = await visit(page, `/admin/bookings/${hersUntilToday.bookingId}/`);
    await context.close();

    expect(seen.signedOut, "she must start out signed in").toBe(false);
    expect(
      seen.text,
      `⛔ WITHOUT THIS, STEP 3 PROVES NOTHING. If she could not reach her own booking while still employed, "she is shut out after leaving" would just be the normal state. It said: "${seen.text.slice(0, 300)}"`,
    ).toContain(hersUntilToday.name);

    console.log(`[D5] step 1 — control: while employed she reaches her own booking.`);
  });

  test("step 2 — ✅ the Owner marks her inactive", async ({ browser }) => {
    expect(hersUntilToday?.bookingId, "step 1 must have run").toBeTruthy();
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "owner");
    await gotoAdmin(page, `/admin/staff/${THERAPIST_B_STAFF_ID}/`, "her staff record");
    await page.waitForTimeout(2_500);

    // ⚠️ TARGETED BY ITS FORM NAME, NOT ITS LABEL, AND THAT IS A FINDING.
    // `getByRole("switch", { name: /Active account/i })` finds NOTHING here:
    // the three toggles on this page have no accessible name at all -- no
    // aria-label, no aria-labelledby, no text, no id. The words "Active
    // account" sit in a sibling paragraph that is never linked to the control.
    // ⛔ See FIND-08-D5-01. Recorded, not fixed.
    const toggle = page.locator('[role="switch"][name="active"]');
    await expect(
      toggle,
      "⛔ the Owner must be able to find the Active account control",
    ).toBeVisible({ timeout: 30_000 });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await page.waitForTimeout(3_000);
    await context.close();

    // ⛔ The database is the truth, not the toggle's appearance.
    const { data } = await db
      .from("staff_profiles")
      .select("active, can_take_bookings")
      .eq("id", THERAPIST_B_STAFF_ID)
      .single();
    const now = data as { active: boolean; can_take_bookings: boolean };

    expect(now.active, "⛔ she must actually be marked inactive").toBe(false);

    // ⛔ AND THE SIDE-EFFECT THAT MATTERS: leaving must also stop her being
    // handed NEW work. Marking somebody inactive while still letting the
    // assignment system pick them would be worse than not deactivating at all.
    expect(
      now.can_take_bookings,
      "⛔ deactivating must also stop her being given new bookings",
    ).toBe(false);

    console.log(`[D5] step 2 — she is inactive, and can no longer be given new work.`);
  });

  test("step 3 — ⛔ THE ONE THAT MATTERS: her browser was already open", async ({
    browser,
  }) => {
    expect(hersUntilToday?.bookingId, "step 1 must have run").toBeTruthy();

    // ⛔ The SAME stored session from step 1 — minted while she was still
    // employed, never logged out. This is the departing-employee case.
    const { context, page } = await pageAs(browser, "therapist_b");
    const booking = await visit(page, `/admin/bookings/${hersUntilToday.bookingId}/`);
    const dashboard = await visit(page, "/admin/dashboard/");
    await context.close();

    const shutOut =
      (booking.signedOut || booking.refused) &&
      (dashboard.signedOut || dashboard.refused);

    expect(
      shutOut,
      `⛔ A FORMER MEMBER OF STAFF STILL HAS THE DOOR OPEN. The admin promises "Inactive staff can't sign in", but she never signed in — her session was already live when she was deactivated. Booking page: signedOut=${booking.signedOut} refused=${booking.refused}. Dashboard: signedOut=${dashboard.signedOut} refused=${dashboard.refused}. It said: "${booking.text.slice(0, 300)}"`,
    ).toBe(true);

    expect(
      booking.text,
      "⛔ and she must not still be able to read the customer's details",
    ).not.toContain(hersUntilToday.name);

    console.log(
      `[D5] step 3 — her live session is shut out too: booking refused=${booking.refused} signedOut=${booking.signedOut}.`,
    );
  });

  test("step 4 — ⛔ her visits must not quietly become nobody's problem", async ({
    browser,
  }) => {
    expect(hersUntilToday?.bookingId, "step 1 must have run").toBeTruthy();
    const db = serviceClient();

    // ⛔ The booking still exists and still names her. That is deliberate —
    // silently orphaning real customer bookings would be worse.
    const assignments = await readAssignments(db, hersUntilToday.bookingId);
    expect(
      assignments[0].assigned_staff_id,
      "the visit should still record who was on it",
    ).toBe(THERAPIST_B_STAFF_ID);

    // ⛔ SO THE CLINIC MUST STILL BE ABLE TO SEE IT. If a departed therapist's
    // future visits disappeared from the Owner's view, nobody would turn up at
    // the customer's house and nobody would know until they complained.
    const { context, page } = await pageAs(browser, "owner");
    const seen = await visit(page, `/admin/bookings/${hersUntilToday.bookingId}/`);
    await context.close();

    expect(seen.signedOut, "the Owner must be signed in").toBe(false);
    expect(
      seen.refused,
      "⛔ the Owner must still be able to open a visit belonging to somebody who has left",
    ).toBe(false);
    expect(
      seen.text,
      `⛔ A DEPARTED THERAPIST'S FUTURE VISIT IS INVISIBLE TO THE OWNER. Somebody would simply not turn up. It said: "${seen.text.slice(0, 300)}"`,
    ).toContain(hersUntilToday.name);

    console.log(
      `[D5] step 4 — the visit is still there and the Owner can still see it, so it can be reassigned.`,
    );
  });

  test("step 5 — ✅ and she can be brought back", async ({ browser }) => {
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "owner");
    await gotoAdmin(page, `/admin/staff/${THERAPIST_B_STAFF_ID}/`, "her staff record");
    await page.waitForTimeout(2_500);

    const toggle = page.locator('[role="switch"][name="active"]');
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await page.waitForTimeout(3_000);
    await context.close();

    const { data } = await db
      .from("staff_profiles")
      .select("active, can_take_bookings")
      .eq("id", THERAPIST_B_STAFF_ID)
      .single();
    const back = data as { active: boolean; can_take_bookings: boolean };

    expect(back.active, "⛔ reactivating must actually work").toBe(true);

    // ⚠️ RECORDED, NOT ASSERTED. Deactivation forced `can_take_bookings` off;
    // whether coming back should turn it on again is the Owner's call, not
    // mine. `afterAll` restores it either way so the roster is left as found.
    console.log(
      `\n[D5] COMPLETE. Reactivated. can_take_bookings came back as ${back.can_take_bookings} — recorded, not judged: turning it back on may well be a deliberate second decision for the Owner to make.\n`,
    );
  });
});
