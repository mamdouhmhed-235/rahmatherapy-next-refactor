// ⛔ GATE 08 — P3, FAMILY I, SCENARIO I3: THE COORDINATOR'S DAY.
//
//   ⛔ The Owner's question: "Can the front desk do front-desk work?"
//
// ⚠️ This is the role with somebody on the phone. Every wall here is a silence
// while a customer waits — and the customer hears it. A coordinator who has to
// say "let me call you back" is the clearest possible failure of this system.
//
// ── ⛔ HER DAY, IN HER REAL ORDER ────────────────────────────────────────
//
//   1. work the enquiry list        — who has been in touch and not booked?
//   2. turn one into a booking      — while they are still on the phone
//   3. assign it                    — so somebody is actually going
//   4. handle a change              — "actually, can we move it?"
//
// ⛔ Steps 2 and 4 are the ones that matter. Taking a booking and then MOVING it
// are the two things front desk does all day, and moving one is the newer of the
// two capabilities (built this session as D-051).
//
// Findings are FRICTION. Only a step she cannot complete at all fails this.
//
// ── ⛔ EMAIL COST: a real booking plus an assignment and a move. Budget five or
// six, a couple of which reach the clinic's real inbox.

import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  isoDaysFromToday,
  pageAs,
  readAssignments,
  readBooking,
  RUN_TAG,
  serviceClient,
  SERVICES,
  testInbox,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
const friction: string[] = [];
const day: string[] = [];

const CALLER = `ZZTEST-I3-CALLER-${RUN_TAG}`;
const CALLER_EMAIL = testInbox(`i3-caller-${RUN_TAG}`);
const CALLER_PHONE = "07700900555";

let enquiryId = "";
let bookingId = "";
let originalDate = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const db = serviceClient();
  if (enquiryId) {
    await db.from("audit_logs").delete().eq("target_id", enquiryId);
    await db.from("enquiries").delete().eq("id", enquiryId);
  }
  if (clientIds.length > 0) await destroyScenarioFixtures(db, clientIds);
});

async function bodyOf(page: Page) {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

/** Typing that VERIFIES — the city field is autocomplete-backed. */
async function typeVerified(page: Page, locator: Locator, value: string) {
  await locator.click();
  await locator.pressSequentially(value, { delay: 60 });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await locator.inputValue()) === value) return;
    await locator.fill("");
    await locator.click();
    await locator.pressSequentially(value, { delay: 120 });
    await page.waitForTimeout(300);
  }
  expect(await locator.inputValue(), `could not type "${value}"`).toBe(value);
}

test.describe("I3 — the coordinator's day: can the front desk do front-desk work?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("with somebody on the phone: enquiries → a booking → staffed → moved", async ({
    browser,
  }) => {
    test.setTimeout(420_000);
    const db = serviceClient();

    // ⛔ Somebody rang yesterday and did not book. That is the enquiry list's
    // whole reason to exist.
    const { data: enquiry, error } = await db
      .from("enquiries")
      .insert({
        full_name: CALLER,
        phone: CALLER_PHONE,
        email: CALLER_EMAIL,
        source: "phone",
        status: "new",
        service_interest: SERVICES.hijama.name,
        notes: "ZZTEST — rang about hijama, wants a home visit.",
      })
      .select("id")
      .single();
    expect(error, `could not seed the enquiry: ${error?.message}`).toBeNull();
    enquiryId = (enquiry as { id: string }).id;

    const { context, page } = await pageAs(browser, "coordinator");

    // ── 1. Who has been in touch and not booked? ───────────────────────
    const enquiriesLink = page.getByRole("link", { name: /^Enquiries$/i }).first();
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2_500);

    if ((await enquiriesLink.count()) > 0 && (await enquiriesLink.isVisible().catch(() => false))) {
      await enquiriesLink.click();
      await page.waitForTimeout(3_000);
      day.push("the enquiry list — one click from where she starts");
    } else {
      friction.push("the enquiry list is not one click from where front desk starts her day");
      await page.goto("/admin/enquiries/", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3_000);
      day.push("the enquiry list — reached the long way");
    }

    // ⚠️ Reloaded before judging: the list is cached and the enquiry was written
    // straight to the database, which invalidates nothing.
    let seesCaller = (await bodyOf(page)).includes(CALLER);
    for (let attempt = 1; attempt <= 5 && !seesCaller; attempt += 1) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3_000);
      seesCaller = (await bodyOf(page)).includes(CALLER);
    }
    expect(
      seesCaller,
      "⛔ SOMEBODY WHO RANG UP IS NOT ON THE ENQUIRY LIST. Front desk has no way of knowing to call them back.",
    ).toBe(true);

    // ── 2. Turn it into a booking, while they are on the phone ─────────
    // ⛔ THE CONVERSION ROUTE. `EnquiryList` links to exactly this, and
    // `createManualBooking` reads `enquiry_id` off the form to close the loop —
    // so the enquiry does not sit there looking unanswered afterwards.
    await page.goto(`/admin/bookings/new/?enquiryId=${enquiryId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: /New booking/i })).toBeVisible({
      timeout: 30_000,
    });

    const next = page.getByRole("button", { name: /^Continue$/ }).first();

    // ⛔ PRE-FILLED FROM THE ENQUIRY, or she is retyping what the customer
    // already told the clinic once. Measured before being overwritten.
    const prefilledName = await page.getByLabel(/Full name/i).inputValue();
    const prefilledPhone = await page.getByLabel(/Phone number/i).inputValue();
    if (!prefilledName.includes(CALLER) && prefilledPhone !== CALLER_PHONE) {
      friction.push(
        "converting an enquiry does not carry the caller's details across — front desk retypes what the customer already gave the clinic",
      );
    } else {
      day.push("their details carried across from the enquiry — no retyping");
    }

    await page.getByLabel(/Booking source/i).selectOption("phone");
    await page.getByLabel(/Full name/i).fill(CALLER);
    await page.getByLabel(/Phone number/i).fill(CALLER_PHONE);
    await page.getByLabel(/Email address/i).fill(CALLER_EMAIL);
    await expect(next).toBeEnabled();
    await next.click();

    await page.getByLabel(/Name or label/i).fill(CALLER);
    await page.getByLabel(/gender/i).selectOption("female");
    await page.getByText(SERVICES.hijama.name, { exact: false }).first().click();
    await expect(next).toBeEnabled();
    await next.click();

    await page.getByLabel(/Postcode/i).fill("LU1 1AA");
    await page.getByRole("combobox", { name: /Address/i }).fill("1 ZZTEST Street");
    await typeVerified(page, page.getByLabel(/^City/i), "Luton");

    const dateField = page.getByLabel(/^Date/i);
    await expect(dateField).toBeVisible();
    await dateField.fill(isoDaysFromToday(9));
    await page.waitForTimeout(2_500);

    const timeButton = page.getByRole("button", { name: /^\d{1,2}:\d{2}/ }).first();
    await expect(
      timeButton,
      "⛔ NO TIME COULD BE OFFERED. Front desk cannot book anybody at all.",
    ).toBeVisible({ timeout: 25_000 });
    await timeButton.click();
    await page.waitForTimeout(1_200);
    await expect(next).toBeEnabled();
    await next.click();

    const submit = page.getByRole("button", { name: /Submit booking request/i }).first();
    await page
      .getByText(/I confirm that the client's details and consent have been obtained/i)
      .click();
    await page.waitForTimeout(400);
    await expect(submit).toBeEnabled();
    await submit.click();
    await page.waitForTimeout(12_000);

    const { data: madeRows } = await db
      .from("bookings")
      .select("id, booking_date, client_id")
      .eq("contact_email", CALLER_EMAIL)
      .order("created_at", { ascending: false });
    const made = (madeRows ?? []) as { id: string; booking_date: string; client_id: string }[];
    expect(
      made.length,
      "⛔ THE CALL ENDED WITHOUT A BOOKING. Front desk could not do the one thing the phone rang for.",
    ).toBeGreaterThan(0);
    bookingId = made[0].id;
    originalDate = made[0].booking_date;
    clientIds.push(made[0].client_id);
    day.push("took the booking while they were on the phone");

    // ⛔ AND THE ENQUIRY IS CLOSED OFF, so nobody rings them again tomorrow.
    const { data: afterEnquiry } = await db
      .from("enquiries")
      .select("status")
      .eq("id", enquiryId)
      .maybeSingle();
    const enquiryStatus = (afterEnquiry as { status: string } | null)?.status ?? "gone";
    if (enquiryStatus === "new") {
      friction.push(
        "the enquiry is still marked new after it was turned into a booking — somebody will ring them again",
      );
    } else {
      day.push(`the enquiry closed itself off (now "${enquiryStatus}")`);
    }

    // ── 3. Somebody has to actually go ─────────────────────────────────
    await page.goto(`/admin/bookings/${bookingId}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);

    const assignTrigger = page.getByRole("button", { name: /^Assign therapist$/i }).first();
    expect(
      await assignTrigger.count(),
      "⛔ FRONT DESK CANNOT SEND ANYBODY TO THE VISIT SHE JUST TOOK.",
    ).toBeGreaterThan(0);
    await assignTrigger.click();
    await page.waitForTimeout(2_000);

    const offered = page
      .getByRole("dialog")
      .getByRole("button")
      .filter({ hasNotText: /^Close$|^Show all staff$|^Show eligible only$/ })
      .filter({ hasNotText: /Minhaj rahman/ });
    expect(
      await offered.count(),
      "⛔ nobody could be sent to this visit",
    ).toBeGreaterThan(0);

    // ⚠️ WHO GETS PICKED DECIDES WHETHER STEP 4 MEANS ANYTHING, AND TAKING
    // "whoever is first" COST ME A FALSE FINDING.
    //
    // A first version clicked `offered.first()` and then recorded that the visit
    // could not be moved because "no times were offered". ⛔ That was very
    // likely correct behaviour: every bookable therapist runs on the clinic's
    // global hours EXCEPT "Test Therapist Fresh", who is on `availability_mode:
    // custom` with NO rules at all — so she is assignable but never available,
    // and any date offers her no slots.
    //
    // ✅ So a therapist on the clinic's own hours is chosen deliberately. If the
    // move then finds no times, that is a real finding rather than an artefact
    // of which fixture happened to sort first.
    const onGlobalHours = offered.filter({ hasText: /Test Therapist(?! Fresh)/ });
    const pick = (await onGlobalHours.count()) > 0 ? onGlobalHours.first() : offered.first();
    const pickedName = ((await pick.innerText()) || "").replace(/\s+/g, " ").trim();
    console.log(`[I3] sent: ${pickedName.slice(0, 60)}`);
    await pick.click();
    await page.waitForTimeout(5_000);

    const assigned = await readAssignments(db, bookingId);
    expect(
      assigned[0].assigned_staff_id,
      "⛔ the assignment did not stick",
    ).not.toBeNull();
    day.push("sent a therapist — from the booking she was already on");

    // ── 4. "Actually, can we move it?" ─────────────────────────────────
    // ⛔ The newest capability in the system (D-051, built this session) and the
    // second most common thing front desk does. If she cannot move a visit, the
    // only alternative is cancel-and-rebook — which loses the slot and mails
    // the customer twice.
    await page.goto(`/admin/bookings/${bookingId}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);

    // ⚠️ TWO THINGS ABOUT THIS PANEL COST ME THREE RUNS, AND BOTH WERE MINE.
    //
    // 1. "Move appointment" is the panel's SUBMIT button, not a trigger. The
    //    panel is already on the booking page, and the button is
    //    `disabled={isPending || unchanged || !date || !time}` — dead until a
    //    genuinely different date AND a time are set. ⛔ A first version clicked
    //    it immediately and Playwright waited on a permanently disabled control
    //    until the test timed out after ten minutes. That is the C3 lesson —
    //    a control being PRESENT is not the same as it being ENABLED — repeated
    //    somewhere new.
    //
    // 2. ⛔ THERE IS NO SLOT PICKER HERE. The panel takes a `New date` and a
    //    typed `New start time`, pre-filled with the time the client asked for.
    //    My test hunted for the slot BUTTONS the public booking form uses,
    //    found none, and recorded "no times were offered, so the visit could not
    //    be moved" — which reads as the move feature being broken. It is not.
    //    The fields are simply typed, not chosen from a list.
    //
    // ✅ Both fields are addressed BY THEIR LABELS, so this can never again fill
    // some other date box on the page and conclude the feature is broken.
    // ⛔ A WEEKDAY, chosen rather than assumed. Picking "+10 days" blind landed
    // on a Saturday in one run — fine here, since the clinic works Mon–Sat
    // 08:00–20:00 and only Sunday is closed — but a later run could land on the
    // Sunday and produce a "no times" finding that is simply the clinic shut.
    let newDate = isoDaysFromToday(10);
    for (let bump = 0; bump < 7; bump += 1) {
      const candidate = isoDaysFromToday(10 + bump);
      if (new Date(`${candidate}T12:00:00Z`).getUTCDay() !== 0) {
        newDate = candidate;
        break;
      }
    }

    const moveSubmit = page.getByRole("button", { name: /^Move appointment$/ }).first();
    const newDateField = page.getByLabel(/^New date$/i);
    const newTimeField = page.getByLabel(/^New start time$/i);

    if ((await newDateField.count()) === 0 || (await moveSubmit.count()) === 0) {
      friction.push(
        "front desk cannot move a visit from the booking itself — the only way to change a time is cancel and rebook",
      );
    } else {
      await newDateField.fill(newDate);
      await newTimeField.fill("15:00");
      await page.waitForTimeout(1_500);

      // ⛔ BOUNDED. If it never becomes usable, that is a finding — not a hang.
      let usable = false;
      for (let attempt = 1; attempt <= 6 && !usable; attempt += 1) {
        usable = await moveSubmit.isEnabled().catch(() => false);
        if (!usable) await page.waitForTimeout(1_000);
      }

      if (!usable) {
        friction.push(
          "a new date and time were entered but the Move button never became usable — front desk is left unable to finish the change",
        );
      } else {
        await moveSubmit.click();
        await page.waitForTimeout(12_000);
        const toast = await bodyOf(page);
        console.log(`[I3] after moving: "${toast.slice(0, 200)}"`);
      }
    }

    const moved = await readBooking(db, bookingId);
    if (String(moved.booking_date) !== originalDate) {
      day.push(`moved the visit — ${originalDate} → ${moved.booking_date}, without re-booking`);
    } else {
      friction.push(
        `the visit could not be moved from the booking screen — it is still on ${originalDate}, so a change of time means cancel-and-rebook`,
      );
    }

    // ⛔ WHATEVER HAPPENED, THE VISIT SURVIVED. A failed move that lost the
    // booking would be far worse than one that simply did not work.
    expect(
      moved.status,
      `⛔ THE BOOKING WAS DAMAGED BY TRYING TO MOVE IT. Status is now "${moved.status}".`,
    ).not.toBe("cancelled");

    const { data: theirBookings } = await db
      .from("bookings")
      .select("id")
      .eq("client_id", made[0].client_id);
    expect(
      (theirBookings ?? []).length,
      "⛔ MOVING THE VISIT LEFT A SECOND BOOKING BEHIND — the customer is now booked twice.",
    ).toBe(1);

    await context.close();

    // ── THE VERDICT ────────────────────────────────────────────────────
    console.log(`\n[I3] THE COORDINATOR'S DAY:\n   ${day.join("\n   ")}`);
    console.log(
      friction.length === 0
        ? `\n[I3] ✅ NO SILENCES. She did the whole call without saying "let me get back to you".\n`
        : `\n[I3] ⚠️ FRICTION (${friction.length}) — reported, NOT failed:\n   - ${friction.join("\n   - ")}\n`,
    );

    expect(
      day.length,
      `⛔ her day did not complete — she got as far as: ${JSON.stringify(day)}`,
    ).toBeGreaterThanOrEqual(4);

    expect(
      friction.length,
      `⛔ FRONT DESK CANNOT DO FRONT-DESK WORK WITHOUT STOPPING — ${friction.length} points where a customer would be left waiting: ${JSON.stringify(friction)}`,
    ).toBeLessThanOrEqual(3);
  });
});
