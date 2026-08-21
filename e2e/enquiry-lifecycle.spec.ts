// ⛔ GATE 08 PHASE P2 GROUP 3 — ENQUIRIES. Case E08-101, chosen by the Owner (D-026).
//
// An enquiry is the first thing that happens in this business: somebody rings, or
// messages on WhatsApp, and a member of staff writes them down before there is any
// booking, any client record, or any money. If that list loses people, the clinic
// loses work it never knew it had.
//
// ── ⚠️⚠️ THIS SPEC SENDS ONE REAL EMAIL. READ BEFORE RUNNING IT. ───────────
//
// ⛔ TWO cases — E08-101h and E08-101i — submit the intake form for real, and that
// EMAILS THE OWNER'S REAL BUSINESS INBOX (rahmatherapy@outlook.com). The Owner was
// warned of precisely that and approved it (D-027). ⛔ Do not run this file as a
// casual "quick check".
//
// Why it cannot be avoided, measured rather than assumed:
//
//   createEnquiry -> sendEnquiryLoggedEmail -> resolveBusinessNotificationRecipients
//
// resolves every ACTIVE Owner/Admin whose business_notification_prefs.enabled is
// true. In production that is two rows, and one of them is `Minhaj rahman`
// <rahmatherapy@outlook.com> — the real inbox. `excludeStaffId` only drops the
// actor, and the harness may never sign in as a real person (D-017), so no actor
// this programme can use will exclude that recipient.
//
// ⚠️ The plan note carried into this group said it emails nobody. ⛔ That was WRONG,
// and it was caught by reading the code first rather than by mail arriving.
//
// ⛔ CHANGING A STATUS SENDS NOTHING. updateEnquiryStatus has no email path at all.
// That is why every OTHER case here inserts its fixture directly and drives only
// status changes — one email for the whole group, not eight.
//
// The create path is also covered where it costs nothing, and those cover the parts
// a browser cannot see:
//   - the permission gate, all four actor states, in
//     src/app/admin/__tests__/server-enforcement.test.ts (case 101), which mocks
//     the admin client and sends no mail at all;
//   - the email hook itself in enquiries/__tests__/createEnquiry.test.ts.
//
// ── The rule underneath, and it is a real business rule ────────────────────
//
// `first_contacted_at` is stamped ONLY on the FIRST move to `contacted`. It is
// what "how quickly do we get back to people" is measured from. If a later status
// edit re-stamped it, that number would silently become "time to the most recent
// fiddle" and would always look good. This spec takes an enquiry all the way
// around — new -> contacted -> closed -> reopened -> contacted — and asserts the
// timestamp never moved.
//
// ── Safety ────────────────────────────────────────────────────────────────
//
// ⛔ Approved to write by D-015. Fixtures are inserted directly (no email), named
// `ZZTEST-...-<run tag>`, and hard-deleted in an unconditional afterAll that also
// sweeps by the run-tag pattern, so a failing assertion still cleans up (G-25).
// ⚠️ The three enquiries already in production are NOT ZZTEST-prefixed, so the
// sweep cannot reach them.

import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { hasBaseUrl } from "./helpers";

const AUTH_DIR = "e2e/.auth";
const RUN_TAG = process.env.E2E_FIXTURE_TAG ?? String(process.pid);

/** Measured. The Coordinator the harness signs in as — selected by ID, never by name. */
const COORDINATOR_STAFF_ID = "998075ff-26fc-4451-9015-fadfbcd9f4df";
const REAL_BUSINESS_INBOX = "rahmatherapy@outlook.com";

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "E08-101 fixtures need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
        "Run via `pnpm test:e2e`, which passes --env-file=.env.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type EnquiryRow = {
  id: string;
  status: string;
  first_contacted_at: string | null;
};

async function createEnquiryFixture(db: SupabaseClient, label: string) {
  const name = `ZZTEST-Enq-${label}-${RUN_TAG}`;
  const { data, error } = await db
    .from("enquiries")
    .insert({
      full_name: name,
      // ⛔ `phone` is a valid `enquiries_source_check` value; `admin` is not.
      source: "phone",
      status: "new",
      phone: "07000000000",
      service_interest: "ZZTEST interest",
      notes: `ZZTEST fixture for E08-101, run ${RUN_TAG}`,
    })
    .select("id")
    .single();
  if (error || !data) {
    // ⛔ Loud. A half-built fixture makes "the therapist was refused" pass for
    // the wrong reason.
    throw new Error(`fixture insert into enquiries failed: ${error?.message}`);
  }
  return { id: (data as { id: string }).id, name };
}

/** Read the row back. ⛔ The database is the fact; the toast is not. */
async function readEnquiry(db: SupabaseClient, id: string): Promise<EnquiryRow> {
  const { data, error } = await db
    .from("enquiries")
    .select("id, status, first_contacted_at")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(`could not read enquiry ${id}: ${error?.message}`);
  return data as EnquiryRow;
}

async function destroyFixtures(db: SupabaseClient, ids: string[], emailRowIds: string[]) {
  // ⛔ The enquiry alert's delivery row carries a NULL booking_id, so nothing
  // cascades it away when the enquiry goes — it must be removed explicitly.
  // ⛔ BY COLLECTED ID, not by subject: the subject is a registry default that
  // may not contain the enquiry name at all, and a filter that silently matches
  // nothing would leak the row while looking like it worked.
  if (emailRowIds.length > 0) {
    await db.from("email_delivery_events").delete().in("id", emailRowIds);
  }
  // Sweep by this run's tag as well as by collected id — a test that failed
  // before pushing its id would otherwise leak a row (G-25).
  const { data: strays } = await db
    .from("enquiries")
    .select("id")
    .like("full_name", `ZZTEST-Enq-%-${RUN_TAG}`);
  const all = [...new Set([...ids, ...((strays ?? []) as { id: string }[]).map((r) => r.id)])];
  if (all.length === 0) return;
  await db.from("audit_logs").delete().in("target_id", all);
  await db.from("enquiries").delete().in("id", all);
}

async function sessionFor(browser: import("@playwright/test").Browser, role: string) {
  const statePath = `${AUTH_DIR}/${role}.json`;
  // ⛔ THROW, never skip. A signed-out browser is refused everywhere, which
  // would make every "was refused" assertion below pass while proving nothing.
  if (!fs.existsSync(statePath)) {
    throw new Error(
      `${statePath} is missing. Run: node scripts/mint-e2e-session.mjs --all --write`,
    );
  }
  const context = await browser.newContext({ storageState: statePath });
  return { context, page: await context.newPage() };
}

/** Open /admin/enquiries and say what the app did. */
async function openEnquiries(page: Page) {
  await page.goto(`/admin/enquiries/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  if (/\/admin\/login/.test(page.url())) return "redirected-to-login" as const;
  // ⛔ The component marker, never the copy (E08-19's false SECURITY finding).
  if ((await page.locator("[data-admin-access-denied]").count()) > 0) return "denied" as const;
  // ⛔ Next.js renders <h1>404</h1>, not "not found" — a classifier that misses
  // this reads a correct refusal as access granted, the alarming direction.
  if ((await page.getByRole("heading", { name: /^404$/ }).count()) > 0) {
    return "not-found" as const;
  }
  return "rendered" as const;
}

/**
 * The one `<li>` belonging to this enquiry.
 *
 * ⛔ Scoped, because every actionable row renders its own "Mark contacted" and
 * the production list is never empty — an unscoped match would click somebody
 * else's enquiry. The "More actions for <name>" trigger is the anchor because it
 * exists on EVERY non-converted row including closed ones, whereas the row
 * checkbox only renders for `new` and `contacted`.
 */
function enquiryRow(page: Page, name: string) {
  return page
    .locator("li")
    .filter({ has: page.getByRole("button", { name: `More actions for ${name}` }) });
}

/**
 * ⛔ RELOAD UNTIL THE LIST CATCHES UP. This is not paranoia padding — it is a
 * measured property of the page.
 *
 * `getEnquiriesListPage` is wrapped in `unstable_cache(..., { revalidate: 60,
 * tags: [TAGS.ENQUIRIES] })`. Only the server actions call `updateTag`, so a row
 * inserted straight into the database — which is how this spec avoids emailing
 * the real business inbox — does NOT invalidate anything. The page keeps serving
 * the old list until the revalidate window turns over.
 *
 * ⚠️ Measured, not assumed: a diagnostic run polled every 10s after a direct
 * insert and got `thisRow=0` at t=2s (still showing the PREVIOUS run's deleted
 * fixtures) and `thisRow=1` at t=14s. The first version of this spec asserted at
 * 400ms and failed for exactly this reason — the check could not have seen the
 * truth.
 *
 * The window is 60s, so the timeout is set well beyond it.
 */
async function waitForEnquiryRow(page: Page, name: string, timeoutMs = 150_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    if ((await enquiryRow(page, name).count()) > 0) return;
    if (Date.now() > deadline) {
      throw new Error(
        `${name} never appeared on /admin/enquiries within ${timeoutMs}ms. ` +
          "The row IS in the database (the fixture insert asserted that), so this " +
          "is a rendering or scoping failure, not a stale cache.",
      );
    }
    await page.waitForTimeout(5_000);
  }
}

/**
 * Click a control and wait for the server action to actually answer.
 *
 * ⛔ Never a fixed sleep (G-13). A slow reply would otherwise read as "the
 * status did not change" — the reassuring direction.
 */
async function clickAndAwaitAction(page: Page, click: () => Promise<void>) {
  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
    { timeout: 60_000 },
  );
  await click();
  await answered;
  // The row re-renders from the revalidated page after the action resolves.
  await page.waitForTimeout(800);
}

test.describe("gate 08 P2 group 3 — an enquiry through the real buttons (E08-101)", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });
  // ⚠️ The dev server compiles each route on first visit. Not a performance
  // statement — gate 14 owns speed and measures the built site.
  test.setTimeout(300_000);

  const db = hasBaseUrl() ? serviceClient() : (null as unknown as SupabaseClient);

  let lifecycle: { id: string; name: string };
  let refused: { id: string; name: string };
  const createdIds: string[] = [];
  /** Delivery rows this run caused, collected so teardown can remove them by id. */
  const createdEmailRowIds: string[] = [];
  /** Captured at the first move to `contacted`, then defended for the rest of the run. */
  let firstContactedAt: string | null = null;

  test.beforeAll(async () => {
    lifecycle = await createEnquiryFixture(db, "Lifecycle");
    refused = await createEnquiryFixture(db, "Refused");
    createdIds.push(lifecycle.id, refused.id);

    // ⛔ Prove the fixture is what the tests assume BEFORE any of them run. A
    // fixture that arrived already `contacted` would make the idempotency
    // assertion below pass without the guard existing.
    const seeded = await readEnquiry(db, lifecycle.id);
    expect(seeded.status, "fixture starts as new").toBe("new");
    expect(seeded.first_contacted_at, "fixture starts un-contacted").toBeNull();
  });

  test.afterAll(async () => {
    // Unconditional — a failed assertion above must not leave rows behind.
    if (db) await destroyFixtures(db, createdIds, createdEmailRowIds);
  });

  test("E08-101a — a Coordinator can open Enquiries and the new enquiry is listed", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      expect(await openEnquiries(page), "the Coordinator holds manage_enquiries").toBe(
        "rendered",
      );

      // ⛔ A per-row CONTROL, not page text. Any list surface echoes its own
      // filters and Next ships an RSC payload in a <script>, so matching the
      // name as text can "find" a record that is not rendered at all (G-12).
      await waitForEnquiryRow(page, lifecycle.name);
      await expect(
        enquiryRow(page, lifecycle.name),
        "the enquiry has a row of its own",
      ).toHaveCount(1);

      // ⛔ Non-vacuity for the row anchor itself: a `new` enquiry is bulk-
      // actionable, so its checkbox must be there too. If the anchor ever
      // matched something that was not a row, this would not hold.
      await expect(
        enquiryRow(page, lifecycle.name).locator(`[aria-label="Select ${lifecycle.name}"]`),
        "and it is a real, actionable row",
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("E08-101b — 'Mark contacted' moves the enquiry AND stamps first_contacted_at", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      expect(await openEnquiries(page)).toBe("rendered");
      await waitForEnquiryRow(page, lifecycle.name);

      const markContacted = enquiryRow(page, lifecycle.name).getByRole("button", {
        name: /^Mark contacted$/,
      });
      await expect(markContacted, "a NEW enquiry offers 'Mark contacted'").toBeVisible();

      await clickAndAwaitAction(page, () => markContacted.click());

      // ⛔ Assert what the DATABASE did. The toast is what the page SAID.
      const after = await readEnquiry(db, lifecycle.id);
      expect(after.status, "status moved to contacted").toBe("contacted");
      expect(
        after.first_contacted_at,
        "the first contact was timestamped — this is what response-time is measured from",
      ).not.toBeNull();

      firstContactedAt = after.first_contacted_at;

      // The audit trail must name who did it and what changed.
      const { data: audit } = await db
        .from("audit_logs")
        .select("action_type, before_state, after_state")
        .eq("target_id", lifecycle.id)
        .eq("action_type", "enquiry_status_updated");
      const entries = (audit ?? []) as Array<{
        before_state: { status?: string } | null;
        after_state: { status?: string } | null;
      }>;
      expect(entries.length, "the status change was audited").toBeGreaterThan(0);
      expect(
        entries.some((e) => e.before_state?.status === "new" && e.after_state?.status === "contacted"),
        "the audit entry records new -> contacted",
      ).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("E08-101c — 'Close enquiry' closes it", async ({ browser }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      expect(await openEnquiries(page)).toBe("rendered");
      await waitForEnquiryRow(page, lifecycle.name);

      const row = enquiryRow(page, lifecycle.name);
      await clickAndAwaitAction(page, async () => {
        await row.getByRole("button", { name: `More actions for ${lifecycle.name}` }).click();
        await row.getByRole("button", { name: /^Close enquiry$/ }).click();
      });

      expect((await readEnquiry(db, lifecycle.id)).status, "the enquiry is closed").toBe(
        "closed",
      );
    } finally {
      await context.close();
    }
  });

  test("E08-101d — a closed enquiry can be reopened as new", async ({ browser }) => {
    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      expect(await openEnquiries(page)).toBe("rendered");

      // ⛔ A closed row lives on the "Closed" tab, not the default view.
      await page.goto(`/admin/enquiries/?tab=closed`, { waitUntil: "domcontentloaded" });
      await waitForEnquiryRow(page, lifecycle.name);

      const row = enquiryRow(page, lifecycle.name);
      await clickAndAwaitAction(page, async () => {
        await row.getByRole("button", { name: `More actions for ${lifecycle.name}` }).click();
        await row.getByRole("button", { name: /^Reopen as new$/ }).click();
      });

      expect(
        (await readEnquiry(db, lifecycle.id)).status,
        "a mistakenly-closed enquiry is recoverable",
      ).toBe("new");
    } finally {
      await context.close();
    }
  });

  test("E08-101e — contacting it a SECOND time does not re-stamp first_contacted_at", async ({
    browser,
  }) => {
    // ⛔ THE RULE THIS GROUP EXISTS FOR. If a later status edit re-stamped this,
    // "how quickly do we get back to people" would silently measure the most
    // recent edit instead of the original contact, and would always look good.
    expect(
      firstContactedAt,
      "E08-101b must have captured the original timestamp for this to mean anything",
    ).not.toBeNull();

    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      expect(await openEnquiries(page)).toBe("rendered");
      await waitForEnquiryRow(page, lifecycle.name);

      const markContacted = enquiryRow(page, lifecycle.name).getByRole("button", {
        name: /^Mark contacted$/,
      });
      await expect(markContacted, "the reopened enquiry offers 'Mark contacted' again").toBeVisible();

      await clickAndAwaitAction(page, () => markContacted.click());

      const after = await readEnquiry(db, lifecycle.id);
      expect(after.status, "it is contacted again").toBe("contacted");
      expect(
        after.first_contacted_at,
        "the ORIGINAL first-contact time survived a full close/reopen/re-contact cycle",
      ).toBe(firstContactedAt);
    } finally {
      await context.close();
    }
  });

  test("E08-101f — a Therapist is refused the Enquiries page outright", async ({ browser }) => {
    const { context, page } = await sessionFor(browser, "therapist_a");
    try {
      const outcome = await openEnquiries(page);
      // ⛔ Refusals come in more than one shape; openEnquiries knows three. Any
      // of them is a refusal, "rendered" is not.
      expect(outcome, "a Therapist does not hold manage_enquiries").not.toBe("rendered");

      // ⛔ And prove the probe could have seen the truth: the same helper, the
      // same session file mechanism, returns "rendered" for the Coordinator in
      // E08-101a. A therapist_a.json that had simply expired would land on
      // /admin/login, which this distinguishes.
      expect(outcome, "refused by permission, not by an expired session").toBe("denied");
    } finally {
      await context.close();
    }
  });

  test("E08-101h — a Coordinator records a new enquiry on the real intake form", async ({
    browser,
  }) => {
    // ⚠️⚠️ THIS CASE SENDS ONE REAL EMAIL TO THE BUSINESS INBOX. ⚠️⚠️
    //
    // ⛔ The Owner was warned of exactly this and approved it (D-027). Do not
    // run this spec casually — it is the only case here that sends mail, and
    // the recipient is a real person's inbox, not a test address.
    //
    // Everything else in this file inserts its fixtures directly to avoid that.
    // This one case exists because the intake form is the surface a receptionist
    // actually types into, and D-023 says prove the FORM once.
    const name = `ZZTEST-Enq-Intake-${RUN_TAG}`;
    const runStartedAt = new Date(Date.now() - 60_000).toISOString();

    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      expect(await openEnquiries(page)).toBe("rendered");

      // ⛔ The panel is `hidden lg:block` — visible on this desktop viewport
      // without touching the mobile "Record new enquiry" toggle. Asserting it
      // is visible first means a layout change cannot make the fills silently
      // no-op.
      const form = page.locator("#enquiry-intake-panel");
      await expect(form, "the intake panel is on the page").toBeVisible();

      // ⛔ These fields DO carry real `name` attributes — unlike the booking
      // wizard, whose visible controls carry none. Addressed by label anyway,
      // which is what a receptionist sees.
      await form.getByLabel(/^Full name/i).fill(name);
      await form.getByLabel(/^Source/i).selectOption("phone");
      await form.getByLabel(/^Phone/i).fill("07000000001");
      await form.getByLabel(/^Email/i).fill(`zztest-intake-${RUN_TAG}@example.test`);
      await form.getByLabel(/^Service interest/i).fill("ZZTEST Hijama enquiry");
      await form.getByLabel(/notes/i).fill(`ZZTEST intake for E08-101h, run ${RUN_TAG}`);

      await clickAndAwaitAction(page, () =>
        form.getByRole("button", { name: /^Record enquiry$/ }).click(),
      );

      // ⛔ The DATABASE is the fact. The form's own success state is not.
      const { data: created } = await db
        .from("enquiries")
        .select("id, full_name, source, status, phone, service_interest, created_by_staff_id")
        .eq("full_name", name)
        .maybeSingle();
      expect(created, "the receptionist's enquiry was actually recorded").not.toBeNull();

      const row = created as {
        id: string;
        source: string;
        status: string;
        phone: string | null;
        service_interest: string | null;
        created_by_staff_id: string | null;
      };
      createdIds.push(row.id);

      expect(row.status, "a new enquiry starts as new").toBe("new");
      expect(row.source, "the source they chose was kept").toBe("phone");
      expect(row.phone, "the phone number was kept — it is how the clinic rings back").toBe(
        "07000000001",
      );
      expect(row.service_interest).toBe("ZZTEST Hijama enquiry");
      // ⛔ Selected by staff ID, never by name (the identity trap).
      expect(
        row.created_by_staff_id,
        "the enquiry is attributed to the member of staff who took it",
      ).toBe(COORDINATOR_STAFF_ID);

      // The audit trail must record the creation too.
      const { data: audit } = await db
        .from("audit_logs")
        .select("action_type")
        .eq("target_id", row.id)
        .eq("action_type", "enquiry_created");
      expect((audit ?? []).length, "the creation was audited").toBeGreaterThan(0);

      // ⛔ AND THE ALERT ACTUALLY WENT OUT — to the real business inbox.
      //
      // ⚠️ Asserting a row EXISTS proves only that the app TRIED: `failed` and
      // `skipped` live in the same table. So the status is asserted explicitly.
      // ⛔ Success is `accepted`, NOT `sent`.
      const { data: emails } = await db
        .from("email_delivery_events")
        .select("id, event_type, to_email, recipient_email, delivery_status, subject")
        .eq("event_type", "enquiry_logged")
        .gte("created_at", runStartedAt);
      const all = (emails ?? []) as Array<{
        id: string;
        to_email: string | null;
        recipient_email: string | null;
        delivery_status: string;
      }>;
      // ⛔ Collected BEFORE the assertions below, so a failing one still tears
      // its rows down (G-25).
      createdEmailRowIds.push(...all.map((e) => e.id));
      const sent = all.filter((e) => (e.to_email ?? e.recipient_email ?? "").length > 0);

      expect(sent.length, "an enquiry alert was attempted").toBeGreaterThan(0);
      expect(
        sent.every((e) => e.delivery_status === "accepted"),
        `every enquiry alert was accepted by the provider, not failed or skipped ` +
          `(saw: ${sent.map((e) => e.delivery_status).join(", ")})`,
      ).toBe(true);
      expect(
        sent.some((e) => (e.to_email ?? e.recipient_email) === REAL_BUSINESS_INBOX),
        "the business is told about a new enquiry — this is the whole point of the alert",
      ).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("E08-101i — a phone enquiry with NO email address is still recorded", async ({
    browser,
  }) => {
    // ⚠️⚠️ THIS CASE ALSO SENDS ONE REAL EMAIL — it creates an enquiry. Covered by
    // the same Owner approval (D-027). Two emails total from this file.
    //
    // ── FIND-08-C, and ⛔ A PREDICTION I MADE HERE WAS WRONG ───────────────
    //
    // This case was first written to assert the OPPOSITE — that the caller is
    // LOST — reasoning from the markup: the Email field carried `required` and a
    // red `*`, while the server schema has email OPTIONAL and the hint under
    // Phone reads "Either phone or email helps you reply." That looked exactly
    // like FIND-08-B, where a `required` attribute silently blocked a submit the
    // server would have accepted.
    //
    // ⛔ IT WAS NOT. The database said so — the enquiry WAS created. Asserting
    // what the DATABASE DID rather than what the markup implied is the only
    // reason this did not become a false finding, the eighth of this run.
    //
    // The `required` marker was **inert**: React drives this form through a
    // server action, so native constraint validation never gates the submit.
    // Measured — the browser reported `validity.valueMissing === true` and the
    // row appeared anyway. So the asterisk told staff email was mandatory while
    // the form cheerfully accepted it empty.
    //
    // ✅ FIND-08-C is now FIXED: the Owner confirmed that admin-side booking and
    // intake must accept a missing email, so the marker was removed and the
    // enquiry form matches the manual booking wizard and both client forms.
    //
    // ⛔ This case guards BOTH halves — that the field is no longer advertised as
    // required, AND that a phone-only caller is actually recorded. The second
    // without the first would let the misleading asterisk come back unnoticed.
    //
    // ⛔ The CUSTOMER-FACING booking form still requires a real address
    // (`booking-schema.ts`, `z.email(...)`) and must NOT be changed to match.
    const name = `ZZTEST-Enq-NoEmail-${RUN_TAG}`;
    const runStartedAt = new Date(Date.now() - 60_000).toISOString();

    const { context, page } = await sessionFor(browser, "coordinator");
    try {
      expect(await openEnquiries(page)).toBe("rendered");
      const form = page.locator("#enquiry-intake-panel");
      await expect(form).toBeVisible();

      await form.getByLabel(/^Full name/i).fill(name);
      await form.getByLabel(/^Source/i).selectOption("phone");
      await form.getByLabel(/^Phone/i).fill("07000000002");
      await form.getByLabel(/^Service interest/i).fill("ZZTEST phone-only enquiry");
      // Email deliberately left empty — the caller would not give one.

      const emailInput = form.getByLabel(/^Email/i);
      // ⛔ FIND-08-C's regression guard. Email must NOT be advertised as
      // mandatory on an admin intake form.
      expect(
        await emailInput.evaluate((el) => (el as HTMLInputElement).required),
        "the admin enquiry form must not mark email as required",
      ).toBe(false);
      // ⛔ And the visible half — no red asterisk in the label. The `required`
      // attribute and the `*` are rendered from the SAME prop, so checking only
      // the attribute would still pass if the marker were reintroduced by hand.
      expect(
        await form
          .locator(`label[for="${await emailInput.getAttribute("id")}"]`)
          .textContent(),
        "and staff are not told it is mandatory",
      ).toBe("Email");

      await clickAndAwaitAction(page, () =>
        form.getByRole("button", { name: /^Record enquiry$/ }).click(),
      );

      // THE BUSINESS OUTCOME:
      const { data: created } = await db
        .from("enquiries")
        .select("id, phone, email, source, status")
        .eq("full_name", name)
        .maybeSingle();
      // ⛔ Collected BEFORE the assertions, so a failure still tears it down.
      if (created) createdIds.push((created as { id: string }).id);

      expect(
        created,
        "a caller who would not give an email address was still written down",
      ).not.toBeNull();
      const row = created as { phone: string | null; email: string | null; status: string };
      expect(row.phone, "the phone number — the only way to reach them — was kept").toBe(
        "07000000002",
      );
      expect(row.email, "and no email was invented").toBeNull();
      expect(row.status).toBe("new");

      // This create also alerts the business. Collect its delivery rows so
      // teardown removes them.
      const { data: emails } = await db
        .from("email_delivery_events")
        .select("id")
        .eq("event_type", "enquiry_logged")
        .gte("created_at", runStartedAt);
      createdEmailRowIds.push(...((emails ?? []) as { id: string }[]).map((e) => e.id));
    } finally {
      await context.close();
    }
  });

  test("E08-101g — a Therapist is not even offered Enquiries in the navigation", async ({
    browser,
  }) => {
    const { context, page } = await sessionFor(browser, "therapist_a");
    try {
      await page.goto(`/admin/dashboard/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);
      const nav = page.locator('nav[aria-label="Admin navigation"]:visible');
      await expect(nav, "the therapist has an admin nav at all").toBeVisible();
      await expect(
        nav.getByRole("link", { name: /Enquiries/i }),
        "no affordance is offered for a page the server would refuse",
      ).toHaveCount(0);

      // ⛔ Non-vacuity: this nav is not simply empty. The Therapist strip is
      // My day / My bookings / Team — measured, and the plans were wrong about
      // it once already.
      await expect(
        nav.getByRole("link", { name: /My bookings/i }),
        "the nav really did render",
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
