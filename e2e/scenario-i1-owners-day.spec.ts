// ⛔ GATE 08 — P3, FAMILY I, SCENARIO I1: THE OWNER'S DAY.
//
//   ⛔ The Owner's question: "Can the person who owns this business actually run
//    it from these screens?"
//
// ── ⛔ THIS FAMILY IS SCORED DIFFERENTLY, AND THAT IS DELIBERATE ─────────
//
// Every other family asks "is this correct?". Family I asks "is this USABLE?" —
// so its findings are recorded as FRICTION, not as defects. ⚠️ "It works, but it
// takes six clicks and a back button" is a real answer to the Owner's question
// and is reported as one.
//
// ⛔ SO THIS FILE ASSERTS ONLY ON GENUINE BLOCKERS — a step the Owner cannot
// complete at all — and MEASURES everything else. A scenario that failed on
// clumsiness would be making a judgement that belongs to the Owner.
//
// ── ⛔ WHAT "COHESIVE" IS MEASURED AS ────────────────────────────────────
//
// The day is walked BY CLICKING, the way a person does — the top nav first, then
// the account menu where the less-daily pages deliberately live. ⚠️ Only a step
// reachable by NEITHER is recorded as friction, because an Owner cannot type
// `/admin/reports` from memory on a Tuesday morning.
//
// ⛔ The number of CLICKS is recorded either way, since "two clicks via a menu"
// and "one click from the top bar" are different answers to the Owner's
// question even though both work.
//
// ── ⛔ EMAIL COST: ZERO. The Owner's day here is reading, not sending.

import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  isoDaysFromToday,
  pageAs,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
const friction: string[] = [];
const reached: string[] = [];
let todaysVisit: SeededBooking;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

/**
 * Get somewhere the way a person does: the top nav first, then the account
 * menu, and only then the address bar.
 *
 * ⚠️ I NEARLY REPORTED FRICTION THAT DOES NOT EXIST. A first version looked only
 * for a VISIBLE top-nav link and duly recorded "no link to Reports / Settings /
 * the audit trail — had to type the address". ⛔ That was wrong, and the reason
 * is worth writing down.
 *
 * `AdminTopNav` deliberately shows FIVE primary items — dashboard, bookings,
 * clients, enquiries, staff — and puts everything else in a grouped account
 * menu: Scheduling, Communications, Clinic Setup, **Reporting**, **Admin &
 * Compliance**. The cap is a stated design rule, and the source carries the
 * reasoning for THIS clinic:
 *
 *     "H10 swap (2026-05-21): reports → overflow, enquiries → primary, because
 *      for the small-clinic Owner enquiry triage is a daily [task]"
 *
 * ✅ So those pages are one menu click away, by a decision made for this Owner.
 * ⛔ Reporting that as friction would have been the eighth finding this run to
 * die on checking — and this one would have argued for undoing a considered
 * design choice.
 *
 * The fallback to typing an address is KEPT, because if a page ever becomes
 * genuinely unreachable the day should still continue and say so.
 */
async function navigate(page: Page, linkName: RegExp, url: string, what: string) {
  // 1. The top nav — the five things this Owner does every day.
  const top = page.getByRole("link", { name: linkName }).first();
  if ((await top.count()) > 0 && (await top.isVisible().catch(() => false))) {
    await top.click();
    await page.waitForTimeout(2_500);
    if (!/\/admin\/login/.test(page.url())) {
      reached.push(`${what} — one click, from the top nav`);
      return;
    }
  }

  // 2. The account menu, where the rest lives by design.
  const menuButton = page.getByRole("button", { name: /account menu/i }).first();
  if ((await menuButton.count()) > 0 && (await menuButton.isVisible().catch(() => false))) {
    await menuButton.click();
    await page.waitForTimeout(1_200);
    const item = page.getByRole("menuitem", { name: linkName }).first();
    if ((await item.count()) > 0) {
      await item.click();
      await page.waitForTimeout(2_500);
      if (!/\/admin\/login/.test(page.url())) {
        reached.push(`${what} — two clicks, via the account menu`);
        return;
      }
    }
    await page.keyboard.press("Escape").catch(() => {});
  }

  // 3. Genuinely unreachable by clicking. THIS is friction.
  friction.push(
    `${what}: not reachable from the top nav OR the account menu — had to type "${url}"`,
  );
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_500);
  reached.push(`${what} — reached only by typing the address`);
}

async function bodyOf(page: Page) {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

test.describe("I1 — the Owner's day: can they run the business from these screens?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("an uninterrupted morning: dashboard → today → a report → settings → the audit trail", async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const db = serviceClient();

    // ⛔ A day with something in it. An empty clinic would make every screen
    // "work" by having nothing to get wrong.
    todaysVisit = await seedWebsiteBooking(db, "I1-TODAY", {
      dayOffset: 0,
      startTime: "10:00:00",
      status: "confirmed",
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(todaysVisit.clientId);

    const later = await seedWebsiteBooking(db, "I1-LATER", {
      dayOffset: 3,
      startTime: "15:00:00",
      status: "pending",
    });
    clientIds.push(later.clientId);

    const { context, page } = await pageAs(browser, "owner");

    // ── 1. He starts where he lands ────────────────────────────────────
    // ⛔ `/admin/` is a REDIRECT STUB — measured at 155 characters before it
    // forwards. Reading it immediately reports "the Owner's first screen is
    // empty", which is false and would have been an embarrassing finding. The
    // redirect is followed the way a browser follows it.
    await page.goto("/admin/", { waitUntil: "domcontentloaded" });
    let landing = "";
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await page.waitForTimeout(2_000);
      landing = await bodyOf(page);
      if (landing.length > 200) break;
      await page.waitForTimeout(1_000);
    }
    console.log(`[I1] the front door settled at ${page.url()}`);
    expect(
      /\/admin\/login/.test(page.url()),
      "⛔ the Owner must be able to open his own admin",
    ).toBe(false);
    expect(
      landing.length,
      "⛔ THE OWNER'S FIRST SCREEN IS EMPTY. There is nowhere to start the day.",
    ).toBeGreaterThan(200);
    reached.push("the admin front door — opened directly");

    // ⛔ Does the first screen tell him anything about TODAY? An owner opening
    // his business should not have to go looking for what is happening now.
    const mentionsToday = /today|upcoming|next visit|this week/i.test(landing);
    if (!mentionsToday) {
      friction.push(
        "the first screen says nothing about today — the Owner has to go looking for what is happening now",
      );
    }

    // ── 2. Today's bookings ────────────────────────────────────────────
    await navigate(page, /^Bookings$/i, "/admin/bookings/", "today's bookings");
    const bookings = await bodyOf(page);
    expect(
      /\/admin\/login/.test(page.url()),
      "⛔ the Owner was signed out on the way to his own bookings",
    ).toBe(false);
    expect(
      bookings.length,
      "⛔ THE BOOKINGS SCREEN IS EMPTY FOR THE OWNER.",
    ).toBeGreaterThan(200);

    // ⛔ HE CLICKS "TODAY", BECAUSE THE DEFAULT VIEW IS "ATTENTION".
    //
    // ⚠️ I RECORDED FRICTION HERE TWICE BEFORE READING THE CODE, AND BOTH TIMES
    // THE APP WAS RIGHT.
    //
    // First I blamed caching; reloading five times changed nothing. Then I read
    // `visibleBookingViews`: the first view for an all-bookings viewer is
    // **attention**, and its predicate selects bookings that NEED something.
    // This fixture is confirmed, assigned and in perfect order — so it is
    // correctly absent. ⛔ "The Owner cannot see his day" would have been a
    // finding about a screen doing exactly its job: showing what needs him
    // rather than everything.
    //
    // ✅ The honest question is whether "what is on today" is one obvious click
    // away. So he clicks Today, the way he would.
    const todayChip = page
      .getByRole("link", { name: /^Today/i })
      .or(page.getByRole("button", { name: /^Today/i }))
      .first();

    let onTodayView = false;
    if ((await todayChip.count()) > 0 && (await todayChip.isVisible().catch(() => false))) {
      await todayChip.click();
      await page.waitForTimeout(3_000);
      onTodayView = true;
      reached.push("today's list — one more click, the Today filter");
    } else {
      friction.push(
        'there is no obvious "Today" filter on the bookings screen — the Owner cannot see what is on today without hunting',
      );
      await page.goto("/admin/bookings/?view=today", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3_000);
    }

    // ⚠️ Reloaded before judging: the list is cached and these fixtures are
    // written straight to the database, which invalidates nothing. A real
    // booking arrives through a server action that clears the entry.
    let seesTodaysCustomer = (await bodyOf(page)).includes(todaysVisit.name);
    for (let attempt = 1; attempt <= 5 && !seesTodaysCustomer; attempt += 1) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3_000);
      seesTodaysCustomer = (await bodyOf(page)).includes(todaysVisit.name);
      if (seesTodaysCustomer) {
        console.log(
          `[I1] today's visit appeared after ${attempt} reload(s) — a caching artefact of direct seeding, not friction.`,
        );
      }
    }

    if (!seesTodaysCustomer) {
      friction.push(
        `today's visit was not on the ${onTodayView ? "Today" : "today"} list even after five reloads — the Owner cannot see his own day`,
      );
    } else {
      console.log(`[I1] the Owner can see today's visit on the Today list.`);
    }

    // ── 3. A report ────────────────────────────────────────────────────
    await navigate(page, /^Reports?$/i, "/admin/reports/", "a report");
    const reports = await bodyOf(page);
    expect(
      reports.length,
      "⛔ THE OWNER CANNOT SEE ANY REPORTING. He cannot tell how the business is doing.",
    ).toBeGreaterThan(200);
    const hasNumbers = /revenue|bookings|total|£|\d/i.test(reports);
    expect(
      hasNumbers,
      `⛔ the reports screen shows no figures at all. It said: "${reports.slice(0, 300)}"`,
    ).toBe(true);

    // ── 4. A settings check ────────────────────────────────────────────
    await navigate(page, /^Settings$/i, "/admin/settings/", "settings");
    const settings = await bodyOf(page);
    expect(
      settings.length,
      "⛔ THE OWNER CANNOT REACH HIS OWN SETTINGS.",
    ).toBeGreaterThan(200);
    expect(
      /\/admin\/login/.test(page.url()),
      "⛔ signed out on the way to settings",
    ).toBe(false);

    // ── 5. The audit trail ─────────────────────────────────────────────
    // ⛔ This is the one that matters most for an owner who is not a developer:
    // it is how he answers "who changed that, and when?" without asking anybody.
    await navigate(page, /^Audit|^Activity|^History/i, "/admin/audit/", "the audit trail");
    const audit = await bodyOf(page);
    expect(
      audit.length,
      "⛔ THE OWNER CANNOT SEE WHO DID WHAT. There is no way for him to answer 'who changed that?' himself.",
    ).toBeGreaterThan(200);

    const auditHasEntries = /\d{1,2}[:/ ]|ago|created|updated|assigned|booking/i.test(audit);
    if (!auditHasEntries) {
      friction.push("the audit trail rendered but showed nothing recognisable as activity");
    }

    await context.close();

    // ── THE VERDICT ────────────────────────────────────────────────────
    console.log(`\n[I1] THE OWNER'S DAY — what he reached:\n   ${reached.join("\n   ")}`);
    console.log(
      friction.length === 0
        ? `\n[I1] ✅ NO FRICTION RECORDED. Every step was reachable by clicking.\n`
        : `\n[I1] ⚠️ FRICTION (${friction.length}) — reported to the Owner, NOT failed:\n   - ${friction.join("\n   - ")}\n`,
    );

    // ⛔ THE ONLY BLOCKING ASSERTION: he got through the whole day. Everything
    // above already failed loudly on a step he could not complete; this catches
    // a day that silently stopped short.
    expect(
      reached.length,
      `⛔ the Owner's day did not complete — he reached only: ${JSON.stringify(reached)}`,
    ).toBeGreaterThanOrEqual(5);

    // ⚠️ And a deliberately generous friction ceiling. This is not a quality bar
    // — it is a tripwire for a day that has become a maze, which is a different
    // thing from a day with a couple of rough edges.
    expect(
      friction.length,
      `⛔ THE OWNER'S DAY HAS BECOME A MAZE — ${friction.length} steps needed typing an address or went nowhere useful: ${JSON.stringify(friction)}`,
    ).toBeLessThanOrEqual(4);
  });
});
