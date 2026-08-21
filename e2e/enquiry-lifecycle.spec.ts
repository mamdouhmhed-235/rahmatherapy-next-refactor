// ⛔ GATE 08 PHASE P2 GROUP 3 — ENQUIRIES. Case E08-101, chosen by the Owner (D-026).
//
// An enquiry is the first thing that happens in this business: somebody rings, or
// messages on WhatsApp, and a member of staff writes them down before there is any
// booking, any client record, or any money. If that list loses people, the clinic
// loses work it never knew it had.
//
// ── ⛔ WHY THIS SPEC NEVER CREATES AN ENQUIRY THROUGH THE FORM ─────────────
//
// ⚠️ CREATING an enquiry EMAILS THE OWNER'S REAL BUSINESS INBOX. That is measured,
// not assumed, and it contradicts the plan note that said this group sends no mail:
//
//   createEnquiry -> sendEnquiryLoggedEmail -> resolveBusinessNotificationRecipients
//
// resolves every ACTIVE Owner/Admin whose business_notification_prefs.enabled is
// true. In production that is two rows, and one of them is `Minhaj rahman`
// <rahmatherapy@outlook.com> — the real inbox. `excludeStaffId` only drops the
// actor, and the harness may never sign in as a real person (D-017), so no actor
// this programme can use will exclude that recipient.
//
// ⛔ So the CREATE half is not run here. It is not skipped either — it is covered
// where it costs nothing:
//   - the permission gate, all four actor states, in
//     src/app/admin/__tests__/server-enforcement.test.ts (case 101), which mocks
//     the admin client and sends no mail at all;
//   - the email hook itself in enquiries/__tests__/createEnquiry.test.ts.
// The one thing left uncovered is the intake FORM's own rendering and submit, and
// that needs the Owner's say-so because it costs one real email. Recorded, not
// quietly dropped.
//
// ⛔ CHANGING A STATUS SENDS NOTHING. updateEnquiryStatus has no email path. That
// is what this spec drives, and it drives it through the real buttons.
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

async function destroyFixtures(db: SupabaseClient, ids: string[]) {
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
    if (db) await destroyFixtures(db, createdIds);
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
