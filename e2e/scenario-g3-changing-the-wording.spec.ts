// ⛔ GATE 08 — P3, FAMILY G, SCENARIO G3: CHANGING THE WORDING.
//
//   ⛔ The Owner's question: "Can I change what my customers read, and put it
//    back?"
//
// This is the Owner's own voice going out under the clinic's name. ⚠️ If editing
// silently does nothing, they will believe customers are reading words that
// nobody is sending. If RESET silently does nothing, a hasty edit is permanent.
//
// ── ⛔ WHICH HALF IS PROVED HOW ──────────────────────────────────────────
//
// 1. DOES AN EDIT REACH THE RENDERED EMAIL? — driven in a browser. The editor
//    saves an override row, and the PREVIEW route re-renders through
//    `resolveTemplateOverrides`, which is the same lookup the real senders use.
//
// 2. DO REAL CUSTOMER EMAILS USE IT? — verified by READING. `notifications.ts`
//    calls `resolveTemplateOverrides(<template>)` per message and passes the
//    result into both the HTML and the plain-text renderer (see its own comment
//    at ~line 635: "each leg reads its own template's overrides"). ⚠️ So the
//    preview is not a separate renderer with its own copy of the wording.
//
// ⛔ THAT DISTINCTION IS STATED RATHER THAN BLURRED. This file does not send a
// customer email, so it must not claim to have watched one arrive.
//
// ⚠️ I NEARLY REPORTED THE OPPOSITE. A first grep found `resolveTemplateOverrides`
// only in the preview route and the test-email button, which reads exactly like
// "editing changes the preview but not what customers receive". It was my grep
// that was too narrow — `notifications.ts` calls it in several places. That would
// have been the seventh finding this run to die on checking.
//
// ── ⛔ THIS EDITS A REAL TEMPLATE, SO IT PUTS IT BACK ────────────────────
// The scenario resets in step 4, and `afterAll` deletes any override row that
// survives a mid-way failure and THROWS if one remains. ⚠️ Leaving a stray
// override would silently change what every future customer reads.
//
// ⛔ EMAIL COST: ZERO. Nothing is sent; the preview is a rendered page.

import { expect, test } from "@playwright/test";
import { gotoAdmin, pageAs, RUN_TAG, serviceClient } from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const TEMPLATE_ID = "booking_confirmation";
const MARKER = `ZZTEST-WORDING-${RUN_TAG}`;

let editedFieldLabel = "";
let defaultPreview = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const db = serviceClient();
  await db.from("email_template_overrides").delete().eq("template_id", TEMPLATE_ID);

  const { data } = await db
    .from("email_template_overrides")
    .select("id")
    .eq("template_id", TEMPLATE_ID);
  if ((data ?? []).length > 0) {
    throw new Error(
      `⛔ TEARDOWN FAILED: an override is still saved on "${TEMPLATE_ID}". Every future customer would read wording this test typed.`,
    );
  }
});

test.describe("G3 — changing the wording: can the Owner edit what customers read, and undo it?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ THE CONTROL: the default wording is what goes out today", async ({
    browser,
  }) => {
    const db = serviceClient();

    // ⛔ Start from a known state — a leftover override from an earlier run
    // would make "the edit changed it" impossible to tell from "it was already
    // changed".
    await db.from("email_template_overrides").delete().eq("template_id", TEMPLATE_ID);

    const { context, page } = await pageAs(browser, "owner");
    const res = await page.goto(`/admin/email-templates/preview/${TEMPLATE_ID}`, {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status(), "⛔ the preview must render at all").toBeLessThan(400);
    await page.waitForTimeout(1_500);
    defaultPreview = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    await context.close();

    expect(
      defaultPreview.length,
      "⛔ the preview must actually contain the email, or nothing below can be compared against it",
    ).toBeGreaterThan(100);
    expect(
      defaultPreview.includes(MARKER),
      "⛔ the default wording must not already contain this test's marker",
    ).toBe(false);

    console.log(`[G3] step 1 — default preview captured (${defaultPreview.length} chars).`);
  });

  test("step 2 — ✅ the Owner changes the wording", async ({ browser }) => {
    expect(defaultPreview, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "owner");
    await gotoAdmin(page, `/admin/emails/templates/${TEMPLATE_ID}/`, "the template editor");
    await page.waitForTimeout(2_500);

    // ⚠️ ENUMERATED, NOT GUESSED. A locator that misses reports "the Owner
    // cannot edit the wording" when the truth may be "I guessed the label".
    const boxes = page.locator("textarea");
    const count = await boxes.count();
    const labels: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const id = await boxes.nth(i).getAttribute("id");
      const label = id
        ? await page.locator(`label[for="${id}"]`).innerText().catch(() => "")
        : "";
      labels.push((label || `(textarea ${i})`).replace(/\s+/g, " ").trim());
    }
    console.log(`[G3] editable fields: ${JSON.stringify(labels)}`);

    expect(
      count,
      "⛔ the template editor must offer at least one editable field",
    ).toBeGreaterThan(0);

    // ⛔ The LAST field is used deliberately: the subject line is the first and
    // is the most constrained, while a body field is where the Owner's own
    // wording actually lives.
    const target = boxes.nth(count - 1);
    editedFieldLabel = labels[count - 1];
    await target.scrollIntoViewIfNeeded();
    await target.fill(`${MARKER} — our clinic looks forward to seeing you.`);
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /^Save/ }).first().click();
    await page.waitForTimeout(4_000);
    await context.close();

    // ⛔ The database is the truth, not the toast.
    const { data } = await db
      .from("email_template_overrides")
      .select("*")
      .eq("template_id", TEMPLATE_ID);
    const rows = (data ?? []) as { value: string | null; field_key: string }[];

    expect(
      rows.some((r) => (r.value ?? "").includes(MARKER)),
      `⛔ THE EDIT WAS NOT SAVED. The Owner would believe customers are reading words nobody is sending. Rows: ${JSON.stringify(rows)}`,
    ).toBe(true);

    console.log(`[G3] step 2 — saved an override on "${editedFieldLabel}".`);
  });

  test("step 3 — ⛔ THE POINT: the rendered email really uses the new wording", async ({
    browser,
  }) => {
    expect(editedFieldLabel, "step 2 must have run").not.toBe("");

    const { context, page } = await pageAs(browser, "owner");
    await page.goto(`/admin/email-templates/preview/${TEMPLATE_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1_500);
    const edited = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    await context.close();

    expect(
      edited.includes(MARKER),
      `⛔ THE EDIT NEVER REACHES THE EMAIL. It is saved in the database but the rendered message still shows the old wording, so changing the template does nothing a customer would ever see. It said: "${edited.slice(0, 400)}"`,
    ).toBe(true);

    // ⛔ AND IT IS A CHANGE, not a coincidence — the same page said something
    // different before the edit.
    expect(
      edited,
      "⛔ the preview is byte-identical to the default, so nothing actually changed",
    ).not.toBe(defaultPreview);

    console.log(`[G3] step 3 — the rendered email now carries the Owner's wording.`);
  });

  test("step 4 — ⛔ THE HALF THAT MUST NOT FAIL SILENTLY: putting it back", async ({
    browser,
  }) => {
    expect(editedFieldLabel, "step 2 must have run").not.toBe("");
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "owner");
    await gotoAdmin(page, `/admin/emails/templates/${TEMPLATE_ID}/`, "the template editor");
    await page.waitForTimeout(2_500);

    // ⛔ Reset asks for confirmation through a NATIVE browser dialog. Left
    // unhandled, Playwright dismisses it automatically and the click looks like
    // it worked while nothing happened.
    page.on("dialog", (dialog) => dialog.accept());

    await page.getByRole("button", { name: /^Reset/ }).first().click();
    await page.waitForTimeout(5_000);
    await context.close();

    // ⛔ The override row is GONE, not merely blanked. A row holding an empty
    // string would still be an override.
    const { data } = await db
      .from("email_template_overrides")
      .select("*")
      .eq("template_id", TEMPLATE_ID);
    expect(
      (data ?? []).length,
      `⛔ RESET DID NOT REMOVE THE CUSTOMISATION. The Owner would believe they had undone an edit that is still going out. Rows left: ${JSON.stringify(data)}`,
    ).toBe(0);

    // ⛔ AND THE RENDERED EMAIL IS BACK TO THE DEFAULT — the row being gone is
    // not the same as customers reading the original words again.
    const after = await pageAs(browser, "owner");
    await after.page.goto(`/admin/email-templates/preview/${TEMPLATE_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await after.page.waitForTimeout(1_500);
    const restored = (await after.page.locator("body").innerText()).replace(/\s+/g, " ");
    await after.context.close();

    expect(
      restored.includes(MARKER),
      `⛔ THE OLD WORDING IS STILL BEING SENT. Reset deleted the row but the rendered email still carries the edit. It said: "${restored.slice(0, 400)}"`,
    ).toBe(false);

    console.log(
      `\n[G3] COMPLETE. The Owner can change what customers read and put it back: the edit reaches the rendered email, and Reset removes both the saved row AND the wording itself.\n`,
    );
  });
});
