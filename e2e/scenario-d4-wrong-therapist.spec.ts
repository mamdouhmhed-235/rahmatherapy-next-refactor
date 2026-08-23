// ⛔ GATE 08 — P3, FAMILY D, SCENARIO D4: THE WRONG THERAPIST.
//
//   ⛔ The Owner's two questions: "Does gender matching hold?" and "Can one
//    therapist touch another's work?" The answer to both must be no.
//
// ── ⛔ WHY GENDER MATCHING IS NOT A PREFERENCE ───────────────────────────
//
// Customers of this clinic choose the gender of the therapist who treats them,
// and for many of them that is a religious or modesty requirement, not a nicety.
// ⚠️ Sending the wrong therapist is not an inconvenience — it is the clinic
// breaking a promise at somebody's front door, with nobody able to undo it.
//
// ── ⛔ THE DESIGN: A MATCHED PAIR ────────────────────────────────────────
//
// Cases 1 and 2 seed TWO bookings that differ in EXACTLY ONE THING — the gender
// of therapist required — and show them to the SAME therapist in the SAME
// browser.
//
//   case 1  female-required  → she IS offered the job          ✅ the control
//   case 2  male-required    → she is refused it entirely      ⛔ the rule
//
// ⛔ THAT PAIRING IS THE WHOLE POINT. Case 2 on its own would pass if the
// therapist were locked out of everything, if her session had expired, or if
// the page were simply broken. Case 1 rules all three out, using the same
// login, minutes apart. Only together do they mean "she was refused BECAUSE of
// the gender rule".
//
// Case 3 asks the second question: work that already belongs to Therapist A is
// shut to Therapist B — who is ALSO female, so gender cannot be what stops her.
//
// ── ✅ MUTATION-TESTED, AND THE RESULT WAS A SURPRISE ────────────────────
//
// A test that has never failed has never been shown to work. So the gender
// rule was deliberately BROKEN in the app and this file re-run. What happened
// is worth recording:
//
//   mutation 1  removed the gender filter from the claimable-visibility query
//               in `booking-detail-data.ts`          → ⚠️ D4 STILL PASSED
//   mutation 2  disabled the gender check in `hasClaimableAssignment`
//               in `access.ts`                       → ⚠️ D4 STILL PASSED
//   control     made `canOpenBookingRecord` return false for everyone
//                                                    → ✅ case 1 WENT RED
//
// ⛔ THE CONTROL IS WHY THAT READS AS GOOD NEWS RATHER THAN BAD. It proves the
// running app really was picking up the edits — without it, "the mutation
// survived" would more likely have meant "nothing was rebuilt", and this note
// would be worthless.
//
// ✅ So the two survivals are real, and they mean gender matching does NOT rest
// on either piece of web code. It is enforced independently in at least three
// places, the last of which is the DATABASE itself: the row-level policy on
// `booking_assignments` calls `app_private.current_staff_can_claim_gender()`,
// which requires the staff row to be active, to take bookings, to hold the
// `claim_assignments` permission, and to have `gender = required_gender`.
//
// ⛔ THAT IS THE STRONGEST PLACE THIS RULE COULD LIVE. A mistake in the website
// code alone cannot send the wrong therapist to a customer's home, because the
// database will not hand over the row in the first place.
//
// ── ⛔ EMAIL COST: ZERO REAL MESSAGES ────────────────────────────────────
// Every case is a refusal or a read. Staff are `@example.test` fixtures.

import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  gotoAdmin,
  pageAs,
  readAssignments,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
let femaleJob: SeededBooking;
let maleJob: SeededBooking;
let hersAlready: SeededBooking;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

/**
 * Open a booking and report what happened, WITHOUT throwing on a refusal —
 * because a refusal is the expected answer in half of these cases.
 *
 * ⛔ It distinguishes "refused" from "signed out". Those look identical to a
 * test that only checks whether the customer's name is on screen, and treating
 * an expired session as a passing security check is exactly how a run reports
 * a rule that is not actually being enforced.
 */
async function visit(page: Page, bookingId: string) {
  await page.goto(`/admin/bookings/${bookingId}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_500);

  const signedOut = /\/admin\/login/.test(page.url());
  return {
    signedOut,
    refused: (await page.locator("[data-admin-access-denied]").count()) > 0,
    offered:
      (await page.getByRole("button", { name: /^Claim this booking$/ }).count()) > 0,
    text: (await page.locator("body").innerText()).replace(/\s+/g, " "),
  };
}

test.describe("D4 — the wrong therapist: does gender matching hold, and is other people's work private?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("case 1 — ✅ THE CONTROL: a FEMALE-required job IS offered to a female therapist", async ({
    browser,
  }) => {
    const db = serviceClient();

    femaleJob = await seedWebsiteBooking(db, "D4-FEMALE", {
      dayOffset: 10,
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
    });
    clientIds.push(femaleJob.clientId);

    const seeded = await readAssignments(db, femaleJob.bookingId);
    expect(seeded[0].required_therapist_gender, "the control must require a FEMALE").toBe(
      "female",
    );
    expect(seeded[0].assigned_staff_id, "and must be unclaimed").toBeNull();

    const { context, page } = await pageAs(browser, "therapist_a");
    const seen = await visit(page, femaleJob.bookingId);
    await context.close();

    expect(seen.signedOut, "the control therapist must be signed in").toBe(false);
    expect(
      seen.offered,
      `⛔ WITHOUT THIS, CASE 2 PROVES NOTHING. A therapist who is offered no work at all would "pass" the gender rule by accident. It said: "${seen.text.slice(0, 300)}"`,
    ).toBe(true);

    console.log(`[D4] case 1 — control: a matching job IS offered. She can be offered work.`);
  });

  test("case 2 — ⛔ THE RULE: a MALE-required job is refused to that same therapist", async ({
    browser,
  }) => {
    expect(femaleJob?.bookingId, "the control must have run first").toBeTruthy();
    const db = serviceClient();

    // ⛔ IDENTICAL to the control in every respect except the one under test.
    maleJob = await seedWebsiteBooking(db, "D4-MALE", {
      dayOffset: 10,
      status: "confirmed",
      participants: [{ gender: "male", requiredGender: "male" }],
    });
    clientIds.push(maleJob.clientId);

    const seeded = await readAssignments(db, maleJob.bookingId);
    expect(
      seeded[0].required_therapist_gender,
      "⛔ the fixture must actually require a MALE, or this case tests nothing",
    ).toBe("male");
    expect(seeded[0].assigned_staff_id).toBeNull();

    const { context, page } = await pageAs(browser, "therapist_a");
    const seen = await visit(page, maleJob.bookingId);
    await context.close();

    // ⛔ Same login as the control, minutes later.
    expect(
      seen.signedOut,
      "⛔ she must be SIGNED IN and refused — an expired session would fake this result",
    ).toBe(false);

    expect(
      seen.offered,
      "⛔ GENDER MATCHING BROKEN: a female therapist was offered a job the customer required a male therapist for.",
    ).toBe(false);
    expect(
      seen.text,
      "⛔ and the customer's details must not be readable by a therapist who can never take the job",
    ).not.toContain(maleJob.name);
    expect(
      seen.refused,
      `⛔ a job she can never take should be shut, not merely un-clickable. It said: "${seen.text.slice(0, 300)}"`,
    ).toBe(true);

    // ⛔ AND NOTHING MOVED. Looking must not assign anybody.
    const after = await readAssignments(db, maleJob.bookingId);
    expect(
      after[0].assigned_staff_id,
      "⛔ a refused view must leave the assignment untouched",
    ).toBeNull();

    console.log(
      `[D4] case 2 — the rule: the SAME therapist, the SAME day, refused the male-required job. The only difference was the required gender.`,
    );
  });

  test("case 3 — ⛔ one therapist cannot reach another therapist's work", async ({
    browser,
  }) => {
    const db = serviceClient();

    hersAlready = await seedWebsiteBooking(db, "D4-HERS", {
      dayOffset: 11,
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
      assignTo: THERAPIST_A_STAFF_ID,
    });
    clientIds.push(hersAlready.clientId);

    const seeded = await readAssignments(db, hersAlready.bookingId);
    expect(
      seeded[0].assigned_staff_id,
      "⛔ the fixture must already belong to Therapist A",
    ).toBe(THERAPIST_A_STAFF_ID);

    // ⛔ CONTROL FIRST: the owner of the work can reach it. Otherwise "B is
    // refused" might just mean the booking is broken for everybody.
    const a = await pageAs(browser, "therapist_a");
    const byOwner = await visit(a.page, hersAlready.bookingId);
    await a.context.close();

    expect(byOwner.signedOut, "the owning therapist must be signed in").toBe(false);
    expect(
      byOwner.text,
      `⛔ THE CONTROL. The therapist who HOLDS this job must be able to see her customer, or case 3 proves only that the page is broken. It said: "${byOwner.text.slice(0, 300)}"`,
    ).toContain(hersAlready.name);

    // ⛔ NOW the other therapist. She is ALSO female, so gender is not what
    // stops her — the work simply is not hers.
    const b = await pageAs(browser, "therapist_b");
    const byOther = await visit(b.page, hersAlready.bookingId);
    await b.context.close();

    expect(
      byOther.signedOut,
      "⛔ Therapist B must be SIGNED IN and refused, not bounced to the login page",
    ).toBe(false);
    expect(
      byOther.text,
      "⛔ PRIVACY BROKEN: a therapist can read the customer details of a job that belongs to a colleague.",
    ).not.toContain(hersAlready.name);
    expect(
      byOther.refused,
      `⛔ another therapist's work must be shut, not merely read-only. It said: "${byOther.text.slice(0, 300)}"`,
    ).toBe(true);
    expect(
      byOther.offered,
      "⛔ and work that already has an owner must never be offered a second time",
    ).toBe(false);

    // ⛔ The assignment did not move because somebody else looked at it.
    const after = await readAssignments(db, hersAlready.bookingId);
    expect(
      after[0].assigned_staff_id,
      "⛔ another therapist opening the page must not take the job from its owner",
    ).toBe(THERAPIST_A_STAFF_ID);

    console.log(
      `\n[D4] COMPLETE. Gender rule: holds, proved against a control. Colleague's work: shut, proved against a control. Nothing moved in either case.\n`,
    );
  });
});
