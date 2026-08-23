// ⛔ GATE 08 — P3, FAMILY B, SCENARIO B3: THE HANDOVER.
//
//   ⛔ The Owner's question: "Does the first therapist actually lose access, and
//    the second gain it?"
//
// A therapist claims a job off the board. Something comes up and she cannot do
// it, so an admin hands it to a colleague. ⛔ The customer's details must travel
// WITH the job — appearing for whoever holds it and disappearing for whoever
// does not. Health notes and a home address are the most sensitive things this
// clinic holds, and a home visit means a therapist is being sent to somebody's
// house.
//
// ── ⛔ THE INVARIANT THIS PROVES, AND WHY IT NEEDS A JOURNEY ─────────────
//
// A therapist who has NOT claimed a booking sees it REDACTED — measured, the
// participant reads "Person 1", the header reads "Claimable booking", and the
// address panel says "No address recorded for this booking" even though the
// booking HAS an address. Claiming reveals it. Reassignment must take it away
// again.
//
// ⛔ That is three different states of the SAME page for the SAME person, and
// only a journey can catch a leak in the transition. A per-screen case would
// check one of them and move on.
//
// ⚠️ `cross-therapist-isolation.spec.ts` already proves therapist A cannot see
// therapist B's work. ⛔ What it does NOT cover is the HAND-OVER: a booking that
// was legitimately yours and then is not. That is this file.
//
// ── ⛔ EMAIL COST: ONE message to the real business inbox ────────────────
// The claim (`sendClaimNotificationEmail` → the business resolver). ✅ The
// reassignment mails the OUTGOING therapist and the customer, both of which are
// test addresses — asserted, not assumed.

import { expect, test } from "@playwright/test";
import {
  auditActions,
  awaitAction,
  destroyScenarioFixtures,
  emailEvents,
  expectOwnerNeverAssigned,
  gotoAdmin,
  pageAs,
  readAssignments,
  readBooking,
  REAL_OWNER_INBOX,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  THERAPIST_B_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

let booking: SeededBooking;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (!booking?.clientId) return;
  await destroyScenarioFixtures(serviceClient(), [booking.clientId]);
});

/** What the page shows this therapist about the customer. */
async function whatTheTherapistSees(
  browser: import("@playwright/test").Browser,
  role: "therapist_a" | "therapist_b",
  bookingId: string,
) {
  const { context, page } = await pageAs(browser, role);
  // ⛔ NOT `gotoAdmin`: a REFUSAL is a legitimate outcome here and that
  // helper throws on one. ⚠️ Measured — once a booking is handed to a
  // colleague the outgoing therapist is refused the page OUTRIGHT
  // (`[data-admin-access-denied]`) rather than shown a redacted copy. That is
  // a stronger boundary than this scenario assumed, and treating it as an
  // error would have reported the correct behaviour as a broken test.
  await page.goto(`/admin/bookings/${bookingId}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_000);
  if (/\/admin\/login/.test(page.url())) {
    await context.close();
    throw new Error(`Signed out while opening the booking as ${role} — re-mint the sessions.`);
  }
  const refused = (await page.locator("[data-admin-access-denied]").count()) > 0;
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const canClaim = (await page.getByRole("button", { name: /Claim this booking/i }).count()) > 0;
  await context.close();
  return { text, canClaim, refused };
}

test.describe("B3 — the handover: does the job's information travel with the job?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — before claiming, the therapist sees a redacted job", async ({ browser }) => {
    const db = serviceClient();

    // Unassigned, female-required, and with a real address on it — so
    // "the address is hidden" is something that CAN fail. ⛔ A fixture with no
    // address would make the redaction assertion vacuous (G-1).
    booking = await seedWebsiteBooking(db, "B3", {
      dayOffset: 32,
      status: "confirmed",
      participants: [{ gender: "female" }],
    });

    const seen = await whatTheTherapistSees(browser, "therapist_a", booking.bookingId);

    expect(
      seen.canClaim,
      "⛔ an unclaimed, gender-matched job must be offered to the therapist, or nobody can pick up work",
    ).toBe(true);
    expect(
      seen.text,
      `⛔ the customer's NAME must not be shown to a therapist who has not taken the job. The page said: "${seen.text.slice(0, 300)}"`,
    ).not.toContain(booking.name);
    expect(
      seen.text,
      "⛔ nor the house they would be visiting",
    ).not.toContain("1 ZZTEST Street");
  });

  test("step 2 — she claims it, and the customer's details appear", async ({ browser }) => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "therapist_a");
    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "the claimable booking");
    await awaitAction(page, async () => {
      await page.getByRole("button", { name: /Claim this booking/i }).click();
    });
    await context.close();

    const assignments = await readAssignments(db, booking.bookingId);
    expect(
      assignments[0].assigned_staff_id,
      "⛔ claiming must actually put her on the job",
    ).toBe(THERAPIST_A_STAFF_ID);
    expect(assignments[0].status).toBe("assigned");

    const after = await readBooking(db, booking.bookingId);
    expect(after.assignment_status, "and the booking is now staffed").toBe("fully_assigned");

    // ── ⛔ THE REVEAL ──────────────────────────────────────────────────
    const seen = await whatTheTherapistSees(browser, "therapist_a", booking.bookingId);
    expect(
      seen.text,
      "⛔ once she holds the job she must see who she is treating",
    ).toContain(booking.name);
    expect(
      seen.text,
      "⛔ and the address she is being sent to — she cannot do a home visit without it",
    ).toContain("1 ZZTEST Street");

    const events = await emailEvents(db, booking.bookingId);
    const toOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);
    expect(
      toOwner.length,
      "⛔ the clinic must be told when someone picks up a job, or two people could travel to the same house",
    ).toBe(1);
  });

  test("step 3 — the admin hands it to a colleague", async ({ browser }) => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${booking.bookingId}/`, "the booking detail page");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    // ⛔ The trigger reads "Reassign" once somebody holds the job, and
    // "Assign therapist" when nobody does.
    await page.getByRole("button", { name: /^Reassign$|^Assign therapist$/i }).first().click();
    const chooser = page.getByRole("dialog");

    // ⚠️ Wait for the CANDIDATE, not for a heading. The sheet's title differs
    // between the assign and reassign cases, and asserting the wrong one cost a
    // run — while the thing the step actually needs is the person to hand it to.
    const colleague = chooser.getByRole("button").filter({ hasText: /Phase10 THERAPIST B/ });
    await expect(
      colleague,
      "the colleague who is going to cover must be offered",
    ).toHaveCount(1, { timeout: 15_000 });
    await expect(colleague).toBeVisible();
    await awaitAction(page, async () => {
      await colleague.click();
    });
    await context.close();

    const assignments = await readAssignments(db, booking.bookingId);
    expect(
      assignments[0].assigned_staff_id,
      "⛔ the job must now belong to the colleague",
    ).toBe(THERAPIST_B_STAFF_ID);
    expect(assignments[0].status).toBe("assigned");
    await expectOwnerNeverAssigned(db, booking.bookingId);

    // ⛔ THE AUDIT ROW KEYS ON THE ASSIGNMENT, NOT THE BOOKING.
    // `updateBookingAssignment` writes `target_type: "booking_assignments"` and
    // `target_id: <assignment id>`. ⚠️ Looking it up by booking id returns an
    // empty array — which reads exactly like "the handover was never recorded".
    // The same keying is why the shared teardown had to learn to sweep it.
    expect(
      await auditActions(db, assignments[0].id),
      "a handover is a change of responsibility and belongs on the record",
    ).toContain("booking_assignment_reassigned");
  });

  test("step 4 — the first therapist loses the details, the second gains them", async ({
    browser,
  }) => {
    expect(booking?.bookingId).toBeTruthy();
    const db = serviceClient();

    // ── ⛔ THE ONE THAT MATTERS ────────────────────────────────────────
    const outgoing = await whatTheTherapistSees(browser, "therapist_a", booking.bookingId);
    console.log(`[B3] outgoing therapist refused the page outright: ${outgoing.refused}`);
    expect(
      outgoing.text,
      `⛔ the therapist who NO LONGER holds this job can still see the customer's name. Handing work over must take the customer's details with it. The page showed her: "${outgoing.text.slice(0, 300)}"`,
    ).not.toContain(booking.name);
    expect(
      outgoing.text,
      "⛔ and she can still see the house she is no longer being sent to",
    ).not.toContain("1 ZZTEST Street");

    const incoming = await whatTheTherapistSees(browser, "therapist_b", booking.bookingId);
    expect(
      incoming.text,
      "⛔ the colleague who now holds it must be able to see who she is treating",
    ).toContain(booking.name);
    expect(
      incoming.text,
      "⛔ and where to go — otherwise the handover has left the visit undoable",
    ).toContain("1 ZZTEST Street");

    // ── Email: the handover must not reach the real business inbox ─────
    const events = await emailEvents(db, booking.bookingId);
    const toOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);
    expect(
      toOwner.length,
      `⛔ only the CLAIM should have reached the business inbox — one message. It holds ${toOwner.length}: ${toOwner.map((e) => e.event_type).join(", ")}`,
    ).toBe(1);

    console.log(
      `\n[B3] COMPLETE. claimed by A, handed to B; details followed the job both ways; ` +
        `${events.length} emails, ${toOwner.length} to ${REAL_OWNER_INBOX}\n`,
    );
  });
});
