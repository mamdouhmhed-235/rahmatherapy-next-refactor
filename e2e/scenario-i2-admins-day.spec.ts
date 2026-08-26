// ⛔ GATE 08 — P3, FAMILY I, SCENARIO I2: THE ADMIN'S DAY.
//
//   ⛔ The Owner's question: "Can a practice manager get through a day without
//    hitting a wall?"
//
// The admin is the person who makes the clinic work when the Owner is treating
// somebody. ⚠️ Her day is not one task — it is four unrelated ones in quick
// succession, and the failure that matters is having to stop and ask.
//
// ── ⛔ WHAT A WALL LOOKS LIKE, AND WHY IT IS DIFFERENT FROM A BUG ────────
//
// A wall is: a step that needs a page her role cannot open; a value she has to
// copy by hand from one screen to another; a change that cannot be undone; or a
// dead end with no way back. ⛔ None of those are defects — every one of them
// "works" — and none would be caught by testing features one at a time.
//
// Findings are FRICTION. Only a step she cannot complete at all fails this.
//
// ── ⛔ EMAIL COST: assigning a therapist notifies staff, and chasing an email
// resends one. Budget three or four, mostly to `@example.test` fixtures.

import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  emailEvents,
  isoDaysFromToday,
  pageAs,
  readAssignments,
  RUN_TAG,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  waitForEmailEvents,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
const friction: string[] = [];
const day: string[] = [];
let unstaffed: SeededBooking;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

async function bodyOf(page: Page) {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

test.describe("I2 — the admin's day: can a practice manager get through it without a wall?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("four jobs in a row: assign the day's work → edit a client → chase an email → adjust a staff profile", async ({
    browser,
  }) => {
    test.setTimeout(420_000);
    const db = serviceClient();

    // ⛔ A visit nobody is going to, which is the thing that ruins a clinic's
    // day if it is not spotted.
    unstaffed = await seedWebsiteBooking(db, "I2-UNSTAFFED", {
      dayOffset: 2,
      startTime: "11:00:00",
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
    });
    clientIds.push(unstaffed.clientId);

    const { context, page } = await pageAs(browser, "admin");

    // ── JOB 1: somebody has to go to that visit ────────────────────────
    await page.goto(`/admin/bookings/${unstaffed.bookingId}/`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2_500);

    const assignTrigger = page.getByRole("button", { name: /^Assign therapist$/i }).first();
    expect(
      await assignTrigger.count(),
      "⛔ SHE CANNOT STAFF A VISIT. A booking nobody is going to is the one thing an admin's day exists to prevent.",
    ).toBeGreaterThan(0);
    await assignTrigger.click();
    await page.waitForTimeout(2_000);

    const chooser = page.getByRole("dialog");
    const offered = chooser
      .getByRole("button")
      .filter({ hasNotText: /^Close$|^Show all staff$|^Show eligible only$/ });
    const howMany = await offered.count();
    expect(
      howMany,
      "⛔ nobody was offered for this visit — a booking the clinic cannot staff at all",
    ).toBeGreaterThan(0);

    // ⛔ NEVER THE REAL OWNER. His staff address is the live business inbox.
    const safe = offered.filter({ hasNotText: /Minhaj rahman/ });
    expect(
      await safe.count(),
      "⛔ the only person offered was the real Owner — refusing to assign them",
    ).toBeGreaterThan(0);
    await safe.first().click();
    await page.waitForTimeout(5_000);

    const assigned = await readAssignments(db, unstaffed.bookingId);
    expect(
      assigned[0].assigned_staff_id,
      "⛔ the assignment did not stick — the visit still has nobody going to it",
    ).not.toBeNull();
    day.push("staffed the unassigned visit — from the booking itself");

    // ── JOB 2: a customer has moved house ──────────────────────────────
    // ⛔ Can she get from the BOOKING to the CUSTOMER without going back to a
    // list and searching? Having to re-find somebody she is already looking at
    // is the classic copy-it-by-hand wall.
    await page.goto(`/admin/bookings/${unstaffed.bookingId}/`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2_500);

    const toClient = page
      .getByRole("link", { name: new RegExp(unstaffed.name.slice(0, 20)) })
      .or(page.getByRole("link", { name: /view client|client record|profile/i }))
      .first();

    if ((await toClient.count()) > 0 && (await toClient.isVisible().catch(() => false))) {
      await toClient.click();
      await page.waitForTimeout(3_000);
      day.push("reached the customer's record — one click from their booking");
    } else {
      friction.push(
        "there is no link from a booking to the customer's own record — she has to go back to the client list and search for somebody she is already looking at",
      );
      await page.goto(`/admin/clients/${unstaffed.clientId}/`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(3_000);
      day.push("reached the customer's record — by going the long way round");
    }

    const onClient = await bodyOf(page);
    expect(
      onClient.includes(unstaffed.name),
      `⛔ she cannot open the customer's record at all. It said: "${onClient.slice(0, 300)}"`,
    ).toBe(true);

    // ⛔ AND SHE CAN ACTUALLY CHANGE IT. A record she can read but not correct
    // means every typo becomes the Owner's job.
    const canEdit =
      (await page.getByRole("link", { name: /^Edit/i }).count()) > 0 ||
      (await page.getByRole("button", { name: /^Edit/i }).count()) > 0;
    expect(
      canEdit,
      "⛔ SHE CANNOT CORRECT A CUSTOMER'S DETAILS. Every change of address becomes somebody else's job.",
    ).toBe(true);
    day.push("the customer's details — editable, not read-only");

    // ── JOB 3: "they say they never got it" ────────────────────────────
    const before = (await emailEvents(db, unstaffed.bookingId)).length;

    // ⛔ SEARCHED BY ADDRESS — the way she would, and the route that was broken
    // until it was fixed this session (FIND-08-G2-01).
    await page.goto(
      `/admin/emails/?range=custom&from=${isoDaysFromToday(-1)}&to=${isoDaysFromToday(30 + (Date.now() % 300))}&q=${encodeURIComponent(unstaffed.email)}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(3_000);
    const log = await bodyOf(page);

    expect(
      /Couldn't load email events/i.test(log),
      "⛔ THE EMAIL SEARCH IS BROKEN AGAIN — she cannot answer 'did they get it?' at all",
    ).toBe(false);

    const resend = page.getByRole("button", { name: /^Resend/ });
    const resendCount = await resend.count();
    if (resendCount === 0) {
      friction.push(
        "she found the customer's messages but was offered no way to send one again from the list",
      );
      day.push("chased the missing email — found it, but could not act on it here");
    } else {
      const labels: string[] = [];
      for (let i = 0; i < resendCount; i += 1) {
        labels.push((await resend.nth(i).getAttribute("aria-label")) ?? "");
      }
      const mine = labels.findIndex((l) => l.includes(unstaffed.email));
      if (mine < 0) {
        friction.push(
          `she could see this customer's messages but the resend controls were for other people: ${JSON.stringify(labels.slice(0, 4))}`,
        );
        day.push("chased the missing email — found it, but could not act on it here");
      } else {
        await resend.nth(mine).click();
        await page.waitForTimeout(1_500);
        const confirm = page
          .getByRole("dialog")
          .getByRole("button", { name: "Resend", exact: true });
        if ((await confirm.count()) > 0) await confirm.first().click();
        await page.waitForTimeout(4_000);
        // ⚠️ WORDED AFTER CHECKING, NOT BEFORE. A first version logged "found
        // and resent" regardless — but the count did not move, because the
        // assignment email had gone out moments earlier and the 60-second rate
        // limiter refused the resend. ⛔ That limiter is deliberate and G2
        // proved it; what would have been wrong is a record claiming a message
        // was sent when none was.
        const nowCount = (await emailEvents(db, unstaffed.bookingId)).length;
        day.push(
          nowCount > before
            ? "chased the missing email — found by address and resent, in one place"
            : "chased the missing email — found by address in one place; the resend was refused by the 60-second anti-spam limiter, which is correct",
        );
      }
    }

    // ── JOB 4: a therapist's profile needs a tweak ─────────────────────
    await page.goto(`/admin/staff/${THERAPIST_A_STAFF_ID}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);
    const staffPage = await bodyOf(page);

    expect(
      /\/admin\/login/.test(page.url()),
      "⛔ signed out on the way to a staff profile",
    ).toBe(false);
    expect(
      staffPage.length,
      "⛔ SHE CANNOT OPEN A STAFF PROFILE. Adjusting who works when becomes the Owner's job.",
    ).toBeGreaterThan(200);

    // ⛔ And something on it is actually adjustable.
    const adjustable =
      (await page.locator('[role="switch"]').count()) > 0 ||
      (await page.getByRole("button", { name: /save/i }).count()) > 0;
    expect(
      adjustable,
      "⛔ she can look at a staff profile but change nothing on it",
    ).toBe(true);
    day.push("a staff profile — open and adjustable");

    await context.close();

    // ── THE VERDICT ────────────────────────────────────────────────────
    const after = await waitForEmailEvents(db, unstaffed.bookingId, before + 1, {
      attempts: 6,
      waitMs: 2_000,
    });
    console.log(
      `[I2] messages on that booking: ${before} before the day, ${after.length} after.`,
    );

    console.log(`\n[I2] THE ADMIN'S DAY:\n   ${day.join("\n   ")}`);
    console.log(
      friction.length === 0
        ? `\n[I2] ✅ NO WALLS. She got through all four jobs without stopping to ask.\n`
        : `\n[I2] ⚠️ FRICTION (${friction.length}) — reported, NOT failed:\n   - ${friction.join("\n   - ")}\n`,
    );

    expect(
      day.length,
      `⛔ her day did not complete — she got as far as: ${JSON.stringify(day)}`,
    ).toBeGreaterThanOrEqual(5);

    expect(
      friction.length,
      `⛔ THE PRACTICE MANAGER'S DAY HAS WALLS IN IT — ${friction.length}: ${JSON.stringify(friction)}`,
    ).toBeLessThanOrEqual(3);
  });
});
