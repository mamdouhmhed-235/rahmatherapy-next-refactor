// ⛔ GATE 08 P2 — BOOKING QUICK ACTIONS. Cases E08-43, E08-44, E08-46, E08-47.
//
// These are the buttons the clinic presses every single day: mark an
// appointment done, cancel one, put a cancelled one back. Everything else in
// the booking group is rarer than these.
//
// ⛔ E08-45 (NO-SHOW) IS **NOT** IN THIS FILE, and that is deliberate rather
// than an omission. No-show is not a row quick action at all — it is an option
// on the booking DETAIL page's status form
// (`BookingManagementForm.tsx`, `<option value="no_show">`). Measured, after
// looking for it in the row menu and finding only confirm / complete / cancel /
// restore / mark-paid / send-reminder. It belongs with the detail-page cases and
// is still OUTSTANDING.
//
// ── ⚠️⚠️ THIS SPEC SENDS REAL EMAIL TO THE BUSINESS INBOX ─────────────────
//
// Cancelling and restoring both notify. `sendBookingCancellationEmails` resolves
// business recipients, and in production that list includes
// `rahmatherapy@outlook.com`. ⛔ The Owner approved running the booking group
// with mail LIVE throughout (D-030), having been told to expect 12+ messages.
// ⛔ Do not run this file as a casual "quick check".
//
// ── ⛔ WHY THE RULES ARE NOT RE-TESTED HERE ───────────────────────────────
//
// D-023: prove the FORM once, test the RULES underneath. The rules already have
// real unit coverage — `quickUpdateBookingCancel` (9), `quickUpdateBookingNoShow`
// (18), `quickUpdateBookingRestore` (7), `ensureBookingActive` (9),
// `updateBookingManagement-completed-guard`. ⛔ Re-asserting those here would be
// duplication dressed up as thoroughness.
//
// What NONE of them cover is whether a coordinator clicking the real control
// actually reaches the action — the menu's visibility rules, the confirmation
// modal, and the re-render afterwards. That is this file's entire job, and it
// asserts the DATABASE rather than the toast.
//
// ── ⛔ THE TRAP IN THIS SCREEN, MEASURED BEFORE WRITING A LINE ────────────
//
// The menu ITEM and the modal's CONFIRM button carry the SAME accessible name —
// "Cancel booking" opens the dialog and "Cancel booking" confirms it; likewise
// "Restore booking". An unscoped `getByRole("button", { name: ... })` is
// therefore ambiguous, and resolving it with `.first()` would click the trigger
// twice and assert nothing. Every click below is scoped — to the row's menu, or
// to the dialog.
//
// ⚠️ Also measured: "Mark complete" only renders when the booking is
// `confirmed` AND `fully_assigned`, and Cancel disappears on
// cancelled/completed/no_show. The fixtures are built to those exact rules, so
// a missing button means a real regression rather than a fixture that never
// qualified.
//
// ── Safety ────────────────────────────────────────────────────────────────
//
// ⛔ Approved to write by D-015. Every row is `ZZTEST-` + a run tag, created
// directly (no email), and hard-deleted in an unconditional afterAll that also
// sweeps by the tag, so a failing assertion still cleans up (G-25).

import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { hasBaseUrl } from "./helpers";

const AUTH_DIR = "e2e/.auth";
const RUN_TAG = process.env.E2E_FIXTURE_TAG ?? String(process.pid);

/** Measured. ⛔ Selected by id, never by name — the identity trap. */
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
      "Quick-action fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
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
  /** The fixture's own booking_date — the list is scoped to it. */
  date: string;
};

/**
 * One client with one booking, in whatever state the case needs.
 *
 * ⛔ `assign` matters: "Mark complete" is only offered on a booking that is
 * `confirmed` AND `fully_assigned`, so the completion case must be assigned or
 * the button legitimately would not be there and the test would fail for the
 * wrong reason.
 */
async function createBookingFixture(
  db: SupabaseClient,
  label: string,
  opts: {
    status: string;
    assign: boolean;
    dayOffset: number;
    cancelledAt?: string | null;
  },
): Promise<BookingFixture> {
  const name = `ZZTEST-QA-${label}-${RUN_TAG}`;
  const phone = `079${String(Number(RUN_TAG) % 1_000_000).padStart(6, "0")}`;

  const clientId = await insertRow(db, "clients", {
    full_name: name,
    email: `zztest-qa-${label.toLowerCase()}-${RUN_TAG}@probe.invalid`,
    phone,
    gender_preference: "female",
    postcode: "LU1 1AA",
    // ⛔ NOT "admin" — `clients_client_source_check` rejects it while
    // `bookings_booking_source_check` allows it. The two look alike.
    client_source: "manual",
  });

  const bookingId = await insertRow(db, "bookings", {
    client_id: clientId,
    booking_date: isoDaysFromToday(opts.dayOffset),
    start_time: "10:00:00",
    end_time: "11:00:00",
    total_duration_mins: SERVICE.durationMins,
    total_price: SERVICE.price,
    status: opts.status,
    assignment_status: opts.assign ? "fully_assigned" : "unassigned",
    contact_full_name: name,
    contact_phone: phone,
    booking_source: "admin",
    consent_acknowledged: true,
    ...(opts.cancelledAt !== undefined ? { cancelled_at: opts.cancelledAt } : {}),
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

  if (opts.assign) {
    await insertRow(db, "booking_assignments", {
      booking_id: bookingId,
      participant_id: participantId,
      assigned_staff_id: THERAPIST_A_STAFF_ID,
      required_therapist_gender: "female",
      status: "assigned",
    });
  }

  return { bookingId, clientId, name, date: isoDaysFromToday(opts.dayOffset) };
}

async function readBooking(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("bookings")
    .select("id, status, cancelled_at, completed_at")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`could not read booking ${id}: ${error?.message}`);
  return data as {
    id: string;
    status: string;
    cancelled_at: string | null;
    completed_at: string | null;
  };
}

async function destroyFixtures(db: SupabaseClient, clientIds: string[]) {
  const { data: strays } = await db
    .from("clients")
    .select("id")
    .like("full_name", `ZZTEST-QA-%-${RUN_TAG}`);
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
 * ⛔ The bookings list, scoped to ONE day — the fixture's own.
 *
 * Three things were measured to arrive at this, each after a case failed to
 * find its row:
 *
 *  1. A Coordinator lands on the **"attention"** view, and a `confirmed` +
 *     `fully_assigned` booking correctly needs no attention, so it is
 *     legitimately absent there.
 *  2. `filterBookings` excludes `cancelled` / `no_show` from every view except
 *     `cancelled`, `all` and `series` — which the restore and terminal-guard
 *     cases depend on. Hence `view=all`.
 *  3. ⛔ `view=all` alone is STILL not enough: a diagnostic showed it rendering
 *     17 rows without the fixture, while `from`/`to` pinned to the fixture's
 *     date found it immediately. The list is paginated over live production
 *     data, so "it is on the all view" does not mean "it is on the first page".
 *
 * ⚠️ Scoping to the day is also what keeps these cases stable as the clinic's
 * real booking list grows — a test that relies on its fixture landing on page
 * one is a test with a shelf life.
 */
function bookingsListFor(date: string) {
  return `/admin/bookings/?view=all&from=${date}&to=${date}`;
}

/** The row's "More actions" trigger — uniquely named per booking. */
function rowMenuTrigger(page: Page, name: string) {
  return page.getByRole("button", { name: `More actions for ${name}` });
}

/**
 * ⛔ Open the row's menu, waiting for the row to exist first.
 *
 * The bookings list is a live production list, so the fixture must be found by
 * its own control rather than by position or by page text (G-12).
 */
async function openRowMenu(page: Page, name: string) {
  // ⛔ DISTINGUISH "signed out" AND "refused" FROM "row missing" BEFORE waiting
  // 30 seconds for a control that was never going to appear.
  //
  // ⚠️ Without this, an EXPIRED SESSION reads as "the button is gone" — which is
  // the alarming direction, and cost a full debugging pass on this very file.
  // Sessions expire; a run that lands on the sign-in page means re-mint, not a
  // broken app.
  if (/\/admin\/login/.test(page.url())) {
    throw new Error(
      `Signed out while looking for ${name}. Re-mint: node scripts/mint-e2e-session.mjs --all --write`,
    );
  }
  if ((await page.locator("[data-admin-access-denied]").count()) > 0) {
    throw new Error(`Refused access to the bookings list while looking for ${name}.`);
  }

  // ⛔ RELOAD UNTIL THE LIST CATCHES UP — the bookings list is CACHED.
  //
  // ⚠️ Measured, and it cost several passes on this file. The diagnostic output
  // was unambiguous: with the current run's fixture in the database, the page
  // rendered ONE row — a fixture from a PREVIOUS run that had already been
  // deleted. A direct check of the database at that moment showed ZERO
  // `ZZTEST-QA-%` rows, so teardown was working perfectly and the page was
  // simply serving a stale render.
  //
  // ⛔ This is the SAME lesson already written down for the enquiries list, and
  // I failed to carry it across: a fixture inserted straight into the database
  // does not invalidate the cache, because only the server actions call
  // `updateTag`. Anything that seeds a list page directly must POLL.
  const trigger = rowMenuTrigger(page, name);
  const deadline = Date.now() + 90_000;
  while ((await trigger.count()) === 0 && Date.now() < deadline) {
    await page.waitForTimeout(3_000);
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  if ((await trigger.count()) === 0) {
    // ⛔ SAY WHAT WAS ACTUALLY THERE. "Element not found" after a 30-second wait
    // tells the next person nothing about WHY — whether the list was empty, or
    // full of other people's bookings, or showing a different day. This turns a
    // silent timeout into a diagnosis.
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

/**
 * Click a control and wait for the server action to answer.
 * ⛔ Never a fixed sleep (G-13) — a slow reply would otherwise read as "the
 * status did not change", the reassuring direction.
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

/** ⛔ Confirm inside the DIALOG — the trigger carries the same name. */
async function confirmInDialog(page: Page, label: RegExp) {
  const dialog = page.getByRole("dialog");
  await expect(dialog, "the confirmation dialog should open").toBeVisible();
  await dialog.getByRole("button", { name: label }).click();
}

/**
 * ⛔ The quick actions write `booking_quick_<action>` — `booking_quick_complete`,
 * `booking_quick_cancel` — NOT `booking_completed` / `booking_cancelled`.
 * Measured from `actions.ts:948` (a template literal), because the obvious guess
 * is wrong and would have failed these cases for the wrong reason.
 * ⚠️ `restoreBooking` is the exception: it writes a literal `booking_restored`.
 */
async function auditActions(db: SupabaseClient, bookingId: string): Promise<string[]> {
  const { data } = await db
    .from("audit_logs")
    .select("action_type")
    .eq("target_id", bookingId);
  return ((data ?? []) as { action_type: string }[]).map((r) => r.action_type);
}

test.describe("gate 08 P2 — booking quick actions, through the real buttons", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });
  // ⚠️ The dev server compiles each route on first visit. Not a performance
  // statement — gate 14 owns speed and measures the built site.
  test.setTimeout(300_000);

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);

  let completable: BookingFixture;
  let cancellable: BookingFixture;
  let restorable: BookingFixture;
  const createdClientIds: string[] = [];

  test.beforeAll(async () => {
    // ⛔ IN THE PAST, and that is a RULE not a preference. `quickUpdateBooking`
    // refuses complete/no-show on a future-dated booking — "This booking is in
    // the future. Mark complete or no-show after the appointment time." The
    // first version of this fixture sat 10 days ahead and the action was
    // correctly refused: the APP was right and the FIXTURE was wrong.
    //
    // ⚠️ Safe from interference: auto-promotion to `completed` fires only from
    // `updateOwnAssignmentStatus` when every assignment closes, never on page
    // load — so this case cannot pass without the click under test.
    completable = await createBookingFixture(db, "Complete", {
      status: "confirmed",
      assign: true,
      dayOffset: -2,
    });
    cancellable = await createBookingFixture(db, "Cancel", {
      status: "confirmed",
      assign: false,
      dayOffset: 11,
    });
    // ⛔ `cancelled_at` must be RECENT: the menu hides Restore once the 28-day
    // window has passed, and `isRestoreWindowExpired` fails CLOSED. A fixture
    // with a null stamp would silently offer no Restore at all.
    // ⛔ FUTURE, for the opposite reason: the menu hides Restore once the
    // appointment moment has passed ("No actions available (appointment time
    // has passed)"). Past here would remove the very control under test.
    restorable = await createBookingFixture(db, "Restore", {
      status: "cancelled",
      assign: false,
      dayOffset: 12,
      cancelledAt: new Date().toISOString(),
    });
    createdClientIds.push(
      completable.clientId,
      cancellable.clientId,
      restorable.clientId,
    );

    // ⛔ Prove the fixtures are what the tests assume BEFORE any of them run.
    expect((await readBooking(db, completable.bookingId)).status).toBe("confirmed");
    expect((await readBooking(db, cancellable.bookingId)).status).toBe("confirmed");
    expect((await readBooking(db, restorable.bookingId)).status).toBe("cancelled");
  });

  test.afterAll(async () => {
    if (db) await destroyFixtures(db, createdClientIds);
  });

  test("E08-43 — 'Mark complete' completes the appointment", async ({ browser }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await page.goto(bookingsListFor(completable.date), { waitUntil: "domcontentloaded" });
      await openRowMenu(page, completable.name);

      // ⛔ No modal on this one — it fires straight away.
      await awaitAction(page, () =>
        page.getByRole("menuitem", { name: /^Mark complete$/ }).click(),
      );

      const after = await readBooking(db, completable.bookingId);
      expect(after.status, "the appointment is marked done").toBe("completed");
      expect(
        after.completed_at,
        "and stamped, which is what the revenue reports read",
      ).not.toBeNull();

      expect(
        await auditActions(db, completable.bookingId),
        "the completion is on the audit trail",
      ).toContain("booking_quick_complete");
    } finally {
      await context.close();
    }
  });

  test("E08-44 — 'Cancel booking' cancels it, through its confirmation dialog", async ({
    browser,
  }) => {
    // ⚠️ THIS CASE EMAILS THE REAL BUSINESS INBOX (D-030).
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await page.goto(bookingsListFor(cancellable.date), { waitUntil: "domcontentloaded" });
      await openRowMenu(page, cancellable.name);

      // ⛔ Scoped: this is the MENU ITEM, not the dialog's confirm button of the
      // same name.
      await page.getByRole("menuitem", { name: /^Cancel booking$/ }).click();
      await awaitAction(page, () => confirmInDialog(page, /^Cancel booking$/));

      const after = await readBooking(db, cancellable.bookingId);
      expect(after.status, "the appointment is cancelled").toBe("cancelled");
      expect(
        after.cancelled_at,
        "and stamped — the restore window is measured from this",
      ).not.toBeNull();

      expect(
        await auditActions(db, cancellable.bookingId),
        "the cancellation is on the audit trail",
      ).toContain("booking_quick_cancel");
    } finally {
      await context.close();
    }
  });

  test("E08-46 — a cancelled booking is no longer offered Cancel", async ({ browser }) => {
    // ⛔ The terminal-state guard, at the affordance layer. The SERVER half is
    // covered by `ensureBookingActive`'s unit tests; this proves the screen does
    // not offer what the server would refuse.
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await page.goto(bookingsListFor(cancellable.date), { waitUntil: "domcontentloaded" });
      await openRowMenu(page, cancellable.name);

      await expect(
        page.getByRole("menuitem", { name: /^Cancel booking$/ }),
        "a cancelled booking cannot be cancelled again",
      ).toHaveCount(0);
      await expect(
        page.getByRole("menuitem", { name: /^Mark complete$/ }),
        "nor completed",
      ).toHaveCount(0);

      // ⛔ NON-VACUITY. Without this the assertions above would also pass if the
      // menu simply failed to open. An inert row has exactly one action, and it
      // is Restore.
      await expect(
        page.getByRole("menuitem", { name: /^Restore booking$/ }),
        "the menu really did open, and offers the one action that IS valid",
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("E08-47 — 'Restore booking' puts a cancelled appointment back", async ({
    browser,
  }) => {
    // ⚠️ THIS CASE MAY EMAIL (D-030) — assigned staff are notified.
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await page.goto(bookingsListFor(restorable.date), { waitUntil: "domcontentloaded" });
      await openRowMenu(page, restorable.name);

      await page.getByRole("menuitem", { name: /^Restore booking$/ }).click();
      await awaitAction(page, () => confirmInDialog(page, /^Restore booking$/));

      const after = await readBooking(db, restorable.bookingId);
      expect(
        after.status,
        "a mistakenly-cancelled appointment is recoverable",
      ).not.toBe("cancelled");
      expect(
        ["pending", "confirmed"],
        `restored to a live status (saw "${after.status}")`,
      ).toContain(after.status);

      expect(
        await auditActions(db, restorable.bookingId),
        "the restore is on the audit trail",
      ).toContain("booking_restored");
    } finally {
      await context.close();
    }
  });
});
