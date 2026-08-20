// ⛔ GATE 07 CASE 20 — THE CROSS-THERAPIST JOURNEY. The last open browser case
// of the authorization gate, run here because it needs a real signed-in browser.
//
// ── Why this case cannot be replaced by any role-level test ─────────────────
//
// Therapist A and Therapist B hold the SAME role and therefore the SAME twelve
// permissions. Every check gate 07 built — the 40-cell bundle matrix, the
// 105-cell page matrix, AUTHZ-3's 14 entry points — asks "may this ROLE do
// this?", and for A versus B the answer is identical and correct in both cases.
// ⛔ Nothing in 400-odd role-level assertions can tell A apart from B.
//
// The only thing separating them is the RECORD. That is a different question,
// and it has essentially never been asked. The one existing check on it says so
// in its own words: `server-enforcement.test.ts` asserts the ownership filter by
// GREPPING THE SOURCE of `updateOwnAssignmentStatus` for
// `eq("assigned_staff_id"`, and its comment explains why — "the mocked client
// cannot observe a real query". A source-text search proves a line exists. It
// cannot prove the line works.
//
// This spec asks the real question against the real database.
//
// ── ⛔ THE DESIGN POINT: BOTH THERAPISTS GET A BOOKING ──────────────────────
//
// The obvious shape — give A a booking, check B cannot see it — is worthless
// here, and it is worth being precise about why. Therapist B has ZERO
// assignments. So "B sees nothing" is exactly what a broken session, a failed
// login, a mistyped URL or a page that silently errored would also produce. It
// is the same trap that made two agents sharing one browser both report
// "isolated" while measuring the same page (RESULT.md, Wave 0).
//
// So the fixture creates TWO bookings — one assigned to A, one assigned to B —
// and every surface is checked in both directions:
//
//     A must see A's booking      and must NOT see B's
//     B must see B's booking      and must NOT see A's
//
// The "sees" half is the control. It runs the identical query, in the identical
// surface, in the identical session, and it comes back with a row. That is what
// makes the "does not see" half mean something.
//
// ── Safety ─────────────────────────────────────────────────────────────────
//
// ⛔ Approved to write by Owner ruling D-015. Every row created here is prefixed
// `ZZTEST-` and is torn down in a `finally`, unconditionally — not as a trailing
// step that a failure would skip.
// ⚠️ The report-export surface writes an `audit_logs` row on every call, by
// design (reports/export/route.ts). Those rows are the system honestly recording
// that an export happened, and they are deliberately NOT deleted.

import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { hasBaseUrl } from "./helpers";

const AUTH_DIR = "e2e/.auth";

// ⛔ MEASURED, and NOT what the older plan documents say. The plans describe
// seven `phase10.*` identities; only three of them are. `E2E_THERAPIST_A_EMAIL`
// resolves to `test.therapist@rahmatherapy.example.test` — a DIFFERENT account
// from `phase10.therapist.a@example.test`, which has two assignments of its own
// and which nothing in this harness ever signs in as. Pointing the fixture at
// the phase10 account would have assigned a booking to a therapist the browser
// never becomes, and every isolation assertion would then have passed for the
// wrong reason.
const THERAPIST_A_STAFF_ID = "884311b1-e9d0-44b9-91f3-14188a3baf59"; // test.therapist@
const THERAPIST_B_STAFF_ID = "1ae328ef-2f33-42dd-acb4-2e541543f162"; // phase10.therapist.b@

// ⚠️ Both therapists are female (measured), so both fixtures must require a
// female therapist — otherwise the gender filter, not the ownership rule, would
// be what hides each booking from the other, and this spec would be quietly
// testing the wrong mechanism.
const REQUIRED_GENDER = "female";

const SERVICE = {
  id: "9e70c3fd-b551-465e-9d7b-822398b431d7",
  name: "Hijama Package",
  price: 45,
  durationMins: 60,
};

/** Unique per run, so a crashed run can never collide with the next one. */
const RUN_TAG = process.env.E2E_FIXTURE_TAG ?? String(process.pid);

type Fixture = {
  clientId: string;
  bookingId: string;
  participantId: string;
  assignmentId: string;
  contactName: string;
  clientName: string;
  healthNote: string;
};

function serviceClient(): SupabaseClient {
  // Resolved the same way e2e/helpers.ts resolves everything else. `pnpm
  // test:e2e` passes --env-file=.env, so these are present.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Cross-therapist fixture needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
        "Run via `pnpm test:e2e`, which passes --env-file=.env.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** A date far enough out that no reminder cron will act on it mid-run. */
function fixtureDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 21);
  return date.toISOString().slice(0, 10);
}

async function createFixture(db: SupabaseClient, who: "A" | "B"): Promise<Fixture> {
  const staffId = who === "A" ? THERAPIST_A_STAFF_ID : THERAPIST_B_STAFF_ID;
  const contactName = `ZZTEST-Xtherapist-${who}-${RUN_TAG}`;
  const clientName = `ZZTEST-XtherapistClient-${who}-${RUN_TAG}`;
  const healthNote = `ZZTEST-healthnote-${who}-${RUN_TAG}`;

  const insert = async <T>(table: string, row: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.from(table).insert(row).select("id").single();
    // ⛔ Loud. A fixture that half-built would make every "cannot see it"
    // assertion below pass for the wrong reason.
    if (error || !data) throw new Error(`fixture insert into ${table} failed: ${error?.message}`);
    return data as T;
  };

  const client = await insert<{ id: string }>("clients", {
    full_name: clientName,
    email: `zztest-xtherapist-${who}-${RUN_TAG}@example.test`,
    phone: "07700900000",
    gender_preference: REQUIRED_GENDER,
    postcode: "LU1 1AA",
    // ⛔ NOT "admin". `clients_client_source_check` allows website/phone/whatsapp/
    // instagram/referral/manual/other — while `bookings_booking_source_check`
    // DOES allow "admin". The two columns look alike and are not.
    client_source: "manual",
  });

  const booking = await insert<{ id: string }>("bookings", {
    client_id: client.id,
    booking_date: fixtureDate(),
    start_time: "10:00:00",
    end_time: "11:00:00",
    total_duration_mins: SERVICE.durationMins,
    total_price: SERVICE.price,
    status: "confirmed",
    assignment_status: "fully_assigned",
    payment_status: "unpaid",
    contact_full_name: contactName,
    contact_email: `zztest-xtherapist-${who}-${RUN_TAG}@example.test`,
    contact_phone: "07700900000",
    service_address_line1: "1 ZZTEST Street",
    service_city: "Luton",
    service_postcode: "LU1 1AA",
    booking_source: "admin",
    consent_acknowledged: true,
    health_notes: healthNote,
  });

  const participant = await insert<{ id: string }>("booking_participants", {
    booking_id: booking.id,
    participant_gender: REQUIRED_GENDER,
    required_therapist_gender: REQUIRED_GENDER,
    is_main_contact: true,
    display_name: contactName,
    consent_acknowledged: true,
    health_notes: healthNote,
  });

  await insert("booking_items", {
    booking_id: booking.id,
    booking_participant_id: participant.id,
    service_id: SERVICE.id,
    service_name_snapshot: SERVICE.name,
    service_price_snapshot: SERVICE.price,
    service_duration_snapshot: SERVICE.durationMins,
  });

  const assignment = await insert<{ id: string }>("booking_assignments", {
    booking_id: booking.id,
    participant_id: participant.id,
    assigned_staff_id: staffId,
    required_therapist_gender: REQUIRED_GENDER,
    status: "assigned",
  });

  return {
    clientId: client.id,
    bookingId: booking.id,
    participantId: participant.id,
    assignmentId: assignment.id,
    contactName,
    clientName,
    healthNote,
  };
}

async function destroyFixture(db: SupabaseClient, fixture: Fixture | null) {
  if (!fixture) return;
  // ⛔ Explicit child-first deletion by EXPLICIT ID. Never "the most recent
  // booking" — that habit is what standing safety rule 5 exists to prevent, and
  // it survives D-016 removing the record it was originally written to protect.
  await db.from("booking_assignments").delete().eq("id", fixture.assignmentId);
  await db.from("booking_items").delete().eq("booking_id", fixture.bookingId);
  await db.from("booking_participants").delete().eq("id", fixture.participantId);
  await db.from("bookings").delete().eq("id", fixture.bookingId);
  await db.from("clients").delete().eq("id", fixture.clientId);
}

type Outcome = "rendered" | "denied" | "not-found" | "redirected-to-login";

async function openBooking(page: Page, bookingId: string): Promise<Outcome> {
  await page.goto(`/admin/bookings/${bookingId}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  if (/\/admin\/login/.test(page.url())) return "redirected-to-login";
  // ⛔ Read the component marker, never the copy. Matching wording produced a
  // false SECURITY finding in E08-19: /admin/privacy/ says "Ask the owner" while
  // the pattern looked for "ask the practice owner".
  if ((await page.locator("[data-admin-access-denied]").count()) > 0) return "denied";
  if ((await page.getByRole("heading", { name: /booking not found/i }).count()) > 0) {
    return "not-found";
  }
  return "rendered";
}

// ⛔ ASK FOR A LINK TO THE RECORD, NEVER FOR ITS NAME ON THE PAGE.
//
// This nearly became the sixth false finding of this programme, and a SECURITY
// one. The first version searched the whole page for the booking's contact name
// and reported "therapist_a found therapist B's booking in the bookings list" —
// while the same booking's DETAIL page correctly refused A, which should have
// been the clue.
//
// Probed rather than believed. Three text nodes on that page contained the name:
// a <span> filter chip echoing the ?search= term straight back at the user, and
// two Next RSC payload <script> blocks containing the same URL. Links to the
// booking id: ZERO. The row was never in the results.
//
// ⛔ Any search surface echoes the query. Asserting on the query term is
// therefore guaranteed to find it whether or not the record is there. Asking for
// an anchor to the record's own id cannot be satisfied by an echo.
async function linksToBooking(page: Page, bookingId: string): Promise<number> {
  return page.locator(`a[href*="${bookingId}"]`).count();
}

/** Search the bookings list and report how many links to the record came back. */
async function bookingsListFinds(page: Page, bookingId: string, name: string): Promise<boolean> {
  // `view=all` so no default period or status filter can be what hides a row —
  // this test is about ownership, and nothing else may be in the way.
  await page.goto(`/admin/bookings/?view=all&search=${encodeURIComponent(name)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(800);
  return (await linksToBooking(page, bookingId)) > 0;
}

/** Type a name into the admin command palette and report whether the record appears. */
async function commandPaletteFinds(
  page: Page,
  bookingId: string,
  name: string,
): Promise<boolean> {
  await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });

  // ⛔ MEASURED. The first attempt looked for /search bookings, clients/i — the
  // placeholder text — and found nothing, which could very easily have been
  // written up as "therapists have no command palette". They do. AdminTopNav
  // renders the trigger in its `compact` variant on the desktop rail, whose
  // accessible name is "Search…⌘K", and a second, hidden mobile button labelled
  // "Search (⌘K)". Both roles get exactly the same pair — checked against the
  // Owner as a control, so this is a shell fact, not a permission one.
  await page.getByRole("button", { name: /Search…/ }).first().click();

  const input = page.locator("#admin-command-search");
  await expect(input).toBeVisible();
  // ⛔ WAIT FOR THE SERVER ACTION TO ANSWER. Two earlier versions of this were
  // wrong, both of them in the reassuring direction, and both were caught by
  // mutation rather than by review.
  //
  // 1. A fixed `waitForTimeout(2500)`. A slow answer then reads as "not found".
  //    Removing the palette's scoping failed to turn this red purely because
  //    the dev server was recompiling and had not replied inside the sleep.
  //
  // 2. Polling the UI for a "terminal" state. ⛔ "Nothing matches" IS NOT
  //    TERMINAL — the component renders it whenever the query is ≥2 characters
  //    and `results` is empty, which is exactly the frame BEFORE the search has
  //    started. Measured directly: with that poll, the OWNER — who is allowed to
  //    search everything — also came back "Nothing matches". Waiting on the
  //    action's own response instead gives owner 2 results, therapist B (the
  //    assignee) 1, therapist A none. That is the real behaviour, and it is
  //    correct.
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      Boolean(response.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  await input.fill(name);
  await answered;
  // A beat for React to commit the transition's result.
  await page.waitForTimeout(500);

  // ⛔ SCOPED TO THE LISTBOX. Counting links across the whole page would count
  // the DASHBOARD sitting behind the modal, which lists the signed-in
  // therapist's own bookings — so the "can find my own booking" control would
  // have passed without the palette returning anything at all.
  const listbox = page.getByRole("listbox");
  return (await listbox.locator(`a[href*="${bookingId}"]`).count()) > 0;
}

/** Download a report export as the current session and return its text. */
async function exportReport(page: Page, report: string): Promise<string> {
  const response = await page.request.get(`/admin/reports/export/?report=${report}`);
  expect(response.status(), `${report} export should be permitted for a therapist`).toBe(200);
  return response.text();
}

test.describe("gate 07 case 20 — one therapist cannot reach another's booking", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });

  // ⚠️ NOT a performance statement. Several of these admin routes are compiled
  // by the dev server on first visit. Gate 14 owns speed and measures the built
  // site.
  test.setTimeout(300_000);

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);
  let fixtureA: Fixture | null = null;
  let fixtureB: Fixture | null = null;

  test.beforeAll(async () => {
    fixtureA = await createFixture(db, "A");
    fixtureB = await createFixture(db, "B");
  });

  test.afterAll(async () => {
    // ⛔ Unconditional, and in an afterAll rather than a trailing step, so a
    // failing assertion cannot leave rows on the production database.
    try {
      await destroyFixture(db, fixtureA);
    } finally {
      await destroyFixture(db, fixtureB);
    }
  });

  async function sessionFor(browser: import("@playwright/test").Browser, role: string) {
    const statePath = `${AUTH_DIR}/${role}.json`;
    // ⛔ THROW, do not skip. A missing storage-state file makes the browser sign
    // in as nobody, and then EVERY assertion in this spec passes: an anonymous
    // visitor sees neither booking. That is the single most dangerous way this
    // case could go green while proving nothing.
    if (!fs.existsSync(statePath)) {
      throw new Error(
        `${statePath} is missing. Run: node scripts/mint-e2e-session.mjs --all --write\n` +
          "⛔ Not skipped on purpose: without a session this spec would PASS while " +
          "measuring a signed-out browser.",
      );
    }
    const context = await browser.newContext({ storageState: statePath });
    return { context, page: await context.newPage() };
  }

  test("CONTROL — each therapist can reach their OWN booking on every surface", async ({
    browser,
  }) => {
    // ⛔ This test is the load-bearing one. If it fails, every "cannot see it"
    // assertion in the next test is meaningless, and the case reports nothing.
    for (const [role, own] of [
      ["therapist_a", fixtureA!],
      ["therapist_b", fixtureB!],
    ] as const) {
      const { context, page } = await sessionFor(browser, role);
      try {
        expect(await openBooking(page, own.bookingId), `${role} should open their own booking`).toBe(
          "rendered",
        );
        await expect(
          page.getByText(own.contactName, { exact: false }).first(),
          `${role}'s own booking should show its contact name`,
        ).toBeVisible();

        expect(
          await bookingsListFinds(page, own.bookingId, own.contactName),
          `${role} should find their own booking in the bookings list`,
        ).toBe(true);

        expect(
          await commandPaletteFinds(page, own.bookingId, own.contactName),
          `${role} should find their own booking in the command palette`,
        ).toBe(true);

        const csv = await exportReport(page, "booking_list");
        expect(csv, `${role}'s export should contain their own booking`).toContain(
          own.contactName,
        );
      } finally {
        await context.close();
      }
    }
  });

  test("neither therapist can reach the other's booking on any surface", async ({ browser }) => {
    for (const [role, other, otherRole] of [
      ["therapist_a", fixtureB!, "B"],
      ["therapist_b", fixtureA!, "A"],
    ] as const) {
      const { context, page } = await sessionFor(browser, role);
      try {
        // 1. The record itself, requested directly by id.
        const outcome = await openBooking(page, other.bookingId);
        expect(
          ["denied", "not-found"],
          `${role} opened therapist ${otherRole}'s booking and got "${outcome}"`,
        ).toContain(outcome);

        // ⛔ And nothing of it leaked onto the refusal page. A refusal that still
        // renders the customer's name is not a refusal.
        for (const secret of [other.contactName, other.clientName, other.healthNote]) {
          await expect(
            page.getByText(secret, { exact: false }),
            `${role} saw ${JSON.stringify(secret)} on the refusal page`,
          ).toHaveCount(0);
        }

        // 2. The bookings list, searched for the exact name.
        expect(
          await bookingsListFinds(page, other.bookingId, other.contactName),
          `${role} found therapist ${otherRole}'s booking in the bookings list`,
        ).toBe(false);

        // 3. The command palette — the surface that already had one real
        //    contact-detail defect this programme (FIND-07-B).
        expect(
          await commandPaletteFinds(page, other.bookingId, other.contactName),
          `${role} found therapist ${otherRole}'s booking in the command palette`,
        ).toBe(false);

        // 4. The report export. ⛔ Checked for BOTH shapes: `booking_list`, and
        //    `client_summary`, whose own source comment records that this route
        //    once mapped the clinic-wide client table straight into a CSV. The
        //    `report` parameter is unvalidated, so a therapist can ask for any
        //    shape — which is exactly why both are asked for here.
        for (const report of ["booking_list", "client_summary"]) {
          const csv = await exportReport(page, report);
          expect(
            csv.includes(other.contactName),
            `${role}'s ${report} export contained therapist ${otherRole}'s contact name`,
          ).toBe(false);
          expect(
            csv.includes(other.clientName),
            `${role}'s ${report} export contained therapist ${otherRole}'s client`,
          ).toBe(false);
          expect(
            csv.includes(other.healthNote),
            `${role}'s ${report} export contained therapist ${otherRole}'s health note`,
          ).toBe(false);
        }
      } finally {
        await context.close();
      }
    }
  });
});
