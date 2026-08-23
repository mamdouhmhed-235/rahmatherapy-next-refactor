// ⛔ GATE 08 — P3, FAMILY B, SCENARIO B5: THE REGULAR CUSTOMER.
//
//   ⛔ The Owner's question: "Can I run a repeat client without cancelling the
//    wrong appointments?"
//
// A standing weekly booking. One week the client cannot make it, so that ONE
// visit is cancelled. Later they stop altogether, so the whole series ends.
// ⛔ Both times, the appointments that should NOT be touched must survive —
// especially the ones that have already happened. A visit the client has had
// and paid for must never be retro-cancelled by ending the arrangement.
//
// ── ⛔ THE TRAP THIS SCENARIO IS BUILT TO AVOID ──────────────────────────
//
// Session H wrote a "past visit is untouched" assertion that was VACUOUS: its
// past visit was ALSO `completed`, and the cancel cascade excludes on status
// AND date — so the date guard could have been deleted outright with every test
// still green. It was proven inert by probe.
//
// ⛔ So this fixture carries BOTH:
//   - a past visit that is COMPLETED (the ordinary case), and
//   - ⛔ a past visit that is still PENDING — excluded ONLY by the date guard.
// If the date guard ever disappears, the second one gets cancelled and this
// scenario goes red. With only the completed one, it could not.
//
// ── ⛔ WHY THE SERIES IS SEEDED THROUGH THE REAL RPC ─────────────────────
//
// D-023: prove the FORM once, then test the RULES underneath.
// `booking-recurring-series.spec.ts` already drives the creation wizard in a
// browser (4 cases). B5 is about the CANCELLATION semantics, so the series is
// created by calling `create_recurring_booking_series` — the same function the
// wizard calls, writing the same rows. ⚠️ The database cannot send mail at all
// (`pg_net`, `http` and `pg_cron` are not installed), so seeding costs nothing.
//
// ── ⛔ EMAIL COST: ONE message to the real business inbox ────────────────
// Cancelling a single visit is an ordinary booking cancellation and reaches the
// business recipients. ✅ Series-level emails are CUSTOMER-ONLY and carry
// `booking_id: null` — they are addressable only by recipient address, which is
// why the shared teardown sweeps `email_delivery_events` by recipient too.

import { expect, test } from "@playwright/test";
import {
  awaitAction,
  destroyScenarioFixtures,
  gotoAdmin,
  isoDaysFromToday,
  pageAs,
  readBooking,
  REAL_OWNER_INBOX,
  RUN_TAG,
  serviceClient,
  testInbox,
  THERAPIST_A_STAFF_ID,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const CLIENT_NAME = `ZZTEST-B5-${RUN_TAG}`;
const ADMIN_STAFF_ID = "97310f6b-4e2f-4a9f-bec1-20224e57d8e6";

let clientId = "";
let templateId = "";
/** Every visit in the series, oldest first. */
let visits: { id: string; booking_date: string; status: string }[] = [];

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (!clientId) return;
  await destroyScenarioFixtures(serviceClient(), [clientId]);
});

async function readSeries(db: ReturnType<typeof serviceClient>) {
  const { data } = await db
    .from("bookings")
    .select("id, booking_date, status")
    .eq("recurring_template_id", templateId)
    .order("booking_date", { ascending: true });
  return (data ?? []) as { id: string; booking_date: string; status: string }[];
}

test.describe("B5 — the regular customer: can I end an arrangement without wrecking its history?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — a weekly standing booking, with history behind it", async () => {
    const db = serviceClient();

    const { data: client, error: clientError } = await db
      .from("clients")
      .insert({
        full_name: CLIENT_NAME,
        email: testInbox("b5"),
        phone: `076${String(Number(RUN_TAG) % 1_000_000).padStart(6, "0")}`,
        gender_preference: "female",
        postcode: "LU1 1AA",
        client_source: "manual",
      })
      .select("id")
      .single();
    expect(clientError, `could not seed the client: ${clientError?.message}`).toBeNull();
    clientId = (client as { id: string }).id;

    // ⛔ The RPC REFUSES a first occurrence in the past, so the series starts in
    // the future and the history is created by moving the first two visits back
    // afterwards. That is the passage of time, stated rather than hidden.
    const { data: result, error } = await db.rpc("create_recurring_booking_series", {
      p_client_id: clientId,
      p_service_slug: "hijama-package",
      p_first_occurrence_date: isoDaysFromToday(7),
      p_anchor_start_time: "10:00",
      p_cadence: "weekly",
      // ⛔ Measured from the deployed function body: the only accepted values
      // are 'until_cancelled', 'after_count' and 'until_date'. "count" is
      // refused with `Invalid end type: count`.
      p_end_type: "after_count",
      p_end_count: 4,
      p_participant_gender: "female",
      p_required_therapist_gender: "female",
      p_actor_staff_id: ADMIN_STAFF_ID,
      p_service_address_line1: "1 ZZTEST Street",
      p_service_postcode: "LU1 1AA",
      p_service_city: "Luton",
    });
    expect(error, `the series RPC refused: ${error?.message}`).toBeNull();
    templateId = String((result as { templateId?: string })?.templateId ?? "");
    expect(templateId, "the RPC should return the new series' id").toBeTruthy();

    visits = await readSeries(db);
    expect(
      visits,
      "⛔ a four-visit weekly arrangement must actually produce four appointments",
    ).toHaveLength(4);

    // ── ⛔ MANUFACTURE THE HISTORY, INCLUDING THE NON-VACUOUS CASE ─────
    // visit 1: past AND completed — the ordinary "already had it" case.
    await db
      .from("bookings")
      .update({ booking_date: isoDaysFromToday(-14), status: "completed" })
      .eq("id", visits[0].id);
    // ⛔ visit 2: past but STILL PENDING. Nothing but the DATE guard keeps this
    // one out of the cancel cascade. Without it the guard could be deleted and
    // every assertion here would still pass.
    await db
      .from("bookings")
      .update({ booking_date: isoDaysFromToday(-7), status: "pending" })
      .eq("id", visits[1].id);

    visits = await readSeries(db);
    expect(visits.map((v) => v.status)).toEqual(["completed", "pending", "pending", "pending"]);
  });

  test("step 2 — one week is cancelled, and only that week", async ({ browser }) => {
    expect(templateId).toBeTruthy();
    const db = serviceClient();

    const target = visits[2]; // the next FUTURE visit
    const untouched = visits.filter((v) => v.id !== target.id);

    const { context, page } = await pageAs(browser, "admin");
    await gotoAdmin(page, `/admin/bookings/${target.id}/`, "one visit in the series");
    await expect(page.locator("#booking-status-form")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: /^Cancel booking$/ }).first().click();
    await page.waitForTimeout(800);
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: /^Cancel booking$/ });
    if ((await confirm.count()) > 0) {
      await awaitAction(page, async () => {
        await confirm.first().click();
      });
    } else {
      await page.waitForTimeout(2_000);
    }
    await context.close();

    const after = await readSeries(db);
    const cancelled = after.find((v) => v.id === target.id);
    expect(
      cancelled?.status,
      "the week the client cannot make must actually be cancelled",
    ).toBe("cancelled");

    // ── ⛔ AND NOTHING ELSE ────────────────────────────────────────────
    for (const visit of untouched) {
      const now = after.find((v) => v.id === visit.id);
      expect(
        now?.status,
        `⛔ cancelling ONE week also changed the visit on ${visit.booking_date} (${visit.status} -> ${now?.status}). A client missing one week must not lose the rest of their arrangement.`,
      ).toBe(visit.status);
    }

    visits = after;
  });

  test("step 3 — the whole arrangement ends, and the past is preserved", async ({ browser }) => {
    expect(templateId).toBeTruthy();
    const db = serviceClient();
    const before = await readSeries(db);

    const { context, page } = await pageAs(browser, "admin");
    // ✅ The series page is NOT cached — verified in session H.
    await gotoAdmin(page, `/admin/bookings/series/${templateId}/`, "the series page");

    await page.getByRole("button", { name: /^Cancel entire series$/i }).first().click();
    await page.waitForTimeout(1_000);
    // ⛔ The modal's confirm shares the trigger's accessible name. Scope to the
    // dialog or the second click lands back on the trigger.
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: /^Cancel entire series$/i });
    await expect(
      confirm,
      "ending a standing arrangement should ask before it acts",
    ).toHaveCount(1, { timeout: 15_000 });
    await awaitAction(page, async () => {
      await confirm.first().click();
    });
    await context.close();

    const after = await readSeries(db);
    const byId = Object.fromEntries(after.map((v) => [v.id, v]));

    for (const visit of before) {
      const now = byId[visit.id];
      const isPast = visit.booking_date < isoDaysFromToday(0);

      if (isPast) {
        // ── ⛔ THE ASSERTION SESSION H'S FIXTURE COULD NOT MAKE ────────
        expect(
          now.status,
          `⛔ ending the arrangement retro-cancelled the visit on ${visit.booking_date}, which had already happened (it was "${visit.status}"). ` +
            `A visit the client has already had must never be rewritten by ending the arrangement — it is in their history and in the revenue figures.`,
        ).toBe(visit.status);
      } else if (visit.status !== "cancelled") {
        expect(
          now.status,
          `⛔ the future visit on ${visit.booking_date} should have been cancelled with the series, and was not — the client would still be expecting a therapist`,
        ).toBe("cancelled");
      }
    }

    // The already-cancelled week stays cancelled, not resurrected.
    const alreadyCancelled = before.filter((v) => v.status === "cancelled");
    for (const visit of alreadyCancelled) {
      expect(byId[visit.id].status, "an already-cancelled week stays cancelled").toBe("cancelled");
    }

    const { data: template } = await db
      .from("recurring_booking_templates")
      .select("cancelled_at")
      .eq("id", templateId)
      .single();
    expect(
      (template as { cancelled_at: string | null })?.cancelled_at,
      "⛔ the arrangement itself must be marked ended, or the nightly job keeps creating new visits for a client who has stopped",
    ).not.toBeNull();

    console.log(
      `\n[B5] COMPLETE. ${after.map((v) => `${v.booking_date}:${v.status}`).join("  ")}\n`,
    );
  });

  test("step 4 — the email ledger for the whole arrangement", async () => {
    expect(clientId).toBeTruthy();
    const db = serviceClient();

    // ⛔ SCOPE THE QUERY TO THIS SCENARIO.
    //
    // ⚠️ `email_delivery_events` holds every message the clinic has ever sent,
    // and `rahmatherapy@outlook.com` is on a great many of them. Filtering by
    // that address ALONE counts the whole run's history and reports a leak that
    // is not there — which is exactly what the first version of this step did.
    //
    // ⛔ Two scopes are needed, because series-level messages carry
    // `booking_id: null` and are addressable ONLY by recipient address:
    //   1. anything attached to one of THIS series' visits;
    //   2. anything addressed to THIS client's unique test address.
    const visitIds = (await readSeries(db)).map((v) => v.id);

    const { data: byBooking } = await db
      .from("email_delivery_events")
      .select("id, event_type, recipient_email, recipient_role, delivery_status, booking_id")
      .in("booking_id", visitIds);

    const { data: byRecipient } = await db
      .from("email_delivery_events")
      .select("id, event_type, recipient_email, recipient_role, delivery_status, booking_id")
      .eq("recipient_email", testInbox("b5"));

    type EmailRow = {
      id: string;
      event_type: string;
      recipient_email: string | null;
      delivery_status: string;
    };
    const seen = new Set<string>();
    const events = [
      ...((byBooking ?? []) as unknown as EmailRow[]),
      ...((byRecipient ?? []) as unknown as EmailRow[]),
    ].filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });

    const toOwner = events.filter((e) => e.recipient_email === REAL_OWNER_INBOX);
    expect(
      toOwner.length,
      `⛔ only the ONE single-visit cancellation should reach the business inbox — series-level messages are customer-only. It holds ${toOwner.length}: ${toOwner.map((e) => e.event_type).join(", ")}`,
    ).toBeLessThanOrEqual(1);

    console.log(
      `\n[B5] emails: ${events.map((e) => `${e.event_type}->${e.recipient_email}(${e.delivery_status})`).join(", ")}\n`,
    );
  });
});
