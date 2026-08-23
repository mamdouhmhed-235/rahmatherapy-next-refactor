// ⛔ GATE 08 — P3, FAMILY A, SCENARIO A3: THE RETURNING CUSTOMER.
//
//   ⛔ The Owner's question: "Do I end up with ONE customer record, or two?"
//
// A regular rings once, books online the next time, and books online again a
// year later. If each visit created a fresh customer row, the clinic would lose
// the one thing that makes someone a regular: their history. Health notes,
// previous treatments, how many times they have been — all of it would scatter
// across duplicate records nobody could see at once.
//
// ── ⛔ WHAT MAKES THIS A REAL TEST AND NOT A TAUTOLOGY ────────────────────
//
// The existing customer is seeded FIRST, directly, with a booking already
// against them — so there is a genuine history for the new booking to either
// join or miss. ⛔ A version of this that booked twice through the website and
// then counted rows would pass just as happily if the code created two records
// and the assertion was reading only one of them.
//
// The link happens in `create_booking_request`: it matches on EMAIL, and the
// public route deliberately leaves `raiseOnDuplicate` off so a returning
// customer is joined silently instead of being handed a 409 they cannot act on
// (`createBookingTransaction.ts` — the admin flow is the one that wants the
// warning; that asymmetry is scenario C4's subject, not this one).
//
// ⛔ `on conflict (email) do nothing` also means the EXISTING client's details
// are never overwritten. That matters: a returning customer typing their name
// slightly differently must not rename the record their therapist's notes hang
// off. Asserted below.
//
// ── ⛔ EMAIL COST: 3 messages, ONE of them to the real business inbox ─────

import { expect, test } from "@playwright/test";
import {
  destroyScenarioFixtures,
  isoDaysFromToday,
  readBooking,
  REAL_OWNER_INBOX,
  RUN_TAG,
  seedWebsiteBooking,
  serviceClient,
  submitPublicBooking,
  testInbox,
  THERAPIST_A_STAFF_ID,
  waitForEmailEvents,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

/** ⛔ One address, used TWICE on purpose — it is the whole subject of A3. */
const REGULAR_EMAIL = testInbox("a3-regular");
const REGULAR_NAME = `ZZTEST-A3-${RUN_TAG}`;
/** ⚠️ Deliberately DIFFERENT from the seeded record's name. */
const NAME_TYPED_THIS_TIME = `ZZTEST-A3-typo-${RUN_TAG}`;

let firstVisit: SeededBooking;
let secondBookingId = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (!firstVisit?.clientId) return;
  await destroyScenarioFixtures(serviceClient(), [firstVisit.clientId]);
});

test.describe("A3 — the returning customer: one record, or two?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("a customer with history books again on the website, and lands on the SAME record", async ({
    page,
  }) => {
    const db = serviceClient();

    // ── Their first visit, months ago. Seeded directly: no email, and the
    // point of A3 is the SECOND booking, not this one.
    firstVisit = await seedWebsiteBooking(db, "A3", {
      dayOffset: -120,
      status: "completed",
      assignTo: THERAPIST_A_STAFF_ID,
      paid: true,
      email: REGULAR_EMAIL,
    });
    // Give the record the name the clinic knows them by.
    await db.from("clients").update({ full_name: REGULAR_NAME }).eq("id", firstVisit.clientId);

    const { count: clientsBefore } = await db
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("email", REGULAR_EMAIL);
    expect(clientsBefore, "the fixture should leave exactly one record for this address").toBe(1);

    // ── They come back and book on the website, typing their name differently.
    const result = await submitPublicBooking(page, {
      name: NAME_TYPED_THIS_TIME,
      email: REGULAR_EMAIL,
      phone: "07700900103",
      packages: ["Hijama Package"],
      participants: [{ gender: "female" }],
    });
    secondBookingId = result.bookingId;

    // ── ⛔ THE QUESTION, ANSWERED AGAINST THE DATABASE ──────────────────
    const { data: records, count: clientsAfter } = await db
      .from("clients")
      .select("id, full_name, email", { count: "exact" })
      .eq("email", REGULAR_EMAIL);

    expect(
      clientsAfter,
      `⛔ booking again created a SECOND customer record for ${REGULAR_EMAIL}. The clinic would now hold this person's history in two places, and neither screen would show both.`,
    ).toBe(1);

    const second = await readBooking(db, secondBookingId);
    expect(
      second.client_id,
      "⛔ the new booking must hang off the record that already holds their history",
    ).toBe(firstVisit.clientId);

    // ⛔ `on conflict (email) do nothing` — the existing record must NOT be
    // rewritten by whatever they typed this time.
    expect(
      (records ?? [])[0]?.full_name,
      "⛔ a returning customer typing their name differently must not rename the record their notes hang off",
    ).toBe(REGULAR_NAME);

    // ── Their history is now two visits on one record ──────────────────
    const { data: history } = await db
      .from("bookings")
      .select("id, booking_date, status")
      .eq("client_id", firstVisit.clientId)
      .order("booking_date", { ascending: true });

    expect(
      (history ?? []).map((b) => (b as { id: string }).id),
      "⛔ both visits must sit on the one record — that is what makes them a regular",
    ).toEqual([firstVisit.bookingId, secondBookingId]);

    expect(
      (history ?? [])[0],
      "the old visit must be left exactly as it was",
    ).toMatchObject({ status: "completed", booking_date: isoDaysFromToday(-120) });

    // ── The clinic is still told, exactly as for a new customer ────────
    const events = await waitForEmailEvents(db, secondBookingId, 3);
    expect(events, "a returning customer's booking still sends the usual three messages").toHaveLength(3);
    expect(
      events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX),
      "exactly one message reaches the real business inbox",
    ).toHaveLength(1);
    for (const event of events) {
      expect(event.delivery_status, `${event.event_type} did not leave`).toBe("accepted");
    }

    console.log(
      `\n[A3] ${REGULAR_EMAIL} booked again -> linked to the existing record ${firstVisit.clientId}, ` +
        `now holding ${(history ?? []).length} visits. 3 emails, 1 to ${REAL_OWNER_INBOX}\n`,
    );
  });

  test("the front desk can SEE they are a regular", async ({ browser }) => {
    expect(firstVisit?.clientId, "the first test must have run").toBeTruthy();
    const { pageAs, gotoAdmin } = await import("./scenario-helpers");
    const { context, page } = await pageAs(browser, "admin");

    // ⛔ The booking history on a client record is TABBED, and it opens on
    // "Upcoming". Measured: the default tab shows ONLY future visits, so a
    // check written against the default view would report a returning
    // customer's history as missing when it is simply on another tab. That is
    // a check that could not have seen the truth (G-1) — ask for `tab=all`.
    await gotoAdmin(
      page,
      `/admin/clients/${firstVisit.clientId}/?tab=all`,
      "the client's record, all visits",
    );

    // ⛔ G-12 — assert the LINKS, never the echoed name.
    await expect(
      page.locator(`a[href*="${firstVisit.bookingId}"]`).first(),
      "their earlier visit should be on their record",
    ).toBeVisible();
    await expect(
      page.locator(`a[href*="${secondBookingId}"]`).first(),
      "⛔ and so should the one they just made — if this is missing, the front desk cannot see they are a regular",
    ).toBeVisible();

    // ⛔ The summary is what someone actually reads at a glance. Two visits on
    // one record is the entire point of A3; if the customer had been
    // duplicated this would say one.
    const summary = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(
      summary,
      `⛔ the record should count BOTH visits. It said: "${summary.slice(0, 300)}"`,
    ).toMatch(/Total visits\s*2/);
    expect(summary, "and should mark them as a repeat client").toMatch(/Repeat\s*Yes/);

    await context.close();
  });
});
