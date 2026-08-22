// ⛔ GATE 07 CASE 18 — THE UI HALF. "The button is missing" AND "the action still refuses."
//
// The case is worded: for six actions, assert (a) the affordance is absent from
// the rendered admin page for the denied role, AND (b) the server action still
// refuses when invoked directly with that role's profile.
// ⛔ A missing button with a permissive server action is a FAIL, not a pass.
//
// ── ⛔ WHERE THE OTHER HALF LIVES, AND WHY IT IS NOT REPEATED HERE ──────────
//
// Half (b) is `src/app/admin/__tests__/server-enforcement.test.ts`, which drives
// each action with FOUR actor states against the REAL permission layer — nothing
// in `@/lib/auth/rbac` is mocked — and additionally asserts that
// `createSupabaseAdminClient` was NEVER CONSTRUCTED on a denial. That last part
// matters more than the refusal itself: every admin mutation uses the
// service-role key, which bypasses RLS by design, so the hand-written check is
// the entire protection and it has to run BEFORE that client exists.
//
// ⚠️ `createService` was MISSING from that file until 2026-08-22 — measured, it
// appeared zero times — and the only other test driving it mocks
// `requirePermission` away, so nothing anywhere proved a real Coordinator or
// Therapist is refused. Added, and mutation-tested: neutering its guard turns
// four cases RED.
//
// ── ⛔ WHY ONLY THREE OF THE SIX APPEAR BELOW ───────────────────────────────
//
// ⛔ FOR AN AFFORDANCE ASSERTION TO MEAN ANYTHING, THE ROLE MUST BE ABLE TO OPEN
// THE PAGE. Asserting "the Create service button is absent" for a Coordinator
// proves nothing when `/admin/services/` returns access-denied to them — the
// button is absent because EVERYTHING is absent. That is the E08-48d trap
// (a case that could not fail) wearing a different hat.
//
// Measured against `page-access-matrix.spec.ts`'s hand-written MATRIX_ALLOWS:
//
//   createService          /admin/services/  ⛔ page DENIED to both roles
//   updateBusinessSettings /admin/settings/  ⛔ page DENIED to both roles
//   toggleRolePermission   /admin/roles/     ⛔ page DENIED to both roles
//   ─────────────────────────────────────────────────────────────────────────
//   adminDeleteClient      /admin/clients/   ✅ Coordinator CAN open it
//   updateBookingAssignment/admin/bookings/  ✅ Therapist CAN open their own
//   updateStaffPermissionOverride /admin/staff/ ✅ BOTH can open it
//
// The first three are covered by E08-19, which requests every admin page
// directly as every role and records the outcome — a stronger result than a
// button check, because it proves the whole page is unreachable rather than one
// control being hidden. ⛔ Recorded here explicitly so a later reader does not
// mistake their absence for an oversight and "fix" it with three vacuous cases.
//
// ── Safety ────────────────────────────────────────────────────────────────
//
// ⛔ READ-ONLY. This spec drives no mutation, so it sends NO email and writes
// nothing except its own fixtures, which are `ZZTEST-` + a run tag and removed
// in an unconditional afterAll. ⛔ The fixture booking is assigned to the TEST
// therapist, never the Owner's staff id — theirs is the real business inbox.

import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { hasBaseUrl } from "./helpers";

const AUTH_DIR = "e2e/.auth";
const RUN_TAG = process.env.E2E_FIXTURE_TAG ?? String(process.pid);

/** ⛔ Measured. Selected by id — the name is a trap (handoff §8). */
const THERAPIST_A_STAFF_ID = "884311b1-e9d0-44b9-91f3-14188a3baf59";
/** A DIFFERENT staff member, so the staff-detail page is never "own profile",
 *  which renders a different panel and would prove the wrong thing. */
const THERAPIST_B_STAFF_ID = "1ae328ef-2f33-42dd-acb4-2e541543f162";

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
      "Case 18 fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
        "Run via `pnpm test:e2e`, which passes --env-file=.env.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function sessionFor(browser: import("@playwright/test").Browser, role: string) {
  const statePath = `${AUTH_DIR}/${role}.json`;
  if (!fs.existsSync(statePath)) {
    throw new Error(`${statePath} missing. Run: node scripts/mint-e2e-session.mjs --all --write`);
  }
  const context = await browser.newContext({ storageState: statePath });
  return { context, page: await context.newPage() };
}

function isoDaysFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** ⛔ The page must have RENDERED, or every "control is absent" assertion below
 *  is true for the boring reason. Detects the refusal marker the run standardised
 *  on, never by matching copy. */
async function expectRendered(page: Page, what: string) {
  await expect(
    page.locator("[data-admin-access-denied]"),
    `${what}: the role must be able to OPEN this page, or the absence proves nothing`,
  ).toHaveCount(0);
}

test.describe("gate 07 case 18 — a hidden control, over a page the role can really open", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);
  const name = `ZZTEST-AUTHZ18-${RUN_TAG}`;
  let clientId = "";
  let bookingId = "";

  test.beforeAll(async () => {
    if (!hasBaseUrl()) return;
    const phone = `076${String(Number(RUN_TAG) % 1_000_000).padStart(6, "0")}`;

    const { data: client, error: clientError } = await db
      .from("clients")
      .insert({
        full_name: name,
        email: `zztest-authz18-${RUN_TAG}@example.test`,
        phone,
        gender_preference: "female",
        postcode: "LU1 1AA",
        client_source: "manual",
      })
      .select("id")
      .single();
    if (clientError || !client) throw new Error(`client fixture: ${clientError?.message}`);
    clientId = (client as { id: string }).id;

    const { data: booking, error: bookingError } = await db
      .from("bookings")
      .insert({
        client_id: clientId,
        booking_date: isoDaysFromToday(9),
        start_time: "10:00:00",
        end_time: "11:00:00",
        total_duration_mins: SERVICE.durationMins,
        total_price: SERVICE.price,
        amount_due: SERVICE.price,
        amount_paid: 0,
        payment_status: "unpaid",
        travel_fee: 0,
        status: "confirmed",
        assignment_status: "fully_assigned",
        contact_full_name: name,
        contact_phone: phone,
        booking_source: "admin",
        consent_acknowledged: true,
      })
      .select("id")
      .single();
    if (bookingError || !booking) throw new Error(`booking fixture: ${bookingError?.message}`);
    bookingId = (booking as { id: string }).id;

    const { data: participant } = await db
      .from("booking_participants")
      .insert({
        booking_id: bookingId,
        participant_gender: "female",
        required_therapist_gender: "female",
        is_main_contact: true,
        display_name: name,
        consent_acknowledged: true,
      })
      .select("id")
      .single();

    await db.from("booking_items").insert({
      booking_id: bookingId,
      booking_participant_id: (participant as { id: string }).id,
      service_id: SERVICE.id,
      service_name_snapshot: SERVICE.name,
      service_price_snapshot: SERVICE.price,
      service_duration_snapshot: SERVICE.durationMins,
    });

    // ⛔ Assigned to the TEST therapist — that is what lets them open the booking
    // at all, and it is never the Owner's staff id.
    await db.from("booking_assignments").insert({
      booking_id: bookingId,
      participant_id: (participant as { id: string }).id,
      assigned_staff_id: THERAPIST_A_STAFF_ID,
      required_therapist_gender: "female",
      status: "assigned",
    });
  });

  test.afterAll(async () => {
    if (!hasBaseUrl()) return;
    const { data: strays } = await db
      .from("clients")
      .select("id")
      .like("full_name", `ZZTEST-AUTHZ18-%${RUN_TAG}`);
    const clientIds = [
      ...new Set([...(clientId ? [clientId] : []), ...((strays ?? []) as { id: string }[]).map((c) => c.id)]),
    ];
    if (clientIds.length === 0) return;

    const { data: bookings } = await db.from("bookings").select("id").in("client_id", clientIds);
    const bookingIds = ((bookings ?? []) as { id: string }[]).map((b) => b.id);
    if (bookingIds.length > 0) {
      await db.from("audit_logs").delete().in("target_id", bookingIds);
      await db.from("booking_assignments").delete().in("booking_id", bookingIds);
      await db.from("booking_items").delete().in("booking_id", bookingIds);
      await db.from("booking_participants").delete().in("booking_id", bookingIds);
      await db.from("email_delivery_events").delete().in("booking_id", bookingIds);
      await db.from("bookings").delete().in("id", bookingIds);
    }
    await db.from("client_notes").delete().in("client_id", clientIds);
    const { error } = await db.from("clients").delete().in("id", clientIds);
    if (error) throw new Error(`⛔ TEARDOWN INCOMPLETE — clients: ${error.message}`);
  });

  // ── adminDeleteClient ──────────────────────────────────────────────────
  test("E07-18a — a Coordinator opens a client and is offered NO way to delete them", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      await page.goto(`/admin/clients/${clientId}/`, { waitUntil: "domcontentloaded" });
      await expectRendered(page, "client detail as Coordinator");

      // ⛔ THE CONTROL. The page really loaded and really is this client's, so
      // "no Delete button" is a fact about permissions, not about a blank page.
      await expect(
        page.getByText(name, { exact: false }).first(),
        "the Coordinator can genuinely see this client",
      ).toBeVisible();

      // ⚠️ A Coordinator HOLDS manage_clients_all — they can read and edit. What
      // they must not have is the destructive op, which is Owner/Admin only.
      await expect(
        page.getByRole("link", { name: /^Edit$/ }),
        "control: they DO get the ordinary client controls",
      ).toBeVisible();

      await expect(
        page.getByRole("button", { name: /^Delete( client)?$/ }),
        "⛔ deleting a client is Owner/Admin only — the Coordinator must not be offered it",
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  // ── updateBookingAssignment ────────────────────────────────────────────
  test("E07-18b — a Therapist opens their own booking and cannot reassign it", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "therapist_a");
    try {
      await page.goto(`/admin/bookings/${bookingId}/`, { waitUntil: "domcontentloaded" });
      await expectRendered(page, "booking detail as Therapist");

      // ⛔ THE CONTROL. They are assigned to this visit and can see it.
      await expect(
        page.getByText(name, { exact: false }).first(),
        "the Therapist can genuinely see the booking they are assigned to",
      ).toBeVisible();

      // ⛔ `updateBookingAssignment` needs manage_bookings_all AND
      // assign_bookings. A Therapist holds NEITHER: they take work, they do not
      // hand it out. Both labels checked because the control renders as
      // "Reassign" when somebody is assigned and "Assign therapist" when not.
      await expect(
        page.getByRole("button", { name: /^(Reassign|Assign therapist)$/ }),
        "⛔ a Therapist must not be offered a control that moves work between people",
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  // ── updateStaffPermissionOverride ──────────────────────────────────────
  for (const role of ["coordinator", "therapist_a"] as const) {
    test(`E07-18c-${role} — ${role} opens a staff member and cannot change their permissions`, async ({
      browser,
    }) => {
      const { context, page } = await sessionFor(browser, role);
      try {
        // ⛔ A DIFFERENT staff member on purpose. The page swaps in a
        // "self overrides are disabled" panel for your own profile, which would
        // make the absence true for an entirely different reason.
        await page.goto(`/admin/staff/${THERAPIST_B_STAFF_ID}/`, {
          waitUntil: "domcontentloaded",
        });
        await expectRendered(page, `staff detail as ${role}`);

        // ⛔ THE CONTROL. `/admin/staff/` is in BOTH roles' allowed set — they
        // are meant to see the team. The question is only whether they are
        // offered the lever.
        await expect(
          page.getByRole("heading", { level: 1 }),
          "the staff page really rendered for this role",
        ).toBeVisible();

        await expect(
          page.getByRole("heading", { name: /Permission overrides/i }),
          "⛔ only a role holding manage_permission_overrides may be offered this",
        ).toHaveCount(0);
      } finally {
        await context.close();
      }
    });
  }
});
