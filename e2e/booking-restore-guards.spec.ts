// ⛔ GATE 08 P2 — WHEN "RESTORE" MUST BE REFUSED. Case E08-48.
//
// Cancelling a booking by mistake is recoverable — E08-47 proves the Restore
// button puts one back. This file is the other half: the three situations where
// putting it back would be WRONG, and what the clinic's staff see instead.
//
// In the Owner's terms:
//   1. The appointment has already been and gone. Restoring it would put a
//      visit back on the books that nobody can now attend.
//   2. It was cancelled more than 28 days ago. That is history, not a mistake
//      somebody is still correcting.
//   3. The customer's record has been deleted. Their old bookings stay visible
//      as history — an Owner ruling, "visible history, frozen records" — but
//      nothing on them can be changed.
//
// ── ⛔ WHAT THIS FILE TESTS, AND WHAT IT DELIBERATELY DOES NOT (D-023) ────
//
// ⛔ THE RULES ARE ALREADY THOROUGHLY UNIT-TESTED and re-asserting them here
// would be duplication dressed up as thoroughness. `restoreBooking.test.ts`
// covers S6 (the past-appointment guard, 4 cases), S7 (the 28-day window, 6
// cases including the exact 28×24h boundary and one millisecond past it), the
// deleted-client refusal, and the completed-reopen force flag.
//
// What NONE of them cover is the SCREEN, and the two halves of it pull in
// opposite directions:
//
//   ⛔ E08-48a/b — the menu must HIDE Restore where the server would refuse,
//      and say WHY. "The button never offers a call the action would refuse."
//   ⛔ E08-48c  — but for a deleted customer the menu CANNOT know, so it still
//      offers Restore, and the guard that matters is the server's. This is the
//      case worth having: an affordance that looks available, a refusal that is
//      correct, and an operator who must be TOLD rather than left guessing.
//
// ⚠️ Gate 07's principle is "a missing button with a permissive server action is
// a FAIL". E08-48c is the mirror image — a PRESENT button with a correct
// refusal — and it is only safe because the refusal is proven, not assumed.
//
// ── ⚠️ EMAIL ─────────────────────────────────────────────────────────────
//
// ⛔ NOTHING IN THIS FILE SENDS ANY EMAIL, and that is the point: every case is
// a REFUSED restore. `restoreBooking` returns before its update, so no client
// email, no assigned-staff email and no business-inbox email is reachable. Each
// case asserts that the booking's `email_delivery_events` are empty afterwards,
// so the claim is measured rather than asserted.
//
// ── ⛔ THE FIXTURES ARE BUILT TO MATCH WHAT THE APP ACTUALLY PRODUCES ─────
//
// ⛔ The deleted-customer fixture is not invented. It is the exact payload
// `adminDeleteClient`'s cascade writes, read from the source:
//   bookings  -> { deleted_at: T, status: "cancelled", cancelled_at: T }
//   clients   -> { deleted_at: T }
// ⚠️ Completed bookings are deliberately NOT cascaded (they are a tax record),
// and already-cancelled ones are skipped. A fixture in any other shape would be
// testing a state the product cannot reach.
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

const SERVICE = {
  id: "9e70c3fd-b551-465e-9d7b-822398b431d7",
  name: "Hijama Package",
  price: 45,
  durationMins: 60,
};

/** ⛔ Measured from `_helpers.ts`: `RESTORE_WINDOW_DAYS = 28`. */
const RESTORE_WINDOW_DAYS = 28;

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Restore-guard fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
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

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type BookingFixture = {
  bookingId: string;
  clientId: string;
  name: string;
  date: string;
};

async function createCancelledFixture(
  db: SupabaseClient,
  label: string,
  opts: {
    dayOffset: number;
    cancelledAt: string;
    /** ⛔ The `adminDeleteClient` cascade shape — see the header. */
    clientDeleted?: boolean;
  },
): Promise<BookingFixture> {
  const name = `ZZTEST-RG-${label}-${RUN_TAG}`;
  const phone = `077${String(Number(RUN_TAG) % 1_000_000).padStart(6, "0")}`;
  const date = isoDaysFromToday(opts.dayOffset);
  const deletedAt = opts.cancelledAt;

  const clientId = await insertRow(db, "clients", {
    full_name: name,
    email: `zztest-rg-${label.toLowerCase()}-${RUN_TAG}@probe.invalid`,
    phone,
    gender_preference: "female",
    postcode: "LU1 1AA",
    // ⛔ NOT "admin" — `clients_client_source_check` rejects it while
    // `bookings_booking_source_check` allows it. The two look alike.
    client_source: "manual",
    ...(opts.clientDeleted ? { deleted_at: deletedAt } : {}),
  });

  const bookingId = await insertRow(db, "bookings", {
    client_id: clientId,
    booking_date: date,
    start_time: "10:00:00",
    end_time: "11:00:00",
    total_duration_mins: SERVICE.durationMins,
    total_price: SERVICE.price,
    status: "cancelled",
    assignment_status: "unassigned",
    contact_full_name: name,
    contact_phone: phone,
    booking_source: "admin",
    consent_acknowledged: true,
    cancelled_at: opts.cancelledAt,
    // ⛔ The cascade soft-deletes the BOOKING too, not just the client.
    ...(opts.clientDeleted ? { deleted_at: deletedAt } : {}),
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

  return { bookingId, clientId, name, date };
}

async function readBooking(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("bookings")
    .select("id, status, cancelled_at, deleted_at")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`could not read booking ${id}: ${error?.message}`);
  return data as {
    id: string;
    status: string;
    cancelled_at: string | null;
    deleted_at: string | null;
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
    .like("full_name", `ZZTEST-RG-%-${RUN_TAG}`);
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
 * ⚠️ `view=all` is load-bearing twice over: `filterBookings` excludes
 * `cancelled` from every view except `cancelled`, `all` and `series`, and a
 * Coordinator's default "attention" view would never show these rows. `from`/`to`
 * is load-bearing too — the list paginates over live production data, so "it is
 * on the all view" is not "it is on the first page".
 */
function bookingsListFor(date: string) {
  return `/admin/bookings/?view=all&from=${date}&to=${date}`;
}

function rowMenuTrigger(page: Page, name: string) {
  return page.getByRole("button", { name: `More actions for ${name}` });
}

/**
 * ⛔ Open the row's menu, waiting for the row to exist first.
 *
 * ⛔ THE BOOKINGS LIST IS CACHED (`unstable_cache`, `revalidate: 60`) and only
 * the server actions call `updateTag`, so a row inserted straight into the
 * database DOES NOT APPEAR until the window turns over. Measured twice on this
 * project, once after the lesson had already been written down. Poll, never
 * assert once.
 */
async function openRowMenu(page: Page, name: string) {
  // ⛔ DISTINGUISH "signed out" AND "refused" FROM "row missing" BEFORE waiting
  // for a control that was never going to appear. An expired session otherwise
  // reads as "the button is gone" — the alarming direction.
  if (/\/admin\/login/.test(page.url())) {
    throw new Error(
      `Signed out while looking for ${name}. Re-mint: node scripts/mint-e2e-session.mjs --all --write`,
    );
  }
  if ((await page.locator("[data-admin-access-denied]").count()) > 0) {
    throw new Error(`Refused access to the bookings list while looking for ${name}.`);
  }

  const trigger = rowMenuTrigger(page, name);
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

/**
 * ⛔ The menu's inert-row branch. A cancelled or no-show row has exactly ONE
 * action and it is Restore — unless a guard closes it, in which case the item is
 * replaced by a DISABLED menuitem naming the reason. Asserting that disabled
 * item is what makes "Restore is absent" non-vacuous: without it, a menu that
 * simply failed to open would pass.
 */
function disabledMenuItem(page: Page, text: RegExp) {
  return page.getByRole("menuitem", { name: text });
}

test.describe("gate 08 P2 — when a cancelled booking must NOT be restorable", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });
  // ⚠️ The dev server compiles each route on first visit. Not a performance
  // statement — gate 14 owns speed and measures the built site.
  test.setTimeout(300_000);

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);

  let gone: BookingFixture;
  let stale: BookingFixture;
  let deletedClient: BookingFixture;
  const createdClientIds: string[] = [];

  test.beforeAll(async () => {
    // ⛔ S6 — the appointment moment has passed. Cancelled RECENTLY, so the
    // 28-day window is wide open and the ONLY thing that can close Restore is
    // the past appointment. Two guards on one fixture would not tell us which
    // one fired.
    gone = await createCancelledFixture(db, "Gone", {
      dayOffset: -2,
      cancelledAt: new Date().toISOString(),
    });
    // ⛔ S7 — cancelled 29 days ago, comfortably past the 28-day window.
    // ⚠️ FUTURE-dated on purpose, for the mirror-image reason: a past date would
    // let S6 close the menu first and this case would pass without ever
    // exercising the window.
    stale = await createCancelledFixture(db, "Stale", {
      dayOffset: 9,
      cancelledAt: isoDaysAgo(RESTORE_WINDOW_DAYS + 1),
    });
    // ⛔ The customer's record was deleted. FUTURE-dated and cancelled JUST NOW,
    // so S6 and S7 both pass and the deleted client is the only guard left —
    // which is exactly the reachable state, since the cascade cancels OPEN
    // bookings and stamps `cancelled_at` with the deletion moment.
    deletedClient = await createCancelledFixture(db, "DelClient", {
      dayOffset: 10,
      cancelledAt: new Date().toISOString(),
      clientDeleted: true,
    });
    createdClientIds.push(gone.clientId, stale.clientId, deletedClient.clientId);

    // ⛔ Prove the fixtures are what the tests assume BEFORE any of them run.
    for (const f of [gone, stale, deletedClient]) {
      const row = await readBooking(db, f.bookingId);
      expect(row.status, `${f.name} should start cancelled`).toBe("cancelled");
      expect(row.cancelled_at, `${f.name} needs a cancellation stamp`).not.toBeNull();
    }
    expect(
      (await readBooking(db, deletedClient.bookingId)).deleted_at,
      "the deleted-client fixture must carry the cascade's booking soft-delete",
    ).not.toBeNull();
  });

  test.afterAll(async () => {
    if (db) await destroyFixtures(db, createdClientIds);
  });

  test("E08-48a — an appointment that has already been and gone offers no Restore", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await page.goto(bookingsListFor(gone.date), { waitUntil: "domcontentloaded" });
      await openRowMenu(page, gone.name);

      await expect(
        page.getByRole("menuitem", { name: /^Restore booking$/ }),
        "a booking whose appointment time has passed cannot be put back",
      ).toHaveCount(0);

      // ⛔ NON-VACUITY, and it doubles as the operator-facing assertion: the menu
      // really did open, and it SAYS WHY rather than looking broken or empty.
      await expect(
        disabledMenuItem(page, /appointment time has passed/i),
        "and the staff member is told why, instead of an empty menu",
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("E08-48b — a booking cancelled more than 28 days ago offers no Restore", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await page.goto(bookingsListFor(stale.date), { waitUntil: "domcontentloaded" });
      await openRowMenu(page, stale.name);

      await expect(
        page.getByRole("menuitem", { name: /^Restore booking$/ }),
        "an old cancellation is history, not a mistake still being corrected",
      ).toHaveCount(0);

      // ⛔ The message must name the WINDOW, not the appointment time. Both
      // guards produce a disabled item, so a looser matcher here would pass on
      // the wrong one and this case would silently become a copy of E08-48a.
      await expect(
        disabledMenuItem(page, /28-day restore window has passed/i),
        "and the staff member is told which rule closed it",
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("E08-48c — a deleted customer's booking still OFFERS Restore, and the server refuses it", async ({
    browser,
  }) => {
    // ⛔ THE ONE THAT MATTERS. The menu reads only the booking's own dates and
    // stamps — it never looks at the client — so it cannot know, and it offers
    // Restore. The guard is `restoreBooking`'s, and this proves it holds through
    // the real button rather than only in a unit test.
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await page.goto(bookingsListFor(deletedClient.date), {
        waitUntil: "domcontentloaded",
      });
      await openRowMenu(page, deletedClient.name);

      // ⛔ Scoped: this is the MENU ITEM, not the dialog's confirm button of the
      // same name. `.first()` would click the trigger twice and assert nothing.
      const item = page.getByRole("menuitem", { name: /^Restore booking$/ });
      await expect(
        item,
        "the menu cannot see the deleted customer, so it still offers Restore — " +
          "if this ever goes to 0 the affordance was fixed and this case should " +
          "become an absence assertion instead",
      ).toBeVisible();
      await item.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog, "the confirmation dialog should open").toBeVisible();
      await awaitAction(page, () =>
        dialog.getByRole("button", { name: /^Restore booking$/ }).click(),
      );

      // ⛔ ASSERT WHAT THE DATABASE DID — first, because it is the substantive
      // claim. A restore that went through would be the real failure; the
      // operator not being told is the smaller half.
      const after = await readBooking(db, deletedClient.bookingId);
      expect(
        after.status,
        "a deleted customer's booking is frozen history and must stay cancelled",
      ).toBe("cancelled");
      expect(
        await auditActions(db, deletedClient.bookingId),
        "and a refused restore must not write a restore to the audit trail",
      ).not.toContain("booking_restored");

      // ⛔ …and then what the page SAID. A refusal the operator cannot see is
      // indistinguishable from a broken button.
      await expect(
        page.getByText(/client has been deleted/i).first(),
        "the staff member is told the customer's record is gone, not left guessing",
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  test("E08-48d — none of the three refusals emailed anybody", async () => {
    // ⛔ No browser: the question is what the SERVER did, and the answer is in
    // the database. `restoreBooking` returns before its UPDATE on every one of
    // these paths, so no client email, no assigned-staff email and — the one
    // that matters to the Owner — nothing to the real business inbox.
    //
    // ⚠️ Asserted rather than reasoned: the file's header makes this claim, and
    // a claim in a ⛔ block that nothing checks is exactly how this run has
    // shipped false statements before.
    for (const f of [gone, stale, deletedClient]) {
      expect(
        await emailEvents(db, f.bookingId),
        `a refused restore must send nothing (${f.name})`,
      ).toEqual([]);
    }
  });
});
