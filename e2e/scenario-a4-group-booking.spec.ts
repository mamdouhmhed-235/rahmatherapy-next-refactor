// ⛔ GATE 08 — P3, FAMILY A, SCENARIO A4: THE GROUP BOOKING.
//
//   ⛔ The Owner's question: "Can I handle a family or a group without the
//    booking falling apart?"
//
// Three people, at the same address, at the same time, with MIXED therapist
// requirements — two who need a female therapist and one who needs a male. That
// is a household, and it is the hardest ordinary thing the booking system is
// asked to do.
//
// ── ⛔ THE STATE MACHINE THIS EXISTS TO PROVE ────────────────────────────
//
// A group booking is not "one booking with a bigger number on it". Each person
// gets their own participant row, their own line item, and their own assignment
// — and the BOOKING's `assignment_status` is derived from all of them by
// `recomputeBookingAssignmentStatus`:
//
//     nobody assigned        -> unassigned
//     some but not all       -> partially_assigned      ⛔ the state that only
//     every one assigned     -> fully_assigned             groups can reach
//
// ⛔ `partially_assigned` is unreachable with a single-person booking, so
// nothing before this scenario has ever exercised it in a browser.
//
// ── ⛔ AND THE RULE THAT PROTECTS THE CLINIC'S RECORDS ───────────────────
//
// One therapist finishing their part must NOT close the whole visit while their
// colleagues are still working. `autoPromoteBookingFromAssignments` requires
// EVERY assignment to be terminal. ⛔ If that ever broke, a three-person visit
// would be recorded as complete the moment the fastest therapist tapped a
// button — and the other two people's treatments would vanish from the record.
//
// ── ⛔ EMAIL COST: 3 messages, ONE of them to the real business inbox ─────
//
// ⚠️ Assigning each participant additionally emails the CUSTOMER
// (`client_assigned_therapist`) and the therapist. Those go to the Owner's TEST
// inbox and to `.test` staff addresses respectively — ⛔ never to the real
// business inbox, which is asserted at the end.

import { expect, test } from "@playwright/test";
import {
  assignFirstUnstaffedParticipant,
  awaitAction,
  destroyScenarioFixtures,
  emailEvents,
  expectOwnerNeverAssigned,
  gotoAdmin,
  isoDaysFromToday,
  pageAs,
  readAssignments,
  readBooking,
  readBookingItems,
  readParticipants,
  REAL_OWNER_INBOX,
  RUN_TAG,
  SERVICES,
  serviceClient,
  submitPublicBooking,
  testInbox,
  waitForEmailEvents,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const PARTY = [
  { gender: "female" as const, name: `ZZTEST-A4-mum-${RUN_TAG}` },
  { gender: "female" as const, name: `ZZTEST-A4-sister-${RUN_TAG}` },
  { gender: "male" as const, name: `ZZTEST-A4-dad-${RUN_TAG}` },
];
const EXPECTED_TOTAL = SERVICES.hijama.price * PARTY.length; // £135

let bookingId = "";
let clientId = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (!clientId) return;
  await destroyScenarioFixtures(serviceClient(), [clientId]);
});

test.describe("A4 — a group booking: can the clinic take a household?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — three people, mixed requirements, book together on the website", async ({ page }) => {
    const db = serviceClient();

    // ⛔ If the clinic cannot offer a single slot to a mixed-gender household,
    // `submitPublicBooking` throws here with "the clinic offered NO appointment
    // times for this request". ⚠️ That would NOT be a test failure to explain
    // away — it would be the answer: a family with a man and two women cannot
    // book online.
    const { bookingId: id } = await submitPublicBooking(page, {
      name: `ZZTEST-A4-${RUN_TAG}`,
      email: testInbox("a4"),
      phone: "07700900104",
      packages: [SERVICES.hijama.name],
      participants: PARTY,
    });
    bookingId = id;

    const booking = await readBooking(db, bookingId);
    clientId = String(booking.client_id);

    expect(
      (booking as Record<string, unknown>).group_booking,
      "⛔ three people at one time must be recorded as a group booking",
    ).toBe(true);
    expect(
      Number(booking.total_price),
      `⛔ three people having the ${SERVICES.hijama.name} is £${SERVICES.hijama.price} each`,
    ).toBe(EXPECTED_TOTAL);
    expect(booking.assignment_status, "nobody is on the job yet").toBe("unassigned");

    // ── Each person is their own record, or the clinic cannot tell them apart
    const participants = await readParticipants(db, bookingId);
    expect(participants, "every person in the group needs their own record").toHaveLength(3);
    expect(
      participants.filter((p) => p.is_main_contact),
      "exactly one of them is the person the clinic rings",
    ).toHaveLength(1);

    const required = participants.map((p) => p.required_therapist_gender).sort();
    expect(
      required,
      "⛔ the mixed requirement must survive the booking — two need a female therapist, one needs a male",
    ).toEqual(["female", "female", "male"]);

    const names = participants.map((p) => p.display_name).sort();
    expect(
      names,
      "⛔ each person's own name must be kept, or the therapists' notes get mixed together",
    ).toEqual(PARTY.map((p) => p.name).sort());

    const items = await readBookingItems(db, bookingId);
    expect(items, "each person needs their own line item to be charged for").toHaveLength(3);

    const assignments = await readAssignments(db, bookingId);
    expect(assignments, "and their own slot for a therapist").toHaveLength(3);
    expect(
      assignments.every((a) => a.assigned_staff_id === null),
      "all of them start empty",
    ).toBe(true);

    const events = await waitForEmailEvents(db, bookingId, 3);
    expect(
      events,
      "⛔ a group of three is still ONE booking, so it sends three messages, not nine",
    ).toHaveLength(3);

    console.log(
      `\n[A4] group of ${PARTY.length} booked: £${booking.total_price}, ` +
        `${participants.length} participants, 3 emails, 1 to ${REAL_OWNER_INBOX}\n`,
    );
  });

  test("step 2 — staffing ONE person leaves the booking partially assigned", async ({ browser }) => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();
    const { context, page } = await pageAs(browser, "admin");

    await gotoAdmin(page, `/admin/bookings/${bookingId}/`, "the group booking");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    const triggers = page.getByRole("button", { name: /^Assign therapist$/i });
    expect(
      await triggers.count(),
      "⛔ the admin needs one assign control per person, not one for the booking",
    ).toBe(3);

    await assignFirstUnstaffedParticipant(page);

    const booking = await readBooking(db, bookingId);
    expect(
      booking.assignment_status,
      "⛔ one therapist on a three-person job is PARTIALLY assigned — the booking must not look ready",
    ).toBe("partially_assigned");

    const assignments = await readAssignments(db, bookingId);
    expect(
      assignments.filter((a) => a.assigned_staff_id !== null),
      "exactly one person has a therapist so far",
    ).toHaveLength(1);

    await context.close();
  });

  test("step 3 — staffing the rest makes it fully assigned", async ({ browser }) => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();

    // ⛔ Two more to place, and each assignment re-renders the page, so the
    // controls are re-found every time rather than held across a navigation.
    for (let remaining = 2; remaining > 0; remaining -= 1) {
      const { context, page } = await pageAs(browser, "admin");
      await gotoAdmin(page, `/admin/bookings/${bookingId}/`, "the group booking");
      await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });
      await assignFirstUnstaffedParticipant(page);
      await context.close();
    }

    const assignments = await readAssignments(db, bookingId);
    expect(
      assignments.filter((a) => a.assigned_staff_id !== null),
      "⛔ everyone in the group must end up with a therapist",
    ).toHaveLength(3);

    const booking = await readBooking(db, bookingId);
    expect(
      booking.assignment_status,
      "⛔ only now is the booking fully staffed",
    ).toBe("fully_assigned");

    // ⛔ THE SAFETY ASSERTION. The male participant can only be taken by
    // `Test Admin` or the REAL Owner, and the chooser lists the Owner first.
    // An earlier version of this scenario took "whoever was offered" and put
    // the Owner on the job, which mailed the real business inbox.
    await expectOwnerNeverAssigned(db, bookingId);

    console.log(
      `\n[A4] staffed: ${assignments.map((a) => a.assigned_staff_id?.slice(0, 8)).join(", ")}\n`,
    );
  });

  test("step 4 — one therapist finishing does NOT close the whole visit", async ({ browser }) => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();

    // The visit's day arrives, and the admin confirms it. ⛔ Moving the date is
    // the same stated simulation A1 uses; nothing else is touched.
    await db
      .from("bookings")
      .update({ booking_date: isoDaysFromToday(0), status: "confirmed" })
      .eq("id", bookingId);

    // Whichever of our two signed-in therapists holds an assignment goes first.
    const assignments = await readAssignments(db, bookingId);
    const mine = assignments.find(
      (a) => a.assigned_staff_id === "884311b1-e9d0-44b9-91f3-14188a3baf59",
    );
    expect(
      mine,
      "the test therapist should hold one of these assignments — otherwise this step proves nothing",
    ).toBeTruthy();

    const { context, page } = await pageAs(browser, "therapist_a");
    await gotoAdmin(page, `/admin/bookings/${bookingId}/`, "the therapist's view");
    const complete = page.getByRole("button", { name: /^Mark complete$/i });
    await expect(complete.first(), "the therapist can close off their own part").toBeVisible({
      timeout: 30_000,
    });
    await awaitAction(page, async () => {
      await complete.first().click();
    });
    const skip = page.getByRole("dialog").getByRole("button", { name: /^Skip$/ });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await context.close();

    const after = await readAssignments(db, bookingId);
    expect(
      after.filter((a) => a.status === "completed"),
      "their own part is finished",
    ).toHaveLength(1);

    const booking = await readBooking(db, bookingId);
    expect(
      booking.status,
      "⛔ THE RULE THAT PROTECTS THE RECORD: two people are still being treated, so the visit is NOT over. If this reads `completed`, the other two treatments have been silently written off.",
    ).toBe("confirmed");

    // ── ⛔ THE EMAIL LEDGER FOR THE WHOLE GROUP JOURNEY ────────────────
    const events = await emailEvents(db, bookingId);
    const toRealOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);
    expect(
      toRealOwner,
      `⛔ the real business inbox should receive exactly ONE message across the whole group journey. It received ${toRealOwner.length}: ${toRealOwner.map((e) => e.event_type).join(", ")}`,
    ).toHaveLength(1);

    console.log(
      `\n[A4] COMPLETE. ${events.length} emails for this booking, 1 to ${REAL_OWNER_INBOX}\n`,
    );
  });
});
