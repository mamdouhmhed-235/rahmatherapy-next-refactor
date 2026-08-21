// ⛔ GATE 08 PHASE P2, BOOKING GROUP — E08-38. ONE REAL PHONE BOOKING.
//
// Owner decision, 2026-08-20: prove the FORM works end to end once, then test
// the business rules underneath it. This is that one journey — a coordinator
// taking a phone booking, through the actual four-step wizard, start to finish.
//
// ⚠️ THIS SENDS A REAL EMAIL. `send_confirmation_email` defaults to ON, the
// contact address is the Owner's inbox, and D-010 says mail is deliberately
// live. That is the point of the case: a booking system whose confirmation
// never arrives is broken however correct its database rows are.
//
// ── ⛔ HOW THIS FORM HAS TO BE DRIVEN (measured; see HANDOFF-2026-08-20-C §7)
//
// Every real input is `type="hidden"` and driven by React state, and the
// visible controls carry NO `name` attribute. They are addressed BY LABEL. A
// test that reaches for `input[name=...]` finds only the hidden mirrors and
// sets nothing at all.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { hasBaseUrl } from "./helpers";

const AUTH_DIR = "e2e/.auth";
const RUN_TAG = process.env.E2E_FIXTURE_TAG ?? String(process.pid);

/** ⛔ D-010: mail is deliberately live to the Owner's inbox. */
const OWNER_INBOX = "thefoolmarketing@outlook.com";

/** The package this booking orders, and what the SERVICES table says it costs. */
const PACKAGE = { label: "Hijama Package", price: 45, durationMins: 60 };

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (`pnpm test:e2e`).");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function isoDaysFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * Type a value and VERIFY it landed, correcting a dropped leading character.
 *
 * ⚠️ The City field drops its first keystroke — "Luton" arrives as "uton", and
 * a programmatic `fill()` leaves it empty altogether. It is entangled with the
 * Google Places autocomplete on the Address field beside it, which degrades to
 * a plain input here because no Maps key is configured.
 *
 * ⛔ That is NOT recorded as a defect, and this helper must not be read as
 * papering over one: whether a receptionist sees the same thing has not been
 * established, and settling it needs the Maps key present. What this helper
 * does is make the test honest — it asserts the field ended up holding what was
 * typed, rather than proceeding with a half-typed city.
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
  // ⛔ Loud rather than silent: a half-typed city would put wrong data on a real
  // customer record, and the rest of the test would still pass.
  expect(await locator.inputValue(), `could not type "${value}" into the field`).toBe(value);
}

async function sessionFor(browser: import("@playwright/test").Browser, role: string) {
  const statePath = `${AUTH_DIR}/${role}.json`;
  if (!fs.existsSync(statePath)) {
    throw new Error(`${statePath} missing. Run: node scripts/mint-e2e-session.mjs --all --write`);
  }
  const context = await browser.newContext({ storageState: statePath });
  return { context, page: await context.newPage() };
}

test.describe("gate 08 P2 — E08-38, a phone booking taken through the real form", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);
  const contactName = `ZZTEST-PhoneBooking-${RUN_TAG}`;
  let bookingId: string | null = null;
  let clientId: string | null = null;

  test.afterAll(async () => {
    // ⛔ Unconditional, and swept by this run's tag as well as by collected id —
    // an id captured only after an assertion is lost when that assertion fails
    // (G-25).
    const { data: clients } = await db.from("clients").select("id").like("full_name", `ZZTEST-%${RUN_TAG}`);
    const clientIds = [...new Set([
      ...(clientId ? [clientId] : []),
      ...((clients ?? []) as { id: string }[]).map((c) => c.id),
    ])];

    const { data: bookings } = await db.from("bookings").select("id").like("contact_full_name", `ZZTEST-%${RUN_TAG}`);
    const bookingIds = [...new Set([
      ...(bookingId ? [bookingId] : []),
      ...((bookings ?? []) as { id: string }[]).map((b) => b.id),
    ])];

    if (bookingIds.length > 0) {
      await db.from("booking_assignments").delete().in("booking_id", bookingIds);
      await db.from("booking_items").delete().in("booking_id", bookingIds);
      await db.from("booking_participants").delete().in("booking_id", bookingIds);
      await db.from("email_delivery_events").delete().in("booking_id", bookingIds);
      await db.from("bookings").delete().in("id", bookingIds);
    }
    if (clientIds.length > 0) {
      await db.from("client_notes").delete().in("client_id", clientIds);
      await db.from("clients").delete().in("id", clientIds);
    }
  });

  test("a coordinator takes a phone booking, and the confirmation email is queued", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    const bookingDate = isoDaysFromToday(21);

    try {
      await page.goto("/admin/bookings/new/", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /New booking/i })).toBeVisible();

      // ── Step 1 — contact and source ───────────────────────────────────────
      await page.getByLabel(/Booking source/i).selectOption("phone");
      await page.getByLabel(/Full name/i).fill(contactName);
      await page.getByLabel(/Phone number/i).fill("07999123456");
      // ⚠️ The customer's address IS the Owner's inbox. This is what makes the
      // confirmation email land somewhere they can check it.
      await page.getByLabel(/Email address/i).fill(OWNER_INBOX);

      const next = page.getByRole("button", { name: /^Continue$/ }).first();
      await expect(next, "Continue should unlock once source, name and phone are set").toBeEnabled();
      await next.click();

      // ── Step 2 — participant and services ─────────────────────────────────
      await page.getByLabel(/Name or label/i).fill(contactName);
      await page.getByLabel(/gender/i).selectOption("female");
      // The package radios are not directly clickable — the card is.
      await page.getByText(PACKAGE.label, { exact: false }).first().click();
      await expect(next, "Continue should unlock once a package is chosen").toBeEnabled();
      await next.click();

      // ── Step 3 — location, then date and time ─────────────────────────────
      await page.getByLabel(/Postcode/i).fill("LU1 1AA");
      // ⛔ Address is a COMBOBOX (Google Places), not a plain text input.
      await page.getByRole("combobox", { name: /Address/i }).fill("1 ZZTEST Street");
      await typeVerified(page, page.getByLabel(/^City/i), "Luton");

      // ⛔ Set the date through the real <input type="date"> rather than by
      // clicking the month grid. The grid's day cells are
      // `<td role="gridcell" data-day="...">` wrapping a button labelled
      // "Saturday, August 1st, 2026" — clickable, but brittle to drive and it
      // proves nothing extra.
      const dateField = page.getByLabel(/^Date/i);
      await expect(dateField, "the date picker appears once city, genders and services are set")
        .toBeVisible();
      await dateField.fill(bookingDate);
      await page.waitForTimeout(2500);

      // Pick the first offered start time.
      const timeButton = page.getByRole("button", { name: /^\d{1,2}:\d{2}/ }).first();
      await expect(timeButton, "a start time should be offered for a future date").toBeVisible();
      const chosenTime = ((await timeButton.textContent()) ?? "").trim();
      await timeButton.click();
      await page.waitForTimeout(1200);

      await expect(next, "Continue should unlock once a date and time are chosen").toBeEnabled();
      await next.click();

      // ── Step 4 — confirm and submit ───────────────────────────────────────
      //
      // ⛔ Measured labels. The submit is "Submit booking request", and it is
      // DISABLED until the consent box is ticked — so a test that only looked
      // for the button would sit waiting on a control that never enables.
      const submit = page.getByRole("button", { name: /Submit booking request/i }).first();
      await expect(submit, "the confirm step should offer a submit").toBeVisible();
      await expect(
        submit,
        "submit must start disabled — consent has not been confirmed yet",
      ).toBeDisabled();

      // The summary must show what is about to be created, not a blank form.
      //
      // ⛔ `.filter({ visible: true })`, not `.first()`. Earlier wizard steps
      // stay in the DOM hidden, so `.first()` picked the step-2 copy of the
      // package name and waited forever for a hidden node to become visible.
      for (const shown of [contactName, PACKAGE.label, bookingDate]) {
        await expect(
          page.getByText(shown, { exact: false }).filter({ visible: true }).first(),
          `the confirm step should show ${shown}`,
        ).toBeVisible();
      }

      // ⛔ Consent is a real gate on a real clinic record. Clicking its text
      // toggles the box; there is no label-for association to target.
      await page
        .getByText(/I confirm that the client's details and consent have been obtained/i)
        .click();
      await page.waitForTimeout(400);
      await expect(submit, "consent should unlock the submit").toBeEnabled();

      const answered = page.waitForResponse(
        (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
        { timeout: 120_000 },
      );
      await submit.click();
      await answered;
      await page.waitForTimeout(3000);

      // ── What the DATABASE says. The screen is an opinion; the rows are facts.
      const { data: rows } = await db
        .from("bookings")
        .select("id, client_id, booking_date, start_time, total_price, total_duration_mins, status, booking_source, contact_email")
        .eq("contact_full_name", contactName);
      expect(rows ?? [], `no booking row was created for ${contactName}`).toHaveLength(1);

      const booking = (rows ?? [])[0] as {
        id: string; client_id: string; booking_date: string; start_time: string;
        total_price: string; total_duration_mins: number; booking_source: string; contact_email: string;
      };
      bookingId = booking.id;
      clientId = booking.client_id;

      expect(booking.booking_date, "the booking landed on the date chosen").toBe(bookingDate);
      expect(booking.start_time.slice(0, 5), "the booking landed at the time chosen").toBe(
        chosenTime.slice(0, 5),
      );
      expect(booking.booking_source).toBe("phone");
      expect(booking.contact_email).toBe(OWNER_INBOX);

      // ⛔ THE ASSERTION THAT MATTERS MOST HERE. Price and duration must come
      // from the `services` table, not from anything the form submitted — a
      // form that can post its own price is a form that can be told to charge
      // £0.
      expect(Number(booking.total_price), "price must be derived from the service").toBe(PACKAGE.price);
      expect(booking.total_duration_mins, "duration must be derived from the service").toBe(
        PACKAGE.durationMins,
      );

      // The record is complete, not just a bookings row.
      const [{ count: participants }, { count: items }, { count: assignments }] = await Promise.all([
        db.from("booking_participants").select("id", { count: "exact", head: true }).eq("booking_id", booking.id),
        db.from("booking_items").select("id", { count: "exact", head: true }).eq("booking_id", booking.id),
        db.from("booking_assignments").select("id", { count: "exact", head: true }).eq("booking_id", booking.id),
      ]);
      expect(participants, "one participant").toBe(1);
      expect(items, "one service line").toBe(1);
      expect(assignments, "one assignment to be claimed").toBe(1);

      // The service line snapshots what was charged, so a later price change
      // cannot rewrite history.
      const { data: itemRows } = await db
        .from("booking_items")
        .select("service_name_snapshot, service_price_snapshot, service_duration_snapshot")
        .eq("booking_id", booking.id);
      const item = (itemRows ?? [])[0] as {
        service_name_snapshot: string; service_price_snapshot: string; service_duration_snapshot: number;
      };
      expect(item.service_name_snapshot).toBe(PACKAGE.label);
      expect(Number(item.service_price_snapshot)).toBe(PACKAGE.price);
      expect(item.service_duration_snapshot).toBe(PACKAGE.durationMins);

      // ⛔ THE EMAIL. This is the half of the case that cannot be proven by
      // reading the schema: a confirmation must actually have been queued for
      // the customer, at the address given.
      const { data: emails } = await db
        .from("email_delivery_events")
        .select("id, event_type, delivery_status, recipient_email, to_email, error_message")
        .eq("booking_id", booking.id);
      expect(
        (emails ?? []).length,
        "a booking taken with an email address must produce a confirmation",
      ).toBeGreaterThan(0);

      type EmailRow = {
        event_type: string; delivery_status: string;
        recipient_email: string | null; to_email: string | null; error_message: string | null;
      };
      const rowsOut = (emails ?? []) as EmailRow[];

      const customerLeg = rowsOut.find(
        (e) => e.recipient_email === OWNER_INBOX || e.to_email === OWNER_INBOX,
      );
      expect(customerLeg, `no email was addressed to ${OWNER_INBOX}`).toBeTruthy();

      // ⛔ THE ASSERTION THE FIRST VERSION WAS MISSING. A row existing only
      // proves the app TRIED. `sendTrackedEmail` records `failed` and `skipped`
      // in the very same table, so a confirmation that never left the building
      // would have satisfied "a row exists" perfectly.
      //
      // ⚠️ This path sends IMMEDIATELY — `delaySeconds` is used only for
      // cancellations, which are parked for the Undo window — so by the time
      // this assertion runs, the provider has already accepted or rejected it.
      //
      // ⛔ The success value is "accepted", NOT "sent" — measured, after
      // guessing "sent" and being told otherwise. The column's CHECK allows
      // accepted / sent / queued / failed / skipped / cancelled_by_restore /
      // cancelled_manual, and the immediate path records the provider's
      // acceptance. Asserting a set rather than one literal, so a future move
      // to "sent" does not fail a working system — while `failed`, `skipped`
      // and every cancelled_* value still do.
      expect(
        ["accepted", "sent"],
        `the confirmation did not go out: ${customerLeg!.delivery_status} ${customerLeg!.error_message ?? ""}`,
      ).toContain(customerLeg!.delivery_status);

      // Reported so the run says out loud what should be in the Owner's inbox.
      // ⚠️ A provider accepting a message is not the same as it arriving —
      // D-010 is explicit that the Owner confirms receipt themselves.
      console.log(
        `[E08-38] emails recorded for this booking: ` +
          rowsOut.map((e) => `${e.event_type}->${e.to_email ?? e.recipient_email}=${e.delivery_status}`).join(", "),
      );

      // Every mutating admin action writes an audit row (invariant 21).
      const { data: audit } = await db
        .from("audit_logs")
        .select("id, action_type")
        .eq("target_id", booking.id);
      expect((audit ?? []).length, "creating a booking must be audited").toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });
});
