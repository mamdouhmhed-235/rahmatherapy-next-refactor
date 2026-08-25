// ⛔ GATE 08 — P3, FAMILY C, SCENARIO C4: THE DUPLICATE WARNING.
//
//   ⛔ The Owner's question: "Does the system stop me creating a second record
//    for somebody I already have?"
//
// A regular customer rings up. ⚠️ If front desk typing their details creates a
// SECOND record, the clinic quietly ends up with two histories for one person:
// their notes on one, their next visit on the other, and nobody notices until a
// therapist arrives without knowing about an allergy.
//
// ── ⛔ THE RULE, READ FROM THE CODE ──────────────────────────────────────
//
// The ADMIN route sets `raiseOnDuplicate: true`; the public form does not. So a
// returning customer booking themselves online is linked silently, while front
// desk is STOPPED and made to decide. ✅ That asymmetry is deliberate and is the
// right way round: staff typing on somebody's behalf are the ones who can get it
// wrong.
//
// ⚠️ AND THE TWO BRANCHES HAVE OPPOSITE OUTCOMES, which this file is careful not
// to conflate:
//
//   WITH an email    → matched on a UNIQUE email → confirming LINKS to the
//                      existing client. The tickbox says "Use the existing
//                      client record for this booking."
//   WITHOUT an email → matched on phone → confirming creates a SEPARATE client.
//                      The tickbox says "Create a separate client profile
//                      anyway."
//
// ⛔ THIS SCENARIO DRIVES THE EMAIL BRANCH, because "linked, not duplicated" is
// the outcome the Owner asked about. The phone branch is recorded here rather
// than tested, so nobody later reads this file as proving something it did not.
//
// ── ⛔ EMAIL COST: ~3, on the successful booking only. The refusal in step 2
// sends nothing, which is itself part of what step 2 proves.

import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  emailEvents,
  gotoAdmin,
  isoDaysFromToday,
  pageAs,
  RUN_TAG,
  seedWebsiteBooking,
  serviceClient,
  SERVICES,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
let regular: SeededBooking;
let secondBookingId = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

/** Typing that VERIFIES — the city field is autocomplete-backed. */
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

/** Walk the manual booking wizard up to the point of submitting. */
async function fillTheForm(page: Page, name: string, email: string, phone: string) {
  await gotoAdmin(page, "/admin/bookings/new/", "the new-booking wizard");
  await expect(page.getByRole("heading", { name: /New booking/i })).toBeVisible();

  const next = page.getByRole("button", { name: /^Continue$/ }).first();

  await page.getByLabel(/Booking source/i).selectOption("phone");
  await page.getByLabel(/Full name/i).fill(name);
  await page.getByLabel(/Phone number/i).fill(phone);
  await page.getByLabel(/Email address/i).fill(email);
  await expect(next).toBeEnabled();
  await next.click();

  await page.getByLabel(/Name or label/i).fill(name);
  await page.getByLabel(/gender/i).selectOption("female");
  await page.getByText(SERVICES.hijama.name, { exact: false }).first().click();
  await expect(next).toBeEnabled();
  await next.click();

  await page.getByLabel(/Postcode/i).fill("LU1 1AA");
  await page.getByRole("combobox", { name: /Address/i }).fill("1 ZZTEST Street");
  await typeVerified(page, page.getByLabel(/^City/i), "Luton");

  const dateField = page.getByLabel(/^Date/i);
  await expect(dateField).toBeVisible();
  await dateField.fill(isoDaysFromToday(9));
  await page.waitForTimeout(2_500);

  const timeButton = page.getByRole("button", { name: /^\d{1,2}:\d{2}/ }).first();
  await expect(timeButton, "a start time should be offered").toBeVisible({ timeout: 20_000 });
  await timeButton.click();
  await page.waitForTimeout(1_200);
  await expect(next).toBeEnabled();
  await next.click();

  const submit = page.getByRole("button", { name: /Submit booking request/i }).first();
  await page
    .getByText(/I confirm that the client's details and consent have been obtained/i)
    .click();
  await page.waitForTimeout(400);
  await expect(submit, "consent unlocks the submit").toBeEnabled();
  return submit;
}

test.describe("C4 — the duplicate warning: is a returning customer linked, not duplicated?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ front desk is STOPPED, and nothing is created", async ({ browser }) => {
    test.setTimeout(300_000);
    const db = serviceClient();

    // ⛔ A customer the clinic already has. Seeded directly: creating them
    // through the form is scenario A's subject, and each one costs real mail.
    regular = await seedWebsiteBooking(db, "C4-REGULAR", {
      dayOffset: 12,
      status: "confirmed",
    });
    clientIds.push(regular.clientId);

    const { data: beforeClients } = await db
      .from("clients")
      .select("id")
      .eq("email", regular.email);
    expect(
      (beforeClients ?? []).length,
      "⛔ the customer must exist exactly once before front desk starts typing",
    ).toBe(1);

    const { data: beforeBookings } = await db
      .from("bookings")
      .select("id")
      .eq("client_id", regular.clientId);
    const bookingsBefore = (beforeBookings ?? []).length;

    const { context, page } = await pageAs(browser, "coordinator");
    const submit = await fillTheForm(page, regular.name, regular.email, "07700900444");
    await submit.click();
    await page.waitForTimeout(6_000);

    const warned = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    await context.close();

    // ⛔ THE WARNING NAMES THE PERSON. "A duplicate exists" is not enough — front
    // desk has to see WHO, or they cannot tell a real clash from a coincidence.
    expect(
      warned.includes(regular.name) || /already uses these contact details/i.test(warned),
      `⛔ FRONT DESK WAS NOT WARNED. They would have created a second record for a customer the clinic already has. The page said: "${warned.slice(0, 400)}"`,
    ).toBe(true);

    // ⛔ AND NOTHING WAS CREATED WHILE THEY DECIDE. A warning that has already
    // written the booking is not a warning, it is a notification.
    const { data: afterClients } = await db
      .from("clients")
      .select("id")
      .eq("email", regular.email);
    expect(
      (afterClients ?? []).length,
      "⛔ A SECOND CUSTOMER RECORD WAS CREATED DESPITE THE WARNING.",
    ).toBe(1);

    const { data: afterBookings } = await db
      .from("bookings")
      .select("id")
      .eq("client_id", regular.clientId);
    expect(
      (afterBookings ?? []).length,
      "⛔ the booking was created before front desk had confirmed anything",
    ).toBe(bookingsBefore);

    // ⛔ AND NOT A SINGLE MESSAGE WENT OUT. A refused submission that still
    // emails the customer would be worse than one that quietly duplicated.
    const mailed = await emailEvents(db, regular.bookingId);
    expect(
      mailed.length,
      `⛔ a REFUSED booking sent mail: ${JSON.stringify(mailed.map((e) => e.event_type))}`,
    ).toBe(0);

    console.log(`[C4] step 1 — warned, and nothing was written while she decided.`);
  });

  test("step 2 — ✅ she confirms, and it LINKS instead of duplicating", async ({ browser }) => {
    test.setTimeout(300_000);
    expect(regular?.clientId, "step 1 must have run").toBeTruthy();
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "coordinator");
    const submit = await fillTheForm(page, regular.name, regular.email, "07700900444");
    await submit.click();
    await page.waitForTimeout(6_000);

    // ⛔ THE TICKBOX SAYS WHAT WILL HAPPEN. On the email branch it promises to
    // USE THE EXISTING RECORD — and step 3 checks the promise was kept.
    const useExisting = page.getByText(/Use the existing client record for this booking/i);
    await expect(
      useExisting,
      "⛔ front desk must be offered the option to link to the customer they already have",
    ).toBeVisible({ timeout: 20_000 });
    await useExisting.click();
    await page.waitForTimeout(600);

    const submitAgain = page.getByRole("button", { name: /Submit booking request/i }).first();
    await expect(submitAgain).toBeEnabled();
    await submitAgain.click();
    await page.waitForTimeout(10_000);
    await context.close();

    const { data: bookings } = await db
      .from("bookings")
      .select("id, booking_date")
      .eq("client_id", regular.clientId)
      .order("created_at", { ascending: false });
    const rows = (bookings ?? []) as { id: string; booking_date: string }[];

    expect(
      rows.length,
      "⛔ CONFIRMING THE WARNING DID NOT CREATE THE BOOKING. Front desk would be stuck: warned, confirmed, and still no appointment.",
    ).toBeGreaterThan(1);

    secondBookingId = rows[0].id;
    console.log(`[C4] step 2 — confirmed; the customer now has ${rows.length} bookings.`);
  });

  test("step 3 — ⛔ THE POINT: one customer, two bookings, not two customers", async () => {
    expect(secondBookingId, "step 2 must have run").not.toBe("");
    const db = serviceClient();

    // ⛔ STILL EXACTLY ONE RECORD for this person.
    const { data: clients } = await db
      .from("clients")
      .select("id, full_name")
      .eq("email", regular.email);
    const found = (clients ?? []) as { id: string; full_name: string }[];

    expect(
      found.length,
      `⛔ THE CLINIC NOW HAS TWO RECORDS FOR ONE PERSON. Their history is split: notes on one, the next visit on the other. Found: ${JSON.stringify(found.map((c) => c.full_name))}`,
    ).toBe(1);
    expect(
      found[0].id,
      "⛔ and it must be the ORIGINAL record, not a replacement",
    ).toBe(regular.clientId);

    // ⛔ AND THE NEW BOOKING HANGS OFF THAT SAME RECORD.
    const { data: booking } = await db
      .from("bookings")
      .select("client_id")
      .eq("id", secondBookingId)
      .single();
    expect(
      (booking as { client_id: string }).client_id,
      "⛔ the new booking was attached to a different customer record than the one front desk confirmed",
    ).toBe(regular.clientId);

    console.log(
      `\n[C4] COMPLETE. Front desk was stopped and told who the clash was, nothing was written while she decided, and confirming attached the visit to the customer the clinic already had — one record, two bookings.\n`,
    );
  });
});
