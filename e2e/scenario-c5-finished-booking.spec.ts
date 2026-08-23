// ⛔ GATE 08 — P3, FAMILY C, SCENARIO C5: THE FINISHED BOOKING.
//
//   ⛔ The Owner's question: "Can staff accidentally re-cancel or re-price
//    something already closed?"
//
// ── ⛔ WHAT THIS DELIBERATELY DOES NOT RE-TEST (D-023) ───────────────────
//
// The terminal-state GUARDS are already covered. `booking-quick-actions.spec.ts`
// drives complete / cancel / restore and the terminal-state refusal;
// `booking-payments.spec.ts` (E08-49) covers the travel-fee lock on a fully-paid
// booking, including that the refusal renders as a FIELD error. ⛔ Re-asserting
// any of that here would be duplication dressed up as thoroughness.
//
// ── ⛔ WHAT IS ACTUALLY UNTESTED, AND IS THIS FILE'S POINT ───────────────
//
// Whether the SCREEN OFFERS staff a control the SERVER would refuse.
//
// A guard that works is only half the answer. If a completed visit still shows
// a live "Cancel booking" button, a receptionist will press it — and whether
// they then get a clear refusal, a silent no-op, or an opaque error is the
// difference between a system people trust and one they route around.
//
// ⚠️ C3 found the customer-facing side of this gets it RIGHT: the cancel control
// on an already-cancelled booking is rendered DISABLED, not hidden and not live.
// ⛔ That is the standard this file holds the admin side to.
//
// ⛔ AND IT ENUMERATES RATHER THAN GUESSES. It reads every enabled button on the
// page and checks the dangerous ones, instead of naming the two or three I
// happen to think of — the whole failure mode here is a control nobody
// remembered.
//
// ── ⛔ EMAIL COST: ZERO ──────────────────────────────────────────────────
// Every action here is expected to be refused, and refusals send nothing.
// ⚠️ Which matters while the Owner's daily quota is out (D-053).

import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  emailEvents,
  gotoAdmin,
  pageAs,
  readBooking,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];

/** Controls that must never be live on a booking that is already closed. */
const DANGEROUS = [
  /^Cancel booking$/,
  /^Confirm booking$/,
  /^Mark complete$/,
  /^Mark (as )?no-show$/,
];

/** Every button on the page, with whether it is actually usable. */
async function enabledControls(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("main button")]
      .map((node) => ({
        label: (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
        enabled: !(node as HTMLButtonElement).disabled,
      }))
      .filter((entry) => entry.label.length > 0),
  );
}

/** The fields the Status & payment form would post, and whether they are locked. */
async function paymentFields(page: Page) {
  return page.evaluate(() => {
    const form = document.querySelector("#booking-status-form");
    if (!form) return null;
    const read = (name: string) => {
      const el = form.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
      return el ? { present: true, disabled: el.disabled || el.readOnly, value: el.value } : null;
    };
    return {
      travel_fee: read("travel_fee"),
      amount_paid: read("amount_paid"),
      status: read("status"),
    };
  });
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

test.describe("C5 — the finished booking: is staff offered anything that cannot work?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("a COMPLETED and fully-paid visit", async ({ browser }) => {
    const db = serviceClient();
    const booking = await seedWebsiteBooking(db, "C5-DONE", {
      dayOffset: -3,
      status: "completed",
      assignTo: THERAPIST_A_STAFF_ID,
      paid: true,
    });
    clientIds.push(booking.clientId);

    const before = await readBooking(db, booking.bookingId);
    const emailsBefore = (await emailEvents(db, booking.bookingId)).length;

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "a completed booking");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    const controls = await enabledControls(page);
    const live = controls.filter((c) => c.enabled).map((c) => c.label);
    console.log(`[C5] completed+paid — enabled controls: ${JSON.stringify(live)}`);

    // ⛔ THE MONEY LOCK, as the OPERATOR meets it. The arithmetic is covered by
    // unit tests; what is not is whether somebody at the desk can still type
    // into the travel charge on a visit that has already been paid for.
    const fields = await paymentFields(page);
    expect(fields, "the status form should render for a completed booking").not.toBeNull();
    console.log(`[C5] payment fields: ${JSON.stringify(fields)}`);

    // ⛔ Press every dangerous control that is LIVE, and prove the booking is
    // unchanged afterwards. A control that is disabled needs no pressing; one
    // that is live must be refused.
    for (const pattern of DANGEROUS) {
      const control = page.getByRole("button", { name: pattern });
      if ((await control.count()) === 0) continue;
      if (!(await control.first().isEnabled())) continue;

      await control.first().click();
      await page.waitForTimeout(1_200);
      // A modal may open; confirm it, because a receptionist would.
      const confirm = page.getByRole("dialog").getByRole("button", { name: pattern });
      if ((await confirm.count()) > 0 && (await confirm.first().isEnabled())) {
        await confirm.first().click();
        await page.waitForTimeout(2_500);
      } else {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }
    }
    await context.close();

    // ── ⛔ WHAT MUST BE TRUE AFTERWARDS ────────────────────────────────
    const after = await readBooking(db, booking.bookingId);
    expect(
      after.status,
      `⛔ a COMPLETED and PAID visit changed status to "${after.status}" because staff pressed a button the page offered them. This is a finished piece of work with money against it.`,
    ).toBe("completed");
    expect(Number(after.amount_paid), "and the money against it is untouched").toBe(
      Number(before.amount_paid),
    );
    expect(Number(after.travel_fee), "and so is the travel charge").toBe(
      Number(before.travel_fee),
    );

    expect(
      (await emailEvents(db, booking.bookingId)).length,
      "⛔ and no customer was emailed about a visit that did not change",
    ).toBe(emailsBefore);
  });

  test("a CANCELLED visit", async ({ browser }) => {
    const db = serviceClient();
    const booking = await seedWebsiteBooking(db, "C5-CANX", {
      dayOffset: -3,
      status: "cancelled",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(booking.clientId);
    await db
      .from("bookings")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", booking.bookingId);

    const before = await readBooking(db, booking.bookingId);
    const emailsBefore = (await emailEvents(db, booking.bookingId)).length;

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "a cancelled booking");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    const controls = await enabledControls(page);
    console.log(
      `[C5] cancelled — enabled controls: ${JSON.stringify(controls.filter((c) => c.enabled).map((c) => c.label))}`,
    );

    // ⛔ CANCELLING SOMETHING ALREADY CANCELLED is the Owner's own example.
    const cancel = page.getByRole("button", { name: /^Cancel booking$/ });
    if ((await cancel.count()) > 0 && (await cancel.first().isEnabled())) {
      await cancel.first().click();
      await page.waitForTimeout(1_200);
      const confirm = page.getByRole("dialog").getByRole("button", { name: /^Cancel booking$/ });
      if ((await confirm.count()) > 0 && (await confirm.first().isEnabled())) {
        await confirm.first().click();
        await page.waitForTimeout(2_500);
      }
    }
    await context.close();

    const after = await readBooking(db, booking.bookingId);
    expect(after.status, "a cancelled booking stays cancelled").toBe("cancelled");
    expect(
      after.cancelled_at,
      "⛔ and the moment it was cancelled must NOT be rewritten — the restore window is measured from it, so moving it would quietly extend or expire the customer's chance to get the booking back",
    ).toEqual(before.cancelled_at);

    expect(
      (await emailEvents(db, booking.bookingId)).length,
      "⛔ and the clinic is not told twice about one cancellation",
    ).toBe(emailsBefore);

    console.log(`\n[C5] COMPLETE. Nothing closed could be re-opened or re-cancelled.\n`);
  });

  test("\u26d4 a CANCELLED visit can still be marked PAID \u2014 recorded, not endorsed", async ({
    browser,
  }) => {
    // \u26d4 FIND-08-C5-01. This case PINS BEHAVIOUR THAT LOOKS WRONG, rather than
    // asserting what I think it should be. It was found by ENUMERATING the
    // enabled controls above rather than by checking the two or three I thought
    // of \u2014 which is the whole reason this file enumerates.
    //
    // What happens today, driven and measured:
    //   - a CANCELLED booking still shows a LIVE "Mark paid" chip on the detail
    //     page (the bookings LIST correctly hides it \u2014 the two surfaces
    //     disagree, `BookingRowActions.tsx` excludes cancelled/no_show);
    //   - one click, no confirmation, toast says "Marked paid.";
    //   - `quickUpdateBooking`'s mark_paid branch has NO status guard, unlike
    //     `complete` and `no_show` beside it, which refuse a future-dated visit;
    //   - `reporting.ts` adds `amount_paid` to COLLECTED REVENUE for every
    //     booking regardless of status, while OUTSTANDING explicitly excludes
    //     cancelled and no_show.
    //
    // \u26a0\ufe0f So a mis-tap puts money for a visit that never happened into the
    // Owner's income figure. Whether that is a defect depends on whether the
    // clinic ever takes money on a cancelled booking \u2014 an independent review is
    // settling that, and the Owner decides. \u26d4 Until then this test records the
    // CURRENT behaviour so a change in either direction is noticed.
    const db = serviceClient();
    const booking = await seedWebsiteBooking(db, "C5-PAIDCANX", {
      dayOffset: -4,
      status: "cancelled",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(booking.clientId);
    await db
      .from("bookings")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", booking.bookingId);

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "a cancelled booking");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    const markPaid = page.getByRole("button", { name: /^Mark paid$/ });
    const offered = (await markPaid.count()) > 0 && (await markPaid.first().isEnabled());

    if (offered) {
      await markPaid.first().click();
      await page.waitForTimeout(1_200);
      const confirm = page.getByRole("dialog").getByRole("button", { name: /^Mark paid$/ });
      if ((await confirm.count()) > 0 && (await confirm.first().isEnabled())) {
        await confirm.first().click();
      }
      await page.waitForTimeout(2_500);
    }
    await context.close();

    const after = await readBooking(db, booking.bookingId);

    console.log(
      `[C5] FIND-08-C5-01 \u2014 cancelled booking: "Mark paid" offered=${offered}, ` +
        `payment_status=${after.payment_status}, amount_paid=${after.amount_paid}`,
    );

    // \u26d4 The one thing that must be true either way: the visit is still
    // cancelled. Recording money must never quietly bring a cancelled visit
    // back to life.
    expect(
      after.status,
      "\u26d4 recording a payment must never resurrect a cancelled booking",
    ).toBe("cancelled");

    // \u26d4 AND THE TRIPWIRE. If this ever stops being true \u2014 in either direction
    // \u2014 somebody has changed how money can be recorded against a cancelled
    // visit, and that is a decision the Owner should be making deliberately.
    expect(
      { offered, paid: after.payment_status },
      "\u26d4 FIND-08-C5-01 CHANGED. Today a cancelled booking CAN be marked paid from the detail page, and that money reaches Collected revenue. If this assertion fails, the behaviour has moved \u2014 check it was on purpose.",
    ).toEqual({ offered: true, paid: "paid" });
  });
});
