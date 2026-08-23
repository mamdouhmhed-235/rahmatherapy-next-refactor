// ⛔ GATE 08 — P3, FAMILY D, SCENARIO D3: THE OFFER.
//
//   ⛔ The Owner's question: "Does a therapist see the customer's details only
//    AFTER taking the job?"
//
// This is BUSINESS INVARIANT #13, driven in a real browser rather than argued
// about in a unit test.
//
// ── ⛔ WHY IT MATTERS IN PLAIN WORDS ─────────────────────────────────────
//
// When a booking comes in with nobody assigned to it, every therapist of the
// matching gender can SEE that there is work going. ⛔ What they must NOT see,
// until they actually take it, is WHO the customer is — their name, their email
// address, their phone number, or what they are paying.
//
// ⚠️ Get this wrong and every therapist on the books can browse the clinic's
// entire customer list without ever doing a minute's work.
//
// ── ⛔ HOW THIS TEST AVOIDS FOOLING ITSELF ───────────────────────────────
//
// Step 1 asserts a customer's name is ABSENT from a page. ⛔ That assertion also
// passes on a blank page, on a 404, on a permission refusal, and on a page that
// simply failed to load — which is the single most common way a privacy test
// lies.
//
// So step 1 does not stand alone:
//   - it asserts the page IS the booking, by finding the literal placeholder
//     "Claimable booking" — a POSITIVE signal that the redaction code RAN,
//     rather than mere absence of data;
//   - and STEP 2 IS THE CONTROL: the very same therapist, on the very same
//     booking, sees the real name the moment they claim it. ⛔ Without step 2,
//     step 1 would prove only that the page was broken.
//
// ── ⛔ EMAIL COST: ZERO REAL MESSAGES ────────────────────────────────────
//
// Every staff identity here is a fixture on `@example.test`, a reserved and
// undeliverable domain, and the customer is a `TEST_INBOX` fixture. ⚠️ The
// Owner's Resend quota is exhausted (D-053), so this was checked BEFORE writing
// the scenario rather than discovered while running it.

import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  gotoAdmin,
  pageAs,
  readAssignments,
  readBooking,
  seedWebsiteBooking,
  serviceClient,
  THERAPIST_A_STAFF_ID,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
let offered: SeededBooking;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

/** Everything the signed-in therapist can actually read on the page. */
async function readAs(page: Page, bookingId: string) {
  await gotoAdmin(page, `/admin/bookings/${bookingId}/`, "the offered booking");
  await page.waitForTimeout(1_500);
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

test.describe("D3 — the offer: are customer details hidden until the job is taken?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ the booking is VISIBLE but the customer is REDACTED", async ({
    browser,
  }) => {
    const db = serviceClient();

    // ⛔ NOBODY ASSIGNED, and the required therapist gender matches the
    // therapist who is about to look. Both are what make it claimable.
    offered = await seedWebsiteBooking(db, "D3-OFFER", {
      dayOffset: 9,
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
    });
    clientIds.push(offered.clientId);

    // ⛔ Prove the fixture really is unclaimed before drawing any conclusion
    // from what the page shows. A booking that had been quietly auto-assigned
    // would make every assertion below meaningless.
    const before = await readAssignments(db, offered.bookingId);
    expect(before, "the fixture must have exactly one assignment").toHaveLength(1);
    expect(
      before[0].assigned_staff_id,
      "⛔ the fixture must start UNASSIGNED or this scenario tests nothing",
    ).toBeNull();
    expect(before[0].required_therapist_gender).toBe("female");

    const { context, page } = await pageAs(browser, "therapist_a");
    const seen = await readAs(page, offered.bookingId);
    await context.close();

    // ⛔ FIRST: the page really is the booking. Without this, every "not
    // visible" below is satisfied by a page that never rendered.
    expect(
      seen,
      `⛔ THE CONTROL FOR THIS STEP. The therapist must be able to SEE that work exists — otherwise "the name is hidden" only means the page did not load. It said: "${seen.slice(0, 300)}"`,
    ).toContain("Claimable booking");

    // ⛔ NOW the invariant itself.
    expect(
      seen,
      "⛔ INVARIANT #13 BROKEN: the customer's NAME is readable by a therapist who has not taken the job.",
    ).not.toContain(offered.name);
    expect(
      seen,
      "⛔ INVARIANT #13 BROKEN: the customer's EMAIL is readable before the job is taken.",
    ).not.toContain(offered.email);

    const booking = await readBooking(db, offered.bookingId);
    if (booking.contact_phone) {
      expect(
        seen,
        "⛔ INVARIANT #13 BROKEN: the customer's PHONE NUMBER is readable before the job is taken.",
      ).not.toContain(booking.contact_phone);
    }

    console.log(
      `[D3] step 1 — offered and redacted: name hidden, email hidden, "Claimable booking" shown.`,
    );
  });

  test("step 2 — ⛔ THE CONTROL: claiming it reveals the same customer", async ({
    browser,
  }) => {
    expect(offered?.bookingId, "step 1 must have run").toBeTruthy();
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "therapist_a");
    await gotoAdmin(page, `/admin/bookings/${offered.bookingId}/`, "the offered booking");

    const claim = page.getByRole("button", { name: /^Claim this booking$/ });
    await expect(
      claim,
      "⛔ a gender-matched therapist must actually be OFFERED the job, not merely shown that it exists",
    ).toBeVisible({ timeout: 30_000 });

    await claim.click();
    await page.waitForTimeout(3_000);

    // ⛔ Re-open rather than trusting the button — it flips to "Claimed" in the
    // browser optimistically, BEFORE the server has agreed.
    const after = await readAs(page, offered.bookingId);
    await context.close();

    expect(
      after,
      `⛔ THE CLAIM DID NOT REVEAL THE CUSTOMER. If this fails, step 1 proved nothing — a page that hides the name from EVERYBODY passes step 1 too. It said: "${after.slice(0, 300)}"`,
    ).toContain(offered.name);

    // ⛔ AND THE DATABASE AGREES. The page alone could be showing a stale view.
    const assignments = await readAssignments(db, offered.bookingId);
    expect(
      assignments[0].assigned_staff_id,
      "⛔ the claim must be recorded against the therapist who made it",
    ).toBe(THERAPIST_A_STAFF_ID);
    expect(assignments[0].status).toBe("assigned");

    console.log(
      `[D3] step 2 — claimed: the SAME therapist on the SAME booking now sees "${offered.name}". So redaction is about entitlement, not a broken page.`,
    );
  });

  test("step 3 — ⛔ a claimed booking is SHUT to every other therapist", async ({
    browser,
  }) => {
    expect(offered?.bookingId, "step 1 must have run").toBeTruthy();
    const db = serviceClient();

    // ⛔ Therapist B is ALSO female, so gender is not what stops her here — the
    // job simply belongs to somebody else now. Keeping those two reasons apart
    // is the whole point of this step.
    //
    // ⚠️ I EXPECTED A REDACTED PAGE HERE AND THE APP DID BETTER.
    // My first version of this step reused the redaction check from step 1 and
    // failed, because Therapist B is not shown a tidied-up page at all — she is
    // REFUSED. ✅ That is the stronger of the two behaviours: once a booking has
    // an owner, an unrelated therapist has no business on the page in any form.
    // The test now asserts what the app actually does, and says why that is
    // right, rather than bending the app to what I first assumed.
    const { context, page } = await pageAs(browser, "therapist_b");
    await page.goto(`/admin/bookings/${offered.bookingId}/`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1_500);

    const refused = (await page.locator("[data-admin-access-denied]").count()) > 0;
    const seen = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const stillOffered = await page
      .getByRole("button", { name: /^Claim this booking$/ })
      .count();
    await context.close();

    // ⛔ SIGNED IN, NOT SIGNED OUT. A login redirect would refuse everything
    // and prove nothing — the same trap as a blank page in step 1.
    expect(
      page.url(),
      "⛔ Therapist B must be SIGNED IN and refused, not bounced to the login page — otherwise this step only proves her session expired",
    ).not.toMatch(/\/admin\/login/);

    expect(
      refused,
      `⛔ a therapist with no claim on this booking must be REFUSED it. It said: "${seen.slice(0, 300)}"`,
    ).toBe(true);
    expect(
      stillOffered,
      "⛔ a booking already taken by one therapist must not still be offered to another",
    ).toBe(0);
    expect(
      seen,
      "⛔ and the customer's details must not be readable by a therapist who does not hold the job",
    ).not.toContain(offered.name);

    // ⛔ Nothing about the booking changed just because somebody else looked.
    const assignments = await readAssignments(db, offered.bookingId);
    expect(
      assignments[0].assigned_staff_id,
      "⛔ another therapist opening the page must not move the assignment",
    ).toBe(THERAPIST_A_STAFF_ID);

    console.log(
      `
[D3] COMPLETE. Unclaimed: visible but redacted. Claimed: revealed to the claimer. A second therapist: refused outright, and nothing moved.
`,
    );
  });
});
