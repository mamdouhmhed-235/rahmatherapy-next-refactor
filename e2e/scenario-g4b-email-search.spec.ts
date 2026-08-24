// ⛔ GATE 08 — P3, FAMILY G: THE EMAIL LOG'S SEARCH BOX.
//
//   ⛔ The Owner's question, in front-desk terms: "Did this customer get their
//    email?" — the first thing anybody reaches for when a customer rings up.
//
// ── ⛔ WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────
//
// This search was 100% broken (FIND-08-G2-01) and shipped with a PASSING unit
// test. The test mocked the query chain and asserted the filter STRING, so the
// database never got the chance to reject it. It proved the filter was BUILT as
// written and said nothing whatsoever about whether it could RUN.
//
// ⛔ SO THE FIX IS NOT ALLOWED TO BE PROVED BY ANOTHER UNIT TEST. This one
// drives the real page against the real database, which is the only kind of
// evidence that would have caught the original.
//
// ── ⛔ WHAT WAS WRONG ────────────────────────────────────────────────────
//
// `applyDeliveryPredicates` put `id.ilike.<term>` in the same `or(...)` as
// `recipient_email.ilike.<term>`. `id` is a `uuid` column and Postgres has no
// ILIKE for uuid, so the database rejected the WHOLE filter —
// `operator does not exist: uuid ~~* unknown` — taking the useful arms with it.
// Every search answered "Couldn't load email events".
//
// ✅ THE FIX: the id arm is included only when the term really is a uuid, and
// matched with `eq`. That is the same shape `bookings-list-data.ts` has always
// used for the identical problem.
//
// ── ⛔ EMAIL COST: ZERO. Every case here is a read.

import { expect, test, type Page } from "@playwright/test";
import {
  destroyScenarioFixtures,
  gotoAdmin,
  pageAs,
  RUN_TAG,
  seedWebsiteBooking,
  serviceClient,
  type SeededBooking,
} from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const clientIds: string[] = [];
let searched: SeededBooking;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  if (clientIds.length === 0) return;
  await destroyScenarioFixtures(serviceClient(), clientIds);
});

/** What the delivery log shows for one URL. */
async function look(page: Page, url: string) {
  await gotoAdmin(page, url, "the email delivery log");
  await page.waitForTimeout(2_500);
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  return {
    text,
    broke: /Couldn't load email events/i.test(text),
    excerpt: text.slice(0, 260),
  };
}

test.describe("the email delivery log's search box", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("⛔ searching by a customer's address finds their message", async ({ browser }) => {
    test.setTimeout(180_000);
    const db = serviceClient();

    searched = await seedWebsiteBooking(db, "GSEARCH", {
      dayOffset: 10,
      startTime: "14:00:00",
      status: "confirmed",
      participants: [{ gender: "female", requiredGender: "female" }],
    });
    clientIds.push(searched.clientId);

    // ⛔ A message that certainly exists, so "not found" cannot mean "nothing
    // to find". No send is needed — the row is what the search reads.
    const messageId = `zztest-search-${RUN_TAG}`;
    const { data: seeded, error } = await db
      .from("email_delivery_events")
      .insert({
        booking_id: searched.bookingId,
        event_type: "booking_confirmation",
        recipient_email: searched.email,
        recipient_role: "customer",
        delivery_status: "accepted",
        provider_message_id: messageId,
      })
      .select("id")
      .single();
    expect(error, `seeding the event failed: ${error?.message}`).toBeNull();
    const eventId = (seeded as { id: string }).id;

    const { context, page } = await pageAs(browser, "owner");

    // ⛔ A run-unique custom window, so this is never served a warm cache entry
    // from an earlier run whose fixture has since been deleted.
    const window = `range=custom&from=2026-01-01&to=2027-${String(1 + (Date.now() % 12)).padStart(2, "0")}-01`;

    // ── 1. THE CONTROL: the log works when nothing is searched ──────────
    const unsearched = await look(page, `/admin/emails/?${window}`);
    expect(
      unsearched.broke,
      `⛔ THE CONTROL. The delivery log must load at all, or "search works" means nothing. It said: "${unsearched.excerpt}"`,
    ).toBe(false);

    // ── 2. THE FIX: an ordinary text search ────────────────────────────
    const byEmail = await look(
      page,
      `/admin/emails/?${window}&q=${encodeURIComponent(searched.email)}`,
    );
    expect(
      byEmail.broke,
      `⛔ THE SEARCH IS BROKEN AGAIN. Every term used to return "Couldn't load email events" because a uuid column was being ILIKE'd. It said: "${byEmail.excerpt}"`,
    ).toBe(false);
    expect(
      byEmail.text.includes(searched.email),
      `⛔ the search ran but did not find a message that is definitely there. It said: "${byEmail.excerpt}"`,
    ).toBe(true);

    // ── 3. A term that genuinely matches nothing ───────────────────────
    // ⛔ It must come back EMPTY, not BROKEN. Those look the same to a tired
    // person at a front desk, and only one of them is the truth.
    const nothing = await look(page, `/admin/emails/?${window}&q=zzzznothingmatchesthis`);
    expect(
      nothing.broke,
      `⛔ a search with no matches must return nothing, not fail. It said: "${nothing.excerpt}"`,
    ).toBe(false);
    expect(
      nothing.text.includes(searched.email),
      "⛔ and it must not show a message that does not match",
    ).toBe(false);

    // ── 4. A UUID, which is the arm that caused all this ───────────────
    // ⛔ Pasting an event id from a support thread should be safe. It is now
    // matched by equality; before the fix it was ILIKE'd and took the whole
    // query down.
    const byUuid = await look(
      page,
      `/admin/emails/?${window}&q=0b7f1c2d-3e4f-4a5b-8c9d-0e1f2a3b4c5d`,
    );
    expect(
      byUuid.broke,
      `⛔ searching by a UUID broke the log — the exact failure this fix was for. It said: "${byUuid.excerpt}"`,
    ).toBe(false);

    // ── 5. Reserved characters, which the quoting exists for ───────────
    const punctuated = await look(
      page,
      `/admin/emails/?${window}&q=${encodeURIComponent("Smith, John (Jr.)")}`,
    );
    expect(
      punctuated.broke,
      `⛔ a search containing a comma and brackets broke the log. The value is quoted precisely so those survive. It said: "${punctuated.excerpt}"`,
    ).toBe(false);

    // ── 6. THE FIX'S OWN FAILURE MODES ────────────────────────────────
    // ⛔ Asking what a FIX breaks is the discipline this run was told to keep:
    // three of session H's refuted claims were defects introduced BY a fix.
    // Two arms were touched here and neither is exercised above, so both are
    // checked against a row that certainly matches.

    // 6a. The provider's message id — still ILIKE'd, still a text column. If
    // the rewrite had dropped or mangled this arm, chasing a bounce by its
    // provider reference would silently stop working.
    const byMessageId = await look(page, `/admin/emails/?${window}&q=${messageId}`);
    expect(
      byMessageId.broke,
      `⛔ searching by the provider's message id broke the log. It said: "${byMessageId.excerpt}"`,
    ).toBe(false);
    expect(
      byMessageId.text.includes(searched.email),
      `⛔ searching by the provider's message id no longer finds the message it belongs to. It said: "${byMessageId.excerpt}"`,
    ).toBe(true);

    // 6b. A REAL event id. Case 4 only proved a uuid does not break the query;
    // it used a made-up one, so it could not tell `id.eq` WORKING from `id.eq`
    // matching nothing. ⛔ This is the case that proves the replacement arm
    // actually does its job.
    const byRealId = await look(page, `/admin/emails/?${window}&q=${eventId}`);
    expect(
      byRealId.broke,
      `⛔ searching by a real event id broke the log. It said: "${byRealId.excerpt}"`,
    ).toBe(false);
    expect(
      byRealId.text.includes(searched.email),
      `⛔ THE REPLACEMENT ARM DOES NOT WORK. Pasting an event's own id finds nothing, so \`id.eq\` is dead code and the uuid search was removed rather than fixed. It said: "${byRealId.excerpt}"`,
    ).toBe(true);

    await context.close();

    console.log(
      `\n[G-SEARCH] COMPLETE. Searching by address finds the message; a term with no matches comes back empty rather than broken; a UUID and a name full of punctuation are both handled.\n`,
    );
  });
});
