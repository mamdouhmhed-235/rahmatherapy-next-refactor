// ⛔ GATE 08 — P3, FAMILY D, SCENARIO D6: THE ONE-OFF PERMISSION.
//
//   ⛔ The Owner's question: "Does the per-person override system work in BOTH
//    directions?"
//
// ── ⛔ WHY BOTH DIRECTIONS, AND WHY THAT IS THE WHOLE POINT ──────────────
//
// Giving somebody an extra permission is the easy half, and it is the half that
// gets noticed immediately — the person says "I still can't do it" and somebody
// fixes it.
//
// ⛔ TAKING IT BACK IS THE HALF THAT FAILS SILENTLY. Nobody reports being able
// to do something they should not. If a revoke does not really land — because a
// page was cached, or a session kept an old copy of the permissions — the clinic
// believes access was removed when it was not, and no one ever finds out.
//
// ⚠️ This app caches admin pages aggressively (`unstable_cache`), which is
// exactly the condition under which a stale permission would survive. So step 4
// is the step this scenario exists for.
//
// ── ⛔ THE PERMISSION USED, AND WHY ──────────────────────────────────────
//
// `view_staff` — the Booking Coordinator role does not have it, and it has a
// precise, visible effect that costs the clinic nothing to hand over or take
// back.
//
// ⚠️ MY FIRST VERSION OF THIS TEST GOT THE PREMISE WRONG AND THE APP WAS RIGHT.
// I assumed `/admin/staff` was simply shut to a coordinator. It is not, and it
// should not be: she holds `assign_bookings`, so she is shown a cut-down "Team
// Directory" of bookable staff, which is exactly what she needs to do her job.
// `getStaffTeamAccess` has THREE scopes, not two.
//
// ✅ So the signal used here is the SCOPE, which is sharper than a refusal:
//     without `view_staff`  ->  scope "assignment"  ->  "Team Directory"
//     with    `view_staff`  ->  scope "admin"       ->  "Staff Management"
//
// ⚠️ A one-off override is the ONLY supported way for somebody to hold a
// capability their role lacks, so this is the real mechanism, not a stand-in.
//
// ── ⛔ HOW THIS AVOIDS FOOLING ITSELF ────────────────────────────────────
//
// Steps 1 and 4 assert that a capability is ABSENT. ⛔ A signed-out browser
// lacks every capability, so both steps first prove the coordinator is signed in
// and working by opening a page she IS entitled to. Without that, an expired
// session would make this scenario report a permission system it never tested.
//
// ── ⛔ CLEANING UP ───────────────────────────────────────────────────────
// The override is removed by the test itself in step 4, and `afterAll` deletes
// any row that survives a mid-way failure. ⚠️ Leaving a real staff member with
// an extra permission would be a far worse outcome than a failing test.
//
// ── ⛔ EMAIL COST: ZERO ──────────────────────────────────────────────────

import { expect, test, type Page } from "@playwright/test";
import { COORDINATOR_STAFF_ID, pageAs, serviceClient } from "./scenario-helpers";
import { hasBaseUrl } from "./helpers";

const PERMISSION = "view_staff";
let permissionId = "";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  // ⛔ BELT AND BRACES. Step 5 removes the override; this removes it again if
  // any step above failed part-way through.
  if (!permissionId) return;
  const db = serviceClient();
  await db
    .from("staff_permission_overrides")
    .delete()
    .eq("staff_id", COORDINATOR_STAFF_ID)
    .eq("permission_id", permissionId);

  const { data } = await db
    .from("staff_permission_overrides")
    .select("id")
    .eq("staff_id", COORDINATOR_STAFF_ID)
    .eq("permission_id", permissionId);
  if ((data ?? []).length > 0) {
    throw new Error(
      "⛔ TEARDOWN FAILED: a real staff member has been left holding an extra permission.",
    );
  }
});

/** Open a page and report WHY it went the way it did, without throwing. */
async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_500);
  return {
    signedOut: /\/admin\/login/.test(page.url()),
    refused: (await page.locator("[data-admin-access-denied]").count()) > 0,
    text: (await page.locator("body").innerText()).replace(/\s+/g, " "),
  };
}

/**
 * Set one override from the Owner's browser, confirming the dialog if shown.
 *
 * ⚠️ The control is a `radiogroup` whose radios are BUTTONS labelled with the
 * raw lowercase modes — "inherit", "grant", "revoke" — while the CONFIRMATION
 * dialog uses capitalised words, and "inherit" is confirmed with a button
 * reading "Reset". Two vocabularies for one control is easy to mix up, and a
 * locator that misses simply finds nothing, so both are named explicitly.
 */
async function setOverride(page: Page, mode: "grant" | "inherit") {
  const confirmLabel = mode === "grant" ? "Grant" : "Reset";

  await page.goto(`/admin/staff/${COORDINATOR_STAFF_ID}/`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2_500);

  const group = page.getByRole("radiogroup", { name: /view staff override/i });
  await expect(
    group,
    "⛔ the Owner must be able to find the view staff override control",
  ).toBeVisible({ timeout: 30_000 });
  await group.scrollIntoViewIfNeeded();

  await group.getByRole("radio", { name: mode, exact: true }).click();
  await page.waitForTimeout(1_000);

  // ⛔ High-risk and critical permissions ask for confirmation. Clicking a
  // control that only OPENED a dialog and then walking away would leave nothing
  // changed while the test believed it had changed something.
  const confirm = page.getByRole("dialog").getByRole("button", {
    name: confirmLabel,
    exact: true,
  });
  if ((await confirm.count()) > 0) {
    await confirm.first().click();
  }
  await page.waitForTimeout(3_000);
}

test.describe("D6 — the one-off permission: does an override work in both directions?", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the scenario suite.");

  test("step 1 — ⛔ the coordinator does NOT already have it (and is not signed out)", async ({
    browser,
  }) => {
    const db = serviceClient();
    const { data: permission } = await db
      .from("permissions")
      .select("id")
      .eq("name", PERMISSION)
      .single();
    permissionId = (permission as { id: string })?.id ?? "";
    expect(permissionId, `the ${PERMISSION} permission must exist`).not.toBe("");

    // ⛔ Start from a known state. A leftover override from an earlier run would
    // make the check below fail for the wrong reason.
    await db
      .from("staff_permission_overrides")
      .delete()
      .eq("staff_id", COORDINATOR_STAFF_ID)
      .eq("permission_id", permissionId);

    const { context, page } = await pageAs(browser, "coordinator");

    // ⛔ THE CONTROL: she is signed in and the admin works for her.
    const allowed = await visit(page, "/admin/bookings/");
    expect(
      allowed.signedOut,
      "⛔ the coordinator must be SIGNED IN, or every refusal below proves nothing",
    ).toBe(false);
    expect(
      allowed.refused,
      `⛔ THE CONTROL. She must be able to reach a page she IS entitled to. It said: "${allowed.text.slice(0, 200)}"`,
    ).toBe(false);

    // ⛔ NOW the page whose SCOPE is what this scenario moves.
    const staff = await visit(page, "/admin/staff/");
    await context.close();

    expect(staff.signedOut, "still signed in").toBe(false);
    expect(
      staff.text,
      `⛔ without "${PERMISSION}" a coordinator must get the cut-down directory. It said: "${staff.text.slice(0, 200)}"`,
    ).toContain("Team Directory");
    expect(
      staff.text,
      "⛔ and must NOT hold the full staff-management view before anything has been granted",
    ).not.toContain("Staff Management");

    console.log(
      `[D6] step 1 — before: signed in, bookings OK, the staff page shows the cut-down "Team Directory". The starting point is real.`,
    );
  });

  test("step 2 — ✅ the Owner grants exactly that one permission", async ({ browser }) => {
    expect(permissionId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    const { context, page } = await pageAs(browser, "owner");
    await setOverride(page, "grant");
    await context.close();

    // ⛔ The database is the truth, not the toast.
    const { data } = await db
      .from("staff_permission_overrides")
      .select("is_granted")
      .eq("staff_id", COORDINATOR_STAFF_ID)
      .eq("permission_id", permissionId)
      .maybeSingle();

    expect(
      data,
      "⛔ the grant must be recorded against the person, not just shown on screen",
    ).not.toBeNull();
    expect((data as { is_granted: boolean }).is_granted).toBe(true);

    console.log(`[D6] step 2 — granted: one override row, is_granted = true.`);
  });

  test("step 3 — ⛔ she gains EXACTLY that capability", async ({ browser }) => {
    expect(permissionId, "step 1 must have run").not.toBe("");

    const { context, page } = await pageAs(browser, "coordinator");
    const nowAdmin = await visit(page, "/admin/staff/");

    // ⛔ AND NOTHING MORE. An override that quietly widened her authority would
    // be worse than one that did not work at all. The permission CONTROLS on a
    // staff record need `manage_permission_overrides`, which she was never
    // given — so if she can now hand out permissions herself, one override has
    // become the power to grant every other one.
    const onARecord = await visit(page, `/admin/staff/${COORDINATOR_STAFF_ID}/`);
    const canGrantToOthers = await page
      .getByRole("radiogroup", { name: /override$/i })
      .count();
    await context.close();

    expect(nowAdmin.signedOut, "still signed in").toBe(false);
    expect(
      nowAdmin.text,
      `⛔ THE GRANT DID NOT TAKE EFFECT. She was given "${PERMISSION}" and still sees only the cut-down directory. It said: "${nowAdmin.text.slice(0, 200)}"`,
    ).toContain("Staff Management");

    expect(
      canGrantToOthers,
      "⛔ ONE override must not become the power to hand out others. She has no manage_permission_overrides, so the override controls must not be on screen.",
    ).toBe(0);
    expect(onARecord.signedOut, "still signed in").toBe(false);

    console.log(
      `[D6] step 3 — gained: the page became "Staff Management", but she still cannot grant permissions to anyone. Exactly one capability moved.`,
    );
  });

  test("step 4 — ⛔ THE STEP THIS SCENARIO EXISTS FOR: taking it back really takes it back", async ({
    browser,
  }) => {
    expect(permissionId, "step 1 must have run").not.toBe("");
    const db = serviceClient();

    const owner = await pageAs(browser, "owner");
    await setOverride(owner.page, "inherit");
    await owner.context.close();

    const { data } = await db
      .from("staff_permission_overrides")
      .select("id")
      .eq("staff_id", COORDINATOR_STAFF_ID)
      .eq("permission_id", permissionId);
    expect(
      (data ?? []).length,
      "⛔ resetting to inherit must DELETE the override row, not leave it behind",
    ).toBe(0);

    // ⛔ AND THE PERSON MUST ACTUALLY LOSE IT, IN A BROWSER. The row being gone
    // is not the same as the capability being gone — a cached page or a session
    // holding an old copy of the permissions would keep the door open, and
    // nobody would ever report being able to do something they should not.
    const { context, page } = await pageAs(browser, "coordinator");
    const stillAllowed = await visit(page, "/admin/bookings/");
    const backToBefore = await visit(page, "/admin/staff/");
    await context.close();

    expect(
      stillAllowed.refused,
      "⛔ the control again: removing ONE permission must not lock her out of her own job",
    ).toBe(false);

    expect(
      backToBefore.text,
      `⛔ THE PERMISSION WAS NOT REALLY REMOVED. The override row is gone but she still sees the full staff-management view — the clinic would believe access was withdrawn when it was not. It said: "${backToBefore.text.slice(0, 200)}"`,
    ).not.toContain("Staff Management");
    expect(
      backToBefore.text,
      "⛔ and she must land back on exactly the view she started with",
    ).toContain("Team Directory");

    console.log(
      `\n[D6] COMPLETE. Granted: gained exactly one capability. Reset: row deleted AND the door really closed, with her own work untouched.\n`,
    );
  });
});
