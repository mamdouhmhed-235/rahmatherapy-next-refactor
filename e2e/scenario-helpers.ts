// ⛔ GATE 08 — PHASE P3. Shared foundation for the business-scenario specs
// (families A-D and G-I of `WORKFLOW-COVERAGE.md` §4).
//
// A *case* proves a button works. A *scenario* proves the clinic works: several
// roles, in order, asserting the business outcome rather than any single screen.
// Everything in here exists because 33 scenarios would otherwise each re-derive
// it — and, more importantly, because getting the FIXTURE wrong silently makes
// the assertions vacuous.
//
// ── ⛔ THE FIXTURE MUST MIRROR WHAT THE DATABASE ACTUALLY WRITES ───────────
//
// ⚠️ This was measured the hard way while mapping for family A. A hand-rolled
// fixture that created a booking WITHOUT `booking_assignments` rows produced a
// booking detail page that said "Therapist is assigned. Send the confirmation
// when you're ready." over a booking with no therapist — which looked exactly
// like a serious defect.
//
// ⛔ It was not. `deriveNextAction` computes
//
//     anyUnassigned = booking.booking_assignments.some(a => !a.assigned_staff_id ...)
//
// and `.some()` on an EMPTY array is `false`. The real `create_booking_request`
// RPC (read out of the deployed `prosrc`) inserts ONE `booking_assignments` row
// PER PARTICIPANT with `assigned_staff_id = null` and `status = 'unassigned'`,
// so `anyUnassigned` is true for every real website booking and the strip
// correctly says "Assign a therapist, then confirm with the client."
//
// ⛔ The empty-assignments state is not reachable from any normal path:
// `updateBookingAssignment`'s unassign branch UPDATEs the row to
// `(null, 'unassigned')` rather than deleting it, and the only DELETE in the
// repo is `rollbackOccurrence` in the extend-recurring-horizons cron, which
// deletes the booking itself in the same breath.
//
// ⛔ SO: `seedWebsiteBooking` below reproduces the RPC's exact output. Do not
// "simplify" it by dropping the assignment rows — that is the difference
// between a test that could see the truth and one that could not (G-1). It is
// also why `AssignmentManager` did not render at all over the bad fixture: with
// no assignment rows there is nothing for it to offer.
//
// ── ⛔ EMAIL ──────────────────────────────────────────────────────────────
//
// Owner instruction, restated 2026-08-23: *"all emails should be sent to
// thefoolmarketing@outlook.com … the other email rahma is the owners emails and
// those will just be sent without actively trying but any and all emails should
// be sent to thefoolmarketing@outlook.com for testing."*
//
// ⛔ So every CUSTOMER-side address in a scenario fixture is the test inbox, via
// `testInbox()`. The Owner's own `rahmatherapy@outlook.com` still receives the
// business-recipient leg of anything that calls
// `resolveBusinessNotificationRecipients` — that is unavoidable (they are an
// active opted-in Owner and there is no actor to exclude them), and it is what
// "sent without actively trying" refers to.
//
// ⚠️ A fixture inserted DIRECTLY through this module sends NOTHING — no app code
// runs. The address only matters once a scenario drives an action that mails.
//
// ── Safety ───────────────────────────────────────────────────────────────
//
// ⛔ Approved to write by D-015. Every row carries the `ZZTEST-` prefix and a
// run tag. ⛔ Teardown CHECKS every delete: session H proved that a teardown
// which ignores `error` reports success while leaving production dirty, and
// `bookings_client_id_fkey` (NO ACTION) blocks, so one silent failure stops the
// whole chain.

import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";

export const AUTH_DIR = "e2e/.auth";
export const RUN_TAG = process.env.E2E_FIXTURE_TAG ?? String(process.pid);

/** ⛔ The Owner's test inbox. Every customer-facing address resolves here. */
export const TEST_INBOX = "thefoolmarketing@outlook.com";

/**
 * ⛔ The Owner's REAL business inbox. Present so assertions can NAME it.
 * ⛔ NEVER put this in a fixture. It is here to be asserted ABOUT, not used.
 */
export const REAL_OWNER_INBOX = "rahmatherapy@outlook.com";

/**
 * ⛔ The test therapist. Selected by id, never by name — `phase10.therapist.a`
 * is a DIFFERENT account with 2 assignments that the harness never signs in as.
 * ⛔ NEVER substitute the Owner's staff id `01582c5d-…`: their
 * `staff_profiles.email` IS the real business inbox, so assigned-staff mail
 * reaches it without ever calling the business-recipient resolver.
 */
export const THERAPIST_A_STAFF_ID = "884311b1-e9d0-44b9-91f3-14188a3baf59";
export const THERAPIST_B_STAFF_ID = "1ae328ef-2f33-42dd-acb4-2e541543f162";
export const ADMIN_STAFF_ID = "97310f6b-4e2f-4a9f-bec1-20224e57d8e6";
export const COORDINATOR_STAFF_ID = "998075ff-26fc-4451-9015-fadfbcd9f4df";
/** ⛔ Assert-only. Never assign. */
export const REAL_OWNER_STAFF_ID = "01582c5d-bd75-4c49-b207-6f5597e15218";

/** Measured against the live `services` table by `pnpm verify:prices`. */
export const SERVICES = {
  hijama: { id: "9e70c3fd-b551-465e-9d7b-822398b431d7", name: "Hijama Package", price: 45, mins: 60 },
} as const;

export type SeededService = { id: string; name: string; price: number; mins: number };

/**
 * A unique deliverable address in the Owner's test inbox.
 *
 * ⚠️ Uses plus-addressing so two clients in one scenario are genuinely distinct
 * rows — the public booking path dedups clients on EMAIL, so reusing one address
 * across fixtures would silently collapse them into a single client record and
 * make scenario A3 (the returning customer) prove nothing.
 *
 * ⛔ Pass `unique: false` where the scenario needs mail the Owner will actually
 * open and confirm, and only one identity is in play.
 */
export function testInbox(slug?: string) {
  if (!slug) return TEST_INBOX;
  const [local, domain] = TEST_INBOX.split("@");
  return `${local}+${slug}-${RUN_TAG}@${domain}`;
}

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Scenario fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
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

/** London-safe ISO date N days from today. */
export function isoDaysFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function addMinutes(hhmmss: string, mins: number) {
  const [h, m] = hhmmss.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

export type ParticipantSpec = {
  /** The gender of the person being treated. */
  gender: "male" | "female";
  /** The gender of therapist they require. Defaults to `gender`. */
  requiredGender?: "male" | "female";
  displayName?: string;
  service?: SeededService;
};

export type SeededBooking = {
  bookingId: string;
  clientId: string;
  participantIds: string[];
  assignmentIds: string[];
  name: string;
  email: string;
  phone: string;
  date: string;
  startTime: string;
  totalPrice: number;
};

/**
 * ⛔ Reproduce, row for row, what `create_booking_request` writes for a booking
 * taken on the public website — WITHOUT sending the three emails a real
 * submission sends.
 *
 * Use this for a scenario's PRECONDITION. ⛔ Where the scenario's own question is
 * "does a customer booking online work", drive the real form instead
 * (`submitPublicBooking`) — a seeded row proves nothing about the front door.
 */
export async function seedWebsiteBooking(
  db: SupabaseClient,
  label: string,
  opts: {
    dayOffset: number;
    startTime?: string;
    participants?: ParticipantSpec[];
    service?: SeededService;
    /** Defaults to `website`, which is what the public form sets. */
    source?: string;
    status?: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
    /** Assign every participant to this staff id. Omit to leave unassigned. */
    assignTo?: string;
    paid?: boolean;
    email?: string;
    clientId?: string;
  },
): Promise<SeededBooking> {
  const service = opts.service ?? SERVICES.hijama;
  const participants: ParticipantSpec[] = opts.participants ?? [{ gender: "female" }];
  const name = `ZZTEST-${label}-${RUN_TAG}`;
  const phone = `076${String((Number(RUN_TAG) + label.length) % 1_000_000).padStart(6, "0")}`;
  const date = isoDaysFromToday(opts.dayOffset);
  const startTime = opts.startTime ?? "10:00:00";
  const email = opts.email ?? testInbox(label.toLowerCase());
  const totalPrice = service.price * participants.length;

  const clientId =
    opts.clientId ??
    (await insertRow(db, "clients", {
      full_name: name,
      email,
      phone,
      gender_preference: participants[0].requiredGender ?? participants[0].gender,
      postcode: "LU1 1AA",
      // ⛔ NOT "admin" — `clients_client_source_check` rejects it while
      // `bookings_booking_source_check` allows it. The two look alike.
      client_source: "manual",
    }));

  const bookingId = await insertRow(db, "bookings", {
    client_id: clientId,
    contact_full_name: name,
    contact_email: email,
    contact_phone: phone,
    booking_source: opts.source ?? "website",
    booking_date: date,
    start_time: startTime,
    end_time: addMinutes(startTime, service.mins),
    total_duration_mins: service.mins,
    total_price: totalPrice,
    // ⛔ The RPC sets amount_due = total_price and amount_paid = 0.
    amount_due: totalPrice,
    amount_paid: opts.paid ? totalPrice : 0,
    payment_status: opts.paid ? "paid" : "unpaid",
    ...(opts.paid ? { payment_method: "cash", paid_at: new Date().toISOString() } : {}),
    travel_fee: 0,
    status: opts.status ?? "pending",
    assignment_status: opts.assignTo ? "fully_assigned" : "unassigned",
    // ⛔ The RPC sets this from `v_participant_count > 1`.
    group_booking: participants.length > 1,
    service_address_line1: "1 ZZTEST Street",
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    consent_acknowledged: true,
  });

  const participantIds: string[] = [];
  const assignmentIds: string[] = [];

  for (const [index, spec] of participants.entries()) {
    const requiredGender = spec.requiredGender ?? spec.gender;
    const participantId = await insertRow(db, "booking_participants", {
      booking_id: bookingId,
      participant_gender: spec.gender,
      required_therapist_gender: requiredGender,
      is_main_contact: index === 0,
      display_name: spec.displayName ?? (participants.length > 1 ? `${name}-P${index + 1}` : name),
      consent_acknowledged: true,
    });
    participantIds.push(participantId);

    const participantService = spec.service ?? service;
    await insertRow(db, "booking_items", {
      booking_id: bookingId,
      booking_participant_id: participantId,
      service_id: participantService.id,
      service_name_snapshot: participantService.name,
      service_price_snapshot: participantService.price,
      service_duration_snapshot: participantService.mins,
    });

    // ⛔ THE ROW THAT MUST NOT BE OMITTED. See the header.
    assignmentIds.push(
      await insertRow(db, "booking_assignments", {
        booking_id: bookingId,
        participant_id: participantId,
        assigned_staff_id: opts.assignTo ?? null,
        required_therapist_gender: requiredGender,
        status: opts.assignTo ? "assigned" : "unassigned",
      }),
    );
  }

  return {
    bookingId,
    clientId,
    participantIds,
    assignmentIds,
    name,
    email,
    phone,
    date,
    startTime,
    totalPrice,
  };
}

/**
 * ⛔ Unconditional, ERROR-CHECKED teardown.
 *
 * Session H's near-miss: a teardown that ignores `error` reports success while
 * leaving production dirty. Measured foreign keys — `bookings_client_id_fkey` is
 * NO ACTION and `recurring_booking_templates_client_id_fkey` is RESTRICT — so
 * ONE silent failure stops the whole chain and leaves rows behind. ⛔ A
 * surviving `recurring_booking_templates` row is picked up by the nightly cron
 * and materialises visits FOR EVER.
 *
 * Sweeps by the run-tagged prefix as well as the collected ids (G-25), then
 * RE-READS rather than trusting the deletes, and throws if anything survives.
 */
export async function destroyScenarioFixtures(
  db: SupabaseClient,
  clientIds: string[],
  opts: { prefix?: string } = {},
) {
  const prefix = opts.prefix ?? `ZZTEST-%-${RUN_TAG}`;
  const problems: string[] = [];

  const { data: strays, error: strayError } = await db
    .from("clients")
    .select("id")
    .like("full_name", prefix);
  if (strayError) problems.push(`sweep for strays failed: ${strayError.message}`);

  const ids = [...new Set([...clientIds, ...((strays ?? []) as { id: string }[]).map((c) => c.id)])].filter(
    Boolean,
  );
  if (ids.length === 0) return;

  const { data: templates } = await db
    .from("recurring_booking_templates")
    .select("id")
    .in("client_id", ids);
  const templateIds = ((templates ?? []) as { id: string }[]).map((t) => t.id);

  const { data: bookings } = await db.from("bookings").select("id").in("client_id", ids);
  const bookingIds = ((bookings ?? []) as { id: string }[]).map((b) => b.id);

  const step = async (
    label: string,
    run: () => PromiseLike<{ error: { message: string } | null }>,
  ) => {
    const { error } = await run();
    if (error) problems.push(`${label}: ${error.message}`);
  };

  if (bookingIds.length > 0) {
    // ⛔ AUDIT ROWS ARE NOT ALL KEYED ON THE BOOKING. Measured after scenario
    // A1's first green run: `verify-system-integrity.mjs` came back with
    // audit_logs 260 -> 264 over a teardown that reported success. The
    // assignment actions — `booking_assignment_reassigned` and
    // `booking_assignment_completed` — write `target_type:
    // "booking_assignments"` and `target_id: <assignment id>`, so a sweep by
    // booking id misses every one of them. ⛔ Collect the assignment and
    // participant ids BEFORE deleting the rows that carry them (G-25).
    const { data: assignmentRows } = await db
      .from("booking_assignments")
      .select("id")
      .in("booking_id", bookingIds);
    const { data: participantRows } = await db
      .from("booking_participants")
      .select("id")
      .in("booking_id", bookingIds);
    const auditTargets = [
      ...bookingIds,
      ...ids,
      // ⛔ AND THE SERIES TEMPLATES. `recurring_series_created` /
      // `recurring_series_cancelled` write `target_type:
      // "recurring_booking_templates"` and `target_id: <template id>`.
      // ⚠️ Six of these survived scenario B5's runs past a teardown that
      // reported success — the third distinct audit-keying this run has had to
      // learn. ⛔ The rule: an audit row is keyed on the thing the ACTION acted
      // on, which is often NOT the booking.
      ...templateIds,
      ...((assignmentRows ?? []) as { id: string }[]).map((r) => r.id),
      ...((participantRows ?? []) as { id: string }[]).map((r) => r.id),
    ];

    await step("audit_logs", () => db.from("audit_logs").delete().in("target_id", auditTargets));
    await step("booking_assignments", () =>
      db.from("booking_assignments").delete().in("booking_id", bookingIds),
    );
    await step("booking_items", () => db.from("booking_items").delete().in("booking_id", bookingIds));
    await step("booking_participants", () =>
      db.from("booking_participants").delete().in("booking_id", bookingIds),
    );
    await step("email_delivery_events (by booking)", () =>
      db.from("email_delivery_events").delete().in("booking_id", bookingIds),
    );

    // ⛔ THE FOURTH DISTINCT LEAK THIS RUN, and it was caught by READING the
    // code rather than by a failing teardown. A failed email does not only
    // write an `email_delivery_events` row — `recordEmailDeliveryEvent` also
    // calls `recordOperationalEvent`, which writes a SEPARATE
    // `operational_events` row carrying the booking id.
    //
    // ⚠️ Nothing above swept that table, so any scenario that produces a failed
    // send would leave an "error" sitting on the Owner's operations page for
    // ever — a permanent fake alarm about a booking that no longer exists.
    //
    // ⛔ THE ORDERING HERE IS LOAD-BEARING, NOT COSMETIC.
    // `operational_events_booking_id_fkey` is ON DELETE SET NULL. So deleting
    // the booking does NOT delete these rows — it NULLS their `booking_id` and
    // leaves them behind, permanently untraceable to the fixture that made
    // them. ⚠️ MEASURED: 27 such rows were found orphaned this way, every one
    // with `booking_id` null, before this step existed. They must be deleted
    // WHILE the booking still exists or they can never be found again.
    await step("operational_events", () =>
      db.from("operational_events").delete().in("booking_id", bookingIds),
    );
  }

  // ⛔ Recurring-series emails carry `booking_id: null` — they are addressable
  // ONLY by recipient_email, so a sweep by booking_id misses them entirely.
  await step("email_delivery_events (by recipient)", () =>
    db.from("email_delivery_events").delete().like("recipient_email", `%+%-${RUN_TAG}@%`),
  );

  if (templateIds.length > 0) {
    // ⛔ RESTRICT on client_id — this must succeed before the client delete can.
    await step("recurring_booking_templates", () =>
      db.from("recurring_booking_templates").delete().in("id", templateIds),
    );
  }

  if (bookingIds.length > 0) {
    await step("bookings", () => db.from("bookings").delete().in("id", bookingIds));
  }
  await step("client_notes", () => db.from("client_notes").delete().in("client_id", ids));
  await step("clients", () => db.from("clients").delete().in("id", ids));

  // ⛔ RE-READ. Do not trust the deletes — that is the whole lesson.
  const { data: survivingClients } = await db.from("clients").select("id").in("id", ids);
  const { data: survivingBookings } = bookingIds.length
    ? await db.from("bookings").select("id").in("id", bookingIds)
    : { data: [] };
  const { data: survivingTemplates } = templateIds.length
    ? await db.from("recurring_booking_templates").select("id").in("id", templateIds)
    : { data: [] };
  const { data: survivingOps } = bookingIds.length
    ? await db.from("operational_events").select("id").in("booking_id", bookingIds)
    : { data: [] };

  if ((survivingClients ?? []).length) problems.push(`${(survivingClients ?? []).length} client rows survived`);
  if ((survivingBookings ?? []).length) problems.push(`${(survivingBookings ?? []).length} booking rows survived`);
  if ((survivingOps ?? []).length)
    problems.push(
      `${(survivingOps ?? []).length} operational_events rows survived — ` +
        `they would sit on the Owner's operations page as permanent errors about bookings that no longer exist`,
    );
  if ((survivingTemplates ?? []).length)
    problems.push(
      `${(survivingTemplates ?? []).length} recurring_booking_templates rows survived — ` +
        `the nightly cron will materialise visits from them FOR EVER`,
    );

  if (problems.length > 0) {
    throw new Error(`⛔ SCENARIO TEARDOWN LEFT PRODUCTION DIRTY:\n  - ${problems.join("\n  - ")}`);
  }
}

/** Open a page as one of the seven minted identities. */
export async function pageAs(
  browser: Browser,
  role: "owner" | "admin" | "coordinator" | "therapist_a" | "therapist_b" | "inactive" | "non_staff",
): Promise<{ context: BrowserContext; page: Page }> {
  const statePath = `${AUTH_DIR}/${role}.json`;
  // ⛔ THROW, never skip — a signed-out browser is refused everywhere, which
  // would make every assertion pass while proving nothing.
  if (!fs.existsSync(statePath)) {
    throw new Error(
      `${statePath} is missing. Run: E2E_BASE_URL=http://localhost:3000 node scripts/mint-e2e-session.mjs --all --write`,
    );
  }
  const context = await browser.newContext({ storageState: statePath });
  return { context, page: await context.newPage() };
}

/**
 * ⛔ Land on an admin page and distinguish the four ways it can go wrong.
 * "Element missing" is not the same as "signed out", "refused" or "404", and
 * conflating them is how a run blames the app for an expired session.
 */
export async function gotoAdmin(page: Page, path: string, label: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });

  if (/\/admin\/login/.test(page.url())) {
    throw new Error(
      `Signed out while opening ${label} (${path}). Sessions last about an hour — re-mint with ` +
        `E2E_BASE_URL=http://localhost:3000 node scripts/mint-e2e-session.mjs --all --write`,
    );
  }
  if ((await page.locator("[data-admin-access-denied]").count()) > 0) {
    throw new Error(`Refused access to ${label} (${path}).`);
  }
  // ⛔ A Next.js 404 renders `<h1>404</h1>`, not the words "not found".
  if ((await page.locator("h1", { hasText: /^404$/ }).count()) > 0) {
    throw new Error(`${label} (${path}) 404ed.`);
  }
}

/**
 * Click a control and wait for the server action to answer.
 * ⛔ Never a fixed sleep (G-13).
 */
export async function awaitAction(page: Page, click: () => Promise<void>) {
  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  await click();
  await answered;
  await page.waitForTimeout(1_200);
}

/**
 * ⛔ EVERY admin LIST and the booking DETAIL page are served from
 * `unstable_cache` (`revalidate: 60`), and ONLY server actions call
 * `updateTag`. A row written straight to the database — or by the PUBLIC
 * booking API, which invalidates NOTHING (measured: no `updateTag` anywhere
 * under `src/app/api/`) — does not appear until the window turns over.
 *
 * ⛔ So POLL. Never assert once and call the absence a defect.
 */
export async function pollUntil(
  page: Page,
  path: string,
  label: string,
  ready: () => Promise<boolean>,
  { attempts = 10, waitMs = 8_000 }: { attempts?: number; waitMs?: number } = {},
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await gotoAdmin(page, path, label);
    if (await ready()) return attempt;
    if (attempt < attempts) await page.waitForTimeout(waitMs);
  }
  throw new Error(
    `${label} never became ready after ${attempts} reloads over ~${Math.round((attempts * waitMs) / 1000)}s (${path}).`,
  );
}

/** The bookings list, scoped to ONE day. ⛔ `view=all` alone paginates over live production data. */
export function bookingsListForDay(date: string) {
  return `/admin/bookings/?view=all&from=${date}&to=${date}`;
}

/** The reports page, scoped to ONE day. */
export function reportsForDay(date: string) {
  return `/admin/reports/?range=custom&from=${date}&to=${date}`;
}

export async function readBooking(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("bookings")
    // ⛔ SELECT EVERYTHING, DELIBERATELY.
    //
    // ⚠️ A hand-maintained column list bit this run THREE separate times, and
    // every time it failed in the REASSURING-LOOKING direction — a column that
    // is not selected comes back `undefined`, and an assertion written as
    // `Number(x ?? 0)` or `x ?? null` reads that as 0 / null and blames the app:
    //   - A5 read a missing `total_duration_mins` as 0 minutes;
    //   - A2 read a missing `customer_cancelled_at` as null and nearly reported
    //     that the clinic is never told a customer cancelled;
    //   - B1 read a missing `reschedule_preferred_date` as "".
    // ⛔ The list is the bug. Take the whole row and let the assertions decide
    // what matters. This is a service-role read in a test — there is nothing to
    // save by narrowing it.
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`could not read booking ${id}: ${error?.message}`);
  return data as unknown as Record<string, unknown> & { status: string; amount_paid: number };
}

export async function readAssignments(db: SupabaseClient, bookingId: string) {
  const { data } = await db
    .from("booking_assignments")
    .select("id, participant_id, assigned_staff_id, status, required_therapist_gender")
    .eq("booking_id", bookingId);
  return (data ?? []) as {
    id: string;
    participant_id: string;
    assigned_staff_id: string | null;
    status: string;
    required_therapist_gender: string | null;
  }[];
}

export async function auditActions(db: SupabaseClient, targetId: string): Promise<string[]> {
  const { data } = await db.from("audit_logs").select("action_type").eq("target_id", targetId);
  return ((data ?? []) as { action_type: string }[]).map((r) => r.action_type);
}

/**
 * ⛔ Success `delivery_status` is `accepted`, NOT `sent`. `failed` and `skipped`
 * live in the same table, so assert the STATUS, never the row's existence.
 */
export async function emailEvents(db: SupabaseClient, bookingId: string) {
  const { data } = await db
    .from("email_delivery_events")
    // ⚠️ `error_message` matters: a `failed` row without its reason tells you an
    // email did not go and nothing about why. ⛔ And this is `*` rather than a
    // hand-written list because a column list that names a column which does
    // not exist comes back as NO ROWS, not as an error — that shape has cost
    // this run four separate false conclusions. `id` in particular is needed to
    // tell a RESENT message apart from the original.
    .select("*")
    .eq("booking_id", bookingId);
  return (data ?? []) as {
    id: string;
    created_at: string;
    event_type: string;
    recipient_email: string | null;
    recipient_role: string | null;
    delivery_status: string;
    to_email: string | null;
    error_message: string | null;
  }[];
}

/**
 * Wait until the booking's email rows settle, then return them.
 * The three creation emails are sent with `Promise.all` AFTER the RPC returns,
 * so they land a beat after the booking row does.
 */
export async function waitForEmailEvents(
  db: SupabaseClient,
  bookingId: string,
  atLeast: number,
  { attempts = 15, waitMs = 2_000 } = {},
) {
  let events = await emailEvents(db, bookingId);
  for (let i = 0; i < attempts && events.length < atLeast; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    events = await emailEvents(db, bookingId);
  }
  return events;
}

/** Assert a locator exists and say what WAS there when it does not. */
export async function expectVisibleOrExplain(page: Page, locator: ReturnType<Page["locator"]>, what: string) {
  const count = await locator.count();
  if (count === 0) {
    const text = (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 500);
    throw new Error(`Expected ${what}, found nothing. The page said: "${text}"`);
  }
  await expect(locator.first()).toBeVisible();
}

/**
 * ⛔ Drive the PUBLIC booking dialog to submission, as a customer would.
 *
 * ⚠️ Scenario A1 deliberately does NOT use this: it keeps the form spelled out
 * step by step, with an assertion at each one, as the reference description of
 * what a customer actually goes through. This helper exists so A3-A5 can get to
 * the part they are actually about without re-deriving the form.
 *
 * ⛔ SENDS REAL EMAIL — three messages per call, one of them to the Owner's real
 * business inbox. There is no actor to exclude them from a customer-initiated
 * booking. Never call this in a loop.
 *
 * ── Facts this encodes, all measured 2026-08-23 ──────────────────────────
 * - ⛔ Packages are ONE PER CATEGORY, not one in total. `togglePackage`
 *   (`booking-store.ts:44`) drops any selection sharing the new package's
 *   `group`, so Fire REPLACES Hijama (both cupping) while a massage ADDS to
 *   either. Hijama £45 + 1-Hour Massage £60 = £105.
 * - ⛔ Day cells' accessible name is the full date, not the digit.
 * - ⛔ The calendar pre-selects a day and the enabled set CHANGES as
 *   availability lands — wait for the time slots before choosing.
 * - ⛔ In GROUP mode the single "Your gender" pair is replaced by one
 *   Male/Female pair PER PARTICIPANT, in participant order.
 */
export async function submitPublicBooking(
  page: Page,
  opts: {
    name: string;
    email: string;
    phone: string;
    /** Label fragments, e.g. ["Hijama Package", "1-Hour Massage Therapy"]. */
    packages: string[];
    /** One entry per participant. More than one switches the form to GROUP mode. */
    participants: { gender: "male" | "female"; name?: string }[];
  },
): Promise<{ bookingId: string; chosenDay: string; chosenTime: string }> {
  // ⛔ Open the dialog by its own URL rather than by clicking the homepage
  // link. The link is a real navigation to `/home/?booking=1`, and clicking it
  // before the page has hydrated leaves the URL changed but the dialog never
  // mounted — measured, as an intermittent failure. ✅ Scenario A1 clicks the
  // homepage button and asserts the dialog opens, so that path IS covered;
  // repeating it in every scenario only buys flake.
  await page.goto("/home/?booking=1", { waitUntil: "domcontentloaded" });
  const dialog = page.getByRole("dialog");
  await expect(dialog, "the booking dialog should open").toBeVisible({ timeout: 30_000 });

  // ── Step 1 — service ────────────────────────────────────────────────
  for (const label of opts.packages) {
    await dialog.getByRole("button", { name: new RegExp(label, "i") }).first().click();
  }
  await dialog.getByRole("button", { name: /^Continue$/ }).click();

  // ── Step 2 — about you ──────────────────────────────────────────────
  await expect(dialog.getByRole("heading", { name: /^About you$/i }).first()).toBeVisible({
    timeout: 20_000,
  });

  const isGroup = opts.participants.length > 1;
  await dialog.getByRole("button", { name: isGroup ? /^For a group/ : /^For myself/ }).click();

  if (isGroup) {
    await dialog.getByLabel(/Participant count/i).selectOption(String(opts.participants.length));
  }

  await dialog.getByLabel(/Main contact name/i).fill(opts.name);
  await dialog.getByLabel(/Phone \/ WhatsApp number/i).fill(opts.phone);
  await dialog.getByLabel(/Email address/i).fill(opts.email);

  // ⛔ One Male/Female pair per participant, in order. `.nth(i)` is the only
  // way to address them — they carry no per-participant accessible name.
  for (const [index, participant] of opts.participants.entries()) {
    const pair = participant.gender === "male" ? /^Male$/ : /^Female$/;
    await dialog.getByRole("button", { name: pair }).nth(index).click();
    if (isGroup) {
      await dialog
        .getByLabel(new RegExp(`Participant ${index + 1} name or label`, "i"))
        .fill(participant.name ?? `${opts.name}-P${index + 1}`);
    }
  }

  await dialog.getByRole("button", { name: /^Luton$/ }).click();
  await dialog.getByLabel(/Area \/ County/i).fill("Bedfordshire");
  await dialog.getByLabel(/Postcode/i).fill("LU1 1AA");
  await dialog.getByLabel(/Home visit address/i).fill("1 ZZTEST Street");
  await dialog.getByRole("button", { name: /^Continue$/ }).click();

  // ── Step 3 — time ───────────────────────────────────────────────────
  await expect(
    dialog.getByRole("heading", { name: /Choose a matched time/i }),
    "the booking dialog should reach its Time step",
  ).toBeVisible({ timeout: 30_000 });

  const slots = dialog.getByRole("button", { name: /^([01]\d|2[0-3]):[0-5]\d$/ });
  await expect(
    slots.first(),
    "⛔ the clinic offered NO appointment times for this request — nothing could be booked",
  ).toBeVisible({ timeout: 30_000 });

  const days = dialog.locator('button[aria-label*="day,"]');
  const dayCount = await days.count();
  let chosenDay = "";
  for (let index = 0; index < dayCount; index += 1) {
    if (await days.nth(index).isEnabled()) {
      chosenDay = (await days.nth(index).getAttribute("aria-label")) ?? "";
      await days.nth(index).click();
      break;
    }
  }
  expect(chosenDay, "⛔ the calendar offered NO bookable day at all").not.toBe("");

  await expect(slots.first(), `no times were offered on ${chosenDay}`).toBeVisible({
    timeout: 30_000,
  });
  const chosenTime = ((await slots.first().textContent()) ?? "").trim();
  await slots.first().click();
  await dialog.getByRole("button", { name: /^Continue$/ }).click();

  // ── Step 4 — confirm ────────────────────────────────────────────────
  await expect(dialog.getByRole("heading", { name: /Review your request/i })).toBeVisible();
  await dialog.getByLabel(/I consent to treatment/i).check();
  await dialog.getByLabel(/I understand payment is taken in person/i).check();
  await dialog.getByLabel(/I understand this is a booking request/i).check();

  const created = page.waitForResponse(
    (r) => r.url().includes("/api/bookings") && r.request().method() === "POST",
    { timeout: 60_000 },
  );
  await dialog.getByRole("button", { name: /Submit booking request/i }).click();
  const response = await created;

  const body = (await response.json()) as { bookingId?: string; error?: string };
  expect(response.status(), `the booking was refused: ${body.error ?? "(no message)"}`).toBe(200);
  expect(body.bookingId, "the server should return the new booking's id").toBeTruthy();

  return { bookingId: body.bookingId!, chosenDay, chosenTime };
}

export async function readBookingItems(db: SupabaseClient, bookingId: string) {
  const { data } = await db
    .from("booking_items")
    .select("service_name_snapshot, service_price_snapshot, service_duration_snapshot")
    .eq("booking_id", bookingId);
  return (data ?? []) as {
    service_name_snapshot: string;
    service_price_snapshot: number;
    service_duration_snapshot: number;
  }[];
}

export async function readParticipants(db: SupabaseClient, bookingId: string) {
  const { data } = await db
    .from("booking_participants")
    .select("id, display_name, participant_gender, required_therapist_gender, is_main_contact")
    .eq("booking_id", bookingId);
  return (data ?? []) as {
    id: string;
    display_name: string;
    participant_gender: string;
    required_therapist_gender: string;
    is_main_contact: boolean;
  }[];
}

/**
 * ⛔ The real Owner's display name, as the assignment chooser renders it.
 *
 * ⚠️ MEASURED 2026-08-23, AND IT BIT: only TWO male staff can take bookings —
 * `Test Admin` and ⛔ **the real Owner, `Minhaj rahman`**. The chooser lists
 * them alphabetically, so "just take the first candidate offered" picks the
 * OWNER for any male participant. Scenario A4 did exactly that and sent a
 * `staff_assignment` email to `rahmatherapy@outlook.com`, because their
 * `staff_profiles.email` IS the real business inbox.
 */
export const REAL_OWNER_NAME = "Minhaj rahman";

/**
 * Put a therapist on the first participant who still needs one.
 *
 * ⛔ THE OWNER IS HARD-EXCLUDED HERE, not merely de-preferred. Standing rule:
 * never assign staff id `01582c5d-…` in a fixture and never act on a booking
 * they are assigned to. ⛔ Use this instead of hand-rolling a chooser click.
 *
 * ⛔ Candidates are addressed by POSITION because the assign controls carry no
 * per-participant accessible name, and — measured — their DOM order does NOT
 * follow the order participants were created in. Taking "the first control
 * still offering to assign" is also what an admin actually does.
 */
export async function assignFirstUnstaffedParticipant(page: Page) {
  const trigger = page.getByRole("button", { name: /^Assign therapist$/i }).first();
  await expect(trigger, "someone still needs a therapist").toBeVisible({ timeout: 15_000 });
  await trigger.click();

  const chooser = page.getByRole("dialog");
  await expect(chooser.getByText(/Assign a therapist/i)).toBeVisible({ timeout: 15_000 });

  // The list is already filtered to this person's gender requirement, so
  // choosing from it IS the gender match.
  const offered = chooser
    .getByRole("button")
    .filter({ hasNotText: /^Close$|^Show all staff$|^Show eligible only$/ });
  expect(
    await offered.count(),
    "⛔ nobody was offered for this person — a booking the clinic cannot staff at all",
  ).toBeGreaterThan(0);

  const safe = offered.filter({ hasNotText: new RegExp(REAL_OWNER_NAME) });
  expect(
    await safe.count(),
    `⛔ the ONLY staff member offered was ${REAL_OWNER_NAME}, whose staff email is the real ` +
      `business inbox. Refusing to assign them. This scenario needs a different gender mix, ` +
      `or the clinic genuinely has nobody else who can take this person.`,
  ).toBeGreaterThan(0);

  // Prefer the therapist this harness can sign in as, so steps that act AS a
  // therapist afterwards have something to act on.
  const preferred = safe.filter({ hasText: /Test Therapist(?! Fresh)/ });
  const pick = (await preferred.count()) > 0 ? preferred.first() : safe.first();

  await awaitAction(page, async () => {
    await pick.click();
  });
}

/**
 * ⛔ Assert the real Owner was never put on this booking.
 *
 * Any status change on a booking they are assigned to emails the real business
 * inbox via `getAssignedStaffEmails`, which never touches
 * `resolveBusinessNotificationRecipients` — so an email-cost assertion written
 * only against the resolver would not notice.
 */
export async function expectOwnerNeverAssigned(db: SupabaseClient, bookingId: string) {
  const assignments = await readAssignments(db, bookingId);
  const ownerRows = assignments.filter((a) => a.assigned_staff_id === REAL_OWNER_STAFF_ID);
  expect(
    ownerRows,
    `⛔ the real Owner (${REAL_OWNER_STAFF_ID}) was assigned to booking ${bookingId}. ` +
      `Their staff_profiles.email is ${REAL_OWNER_INBOX}, so every later status change on this ` +
      `booking mails the real business inbox.`,
  ).toHaveLength(0);
}

/**
 * ⛔ Mint a customer manage link the way `ensureBookingManageUrl` does.
 *
 * `bookings.manage_token_hash` stores ONLY a sha256 of the token. The plaintext
 * is never persisted — not on the booking, and not in `email_delivery_events`
 * either, because an immediate send records delivery metadata WITHOUT
 * `html_payload`. ⛔ So a test genuinely cannot recover the customer's real
 * link, and must mint its own. The single-live-token model means the newest
 * token is the only valid one anyway, so this IS the customer's link.
 */
export async function mintManageUrl(
  db: SupabaseClient,
  bookingId: string,
  bookingDate: string,
): Promise<string> {
  const { createHash, randomUUID } = await import("node:crypto");
  const token = randomUUID();
  const { error } = await db
    .from("bookings")
    .update({
      manage_token_hash: createHash("sha256").update(token).digest("hex"),
      manage_token_expires_at: new Date(`${bookingDate}T23:59:59.000Z`).toISOString(),
    })
    .eq("id", bookingId);
  if (error) throw new Error(`could not mint a manage token: ${error.message}`);
  return `/booking/manage?token=${encodeURIComponent(token)}`;
}

/**
 * The customer asks to move their appointment, from their own manage page.
 *
 * ⛔ COSTS ONE REAL MESSAGE TO THE BUSINESS INBOX —
 * `sendBookingRescheduleRequestEmails` goes through
 * `resolveBusinessNotificationRecipients`, and a customer-initiated request has
 * no actor to exclude the Owner with.
 */
export async function requestRescheduleAsCustomer(
  page: Page,
  manageUrl: string,
  preferred: { date: string; time: string; note?: string },
) {
  await page.goto(manageUrl, { waitUntil: "domcontentloaded" });

  const dateField = page.getByLabel(/Preferred date/i);
  await expect(
    dateField,
    "⛔ a customer with a live booking must be able to ask to move it",
  ).toBeVisible({ timeout: 20_000 });

  await dateField.fill(preferred.date);
  await page.getByLabel(/Preferred time/i).fill(preferred.time);
  if (preferred.note) {
    // ⛔ Three forms on this page share a `note` textarea (add-a-note, cancel,
    // reschedule). Scope to the one inside the reschedule form, or the note
    // lands on a different action entirely.
    await page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: /^Send request$/ }) })
      .locator("textarea")
      .fill(preferred.note);
  }

  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: /^Send request$/ }).click();
  await answered;
  await page.waitForTimeout(2_500);
}
