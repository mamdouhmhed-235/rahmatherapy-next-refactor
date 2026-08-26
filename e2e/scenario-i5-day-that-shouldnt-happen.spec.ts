// ⛔ GATE 08 — P3, FAMILY I, SCENARIO I5: THE DAY THAT SHOULDN'T HAPPEN.
//
//   ⛔ The Owner's question: "Does the system say no, POLITELY, everywhere?"
//
// Two people who have no business here try to do a normal working day:
//
//   • a DEACTIVATED account — somebody who used to work at the clinic
//   • a NON-STAFF account   — a real login with no staff profile behind it
//
// ── ⛔ HOW THIS DIFFERS FROM H3, WHICH ALREADY SWEPT EVERY ROUTE ─────────
//
// H3 asked "can they get in anywhere?" and answered no across all 28 admin
// routes. ⚠️ That is a security question and it is already settled.
//
// ⛔ THIS IS A DIFFERENT QUESTION AND MUST NOT BE CONFUSED WITH IT: given that
// they are refused, is the refusal FIT TO MEET? Family I is about the experience,
// so what is measured here is the QUALITY of the no:
//
//   1. Is it a proper refusal, or a crash, a blank page, or a raw error?
//   2. Does it TELL them something, rather than just stopping?
//   3. Is it the SAME everywhere, or does each page refuse differently?
//   4. Is there a way out — a link back to somewhere they can be?
//
// ⚠️ A system that refuses inconsistently teaches people that some refusals are
// bugs worth retrying. One that refuses with a blank screen teaches them the
// system is broken. Both cost the Owner a phone call.
//
// ⛔ Findings here are FRICTION, not defects — unless a page genuinely breaks.
//
// ── ⛔ EMAIL COST: ZERO. Every step is a refusal.

import { expect, test, type Page } from "@playwright/test";
import { pageAs, serviceClient, THERAPIST_A_STAFF_ID } from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

type Intruder = "inactive" | "non_staff";

interface Refusal {
  who: Intruder;
  step: string;
  signedOut: boolean;
  refused: boolean;
  crashed: boolean;
  blank: boolean;
  explains: boolean;
  wayOut: boolean;
  excerpt: string;
}

const seen: Refusal[] = [];
const friction: string[] = [];

test.describe.configure({ mode: "serial" });

/** A working day, in the order somebody would actually do it. */
const A_NORMAL_DAY: { step: string; url: string }[] = [
  { step: "start the day on the dashboard", url: "/admin/dashboard/" },
  { step: "look at today's bookings", url: "/admin/bookings/?view=today" },
  { step: "open the calendar", url: "/admin/calendar/" },
  { step: "look up a customer", url: "/admin/clients/" },
  { step: "check the enquiries", url: "/admin/enquiries/" },
  { step: "check their own profile", url: "/admin/me/" },
  { step: "look at the team", url: `/admin/staff/${THERAPIST_A_STAFF_ID}/` },
  { step: "take a new booking", url: "/admin/bookings/new/" },
];

async function attempt(page: Page, who: Intruder, step: string, url: string): Promise<Refusal> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_500);

  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const signedOut = /\/admin\/login/.test(page.url());
  const refused = (await page.locator("[data-admin-access-denied]").count()) > 0;

  return {
    who,
    step,
    signedOut,
    refused,
    // ⛔ A raw framework error page, or a Next.js 500/error boundary.
    crashed:
      /application error|unhandled|stack trace|Internal Server Error|something went wrong/i.test(
        text,
      ),
    // ⛔ Nothing rendered at all is its own failure mode, distinct from a refusal.
    blank: text.trim().length < 60,
    // ✅ Does it say anything, rather than merely stopping?
    explains:
      signedOut ||
      /don't have access|do not have access|not have permission|ask the (coordinator|owner)|sign in|no longer|inactive/i.test(
        text,
      ),
    // ✅ Is there a way back to somewhere they are allowed to be?
    wayOut:
      signedOut ||
      (await page.getByRole("link", { name: /back|dashboard|sign in|home/i }).count()) > 0,
    excerpt: text.slice(0, 160),
  };
}

test.describe("I5 — the day that shouldn't happen: does the system say no politely, everywhere?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("both intruders attempt a full working day", async ({ browser }) => {
    test.setTimeout(300_000);

    // ⛔ THE CONTROL, FIRST. If these pages were broken for EVERYONE, every
    // refusal below would be indistinguishable from a broken system — and this
    // scenario would report excellent security on a dead application.
    const owner = await pageAs(browser, "owner");
    const controlFailures: string[] = [];
    for (const { step, url } of A_NORMAL_DAY) {
      // ⚠️ POLLED, not sampled once. A first version waited 1.2s and reported
      // that the OWNER could not open a staff record or the new-booking wizard.
      // ⛔ Both are simply heavy pages that had not finished rendering — my
      // timing, not a fault. The control has to be patient or it condemns the
      // app for being slower than the test.
      await owner.page.goto(url, { waitUntil: "domcontentloaded" });
      let text = "";
      let ok = false;
      for (let attempt = 1; attempt <= 8; attempt += 1) {
        await owner.page.waitForTimeout(1_500);
        text = (await owner.page.locator("body").innerText()).replace(/\s+/g, " ");
        ok =
          !/\/admin\/login/.test(owner.page.url()) &&
          (await owner.page.locator("[data-admin-access-denied]").count()) === 0 &&
          text.trim().length > 200;
        if (ok) break;
      }
      if (!ok) controlFailures.push(`${step} (${url}) — last saw: "${text.slice(0, 120)}"`);
    }
    await owner.context.close();

    expect(
      controlFailures,
      `⛔ THE CONTROL FAILED. These steps do not work for the OWNER either, so refusing them proves nothing about security: ${JSON.stringify(controlFailures)}`,
    ).toEqual([]);
    console.log(`[I5] control: the Owner completed all ${A_NORMAL_DAY.length} steps of the day.`);

    // ── Now the two who should not be here ─────────────────────────────
    for (const who of ["inactive", "non_staff"] as Intruder[]) {
      const { context, page } = await pageAs(browser, who);
      for (const { step, url } of A_NORMAL_DAY) {
        seen.push(await attempt(page, who, step, url));
      }
      await context.close();
    }

    // ── What happened ──────────────────────────────────────────────────
    for (const who of ["inactive", "non_staff"] as Intruder[]) {
      const mine = seen.filter((r) => r.who === who);
      const gotIn = mine.filter((r) => !r.signedOut && !r.refused && !r.blank && !r.crashed);
      // ⚠️ ONE PRIMARY OUTCOME PER STEP. A first version counted the flags
      // independently and printed "8 sent to sign in, 8 refused in place",
      // which reads as a contradiction. Both CAN be true — the refusal marker
      // renders and the redirect follows — but only one is what the person
      // ends up looking at, and that is what the Owner is being told about.
      const shapeOf = (r: Refusal) =>
        r.crashed ? "crashed" : r.blank ? "blank" : r.signedOut ? "sent to sign in" : r.refused ? "refused in place" : "GOT THROUGH";
      const tally = new Map<string, number>();
      for (const r of mine) tally.set(shapeOf(r), (tally.get(shapeOf(r)) ?? 0) + 1);
      console.log(
        `[I5] ${who.padEnd(10)} — ${mine.length} steps: ` +
          [...tally.entries()].map(([k, n]) => `${n} ${k}`).join(", ") +
          `. (${mine.filter((r) => r.refused).length} of them also rendered the refusal notice before redirecting.)`,
      );
    }

    // ⛔ THE SECURITY FLOOR — the only thing here that is a DEFECT, not friction.
    const gotThrough = seen.filter((r) => !r.signedOut && !r.refused && !r.blank && !r.crashed);
    expect(
      gotThrough.map((r) => `${r.who}: ${r.step} → "${r.excerpt}"`),
      "⛔ SOMEBODY WHO SHOULD NOT BE HERE COMPLETED A STEP OF A WORKING DAY.",
    ).toEqual([]);

    // ⛔ AND NOTHING CRASHED. A stack trace is not a refusal — it is a bug that
    // happens to stop somebody, and it tells them the system is broken rather
    // than that they are not allowed.
    const crashed = seen.filter((r) => r.crashed);
    expect(
      crashed.map((r) => `${r.who}: ${r.step} → "${r.excerpt}"`),
      "⛔ A PAGE CRASHED RATHER THAN REFUSING. That is a defect, not a polite no.",
    ).toEqual([]);

    // ── Now the FRICTION: the quality of the no ────────────────────────
    const blank = seen.filter((r) => r.blank);
    if (blank.length > 0) {
      friction.push(
        `${blank.length} step(s) showed a blank screen rather than saying anything: ${JSON.stringify(blank.map((r) => `${r.who}/${r.step}`))}`,
      );
    }

    const silent = seen.filter((r) => !r.explains && !r.blank);
    if (silent.length > 0) {
      friction.push(
        `${silent.length} step(s) stopped them without explaining why: ${JSON.stringify(silent.map((r) => `${r.who}/${r.step}`))}`,
      );
    }

    const trapped = seen.filter((r) => !r.wayOut && !r.blank);
    if (trapped.length > 0) {
      friction.push(
        `${trapped.length} step(s) offered no way back to anywhere they are allowed: ${JSON.stringify(trapped.map((r) => `${r.who}/${r.step}`))}`,
      );
    }

    // ⛔ CONSISTENCY. Being sent to the login page on one screen and refused in
    // place on another teaches people that some refusals are glitches worth
    // retrying — which is how a former employee ends up rattling the door.
    for (const who of ["inactive", "non_staff"] as Intruder[]) {
      const mine = seen.filter((r) => r.who === who);
      const shapes = new Set(
        mine.map((r) => (r.signedOut ? "sent to sign in" : r.refused ? "refused in place" : "other")),
      );
      if (shapes.size > 1) {
        friction.push(
          `${who} met ${shapes.size} different kinds of refusal across one day (${[...shapes].join(", ")}) — an inconsistent no reads as an unreliable system`,
        );
      }
    }

    console.log(
      friction.length === 0
        ? `\n[I5] ✅ NO FRICTION. Both were refused everywhere, consistently, with an explanation and a way back.\n`
        : `\n[I5] ⚠️ FRICTION (${friction.length}) — reported, NOT failed:\n   - ${friction.join("\n   - ")}\n`,
    );

    // ⚠️ A deliberately generous ceiling: a tripwire for a system that refuses
    // chaotically, not a quality bar for a couple of rough edges.
    expect(
      friction.length,
      `⛔ THE REFUSALS ARE CHAOTIC — ${friction.length} distinct problems with HOW the system says no: ${JSON.stringify(friction)}`,
    ).toBeLessThanOrEqual(3);
  });
});
