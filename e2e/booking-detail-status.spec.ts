// ⛔ GATE 08 P2 — THE BOOKING DETAIL PAGE'S STATUS FORM. Case E08-45 (no-show).
//
// Somebody books a treatment, the therapist travels to them, and nobody answers
// the door. The clinic has to be able to write that down — otherwise the visit
// either disappears, or sits on the list as "confirmed" forever and keeps
// showing up as work still to do.
//
// ── ⛔ WHERE NO-SHOW ACTUALLY LIVES, AND WHERE IT DOES NOT ────────────────
//
// ⛔ NO-SHOW IS NOT A ROW QUICK ACTION. The bookings list row menu offers only
// confirm / mark-paid / mark-complete / cancel / restore / send-reminder
// (`BookingRowActions.tsx`) — measured by reading every branch, after an earlier
// session went looking for it there and found nothing.
//
// ⚠️ `BookingRowActions` DOES carry `"no_show"` in its `BookingRowAction` union
// and a success toast for it, but **nothing renders a control that fires it**.
// That is dead code, not a hidden affordance — noted here so the next person
// does not read the type and conclude the menu has the button.
//
// It also is NOT one of the detail page's one-click chips: `QUICK_ACTIONS` in
// `BookingManagementForm.tsx` is confirm / mark_paid / complete / cancel only.
//
// ⛔ The ONE control a human can press is the Status dropdown on the booking
// DETAIL page — `<option value="no_show">No-show</option>` — saved with
// "Save status & payment". That is what this file drives.
//
// ⚠️ And it is the only way the booking ever reaches `no_show` in normal use.
// A therapist marking their OWN assignment as a no-show
// (`updateOwnAssignmentStatus`) does **not** move the booking there:
// `autoPromoteBookingFromAssignments` only ever promotes to `completed`, and it
// refuses outright when every assignment was a no-show, deliberately leaving
// "a visit nobody attended" for a human to classify. So this dropdown is not a
// convenience — it is the whole feature.
//
// ── ⚠️ EMAIL — WHAT THIS FILE COSTS ──────────────────────────────────────
//
// ⛔ NOTHING REACHES THE OWNER'S REAL BUSINESS INBOX FROM THIS FILE, and that is
// measured rather than hoped for. A status change that is not a cancellation
// calls `sendAssignedStaffBookingChangeEmails`, whose recipients are the
// booking's ASSIGNED STAFF — not `resolveBusinessNotificationRecipients`, which
// is the function that resolves `rahmatherapy@outlook.com`. The only assignee
// here is the test therapist on the `example.test` domain (D-017).
//
// ⚠️ Fixtures are inserted directly, so no booking-confirmation mail is sent
// either. Expect ONE message per run of E08-45a, to a fake domain.
//
// ── ⛔ WHY THE RULES ARE NOT RE-TESTED HERE (D-023) ───────────────────────
//
// The rule underneath already has real unit coverage:
// `quickUpdateBookingNoShow` (18 cases) and
// `updateBookingManagement-completed-guard.test.ts`, which includes the
// future-date guard for both `completed` and `no_show`.
//
// What NONE of that covers is whether a coordinator sitting in front of the
// real screen can reach the behaviour: whether the dropdown offers the option,
// whether Save is reachable, whether the write lands, and — E08-45c — whether a
// refusal is SHOWN to them or silently swallowed. That is this file's job, and
// it asserts the DATABASE rather than the toast (G-27).
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

/** Measured. ⛔ Selected by id, never by name — the identity trap (handoff §8). */
const THERAPIST_A_STAFF_ID = "884311b1-e9d0-44b9-91f3-14188a3baf59";
const THERAPIST_A_EMAIL = "test.therapist@rahmatherapy.example.test";
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
      "Detail-status fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
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
  opts: { status: string; assign: boolean; dayOffset: number },
): Promise<BookingFixture> {
  const name = `ZZTEST-DS-${label}-${RUN_TAG}`;
  const phone = `078${String(Number(RUN_TAG) % 1_000_000).padStart(6, "0")}`;
  const date = isoDaysFromToday(opts.dayOffset);

  const clientId = await insertRow(db, "clients", {
    full_name: name,
    email: `zztest-ds-${label.toLowerCase()}-${RUN_TAG}@probe.invalid`,
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
    status: opts.status,
    assignment_status: opts.assign ? "fully_assigned" : "unassigned",
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

  if (opts.assign) {
    await insertRow(db, "booking_assignments", {
      booking_id: bookingId,
      participant_id: participantId,
      assigned_staff_id: THERAPIST_A_STAFF_ID,
      required_therapist_gender: "female",
      status: "assigned",
    });
  }

  return { bookingId, clientId, name, date };
}

async function readBooking(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("bookings")
    .select("id, status, cancelled_at, completed_at, payment_status")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`could not read booking ${id}: ${error?.message}`);
  return data as {
    id: string;
    status: string;
    cancelled_at: string | null;
    completed_at: string | null;
    payment_status: string;
  };
}

/**
 * ⛔ The audit action is `booking_management_updated` — the SAME action for
 * every save of this form. Measured from `updateBookingManagement`, not guessed:
 * the quick actions write `booking_quick_<action>` and `restoreBooking` writes a
 * literal `booking_restored`, so guessing `booking_no_show` here would have
 * failed the case for the wrong reason.
 *
 * ⚠️ Because the action name is shared, the action name ALONE proves nothing
 * about what changed. The `after_state` is what carries the new status, so that
 * is what E08-45a asserts.
 */
async function auditRows(db: SupabaseClient, bookingId: string) {
  const { data } = await db
    .from("audit_logs")
    .select("action_type, before_state, after_state")
    .eq("target_id", bookingId);
  return (data ?? []) as {
    action_type: string;
    before_state: { status?: string } | null;
    after_state: { status?: string } | null;
  }[];
}

async function destroyFixtures(db: SupabaseClient, clientIds: string[]) {
  const { data: strays } = await db
    .from("clients")
    .select("id")
    .like("full_name", `ZZTEST-DS-%-${RUN_TAG}`);
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
 * ⛔ Open the booking DETAIL page and prove the status form is really there.
 *
 * ⚠️ Unlike the bookings LIST, this page is **not** wrapped in
 * `unstable_cache` — it reads the booking directly — so a fixture inserted
 * straight into the database is visible immediately and no reload-poll is
 * needed. Measured by reading `[bookingId]/page.tsx`, which imports nothing
 * from `next/cache`. ⛔ Do not copy this shape to a list page: the list is
 * cached and the lesson has already been learned twice there.
 *
 * The three failure modes are separated because they mean completely different
 * things, and confusing them cost an earlier session a debugging pass.
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
  await expect(
    form,
    `the status form should render for ${label} — it is gated on manage_bookings_all, ` +
      `which the Coordinator holds`,
  ).toBeVisible({ timeout: 30_000 });
  return form;
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
 * Drive the Status dropdown to `no_show` and press Save.
 *
 * ⛔ Scoped to `#booking-status-form`: "Status" is not a unique label on this
 * page once the assignment and payment panels render, and an unscoped
 * `getByLabel` would be ambiguous.
 *
 * ⛔ MEASURED, after `getByLabel("Status", { exact: true })` matched NOTHING and
 * the case failed as "the dropdown is missing" — the alarming direction, and
 * wrong. `Field` renders the required marker as
 * `<span aria-hidden="true">*</span> INSIDE the label, and Playwright's
 * `getByLabel` matches the label's TEXT CONTENT, not the computed accessible
 * name — so the label reads `"Status*"`, asterisk included. The regex below
 * accepts either form, and stays anchored so it cannot drift onto
 * "Payment status*".
 */
async function selectNoShowAndSave(page: Page, form: ReturnType<Page["locator"]>) {
  const status = form.getByLabel(/^Status\*?$/);
  await expect(status, "the Status dropdown should be on the form").toBeVisible();

  // ⛔ NON-VACUITY: prove the option exists before selecting it. Without this a
  // renamed or removed option would fail as a timeout on the Save button —
  // which reads as "saving is broken", the wrong diagnosis entirely.
  await expect(
    status.locator('option[value="no_show"]'),
    "the Status dropdown must offer No-show — it is the only control that records one",
  ).toHaveCount(1);

  await status.selectOption("no_show");
  await expect(status, "the dropdown should now hold no_show").toHaveValue("no_show");

  const save = form.getByRole("button", { name: /Save status & payment/i });
  // ⛔ The Save control is `disabled` until the form is dirty. Asserting it
  // became enabled proves the change was registered, rather than clicking a
  // dead button and reading the unchanged database as a failure to save.
  await expect(save, "changing the status should enable Save").toBeEnabled();
  await awaitAction(page, () => save.click());
}

test.describe("gate 08 P2 — recording a no-show, on the booking detail page", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });
  // ⚠️ The dev server compiles each route on first visit. Not a performance
  // statement — gate 14 owns speed and measures the built site.
  test.setTimeout(300_000);

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);

  let missed: BookingFixture;
  let future: BookingFixture;
  const createdClientIds: string[] = [];

  test.beforeAll(async () => {
    // ⛔ IN THE PAST, and that is a RULE not a preference. `updateBookingManagement`
    // refuses `completed` and `no_show` on a future-dated booking —
    // "This booking is in the future. Mark complete or no-show after the
    // appointment time." A future fixture here would be a WRONG FIXTURE, not a
    // broken app.
    //
    // ⛔ ASSIGNED, deliberately: a real no-show is a therapist who travelled.
    // It is also what gives E08-45b something to assert — the assignee is the
    // only person this change emails.
    missed = await createBookingFixture(db, "NoShow", {
      status: "confirmed",
      assign: true,
      dayOffset: -2,
    });
    // The mirror image, for the guard. ⚠️ Unassigned on purpose: a refused save
    // must send nothing, and the cleanest way to be sure of that is to leave
    // nobody to send to.
    future = await createBookingFixture(db, "Future", {
      status: "confirmed",
      assign: false,
      dayOffset: 11,
    });
    createdClientIds.push(missed.clientId, future.clientId);

    // ⛔ Prove the fixtures are what the tests assume BEFORE any of them run.
    expect((await readBooking(db, missed.bookingId)).status).toBe("confirmed");
    expect((await readBooking(db, future.bookingId)).status).toBe("confirmed");
  });

  test.afterAll(async () => {
    if (db) await destroyFixtures(db, createdClientIds);
  });

  test("E08-45a — a customer who did not turn up is recorded as a no-show", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      const form = await openBookingDetail(page, missed.bookingId, missed.name);
      await selectNoShowAndSave(page, form);

      const after = await readBooking(db, missed.bookingId);
      expect(
        after.status,
        "the appointment nobody attended is recorded as a no-show",
      ).toBe("no_show");

      // ⛔ A no-show is NOT a completed visit. `bookings_set_completed_at` is a
      // BEFORE UPDATE trigger on this column, so this asserts the database's own
      // behaviour, not the action's — and it is what keeps a visit that never
      // happened out of the revenue reports.
      expect(
        after.completed_at,
        "a no-show must never be stamped as completed — the reports read that column",
      ).toBeNull();
      expect(
        after.cancelled_at,
        "and it is not a cancellation either, so no restore window opens",
      ).toBeNull();

      // ⛔ The action name is shared by every save of this form, so it proves
      // nothing on its own. The `after_state` is what says WHAT changed.
      const audits = await auditRows(db, missed.bookingId);
      const management = audits.filter((r) => r.action_type === "booking_management_updated");
      expect(
        management.length,
        `the change should be on the audit trail (saw: ${JSON.stringify(
          audits.map((r) => r.action_type),
        )})`,
      ).toBeGreaterThan(0);
      expect(
        management.some(
          (r) => r.before_state?.status === "confirmed" && r.after_state?.status === "no_show",
        ),
        "and the audit row should name the move from confirmed to no_show",
      ).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("E08-45b — the therapist who travelled is told the booking changed", async () => {
    // ⛔ Depends on E08-45a having run (serial). No browser needed: the question
    // is what the SERVER did, and the answer is in the database.
    //
    // ⚠️ `delivery_status` for a success is `accepted`, NOT `sent`, and `failed`
    // and `skipped` live in the same table — so the STATUS is asserted, never
    // the row's mere existence.
    const { data } = await db
      .from("email_delivery_events")
      .select("event_type, recipient_email, delivery_status")
      .eq("booking_id", missed.bookingId);
    const rows = (data ?? []) as {
      event_type: string;
      recipient_email: string;
      delivery_status: string;
    }[];

    const staffChange = rows.filter((r) => r.event_type === "staff_booking_change");
    expect(
      staffChange.length,
      `the assigned therapist should be notified (rows seen: ${JSON.stringify(rows)})`,
    ).toBe(1);
    expect(
      staffChange[0].recipient_email,
      "and it goes to the assigned therapist, nobody else",
    ).toBe(THERAPIST_A_EMAIL);
    expect(
      staffChange[0].delivery_status,
      `the message was handed to the mail provider (saw "${staffChange[0].delivery_status}")`,
    ).toBe("accepted");

    // ⛔ AND NOBODY ELSE WAS EMAILED. This is the assertion that keeps the file's
    // header claim honest: a status change that is not a cancellation must not
    // reach the customer or the business inbox.
    expect(
      rows.filter((r) => r.event_type !== "staff_booking_change"),
      "a no-show must not email the customer or the business inbox",
    ).toEqual([]);
  });

  test("E08-45c — an appointment that has not happened yet cannot be marked a no-show", async ({
    browser,
  }) => {
    // ⛔ THE GUARD, AT THE SCREEN. The rule itself is unit-tested; what is NOT
    // covered anywhere else is whether the operator is TOLD, or whether the
    // refusal is swallowed and the save silently does nothing — which would look
    // identical to a broken form and would teach staff to distrust the screen.
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      const form = await openBookingDetail(page, future.bookingId, future.name);
      await selectNoShowAndSave(page, form);

      // ⛔ THE DATABASE FIRST, and the order is deliberate (G-27). When the
      // guard was deleted as a mutation, the message assertion below tripped
      // first and reported "the operator was not told" — true, but the far
      // smaller half of what had gone wrong. The substantive claim is that a
      // future appointment CANNOT be marked missed, so that is asserted first
      // and a broken guard now fails with the status it wrongly wrote.
      const after = await readBooking(db, future.bookingId);
      expect(
        after.status,
        "a future appointment stays as it was — nobody can mark it missed in advance",
      ).toBe("confirmed");

      // …and only then, what the page SAID. A refusal the operator cannot see
      // is indistinguishable from a broken form, and would teach staff to
      // distrust the screen.
      const alert = form.getByRole("alert").filter({
        hasText: /Mark complete or no-show after the appointment time/i,
      });
      await expect(
        alert,
        "the operator must be told why the save was refused, in words they can act on",
      ).toBeVisible({ timeout: 15_000 });

      // ⛔ NON-VACUITY, and it is the whole point of running this case after
      // E08-45a: the identical form, the identical actor and the identical click
      // DID write in E08-45a. So "the database did not change" here is a refusal,
      // not a form that never submitted.
      const audits = await auditRows(db, future.bookingId);
      expect(
        audits.filter((r) => r.action_type === "booking_management_updated"),
        `a refused save must not write an audit row (saw: ${JSON.stringify(
          audits.map((r) => r.action_type),
        )})`,
      ).toEqual([]);

      // ⛔ And it must not have emailed anybody about a change that did not happen.
      const { data } = await db
        .from("email_delivery_events")
        .select("event_type, recipient_email")
        .eq("booking_id", future.bookingId);
      expect(
        (data ?? []) as unknown[],
        "a refused save must send no mail at all",
      ).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
