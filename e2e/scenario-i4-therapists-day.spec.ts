// ⛔ GATE 08 — P3, FAMILY I, SCENARIO I4: THE THERAPIST'S DAY.
//
//   ⛔ The Owner's question: "Can a practitioner run their own day?"
//
// ⚠️ This is the person who uses the system MOST and cares about it LEAST. She is
// between visits, on a phone, in somebody's hallway. If her day takes six clicks
// and a back button she will stop keeping records, and the clinic's notes will
// quietly stop matching reality.
//
// ── ⛔ HOW THIS DIFFERS FROM D2 AND D3, WHICH ALREADY PASSED ─────────────
//
// D2 proved a therapist CAN see her list, write a note and mark work complete.
// D3 proved the claim/redaction invariant. ⚠️ Both are correctness questions and
// both are already settled.
//
// ⛔ THIS ASKS WHETHER THE DAY HANGS TOGETHER — one uninterrupted session, in
// her real order, counting the clicks and looking for the three things that only
// show up in a working session:
//
//   • a step that needs a page her role cannot reach
//   • a value she has to copy by hand between two screens
//   • a dead end with no way back
//
// Findings are FRICTION, not defects. Only a step she cannot complete AT ALL
// fails this scenario.
//
// ── ⛔ EMAIL COST: a claim and a completion may notify staff. Two or three
// messages, all to `@example.test` fixtures except any business alert.

import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  isoDaysFromToday,
  pageAs,
  readAssignments,
  readBooking,
  RUN_TAG,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
const friction: string[] = [];
const day: string[] = [];
let hers: SeededBooking;
let onOffer: SeededBooking;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

async function bodyOf(page: Page) {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

/** Reach somewhere by clicking; record it if only the address bar worked. */
async function reach(page: Page, linkName: RegExp, url: string, what: string) {
  const top = page.getByRole("link", { name: linkName }).first();
  if ((await top.count()) > 0 && (await top.isVisible().catch(() => false))) {
    await top.click();
    await page.waitForTimeout(2_500);
    if (!/\/admin\/login/.test(page.url())) {
      day.push(`${what} — one click, from her own nav`);
      return;
    }
  }
  const menuButton = page.getByRole("button", { name: /account menu/i }).first();
  if ((await menuButton.count()) > 0 && (await menuButton.isVisible().catch(() => false))) {
    await menuButton.click();
    await page.waitForTimeout(1_200);
    const item = page.getByRole("menuitem", { name: linkName }).first();
    if ((await item.count()) > 0) {
      await item.click();
      await page.waitForTimeout(2_500);
      if (!/\/admin\/login/.test(page.url())) {
        day.push(`${what} — two clicks, via her account menu`);
        return;
      }
    }
    await page.keyboard.press("Escape").catch(() => {});
  }
  friction.push(`${what}: not reachable by clicking — had to type "${url}"`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_500);
  day.push(`${what} — reached only by typing the address`);
}

test.describe("I4 — the therapist's day: can a practitioner run their own day?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("one uninterrupted session: her schedule → an offer → the address → notes → done → her availability", async ({
    browser,
  }) => {
    test.setTimeout(420_000);
    const db = serviceClient();

    // ⛔ Her day: one visit already hers, and one going spare that she could
    // pick up. Both today, both female-required so she genuinely matches.
    hers = await seedWebsiteBooking(db, "I4-HERS", {
      dayOffset: 0,
      startTime: "09:00:00",
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(hers.clientId);

    onOffer = await seedWebsiteBooking(db, "I4-OFFER", {
      dayOffset: 0,
      startTime: "14:00:00",
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
    });
    clientIds.push(onOffer.clientId);

    const { context, page } = await pageAs(browser, "therapist_a");

    // ── 1. She opens her own day ───────────────────────────────────────
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });
    let dash = "";
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await page.waitForTimeout(2_000);
      dash = await bodyOf(page);
      if (dash.length > 200) break;
    }
    expect(
      /\/admin\/login/.test(page.url()),
      "⛔ the therapist cannot open her own day",
    ).toBe(false);
    expect(
      dash.length,
      "⛔ HER FIRST SCREEN IS EMPTY. She has nowhere to start.",
    ).toBeGreaterThan(200);
    day.push("her own day — opened directly");

    // ⛔ Does her first screen show HER work? A practitioner should not have to
    // go hunting for what she is doing in an hour.
    if (!dash.includes(hers.name)) {
      // ⚠️ Reloaded before judging — the dashboard is cached and this fixture
      // was written straight to the database.
      let found = false;
      for (let attempt = 1; attempt <= 4 && !found; attempt += 1) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3_000);
        found = (await bodyOf(page)).includes(hers.name);
      }
      if (!found) {
        friction.push(
          "her own visit was not on her first screen — she has to go looking for what she is doing today",
        );
      }
    }

    // ── 2. She picks up the job going spare ────────────────────────────
    await page.goto(`/admin/bookings/${onOffer.bookingId}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2_500);
    const claim = page.getByRole("button", { name: /^Claim this booking$/ });
    const offered = (await claim.count()) > 0;

    if (!offered) {
      friction.push(
        "the spare visit was not offered to her, so she could not pick up extra work from the booking itself",
      );
    } else {
      await claim.first().click();
      await page.waitForTimeout(4_000);
      day.push("picked up the spare visit — one click, from the booking itself");
    }

    const claimed = await readAssignments(db, onOffer.bookingId);
    expect(
      claimed[0].assigned_staff_id,
      `⛔ SHE COULD NOT TAKE THE WORK. A practitioner who cannot pick up an unstaffed visit cannot run her day. Assignment: ${JSON.stringify(claimed[0])}`,
    ).toBe(THERAPIST_A_STAFF_ID);

    // ── 3. The address — the thing she actually needs on the doorstep ──
    await page.goto(`/admin/bookings/${hers.bookingId}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2_500);
    const herVisit = await bodyOf(page);

    expect(
      herVisit.includes(hers.name),
      "⛔ she cannot see who she is treating on her own booking",
    ).toBe(true);

    // ⛔ A home-visit clinic: without an address she cannot do the job at all.
    const booking = await readBooking(db, hers.bookingId);
    const address = String(booking.service_address_line1 ?? "").trim();
    const postcode = String(booking.service_postcode ?? "").trim();
    const hasWhere =
      (address.length > 0 && herVisit.includes(address)) ||
      (postcode.length > 0 && herVisit.includes(postcode));
    expect(
      hasWhere,
      `⛔ SHE CANNOT SEE WHERE TO GO. This is a home-visit clinic and the address is not on the booking she is about to attend. Looked for "${address}" / "${postcode}".`,
    ).toBe(true);
    day.push("the address — on the booking itself, no hunting");

    // ── 4. She writes up the visit and marks it done ───────────────────
    const note = `ZZTEST I4 session note ${RUN_TAG}`;
    const markComplete = page.getByRole("button", { name: /^Mark complete$/ });
    expect(
      await markComplete.count(),
      "⛔ SHE CANNOT RECORD THAT SHE DID THE WORK.",
    ).toBeGreaterThan(0);
    await markComplete.first().click();
    await page.waitForTimeout(3_000);

    const noteBox = page.getByPlaceholder("What happened in this session?");
    if ((await noteBox.count()) > 0) {
      await noteBox.first().fill(note);
      const save = page.getByRole("button", { name: /^Save note$/ });
      if ((await save.count()) > 0) {
        await save.first().click();
        await page.waitForTimeout(3_000);
      }
      day.push("wrote the visit up — offered in the same breath as finishing it");
    } else {
      friction.push(
        "she was not offered anywhere to write the visit up at the moment she finished it",
      );
    }

    const after = await readAssignments(db, hers.bookingId);
    expect(
      after[0].status,
      "⛔ marking her own work complete did not record it",
    ).toBe("completed");

    const { data: notes } = await db
      .from("client_notes")
      .select("*")
      .eq("client_id", hers.clientId);
    const savedNote = ((notes ?? []) as { note: string | null }[]).some((n) =>
      (n.note ?? "").includes("ZZTEST I4 session note"),
    );
    if (!savedNote) {
      friction.push("the note she typed did not reach the customer's record");
    }

    // ── 5. Her own availability ────────────────────────────────────────
    //
    // ⚠️ I SENT HER TO THE WRONG PAGE FIRST, AND THE APP WAS RIGHT TWICE.
    //
    // A first version pointed her at `/admin/availability` and then recorded two
    // frictions: "not reachable by clicking" and "offers nothing to change".
    // ⛔ Both were my error.
    //
    //  • `/admin/availability` is the CLINIC-WIDE page. Its nav entry carries
    //    `dataScopes: ["all"]`, so it is deliberately hidden from a therapist —
    //    she has `manage_availability_own`, not the global one. The nav was
    //    right to hide it, and "offers nothing to change" was me looking at a
    //    page she is not the audience for.
    //
    //  • HER OWN hours live at `/admin/staff/<her id>/availability`, which is
    //    where `StaffAvailabilityRulesForm`, `StaffBlockedDatesManager` and
    //    `AvailabilityModeSelector` actually are.
    //
    // ⛔ So the honest question is whether she can reach HER OWN page by
    // clicking — from her nav, through her own record. That is what is measured
    // now, and typing the address is still recorded as friction if it is the
    // only way there.
    const mine = `/admin/staff/${THERAPIST_A_STAFF_ID}/availability/`;
    let reachedByClicking = false;

    // Her nav shows Staff (labelled "Team" for some roles) — start there.
    const staffLink = page.getByRole("link", { name: /^(Staff|Team)$/i }).first();
    if ((await staffLink.count()) > 0 && (await staffLink.isVisible().catch(() => false))) {
      await staffLink.click();
      await page.waitForTimeout(3_000);

      // Her own record, then the availability link on it.
      const ownRecord = page.getByRole("link", { name: /Test Therapist(?! Fresh)/ }).first();
      if ((await ownRecord.count()) > 0) {
        await ownRecord.click();
        await page.waitForTimeout(3_000);
      } else {
        await page.goto(`/admin/staff/${THERAPIST_A_STAFF_ID}/`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForTimeout(2_500);
        friction.push(
          "she could not click through to her own record from the team list — she had to know its address",
        );
      }

      const availLink = page.getByRole("link", { name: /Availability/i }).first();
      if ((await availLink.count()) > 0 && (await availLink.isVisible().catch(() => false))) {
        await availLink.click();
        await page.waitForTimeout(3_000);
        reachedByClicking = true;
      }
    }

    if (!reachedByClicking) {
      friction.push(
        `her own working hours were not reachable by clicking — she had to type "${mine}"`,
      );
      await page.goto(mine, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3_000);
    }
    day.push(
      `her own working hours — ${reachedByClicking ? "reached by clicking through her own record" : "reached only by typing the address"}`,
    );

    const availability = await bodyOf(page);
    expect(
      /\/admin\/login/.test(page.url()),
      "⛔ signed out on the way to her own working hours",
    ).toBe(false);
    expect(
      availability.length,
      "⛔ SHE CANNOT REACH HER OWN WORKING HOURS. Every change to when she works becomes somebody else's job.",
    ).toBeGreaterThan(200);

    // ⛔ AND SHE CAN ACTUALLY CHANGE THEM. Looking at her hours without being
    // able to set them would send every schedule change back through the Owner.
    const canEditIt =
      (await page.getByRole("button", { name: /save|add|block|apply/i }).count()) > 0 ||
      (await page.getByRole("switch").count()) > 0 ||
      (await page.locator("select, input[type='time']").count()) > 0;
    expect(
      canEditIt,
      `⛔ SHE CAN SEE HER HOURS BUT NOT SET THEM. It said: "${availability.slice(0, 300)}"`,
    ).toBe(true);

    await context.close();

    // ── THE VERDICT ────────────────────────────────────────────────────
    console.log(`\n[I4] THE THERAPIST'S DAY:\n   ${day.join("\n   ")}`);
    console.log(
      friction.length === 0
        ? `\n[I4] ✅ NO FRICTION. She ran her whole day without a dead end.\n`
        : `\n[I4] ⚠️ FRICTION (${friction.length}) — reported, NOT failed:\n   - ${friction.join("\n   - ")}\n`,
    );

    expect(
      day.length,
      `⛔ her day did not complete — she got as far as: ${JSON.stringify(day)}`,
    ).toBeGreaterThanOrEqual(5);

    expect(
      friction.length,
      `⛔ THE PRACTITIONER'S DAY IS A MAZE — ${friction.length} steps went nowhere useful: ${JSON.stringify(friction)}`,
    ).toBeLessThanOrEqual(3);
  });
});
