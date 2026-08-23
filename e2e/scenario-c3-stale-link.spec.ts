// ⛔ GATE 08 — P3, FAMILY C, SCENARIO C3: THE STALE LINK.
//
//   ⛔ The Owner's question: "Do old or meddled-with links fail safely instead
//    of doing something odd?"
//
// Every customer gets a "manage your booking" link by email. It is a URL with a
// secret in it, it has no password behind it, and it lives in an inbox for as
// long as the customer keeps the message. ⛔ That makes it the ONE public
// doorway into a real customer's record — their name, their home address, and
// the ability to cancel a visit.
//
// ── ⛔ WHY THE WORKING LINK IS TESTED FIRST, AND WHY THAT IS NOT PADDING ──
//
// Three of the four cases here assert that something is REFUSED. ⛔ A page that
// was simply broken for everybody would pass all three and prove nothing —
// that is the single most common way a security test lies.
//
// So case 1 proves a GOOD link really does open a real booking and show the
// customer their details. Only against that control do the refusals below mean
// "this was rejected" rather than "nothing works".
//
// ── ⛔ WHAT THE GUARD ACTUALLY IS ────────────────────────────────────────
//
// `getCustomerManageBooking` (`customer-manage.ts:278`) looks the booking up by
//   .eq("manage_token_hash", sha256(token))
//   .gt("manage_token_expires_at", now)
// ⛔ BOTH conditions, in the database query itself. A wrong token finds no row;
// an expired one finds no row. ⚠️ Only the HASH is stored, so even a leaked
// database cannot hand anybody a working link.
//
// ── ⛔ EMAIL COST: ZERO ──────────────────────────────────────────────────
// Every case here is a refusal, and refusals send nothing. ⚠️ Which matters
// today: the Owner's Resend daily quota is exhausted (D-053).

import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  emailEvents,
  isoDaysFromToday,
  mintManageUrl,
  readBooking,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
let live: SeededBooking;
let liveManageUrl = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

/**
 * What the customer actually sees at a manage URL.
 *
 * \u26d4 `canCancel` means ENABLED, not merely PRESENT, and that distinction
 * cost a run. Counting the button's existence reported that the page offers
 * to cancel an already-cancelled booking \u2014 it does not: the button is
 * rendered `disabled`. \u26a0\ufe0f A check that cannot tell a live control from a
 * greyed-out one will invent friction that is not there.
 */
async function openAsCustomer(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_500);

  const cancel = page.getByRole("button", { name: /^Cancel booking$/ });
  const reschedule = page.getByRole("button", { name: /^Send request$/ });

  return {
    text: (await page.locator("body").innerText()).replace(/\s+/g, " "),
    cancelPresent: (await cancel.count()) > 0,
    canCancel: (await cancel.count()) > 0 && (await cancel.first().isEnabled()),
    canReschedule:
      (await reschedule.count()) > 0 && (await reschedule.first().isEnabled()),
  };
}

test.describe("C3 — the stale link: do old or meddled-with links fail safely?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("case 1 — ⛔ THE CONTROL: a good link opens the customer's booking", async ({ page }) => {
    const db = serviceClient();
    live = await seedWebsiteBooking(db, "C3-LIVE", {
      dayOffset: 20,
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(live.clientId);
    liveManageUrl = await mintManageUrl(db, live.bookingId, live.date);

    const seen = await openAsCustomer(page, liveManageUrl);

    expect(
      seen.text,
      `⛔ WITHOUT THIS, EVERY REFUSAL BELOW IS MEANINGLESS. A page that is broken for everybody would "reject" a tampered link too. It said: "${seen.text.slice(0, 300)}"`,
    ).toContain(live.name);
    expect(seen.canCancel, "a customer with a live booking can cancel it").toBe(true);
    expect(seen.canReschedule, "and can ask to move it").toBe(true);
  });

  test("case 2 — ⛔ an EXPIRED link shows nothing and does nothing", async ({ page }) => {
    expect(liveManageUrl, "the control must have run").not.toBe("");
    const db = serviceClient();

    // The same booking, the same token — only time has passed. ⛔ That is what
    // makes this case about EXPIRY and nothing else.
    await db
      .from("bookings")
      .update({ manage_token_expires_at: new Date(`${isoDaysFromToday(-2)}T23:59:59.000Z`).toISOString() })
      .eq("id", live.bookingId);

    const seen = await openAsCustomer(page, liveManageUrl);

    expect(
      seen.text,
      `⛔ an EXPIRED link still showed the customer's details. This link sits in an inbox for ever — expiry is what stops an old email being a permanent key to somebody's record. It said: "${seen.text.slice(0, 300)}"`,
    ).not.toContain(live.name);
    expect(
      seen.canCancel,
      "⛔ and it must not still offer to cancel a real visit",
    ).toBe(false);

    // Put it back so case 4 has a working link to work with.
    await db
      .from("bookings")
      .update({ manage_token_expires_at: new Date(`${live.date}T23:59:59.000Z`).toISOString() })
      .eq("id", live.bookingId);
  });

  test("case 3 — ⛔ a TAMPERED token opens nothing", async ({ page }) => {
    expect(live?.bookingId, "the control must have run").toBeTruthy();

    // ⛔ A well-formed token that simply is not the right one — what somebody
    // gets by editing the URL, or by trying another customer's link shape.
    const tampered = `/booking/manage?token=${encodeURIComponent(randomUUID())}`;
    const guessed = await openAsCustomer(page, tampered);

    expect(
      guessed.text,
      `⛔ a made-up token opened a booking. That would make every customer's record reachable by guessing. It said: "${guessed.text.slice(0, 300)}"`,
    ).not.toContain(live.name);
    expect(guessed.canCancel, "and it must not offer to cancel anything").toBe(false);

    // ⛔ THE HASH ITSELF IS NOT A KEY. Only the sha256 is stored, so even
    // somebody holding the database cannot turn it back into a working link.
    const { data } = await serviceClient()
      .from("bookings")
      .select("manage_token_hash")
      .eq("id", live.bookingId)
      .single();
    const storedHash = (data as { manage_token_hash: string | null })?.manage_token_hash ?? "";
    expect(storedHash, "the booking should hold a token hash").not.toBe("");

    const usingTheHash = await openAsCustomer(
      page,
      `/booking/manage?token=${encodeURIComponent(storedHash)}`,
    );
    expect(
      usingTheHash.text,
      "⛔ the STORED HASH worked as a link. Only the hash is kept precisely so that a database leak is not a set of working keys to every customer's booking.",
    ).not.toContain(live.name);

    // And an empty token, which is what a truncated email produces.
    const empty = await openAsCustomer(page, "/booking/manage?token=");
    expect(empty.text).not.toContain(live.name);
    expect(empty.canCancel).toBe(false);
  });

  test("case 4 — \u26d4 an ALREADY-cancelled booking cannot be cancelled again", async ({
    page,
  }) => {
    const db = serviceClient();

    const cancelled = await seedWebsiteBooking(db, "C3-CANX", {
      dayOffset: 21,
      status: "cancelled",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(cancelled.clientId);
    await db
      .from("bookings")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", cancelled.bookingId);
    const url = await mintManageUrl(db, cancelled.bookingId, cancelled.date);

    const seen = await openAsCustomer(page, url);

    // \u26a0\ufe0f I NEARLY REPORTED FRICTION HERE THAT DOES NOT EXIST.
    //
    // An earlier version counted whether the "Cancel booking" button was
    // PRESENT and concluded the page offers a dead-end action. \u26d4 It does not:
    // the button is rendered DISABLED. The check could not tell a live control
    // from a greyed-out one \u2014 the same shape of mistake as asserting something
    // is absent from a check that could never have seen it.
    expect(
      seen.cancelPresent,
      "the control is still rendered, so the customer can see cancelling was an option",
    ).toBe(true);
    expect(
      seen.canCancel,
      "\u26d4 but it must be DISABLED. Offering to cancel a booking that is already cancelled is a dead end \u2014 and a live one would mean a second cancellation alert to the clinic.",
    ).toBe(false);

    // \u2705 The customer can still SEE their booking. They are entitled to check
    // what happened to it; what they must not be given is an action that cannot
    // work.
    expect(
      seen.text,
      "a customer may still look at their own cancelled booking",
    ).toContain(cancelled.name);

    // \u26d4 And nothing about it changed by looking.
    const after = await readBooking(db, cancelled.bookingId);
    expect(after.status).toBe("cancelled");
    expect(
      await emailEvents(db, cancelled.bookingId),
      "\u26d4 opening a cancelled booking must not mail the clinic about it again",
    ).toHaveLength(0);

    console.log(
      `\n[C3] COMPLETE. good link: opens. expired: closed. tampered: closed. stored hash: not a key. cancelled: control disabled, nothing changed.\n`,
    );
  });
});
