// ⛔ GATE 08 — P3, FAMILY A, SCENARIO A2: THE PHONE BOOKING.
//
//   ⛔ The Owner's question: "Does a booking taken by hand behave like one
//    taken online?"
//
// Somebody rings. The coordinator writes it down as an enquiry, turns it into a
// real booking, and a therapist is put on it. Then the customer changes their
// mind and cancels using the link in their own confirmation email — and the
// slot has to come back, exactly once.
//
// ── ⛔ WHY THE ENQUIRY ITSELF IS SEEDED, NOT TYPED ───────────────────────
//
// D-023: prove the FORM once, then test the RULES underneath. The enquiry form
// already has NINE passing browser cases (`enquiry-lifecycle.spec.ts`), and
// re-typing it here would send two more real emails to prove something already
// proven. ⛔ What has NEVER been driven is the CONVERSION — enquiry to booking —
// and the customer-facing cancellation. Those are what this file is for.
//
// ── ⛔ THE MANAGE LINK, AND WHY THE TEST MINTS ITS OWN ───────────────────
//
// `bookings.manage_token_hash` stores ONLY a sha256 of the token. ⛔ The
// plaintext is never persisted — not in the booking row, and not in
// `email_delivery_events` either, because an immediate send records delivery
// metadata WITHOUT `html_payload` (`recordEmailDeliveryEvent`, notifications.ts
// :449). So the customer's link genuinely cannot be recovered from the database
// by anyone, which is the point of the design.
//
// ⛔ The test therefore mints a token the same way `ensureBookingManageUrl`
// does — `randomUUID()`, sha256 hex, expiry `<booking_date>T23:59:59.000Z` —
// and writes the hash. ⚠️ That is exactly what the app does on every booking
// creation, and the single-live-token model means the newest token is the only
// valid one anyway. What this does NOT re-prove is the minting itself; what it
// DOES prove is everything the customer then touches, which is the untested
// half.
//
// ── ⛔ EMAIL COST: 2 to the real business inbox ──────────────────────────
//   1. the new-booking alert when the coordinator converts the enquiry
//   2. the cancellation alert when the customer cancels
// ⚠️ Customer-side mail goes to the Owner's TEST inbox throughout.

import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  assignFirstUnstaffedParticipant,
  auditActions,
  destroyScenarioFixtures,
  emailEvents,
  expectOwnerNeverAssigned,
  gotoAdmin,
  isoDaysFromToday,
  pageAs,
  readAssignments,
  readBooking,
  REAL_OWNER_INBOX,
  RUN_TAG,
  SERVICES,
  serviceClient,
  testInbox,
  waitForEmailEvents,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const CALLER_NAME = `ZZTEST-A2-${RUN_TAG}`;
const CALLER_EMAIL = testInbox("a2");
const CALLER_PHONE = "07999123402";
const BOOKING_DATE = isoDaysFromToday(24);

let enquiryId = "";
let bookingId = "";
let clientId = "";
let chosenTime = "";
let manageUrl = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const db = serviceClient();
  if (enquiryId) {
    // ⛔ THE AUDIT ROW FOR THE CONVERSION KEYS ON THE ENQUIRY, NOT THE BOOKING.
    // `createManualBooking` writes `enquiry_converted_to_booking` with
    // `target_type: "enquiries"` and `target_id: <enquiry id>`, so the shared
    // teardown — which sweeps bookings, assignments, participants and clients
    // — cannot see it. ⚠️ Measured: six of these survived six A2 runs past a
    // teardown that reported success, and only `verify-system-integrity.mjs`
    // caught them (audit_logs 260 -> 266).
    await db.from("audit_logs").delete().eq("target_id", enquiryId);
    await db.from("enquiries").delete().eq("id", enquiryId);

    const { data: survivors } = await db.from("enquiries").select("id").eq("id", enquiryId);
    if ((survivors ?? []).length > 0) {
      throw new Error(`⛔ A2 teardown left enquiry ${enquiryId} in production.`);
    }
  }
  if (clientId) await destroyScenarioFixtures(db, [clientId]);
});

/**
 * ⚠️ The City field drops its first keystroke — it is entangled with the
 * Address combobox beside it (Google Places, degraded because no Maps key is
 * configured). Typing and VERIFYING is what keeps the test honest rather than
 * proceeding with a half-typed city.
 */
async function typeVerified(page: Page, locator: Locator, value: string) {
  await locator.click();
  await locator.pressSequentially(value, { delay: 60 });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await locator.inputValue()) === value) return;
    await locator.fill("");
    await locator.click();
    await locator.pressSequentially(value, { delay: 120 });
    await page.waitForTimeout(300);
  }
  expect(await locator.inputValue(), `could not type "${value}" into the field`).toBe(value);
}

test.describe("A2 — the phone booking: does a booking taken by hand behave like one taken online?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — a phone enquiry becomes a real booking", async ({ browser }) => {
    const db = serviceClient();

    const { data: enquiry, error } = await db
      .from("enquiries")
      .insert({
        full_name: CALLER_NAME,
        phone: CALLER_PHONE,
        email: CALLER_EMAIL,
        source: "phone",
        status: "new",
        service_interest: SERVICES.hijama.name,
        notes: "ZZTEST — rang about hijama, wants a home visit.",
      })
      .select("id")
      .single();
    expect(error, `could not seed the enquiry: ${error?.message}`).toBeNull();
    enquiryId = (enquiry as { id: string }).id;

    const { context, page } = await pageAs(browser, "coordinator");

    // ⛔ THE CONVERSION ROUTE. `EnquiryList` links to exactly this, and
    // `createManualBooking` reads `enquiry_id` off the form to close the loop.
    await gotoAdmin(page, `/admin/bookings/new/?enquiryId=${enquiryId}`, "the new-booking wizard");
    await expect(page.getByRole("heading", { name: /New booking/i })).toBeVisible();

    const next = page.getByRole("button", { name: /^Continue$/ }).first();

    // ── Step 1 — contact. Pre-filled from the enquiry; filled defensively so
    // a pre-fill regression shows up as a WRONG VALUE later, not a crash here.
    await page.getByLabel(/Booking source/i).selectOption("phone");
    await page.getByLabel(/Full name/i).fill(CALLER_NAME);
    await page.getByLabel(/Phone number/i).fill(CALLER_PHONE);
    await page.getByLabel(/Email address/i).fill(CALLER_EMAIL);
    await expect(next).toBeEnabled();
    await next.click();

    // ── Step 2 — who it is for, and what they are having
    await page.getByLabel(/Name or label/i).fill(CALLER_NAME);
    await page.getByLabel(/gender/i).selectOption("female");
    // The package radios are not clickable — the card is.
    await page.getByText(SERVICES.hijama.name, { exact: false }).first().click();
    await expect(next).toBeEnabled();
    await next.click();

    // ── Step 3 — where, and when
    await page.getByLabel(/Postcode/i).fill("LU1 1AA");
    // ⛔ Address is a COMBOBOX, not a plain text input.
    await page.getByRole("combobox", { name: /Address/i }).fill("1 ZZTEST Street");
    await typeVerified(page, page.getByLabel(/^City/i), "Luton");

    const dateField = page.getByLabel(/^Date/i);
    await expect(dateField, "the date picker appears once the visit is described").toBeVisible();
    await dateField.fill(BOOKING_DATE);
    await page.waitForTimeout(2500);

    const timeButton = page.getByRole("button", { name: /^\d{1,2}:\d{2}/ }).first();
    await expect(timeButton, "a start time should be offered").toBeVisible();
    chosenTime = ((await timeButton.textContent()) ?? "").trim().slice(0, 5);
    await timeButton.click();
    await page.waitForTimeout(1200);
    await expect(next).toBeEnabled();
    await next.click();

    // ── Step 4 — confirm
    const submit = page.getByRole("button", { name: /Submit booking request/i }).first();
    await expect(submit, "submit must start disabled — consent has not been confirmed").toBeDisabled();
    await page
      .getByText(/I confirm that the client's details and consent have been obtained/i)
      .click();
    await page.waitForTimeout(400);
    await expect(submit, "consent unlocks the submit").toBeEnabled();

    const answered = page.waitForResponse(
      (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
      { timeout: 120_000 },
    );
    await submit.click();
    await answered;
    await page.waitForTimeout(3000);
    await context.close();

    // ── ⛔ WHAT THE DATABASE SAYS ───────────────────────────────────────
    const { data: rows } = await db
      .from("bookings")
      .select("id")
      .eq("contact_full_name", CALLER_NAME);
    expect(rows ?? [], `no booking was created for ${CALLER_NAME}`).toHaveLength(1);
    bookingId = ((rows ?? [])[0] as { id: string }).id;

    const booking = await readBooking(db, bookingId);
    clientId = String(booking.client_id);

    expect(
      booking.booking_source,
      "⛔ a booking taken over the phone must be recorded as a phone booking, not a website one — it is how the Owner knows where work comes from",
    ).toBe("phone");
    expect(booking.booking_date).toBe(BOOKING_DATE);
    expect(String(booking.start_time).slice(0, 5)).toBe(chosenTime);
    expect(Number(booking.total_price), "the phone booking is priced the same as an online one").toBe(
      SERVICES.hijama.price,
    );
    // ⛔ The same starting state as a website booking. That IS the question A2 asks.
    expect(booking.status, "a hand-taken booking starts pending, like any other").toBe("pending");
    expect(booking.assignment_status, "and with nobody on it").toBe("unassigned");

    // ── ⛔ THE ENQUIRY MUST BE CLOSED OFF, OR THE FRONT DESK CHASES IT TWICE
    const { data: after } = await db
      .from("enquiries")
      .select("status, converted_booking_id")
      .eq("id", enquiryId)
      .single();
    expect(
      (after as { converted_booking_id: string | null })?.converted_booking_id,
      "⛔ the enquiry must point at the booking it became",
    ).toBe(bookingId);
    expect(
      (after as { status: string })?.status,
      "⛔ and must stop looking like an open enquiry",
    ).toBe("booked");

    expect(
      await auditActions(db, enquiryId),
      "the conversion must be on the record",
    ).toContain("enquiry_converted_to_booking");

    // ── The customer is confirmed, and the clinic is told ───────────────
    const events = await waitForEmailEvents(db, bookingId, 3);
    const toCustomer = events.filter((e) => (e.recipient_email ?? e.to_email) === CALLER_EMAIL);
    expect(
      toCustomer.length,
      "⛔ someone who booked by phone still gets their confirmation — otherwise they have no record of it and no way to manage it",
    ).toBeGreaterThan(0);
    expect(toCustomer[0].delivery_status).toBe("accepted");

    console.log(`\n[A2] enquiry ${enquiryId} -> booking ${bookingId} on ${BOOKING_DATE} ${chosenTime}\n`);
  });

  test("step 2 — a therapist is put on it", async ({ browser }) => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();
    const { context, page } = await pageAs(browser, "admin");

    await gotoAdmin(page, `/admin/bookings/${bookingId}/`, "the booking detail page");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });
    await assignFirstUnstaffedParticipant(page);
    await context.close();

    const booking = await readBooking(db, bookingId);
    expect(booking.assignment_status, "one person, one therapist, fully staffed").toBe(
      "fully_assigned",
    );
    await expectOwnerNeverAssigned(db, bookingId);
  });

  test("step 3 — the customer cancels using the link in their own email", async ({ page }) => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();

    // ⛔ Mint the customer's link exactly as `ensureBookingManageUrl` does.
    const token = randomUUID();
    const { error } = await db
      .from("bookings")
      .update({
        manage_token_hash: createHash("sha256").update(token).digest("hex"),
        manage_token_expires_at: new Date(`${BOOKING_DATE}T23:59:59.000Z`).toISOString(),
      })
      .eq("id", bookingId);
    expect(error, `could not mint the manage token: ${error?.message}`).toBeNull();
    manageUrl = `/booking/manage?token=${encodeURIComponent(token)}`;

    // ⛔ NO admin session — this is the customer, on their own phone.
    await page.goto(manageUrl, { waitUntil: "domcontentloaded" });

    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(
      body,
      `⛔ the customer's own manage link did not open their booking. The page said: "${body.slice(0, 300)}"`,
    ).toContain(CALLER_NAME);

    // ⛔ MEASURED: "Cancel booking" is a plain `type="submit"` on its own form.
    // There is NO confirmation step — one tap cancels, and the button then goes
    // DISABLED while the action runs. ⚠️ An earlier version of this test looked
    // for a confirm button afterwards, matched that now-disabled button, and
    // waited for it to become clickable for the rest of the timeout.
    const cancelButton = page.getByRole("button", { name: /^Cancel booking$/ });
    await expect(
      cancelButton,
      "⛔ a customer who wants to cancel must be able to, without ringing the clinic",
    ).toBeVisible({ timeout: 20_000 });

    const answered = page.waitForResponse(
      (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
      { timeout: 60_000 },
    );
    await cancelButton.click();
    await answered;
    await page.waitForTimeout(3_000);

    const booking = await readBooking(db, bookingId);
    expect(
      booking.status,
      `⛔ the customer cancelled and the booking is still ${booking.status}. The clinic would keep the slot blocked and turn up.`,
    ).toBe("cancelled");
    expect(
      (booking as Record<string, unknown>).customer_cancelled_at ?? null,
      "⛔ a customer-initiated cancellation must be marked as theirs, not as the clinic's",
    ).not.toBeNull();
  });

  test("step 4 — the slot comes back, and exactly one booking gave it up", async () => {
    expect(bookingId).toBeTruthy();
    const db = serviceClient();

    // ⛔ "Exactly once": the cancelled booking must be the ONLY one that
    // stopped occupying this slot, and it must not have been double-counted.
    const { data: live } = await db
      .from("bookings")
      .select("id, status")
      .eq("booking_date", BOOKING_DATE)
      .eq("start_time", `${chosenTime}:00`)
      .in("status", ["pending", "confirmed"]);
    expect(
      ((live ?? []) as { id: string }[]).map((b) => b.id),
      "⛔ the cancelled booking must no longer hold the slot",
    ).not.toContain(bookingId);

    // ⛔ And the slot is genuinely on sale again — asked of the SAME endpoint
    // the customer's booking form uses, not of the database.
    // ⚠️ Contract measured from `src/app/api/availability/route.ts`:
    // { date, serviceIds[], participantGenders[], city } — NOT the shape the
    // browser store uses internally.
    const response = await fetch(`${process.env.E2E_BASE_URL}/api/availability/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: BOOKING_DATE,
        // ⛔ SLUGS, not the services table's UUID. Passing the UUID comes back
        // 200 with `{"slots":[],"reason":"Selected service is unavailable."}`
        // — a SUCCESSFUL response carrying an empty list, which is exactly the
        // shape a genuine "no availability" answer has. ⚠️ Asserting only on
        // the status code here would have read a malformed request as proof
        // that the clinic had no slots.
        serviceIds: ["hijama-package"],
        participantGenders: ["female"],
        city: "Luton",
      }),
    });
    const raw = await response.text();
    expect(
      response.status,
      `the availability endpoint refused the request: ${raw.slice(0, 300)}`,
    ).toBe(200);

    expect(
      raw,
      `⛔ after the cancellation the clinic no longer offers ${chosenTime} on ${BOOKING_DATE}. ` +
        `The slot the customer gave up has NOT come back, so it can never be re-sold. ` +
        `The endpoint answered: ${raw.slice(0, 400)}`,
    ).toContain(chosenTime);

    // ── ⛔ THE EMAIL LEDGER ────────────────────────────────────────────
    const events = await emailEvents(db, bookingId);
    const toRealOwner = events.filter((e) => (e.recipient_email ?? e.to_email) === REAL_OWNER_INBOX);
    expect(
      toRealOwner.length,
      `⛔ the real business inbox should get the new-booking alert AND the cancellation alert — two. It got ${toRealOwner.length}: ${toRealOwner.map((e) => e.event_type).join(", ")}`,
    ).toBe(2);

    const assignments = await readAssignments(db, bookingId);
    console.log(
      `\n[A2] COMPLETE. booking cancelled by the customer; ${assignments.length} assignment(s); ` +
        `${events.length} emails, ${toRealOwner.length} to ${REAL_OWNER_INBOX}\n`,
    );
  });
});
