// ⛔ GATE 08 P2 — TAKING THE MONEY. Case E08-49.
//
// This is the part of the system that decides whether the clinic's books match
// what actually happened. Three questions, in the Owner's terms:
//
//   1. A customer pays. Can staff record it, and does it stick?
//   2. The one-click "Mark paid" on the bookings list — the fastest thing a
//      receptionist does — does it record the right amount?
//   3. Once a booking is paid for, the travel charge must STOP being editable.
//      Otherwise somebody can quietly change what a settled visit cost after
//      the money has already changed hands.
//
// ── ⛔ WHAT IS NEW HERE, AND WHY IT MATTERS ──────────────────────────────
//
// ⛔ "Mark paid" had NO browser coverage anywhere before this file. The quick
// actions spec covers complete / cancel / restore / the terminal-state guard,
// and `mark_paid` was simply never driven — measured by grepping `e2e/`. It is
// the most-used money control in the product.
//
// ── ⛔ WHAT THIS FILE DELIBERATELY DOES NOT RE-TEST (D-023) ──────────────
//
// The travel-fee ARITHMETIC and both LOCKS are already thoroughly unit-tested in
// `updateBookingManagement-travelFee.test.ts` (12 cases: the fee folds in as
// (service × participants) + fee rather than (service + fee) × participants, it
// clears back out without drift, an unchanged fee re-posted alongside another
// edit still goes through, a cancelled booking is NOT locked, and both refusals
// fire). ⛔ Re-asserting that here would be duplication dressed up as
// thoroughness.
//
// What none of it covers is whether the person at the desk can SEE the refusal.
// A lock the operator cannot see is indistinguishable from a broken form, and
// this form reports it as a FIELD error rather than a banner — a different
// rendering path from every refusal tested so far in this run.
//
// ── ⚠️ EMAIL — ZERO, AND ASSERTED SO IT CAN FAIL ────────────────────────
//
// A payment-only save changes no status, so neither `updateBookingManagement`
// nor `quickUpdateBooking` reaches `sendAssignedStaffBookingChangeEmails`, and
// nothing here touches `resolveBusinessNotificationRecipients`.
//
// ⛔ THE FIXTURES ARE ASSIGNED (to the TEST THERAPIST) SO THAT ASSERTION CAN
// ACTUALLY FAIL. An independent review caught the previous file asserting "no
// email" over fixtures with no assignee, where no send could have left a row
// however broken the code was. With an assignee, a stray send lands in
// `email_delivery_events` and E08-49e catches it.
//
// ⛔ NEVER assign the Owner's staff id: their `staff_profiles.email` IS
// `rahmatherapy@outlook.com`, so assigned-staff mail reaches the real business
// inbox without ever calling the business-recipient resolver.
//
// ── Safety ────────────────────────────────────────────────────────────────
//
// ⛔ Approved to write by D-015. Every row is `ZZTEST-` + a run tag, created
// directly, and hard-deleted in an unconditional afterAll that also sweeps by
// the tag, so a failing assertion still cleans up (G-25).

import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { hasBaseUrl } from "./helpers";

const AUTH_DIR = "e2e/.auth";
const RUN_TAG = process.env.E2E_FIXTURE_TAG ?? String(process.pid);

/** ⛔ Measured. Selected by id, never by name — the identity trap (handoff §8).
 *  ⛔ NEVER substitute the Owner's staff id: their staff_profiles.email is the
 *  real business inbox. */
const THERAPIST_A_STAFF_ID = "884311b1-e9d0-44b9-91f3-14188a3baf59";

const SERVICE = {
  id: "9e70c3fd-b551-465e-9d7b-822398b431d7",
  name: "Hijama Package",
  price: 45,
  durationMins: 60,
};

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Payment fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
        "Run via `pnpm test:e2e`, which passes --env-file=.env.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function insertRow(db: SupabaseClient, table: string, row: Record<string, unknown>) {
  const { data, error } = await db.from(table).insert(row).select("id").single();
  if (error || !data) throw new Error(`fixture insert into ${table} failed: ${error?.message}`);
  return (data as { id: string }).id;
}

function isoDaysFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

type BookingFixture = {
  bookingId: string;
  clientId: string;
  name: string;
  date: string;
};

async function createBookingFixture(
  db: SupabaseClient,
  label: string,
  opts: {
    status: string;
    dayOffset: number;
    /** Fully paid: `amount_due > 0 && amount_paid >= amount_due` is what the lock reads. */
    paid?: boolean;
  },
): Promise<BookingFixture> {
  const name = `ZZTEST-PAY-${label}-${RUN_TAG}`;
  const phone = `076${String(Number(RUN_TAG) % 1_000_000).padStart(6, "0")}`;
  const date = isoDaysFromToday(opts.dayOffset);

  const clientId = await insertRow(db, "clients", {
    full_name: name,
    email: `zztest-pay-${label.toLowerCase()}-${RUN_TAG}@probe.invalid`,
    phone,
    gender_preference: "female",
    postcode: "LU1 1AA",
    // ⛔ NOT "admin" — `clients_client_source_check` rejects it while
    // `bookings_booking_source_check` allows it. The two look alike.
    client_source: "manual",
  });

  const bookingId = await insertRow(db, "bookings", {
    client_id: clientId,
    booking_date: date,
    start_time: "10:00:00",
    end_time: "11:00:00",
    total_duration_mins: SERVICE.durationMins,
    total_price: SERVICE.price,
    // ⛔ Populated deliberately, and equal to `total_price`, which is the
    // ordinary state: `applyTravelFeeDelta` moves BOTH columns together, so
    // nothing in the app leaves them out of step.
    //
    // ⚠️ CONSEQUENCE, MEASURED AND STATED RATHER THAN GLOSSED: this fixture
    // cannot distinguish `amount_due ?? total_price` from
    // `total_price ?? amount_due`. Swapping that order was mutation-tested and
    // stayed GREEN — correctly. The two expressions agree whenever the columns
    // are equal AND whenever either is null, so the swap is behaviourally inert
    // unless something writes them out of step, which nothing does.
    // ⛔ The unit fixture in `quickUpdateBookingNoShow.test.ts` also sets both to
    // the same figure (55), so NOTHING in the repo pins that order — checked,
    // rather than assumed to be covered elsewhere. Harmless today; noted so the
    // next person does not mistake the green for proof.
    amount_due: SERVICE.price,
    amount_paid: opts.paid ? SERVICE.price : 0,
    payment_status: opts.paid ? "paid" : "unpaid",
    ...(opts.paid ? { payment_method: "cash", paid_at: new Date().toISOString() } : {}),
    travel_fee: 0,
    status: opts.status,
    assignment_status: "fully_assigned",
    contact_full_name: name,
    contact_phone: phone,
    booking_source: "admin",
    consent_acknowledged: true,
  });

  const participantId = await insertRow(db, "booking_participants", {
    booking_id: bookingId,
    participant_gender: "female",
    required_therapist_gender: "female",
    is_main_contact: true,
    display_name: name,
    consent_acknowledged: true,
  });

  await insertRow(db, "booking_items", {
    booking_id: bookingId,
    booking_participant_id: participantId,
    service_id: SERVICE.id,
    service_name_snapshot: SERVICE.name,
    service_price_snapshot: SERVICE.price,
    service_duration_snapshot: SERVICE.durationMins,
  });

  // ⛔ ASSIGNED so E08-49e's "no email" assertion can actually fail. See header.
  await insertRow(db, "booking_assignments", {
    booking_id: bookingId,
    participant_id: participantId,
    assigned_staff_id: THERAPIST_A_STAFF_ID,
    required_therapist_gender: "female",
    status: "assigned",
  });

  return { bookingId, clientId, name, date };
}

async function readBooking(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("bookings")
    .select(
      "id, status, payment_status, payment_method, amount_paid, amount_due, paid_at, travel_fee, total_price",
    )
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`could not read booking ${id}: ${error?.message}`);
  return data as {
    id: string;
    status: string;
    payment_status: string;
    payment_method: string | null;
    amount_paid: number;
    amount_due: number | null;
    paid_at: string | null;
    travel_fee: number;
    total_price: number;
  };
}

async function auditActions(db: SupabaseClient, bookingId: string): Promise<string[]> {
  const { data } = await db
    .from("audit_logs")
    .select("action_type")
    .eq("target_id", bookingId);
  return ((data ?? []) as { action_type: string }[]).map((r) => r.action_type);
}

async function emailEvents(db: SupabaseClient, bookingId: string) {
  const { data } = await db
    .from("email_delivery_events")
    .select("event_type, recipient_email, delivery_status")
    .eq("booking_id", bookingId);
  return (data ?? []) as Record<string, string>[];
}

async function destroyFixtures(db: SupabaseClient, clientIds: string[]) {
  const { data: strays } = await db
    .from("clients")
    .select("id")
    .like("full_name", `ZZTEST-PAY-%-${RUN_TAG}`);
  const ids = [
    ...new Set([...clientIds, ...((strays ?? []) as { id: string }[]).map((c) => c.id)]),
  ];
  if (ids.length === 0) return;

  const { data: bookings } = await db.from("bookings").select("id").in("client_id", ids);
  const bookingIds = ((bookings ?? []) as { id: string }[]).map((b) => b.id);
  if (bookingIds.length > 0) {
    await db.from("audit_logs").delete().in("target_id", bookingIds);
    await db.from("booking_assignments").delete().in("booking_id", bookingIds);
    await db.from("booking_items").delete().in("booking_id", bookingIds);
    await db.from("booking_participants").delete().in("booking_id", bookingIds);
    await db.from("email_delivery_events").delete().in("booking_id", bookingIds);
    await db.from("bookings").delete().in("id", bookingIds);
  }
  await db.from("client_notes").delete().in("client_id", ids);
  await db.from("clients").delete().in("id", ids);
}

async function sessionFor(browser: import("@playwright/test").Browser, role: string) {
  const statePath = `${AUTH_DIR}/${role}.json`;
  // ⛔ THROW, never skip — a signed-out browser is refused everywhere, which
  // would make every assertion below pass while proving nothing.
  if (!fs.existsSync(statePath)) {
    throw new Error(
      `${statePath} is missing. Run: node scripts/mint-e2e-session.mjs --all --write`,
    );
  }
  const context = await browser.newContext({ storageState: statePath });
  return { context, page: await context.newPage() };
}

/**
 * ⛔ Open the booking detail page and return its Status & payment form.
 *
 * ⚠️ This page IS cached — `getBookingDetailData` wraps its fetch in
 * `unstable_cache` with `revalidate: 60`. A brand-new fixture misses the cache
 * on its first read, which is why no poll is needed here; ⛔ a case that mutates
 * an EXISTING booking out-of-band and re-reads it inside 60 seconds would be
 * served a stale render.
 */
async function openBookingDetail(page: Page, bookingId: string, label: string) {
  await page.goto(`/admin/bookings/${bookingId}/`, { waitUntil: "domcontentloaded" });

  if (/\/admin\/login/.test(page.url())) {
    throw new Error(
      `Signed out while opening ${label}. Sessions expire in about an hour — re-mint: ` +
        `node scripts/mint-e2e-session.mjs --all --write`,
    );
  }
  if ((await page.locator("[data-admin-access-denied]").count()) > 0) {
    throw new Error(`Refused access to the booking detail page for ${label}.`);
  }
  // ⛔ A Next.js 404 renders `<h1>404</h1>`, not the words "not found".
  if ((await page.locator("h1", { hasText: /^404$/ }).count()) > 0) {
    throw new Error(`Booking ${bookingId} (${label}) 404ed on the detail page.`);
  }

  const form = page.locator("#booking-status-form");
  await expect(form, `the status form should render for ${label}`).toBeVisible({
    timeout: 30_000,
  });
  return form;
}

/**
 * Click a control and wait for the server action to answer.
 * ⛔ Never a fixed sleep (G-13).
 */
async function awaitAction(page: Page, click: () => Promise<void>) {
  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  await click();
  await answered;
  await page.waitForTimeout(1_200);
}

function saveButton(form: ReturnType<Page["locator"]>) {
  return form.getByRole("button", { name: /Save status & payment/i });
}

function bookingsListFor(date: string) {
  return `/admin/bookings/?view=all&from=${date}&to=${date}`;
}

/**
 * ⛔ Open the row's menu. The bookings LIST is cached (`unstable_cache`,
 * `revalidate: 60`) and only server actions call `updateTag`, so a directly
 * inserted row does not appear until the window turns over. Poll, never assert
 * once — measured twice on this project.
 */
async function openRowMenu(page: Page, name: string) {
  if (/\/admin\/login/.test(page.url())) {
    throw new Error(
      `Signed out while looking for ${name}. Re-mint: node scripts/mint-e2e-session.mjs --all --write`,
    );
  }
  if ((await page.locator("[data-admin-access-denied]").count()) > 0) {
    throw new Error(`Refused access to the bookings list while looking for ${name}.`);
  }

  const trigger = page.getByRole("button", { name: `More actions for ${name}` });
  const deadline = Date.now() + 90_000;
  while ((await trigger.count()) === 0 && Date.now() < deadline) {
    await page.waitForTimeout(3_000);
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  if ((await trigger.count()) === 0) {
    // ⛔ SAY WHAT WAS ACTUALLY THERE. A silent timeout diagnoses nothing.
    const names = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[aria-label^="More actions for "]'))
        .map((el) => el.getAttribute("aria-label"))
        .slice(0, 12),
    );
    throw new Error(
      `${name} is not on ${page.url()}\n` +
        `  rows rendered: ${names.length}\n` +
        names.map((n) => `    - ${n}`).join("\n"),
    );
  }
  await expect(trigger, `the row for ${name} should be on the bookings list`).toBeVisible({
    timeout: 30_000,
  });
  await trigger.click();
}

test.describe("gate 08 P2 — taking payment, and locking it once it is taken", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });
  // ⚠️ The dev server compiles each route on first visit. Not a performance
  // statement — gate 14 owns speed and measures the built site.
  test.setTimeout(300_000);

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);

  let payable: BookingFixture;
  let quickPayable: BookingFixture;
  let settled: BookingFixture;
  let finished: BookingFixture;
  const createdClientIds: string[] = [];

  test.beforeAll(async () => {
    // ⚠️ Past-dated: an ordinary "the visit happened, they paid" booking. The
    // payment path carries NO future-date guard — money can legitimately be
    // taken in advance — so the date is not what is under test here.
    payable = await createBookingFixture(db, "Form", { status: "confirmed", dayOffset: -2 });
    // ⛔ A DIFFERENT DAY FROM `payable`, AND THAT IS LOAD-BEARING, NOT TIDINESS.
    // Two fixtures on one day made this spec FLAKY, and chasing it down found a
    // real defect in the product: an inert row (cancelled, no-show, or ANY
    // past-dated booking) carries `opacity-75`, which creates a CSS stacking
    // context that paints OVER the previous row's absolutely-positioned actions
    // menu. Measured on real production rows with `document.elementFromPoint`:
    // 2 of 3 menu items unclickable, 0 of 3 with the following row forced to
    // opacity 1, 2 of 3 again when restored. Recorded as a finding.
    // ⚠️ One fixture per day keeps this spec measuring PAYMENT rather than that
    // defect — and it is why the quick-actions spec never caught it either.
    quickPayable = await createBookingFixture(db, "Quick", {
      status: "confirmed",
      dayOffset: -6,
    });
    // ⛔ Fully paid: `amount_due > 0 && amount_paid >= amount_due`, which is the
    // exact expression the lock reads.
    settled = await createBookingFixture(db, "Settled", {
      status: "confirmed",
      dayOffset: -3,
      paid: true,
    });
    // ⛔ The other lock: a finished visit, still unpaid, so it is the COMPLETED
    // status doing the locking rather than the money.
    finished = await createBookingFixture(db, "Done", { status: "completed", dayOffset: -4 });
    createdClientIds.push(
      payable.clientId,
      quickPayable.clientId,
      settled.clientId,
      finished.clientId,
    );

    // ⛔ Prove the fixtures are what the tests assume BEFORE any of them run.
    for (const f of [payable, quickPayable]) {
      const row = await readBooking(db, f.bookingId);
      expect(row.payment_status, `${f.name} must start unpaid`).toBe("unpaid");
      expect(Number(row.amount_paid), `${f.name} must start at zero paid`).toBe(0);
    }
    const settledRow = await readBooking(db, settled.bookingId);
    expect(settledRow.payment_status, "the settled fixture must start paid").toBe("paid");
    expect(
      Number(settledRow.amount_paid) >= Number(settledRow.amount_due),
      "and must genuinely satisfy amount_paid >= amount_due, which is what the lock reads",
    ).toBe(true);
    expect(
      (await readBooking(db, finished.bookingId)).status,
      "the completed fixture must start completed",
    ).toBe("completed");
  });

  test.afterAll(async () => {
    if (db) await destroyFixtures(db, createdClientIds);
  });

  test("E08-49a — a customer pays, and the books record it", async ({ browser }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      const form = await openBookingDetail(page, payable.bookingId, payable.name);

      await form.getByLabel(/^Payment status\*?$/).selectOption("paid");
      await form.getByLabel(/^Payment method$/).selectOption("cash");

      // ⛔ Use the real "Match total" shortcut rather than typing a number. It is
      // what a receptionist actually presses, and it proves the button fills the
      // figure the rest of the form agrees with.
      await form.getByRole("button", { name: /Match total/i }).click();
      await expect(
        form.getByLabel(/^Amount paid$/),
        "the Match total shortcut should fill in the booking's own total",
      ).toHaveValue("45.00");

      await expect(saveButton(form), "the save control should enable").toBeEnabled();
      await awaitAction(page, () => saveButton(form).click());

      const after = await readBooking(db, payable.bookingId);
      expect(after.payment_status, "the booking is marked paid").toBe("paid");
      expect(Number(after.amount_paid), "for the full amount").toBe(SERVICE.price);
      expect(after.payment_method, "by the method the staff member chose").toBe("cash");
      // ⛔ `paid_at` is what tells the clinic WHEN money came in. It is stamped
      // by the action, not by a trigger, so a payment recorded without it would
      // be invisible to any date-based takings question.
      expect(after.paid_at, "and stamped with when it was taken").not.toBeNull();

      expect(
        await auditActions(db, payable.bookingId),
        "the payment is on the audit trail",
      ).toContain("booking_management_updated");
    } finally {
      await context.close();
    }
  });

  test("E08-49b — the one-click 'Mark paid' on the bookings list", async ({ browser }) => {
    // ⛔ NO BROWSER COVERAGE BEFORE THIS. It is the fastest money control in the
    // product and nothing had ever driven it.
    //
    // ⚠️ It is a DIFFERENT server action from E08-49a — `quickUpdateBooking`,
    // writing a `booking_quick_mark_paid` audit row rather than
    // `booking_management_updated`.
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await page.goto(bookingsListFor(quickPayable.date), { waitUntil: "domcontentloaded" });
      await openRowMenu(page, quickPayable.name);

      // ⛔ No modal on this one — it fires straight away.
      await awaitAction(page, () =>
        page.getByRole("menuitem", { name: /^Mark paid$/ }).click(),
      );

      const after = await readBooking(db, quickPayable.bookingId);
      expect(after.payment_status, "one click records the payment").toBe("paid");
      // ⛔ THE FIGURE IS THE POINT. `quickUpdateBooking` sets `amount_paid` to
      // `amount_due ?? total_price ?? 0` — if that ever drifted, the clinic would
      // show visits as settled for the wrong money, silently.
      expect(
        Number(after.amount_paid),
        "for the amount actually due, not zero and not a guess",
      ).toBe(SERVICE.price);
      expect(
        after.payment_method,
        "defaulting to cash, which is what the shortcut promises",
      ).toBe("cash");
      expect(after.paid_at, "and stamped").not.toBeNull();

      // ⛔ `booking_quick_mark_paid` — a template literal `booking_quick_${action}`.
      // NOT `booking_paid`. Measured, because the obvious guess is wrong.
      expect(
        await auditActions(db, quickPayable.bookingId),
        "the quick action leaves its own distinct audit trail",
      ).toContain("booking_quick_mark_paid");

      // ⛔ The status must NOT have moved. `mark_paid` is the one quick action
      // that writes no status, and a payment that silently confirmed or completed
      // a booking would be a far worse bug than a wrong figure.
      expect(
        after.status,
        "and taking payment does not quietly change the booking's status",
      ).toBe("confirmed");
    } finally {
      await context.close();
    }
  });

  test("E08-49c — once a booking is paid for, the travel charge is locked", async ({
    browser,
  }) => {
    // ⛔ The business rule: nobody edits what a settled visit cost after the money
    // has changed hands. The RULE is unit-tested; what is proven here is that the
    // person at the desk is TOLD, on the field they tried to change.
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      const form = await openBookingDetail(page, settled.bookingId, settled.name);
      const before = await readBooking(db, settled.bookingId);

      await form.getByLabel(/^Travel charge$/).fill("12.50");
      await expect(saveButton(form), "the save control should enable").toBeEnabled();
      await awaitAction(page, () => saveButton(form).click());

      // ⛔ THE DATABASE FIRST — it is the substantive claim. A charge that
      // actually changed would be the real failure; the operator not being told
      // is the smaller half.
      const after = await readBooking(db, settled.bookingId);
      expect(
        Number(after.travel_fee),
        "a settled booking's travel charge does not move",
      ).toBe(Number(before.travel_fee));
      expect(
        Number(after.total_price),
        "and neither does what the customer was charged in total",
      ).toBe(Number(before.total_price));

      // …and then what the page SAID. ⛔ This form reports the refusal as a FIELD
      // error, not a banner — a different rendering path from every other refusal
      // in this run, which is the reason this case exists at all.
      await expect(
        form.getByText(/fully paid — the travel charge can no longer be changed/i),
        "the staff member is told why, on the field they tried to change",
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test("E08-49d — once a visit is completed, the travel charge is locked too", async ({
    browser,
  }) => {
    // ⚠️ A SECOND, SEPARATE lock with its own message. This fixture is still
    // UNPAID, so it is the completed STATUS doing the locking and not the money —
    // without that the case would be a copy of E08-49c that could pass for the
    // wrong reason.
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      const form = await openBookingDetail(page, finished.bookingId, finished.name);
      const before = await readBooking(db, finished.bookingId);
      expect(before.payment_status, "this fixture must still be unpaid").toBe("unpaid");

      await form.getByLabel(/^Travel charge$/).fill("9.99");
      await awaitAction(page, () => saveButton(form).click());

      const after = await readBooking(db, finished.bookingId);
      expect(
        Number(after.travel_fee),
        "a completed visit's travel charge does not move",
      ).toBe(Number(before.travel_fee));

      // ⛔ The message must name COMPLETED, not "fully paid". Both locks render
      // through the same field, so a looser matcher would pass on the wrong one
      // and this case would silently become a copy of E08-49c.
      await expect(
        form.getByText(/completed — the travel charge can no longer be changed/i),
        "and the message names the rule that actually applies",
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test("E08-49e — none of the payment work emailed anybody", async () => {
    // ⛔ No browser: the question is what the SERVER did.
    //
    // A payment-only save changes no status, so neither action reaches
    // `sendAssignedStaffBookingChangeEmails`. ⛔ EVERY fixture here IS ASSIGNED,
    // so this assertion can genuinely fail: a stray send would leave a
    // `staff_booking_change` row. The previous file in this run asserted the same
    // thing over unassigned fixtures, where no send could have produced a row
    // however broken the code was — caught by an independent review.
    for (const f of [payable, quickPayable, settled, finished]) {
      expect(
        await emailEvents(db, f.bookingId),
        `recording money must not email anybody (${f.name})`,
      ).toEqual([]);
    }
  });
});
