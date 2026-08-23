// ⛔ GATE 08 — P3, FAMILY H, SCENARIO H3: THE LOCKED OUT.
//
//   ⛔ The Owner's question: "Can somebody who shouldn't be here get anywhere
//    at all?"
//
// Two people who are signed in but have no business in the admin:
//
//   • the DEACTIVATED staff member — someone who used to work here
//   • the NON-STAFF user — a real signed-in account with no staff profile at
//     all, which is what a customer account or a stray sign-up looks like
//
// ⛔ Both are walked down EVERY admin route in the app, not a sample of them.
// One forgotten page is the whole point of this scenario: a permission model is
// only as good as its worst-guarded route, and the route nobody remembers is
// exactly the one that gets left open.
//
// ── ⛔ WHY THE ROUTE LIST IS BUILT, NOT HAND-PICKED ──────────────────────
//
// The list below is every `page.tsx` under `src/app/admin`, minus the three
// that MUST work when signed out (`/admin/login` and the two password-reset
// routes). ⚠️ Hand-picking "the important ones" is how a route gets missed, and
// the missed one is never the one you would have picked.
//
// ── ⛔ THE CONTROL, AND WHY IT IS PER-ROUTE ──────────────────────────────
//
// "They were refused" means nothing on a route that is broken, 404s, or needs
// data that does not exist. ⛔ So the Owner walks the SAME list first, and only
// the routes the OWNER genuinely reached are used to judge the other two.
//
// ⚠️ Any route the Owner could not reach is EXCLUDED AND PRINTED, never silently
// dropped. A sweep that quietly skips what it could not test reads as "all
// clear" when it is nothing of the kind.
//
// ── ⛔ EMAIL COST: ZERO ── every visit is a read, most of them refusals.

import { expect, test, type Browser } from "@playwright/test";
import {
  destroyScenarioFixtures,
  pageAs,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

// ⛔ Real ids, so the dynamic routes are genuinely exercised rather than
// bouncing off a 404 that would look like a refusal.
const A_ROLE_ID = "9f746458-a342-49ae-8b24-ff1a9068f422";
const A_TEMPLATE_ID = "booking_confirmation";

const clientIds: string[] = [];
let seeded: SeededBooking;

interface Visit {
  route: string;
  signedOut: boolean;
  refused: boolean;
  notFound: boolean;
  reached: boolean;
  excerpt: string;
}

let ownerReached: string[] = [];
const excluded: string[] = [];

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

function routes(bookingId: string, clientId: string): string[] {
  return [
    "/admin",
    "/admin/dashboard",
    "/admin/bookings",
    "/admin/bookings/new",
    `/admin/bookings/${bookingId}`,
    "/admin/calendar",
    "/admin/clients",
    "/admin/clients/new",
    `/admin/clients/${clientId}`,
    `/admin/clients/${clientId}/edit`,
    "/admin/enquiries",
    "/admin/staff",
    `/admin/staff/${THERAPIST_A_STAFF_ID}`,
    `/admin/staff/${THERAPIST_A_STAFF_ID}/availability`,
    `/admin/staff/${THERAPIST_A_STAFF_ID}/performance`,
    "/admin/availability",
    "/admin/reports",
    "/admin/audit",
    "/admin/emails",
    `/admin/emails/templates/${A_TEMPLATE_ID}`,
    "/admin/roles",
    `/admin/roles/${A_ROLE_ID}`,
    "/admin/services",
    "/admin/settings",
    "/admin/operations",
    "/admin/privacy",
    "/admin/account-password-requests",
    "/admin/me",
  ];
}

async function walk(
  browser: Browser,
  role: "owner" | "inactive" | "non_staff",
  list: string[],
): Promise<Visit[]> {
  const { context, page } = await pageAs(browser, role);
  const out: Visit[] = [];

  for (const route of list) {
    await page.goto(`${route}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);

    const signedOut = /\/admin\/login/.test(page.url());
    const refused = (await page.locator("[data-admin-access-denied]").count()) > 0;
    const notFound = (await page.locator("h1", { hasText: /^404$/ }).count()) > 0;
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");

    out.push({
      route,
      signedOut,
      refused,
      notFound,
      reached: !signedOut && !refused && !notFound,
      excerpt: text.slice(0, 120),
    });
  }

  await context.close();
  return out;
}

test.describe("H3 — the locked out: can somebody who shouldn't be here get anywhere?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ THE CONTROL: the Owner walks every route", async ({ browser }) => {
    test.setTimeout(180_000);
    const db = serviceClient();

    seeded = await seedWebsiteBooking(db, "H3-SWEEP", {
      dayOffset: 11,
      startTime: "16:00:00",
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(seeded.clientId);

    const list = routes(seeded.bookingId, seeded.clientId);
    const seen = await walk(browser, "owner", list);

    ownerReached = seen.filter((v) => v.reached).map((v) => v.route);
    for (const v of seen.filter((x) => !x.reached)) {
      excluded.push(
        `${v.route} (signedOut=${v.signedOut} refused=${v.refused} 404=${v.notFound})`,
      );
    }

    console.log(
      `[H3] control: the Owner reached ${ownerReached.length} of ${list.length} routes.`,
    );
    if (excluded.length > 0) {
      // ⚠️ PRINTED, NEVER SILENTLY DROPPED. These routes are not judged below,
      // and anybody reading this run must be able to see which.
      console.log(
        `[H3] ⚠️ EXCLUDED from the sweep because the Owner could not reach them:\n   - ${excluded.join("\n   - ")}`,
      );
    }

    expect(
      seen.some((v) => v.signedOut),
      "⛔ the Owner's own session must be alive, or this whole scenario is measuring an expired login",
    ).toBe(false);

    expect(
      ownerReached.length,
      "⛔ the Owner must reach a substantial majority of the admin, or there is no control to judge anybody against",
    ).toBeGreaterThan(list.length * 0.7);
  });

  test("step 2 — ⛔ the DEACTIVATED staff member gets nowhere", async ({ browser }) => {
    test.setTimeout(180_000);
    expect(ownerReached.length, "the control must have run").toBeGreaterThan(0);

    const seen = await walk(browser, "inactive", ownerReached);
    const gotIn = seen.filter((v) => v.reached);

    console.log(
      `[H3] deactivated staff: reached ${gotIn.length} of ${ownerReached.length} routes the Owner reached.`,
    );

    expect(
      gotIn.map((v) => `${v.route} → "${v.excerpt}"`),
      `⛔ A DEACTIVATED MEMBER OF STAFF IS STILL INSIDE THE ADMIN. Every route listed here was opened by somebody who no longer works at this clinic, and the Owner reached each of them too, so none of this is a broken page.`,
    ).toEqual([]);
  });

  test("step 3 — ⛔ the signed-in NON-STAFF user gets nowhere", async ({ browser }) => {
    test.setTimeout(180_000);
    expect(ownerReached.length, "the control must have run").toBeGreaterThan(0);

    // ⛔ A real, valid login with no staff profile behind it — a customer
    // account, or somebody who signed up and was never given a role.
    const seen = await walk(browser, "non_staff", ownerReached);
    const gotIn = seen.filter((v) => v.reached);

    console.log(
      `[H3] non-staff user: reached ${gotIn.length} of ${ownerReached.length} routes the Owner reached.`,
    );

    expect(
      gotIn.map((v) => `${v.route} → "${v.excerpt}"`),
      `⛔ A SIGNED-IN USER WITH NO STAFF PROFILE IS INSIDE THE ADMIN. Having an account is not having a job here.`,
    ).toEqual([]);

    console.log(
      `\n[H3] COMPLETE. ${ownerReached.length} admin routes, walked by a deactivated therapist and by a signed-in outsider. Neither got into a single one.\n`,
    );
  });
});
