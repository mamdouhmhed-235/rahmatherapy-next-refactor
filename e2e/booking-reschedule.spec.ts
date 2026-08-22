// ⛔ GATE 08 P2 — ANSWERING A CUSTOMER'S RESCHEDULE REQUEST. Cases E08-50/51/52.
//
// A customer asks to move their appointment. Somebody at the clinic has to
// answer — accept it or decline it — and the answer has to stick, because
// `reschedule_status` is what stops the request nagging on the bookings list
// forever.
//
// ── ⚠️ EMAIL — ZERO, AND THE ESTIMATE CAME DOWN ─────────────────────────
//
// ⚠️ I first told the Owner this group would cost 4–8 real emails. ⛔ MEASURED,
// and it costs NONE. `sendBookingRescheduleRequestEmails` — which IS one of the
// five senders that reach `rahmatherapy@outlook.com` — fires from the CUSTOMER's
// manage-booking page (`src/app/booking/manage/actions.ts`), not from the admin
// response. `respondToCustomerReschedule` sends nothing at all.
//
// So seeding `reschedule_status = 'requested'` directly and answering it through
// the real admin buttons costs zero mail. ⛔ The customer-REQUEST half belongs to
// the customer-facing phase and its spec is on the never-run list; it is not
// pulled forward here just because it would be interesting.
//
// ⛔ Fixtures are ASSIGNED to the TEST THERAPIST so E08-52's "no mail" assertion
// can actually fail. NEVER assign the Owner's staff id — their
// `staff_profiles.email` IS the real business inbox.
//
// ── ⛔ E08-52 IS A REGRESSION TEST FOR A DEFECT FOUND THIS SESSION (G-08-02) ──
//
// `respondToCustomerReschedule` used to return `void` and swallow all five of
// its refusal paths, while the buttons fired
// `toast.success("Reschedule request accepted.")` on any resolution. ⛔ So a
// refused answer showed staff a GREEN TICK, wrote nothing, and left the customer
// waiting with nobody aware.
//
// ⚠️ E08-52 drives the commonest real refusal — answering a request somebody has
// ALREADY answered — and asserts the operator is told the truth. Without the fix
// this case fails, which is the whole point of it existing.
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

/** ⛔ Measured. By id, never by name. ⛔ NEVER the Owner's staff id. */
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
      "Reschedule fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
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

async function createRescheduleFixture(
  db: SupabaseClient,
  label: string,
  opts: { dayOffset: number; rescheduleStatus: string },
): Promise<BookingFixture> {
  const name = `ZZTEST-RS-${label}-${RUN_TAG}`;
  const phone = `075${String(Number(RUN_TAG) % 1_000_000).padStart(6, "0")}`;
  const date = isoDaysFromToday(opts.dayOffset);

  const clientId = await insertRow(db, "clients", {
    full_name: name,
    email: `zztest-rs-${label.toLowerCase()}-${RUN_TAG}@probe.invalid`,
    phone,
    gender_preference: "female",
    postcode: "LU1 1AA",
    // ⛔ NOT "admin" — `clients_client_source_check` rejects it.
    client_source: "manual",
  });

  const bookingId = await insertRow(db, "bookings", {
    client_id: clientId,
    booking_date: date,
    start_time: "10:00:00",
    end_time: "11:00:00",
    total_duration_mins: SERVICE.durationMins,
    total_price: SERVICE.price,
    amount_due: SERVICE.price,
    status: "confirmed",
    assignment_status: "fully_assigned",
    contact_full_name: name,
    contact_phone: phone,
    booking_source: "admin",
    consent_acknowledged: true,
    // ⛔ The state a customer's request leaves behind. `reschedule_status` is the
    // only one the panel gates on; the rest is what the panel SHOWS the operator.
    reschedule_status: opts.rescheduleStatus,
    reschedule_requested_at: new Date().toISOString(),
    reschedule_preferred_date: isoDaysFromToday(opts.dayOffset + 7),
    reschedule_preferred_time: "14:00:00",
    reschedule_note: `ZZTEST reschedule note ${RUN_TAG}`,
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

  // ⛔ ASSIGNED so the "no mail" assertion can fail. See the header.
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
    .select("id, status, reschedule_status, reschedule_preferred_date")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`could not read booking ${id}: ${error?.message}`);
  return data as {
    id: string;
    status: string;
    reschedule_status: string;
    reschedule_preferred_date: string | null;
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
    .select("event_type, recipient_email")
    .eq("booking_id", bookingId);
  return (data ?? []) as Record<string, string>[];
}

async function destroyFixtures(db: SupabaseClient, clientIds: string[]) {
  const { data: strays } = await db
    .from("clients")
    .select("id")
    .like("full_name", `ZZTEST-RS-%-${RUN_TAG}`);
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
 * ⛔ Open the booking detail page and return the reschedule panel.
 *
 * ⚠️ This page IS cached (`getBookingDetailData` wraps its fetch in
 * `unstable_cache`, `revalidate: 60`). A brand-new fixture misses the cache on
 * its first read, which is why no poll is needed; ⛔ a case that mutated an
 * EXISTING booking out-of-band and re-read it inside 60 seconds would be served
 * a stale render.
 */
async function openReschedulePanel(page: Page, bookingId: string, label: string) {
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

  // ⛔ The panel renders ONLY on `fullScope && reschedule_status === "requested"`,
  // so its presence is itself an assertion about the fixture and the role.
  const accept = page.getByRole("button", { name: /^Accept request$/ });
  await expect(
    accept,
    `the reschedule panel should render for ${label} — it is gated on ` +
      `manage_bookings_all AND reschedule_status = 'requested'`,
  ).toBeVisible({ timeout: 30_000 });
  return page;
}

/**
 * Click and wait for the server action to answer.
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

test.describe("gate 08 P2 — answering a customer's reschedule request", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });
  // ⚠️ The dev server compiles each route on first visit. Not a performance
  // statement — gate 14 owns speed and measures the built site.
  test.setTimeout(300_000);

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);

  let toAccept: BookingFixture;
  let toDecline: BookingFixture;
  let alreadyAnswered: BookingFixture;
  const createdClientIds: string[] = [];

  test.beforeAll(async () => {
    // ⚠️ Separate days: two fixtures on one day makes a bookings-list case flaky
    // (G-08-01). These are detail-page cases, but the habit is cheap and the
    // fixtures are also findable on the list.
    toAccept = await createRescheduleFixture(db, "Accept", {
      dayOffset: 5,
      rescheduleStatus: "requested",
    });
    toDecline = await createRescheduleFixture(db, "Decline", {
      dayOffset: 6,
      rescheduleStatus: "requested",
    });
    alreadyAnswered = await createRescheduleFixture(db, "Raced", {
      dayOffset: 7,
      rescheduleStatus: "requested",
    });
    createdClientIds.push(toAccept.clientId, toDecline.clientId, alreadyAnswered.clientId);

    // ⛔ Prove the fixtures are what the tests assume BEFORE any of them run.
    for (const f of [toAccept, toDecline, alreadyAnswered]) {
      expect(
        (await readBooking(db, f.bookingId)).reschedule_status,
        `${f.name} must start as an unanswered request`,
      ).toBe("requested");
    }
  });

  test.afterAll(async () => {
    if (db) await destroyFixtures(db, createdClientIds);
  });

  test("E08-50 — a coordinator ACCEPTS the request, and it stops nagging", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await openReschedulePanel(page, toAccept.bookingId, toAccept.name);
      await awaitAction(page, () =>
        page.getByRole("button", { name: /^Accept request$/ }).click(),
      );

      const after = await readBooking(db, toAccept.bookingId);
      // ⛔ "reviewed", not "accepted". The `bookings_reschedule_status_check`
      // constraint allows none/requested/reviewed/declined/completed, and the
      // operator-facing label deliberately differs from the stored value.
      // Measured from `RESCHEDULE_DECISIONS`, because the obvious guess is wrong.
      expect(
        after.reschedule_status,
        "the request is marked answered so it stops appearing as outstanding",
      ).toBe("reviewed");

      // ⚠️ Accepting RECORDS a decision; it does not move the appointment. No
      // admin path edits `booking_date` today — the move is done out of band —
      // so asserting the date changed would be asserting a feature that does not
      // exist.
      expect(
        after.status,
        "and answering a reschedule does not disturb the booking itself",
      ).toBe("confirmed");

      expect(
        await auditActions(db, toAccept.bookingId),
        "the decision is on the audit trail",
      ).toContain("booking_reschedule_reviewed");
    } finally {
      await context.close();
    }
  });

  test("E08-51 — a coordinator DECLINES the request", async ({ browser }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await openReschedulePanel(page, toDecline.bookingId, toDecline.name);
      await awaitAction(page, () =>
        page.getByRole("button", { name: /^Decline request$/ }).click(),
      );

      const after = await readBooking(db, toDecline.bookingId);
      expect(
        after.reschedule_status,
        "a declined request is answered too — it must not keep nagging either",
      ).toBe("declined");

      // ⛔ The two decisions write DIFFERENT audit actions. Asserting the wrong
      // one would let accept and decline be silently swapped.
      const audits = await auditActions(db, toDecline.bookingId);
      expect(audits, "the decline is on the audit trail").toContain(
        "booking_reschedule_declined",
      );
      expect(
        audits,
        "and it is NOT recorded as an acceptance",
      ).not.toContain("booking_reschedule_reviewed");
    } finally {
      await context.close();
    }
  });

  test("E08-52 — a request somebody already answered tells the truth, not a green tick", async ({
    browser,
  }) => {
    // ⛔ REGRESSION TEST FOR G-08-02, the defect fixed this session.
    //
    // Two coordinators opening the same request is an ordinary race. The screen
    // in front of the second one is stale, so their click cannot succeed — and
    // BEFORE THE FIX they were shown "Reschedule request accepted." anyway,
    // while nothing was written and the customer went on waiting.
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await openReschedulePanel(page, alreadyAnswered.bookingId, alreadyAnswered.name);

      // ⛔ Simulate the OTHER coordinator answering first, AFTER this page
      // rendered. Writing directly is the honest way to model a race: it is
      // exactly the state the second operator's browser cannot know about.
      const { error } = await db
        .from("bookings")
        .update({ reschedule_status: "reviewed" })
        .eq("id", alreadyAnswered.bookingId);
      expect(error, "the fixture's race setup must succeed").toBeNull();

      await awaitAction(page, () =>
        page.getByRole("button", { name: /^Accept request$/ }).click(),
      );

      // ⛔ THE DATABASE FIRST. The stale click must not overwrite the answer that
      // did land, and must not add a second audit row claiming it did.
      const after = await readBooking(db, alreadyAnswered.bookingId);
      expect(
        after.reschedule_status,
        "the answer that actually landed is not overwritten by a stale click",
      ).toBe("reviewed");

      const audits = await auditActions(db, alreadyAnswered.bookingId);
      expect(
        audits.filter((a) => a === "booking_reschedule_reviewed"),
        `a refused answer must not write an audit row (saw: ${JSON.stringify(audits)})`,
      ).toEqual([]);

      // ⛔ …AND THE OPERATOR IS TOLD THE TRUTH. This is the half that was broken:
      // the success toast used to fire regardless. The message must name the real
      // reason — "already been answered" — and NOT be the generic "try again",
      // which would be wrong advice for a race.
      await expect(
        page.getByText(/already been answered/i).first(),
        "the staff member is told the request was already answered",
      ).toBeVisible({ timeout: 15_000 });

      await expect(
        page.getByText(/Reschedule request accepted\./i),
        "⛔ and is NOT told it worked — the exact lie this test exists to catch",
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("E08-53 — answering a reschedule emails nobody", async () => {
    // ⛔ No browser: the question is what the SERVER did.
    //
    // ⚠️ Measured, and it corrected an estimate I had already given the Owner:
    // `respondToCustomerReschedule` has no email path at all. The reschedule
    // email that DOES reach the business inbox fires from the CUSTOMER's
    // manage-booking page, which this spec deliberately does not touch.
    //
    // ⛔ Every fixture here is ASSIGNED, so a stray send would leave a
    // `staff_booking_change` row and this would fail.
    for (const f of [toAccept, toDecline, alreadyAnswered]) {
      expect(
        await emailEvents(db, f.bookingId),
        `answering a reschedule must email nobody (${f.name})`,
      ).toEqual([]);
    }
  });
});
