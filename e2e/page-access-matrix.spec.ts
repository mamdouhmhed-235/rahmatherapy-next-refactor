// ⛔ GATE 08 CASE E08-19 — NAV-VERSUS-ENFORCEMENT DRIFT.
//
// Two authorization systems exist in this app and they can disagree.
// `getAdminPageAccess` drives the nav — but only 6 of the 21 admin pages
// actually consult it. The other 15 hand-roll their own checks. So the 105-cell
// matrix in src/lib/auth/admin-access.test.ts states what the NAV believes, and
// says nothing about what those 15 pages will do when you type their address in.
//
// This spec types their address in. For every role, for every page, it records
// what the server ACTUALLY did, and compares that to what the matrix claims.
//
// ⛔ THE TWO DISAGREEMENTS ARE NOT EQUALLY SERIOUS:
//
//   matrix says NO, page says YES  -> ⛔ SECURITY. A role reached a page the
//                                      permission model says it may not. The
//                                      hidden nav link was the only thing
//                                      "protecting" it.
//   matrix says YES, page says NO  -> ⚠️ INCONSISTENCY. Nothing is exposed, but
//                                      a role is offered a page it cannot use,
//                                      or is blocked from one it should have.
//
// Both are reported. Only the first is a security finding, and this spec says
// which is which rather than lumping them together as "mismatch".
//
// ⚠️ Deliberately LIST-LEVEL routes only. Detail routes (bookingDetail,
// clientDetail, staffDetail, roleDetail) need a real id and their own
// per-record ownership rules — that is E08-20's job, not this one.

import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { hasBaseUrl } from "./helpers";

const AUTH_DIR = "e2e/.auth";

/** The 17 list-level admin routes, by the page key the matrix uses. */
const ROUTES: ReadonlyArray<{ key: string; path: string }> = [
  { key: "dashboard", path: "/admin/dashboard/" },
  { key: "bookings", path: "/admin/bookings/" },
  { key: "calendar", path: "/admin/calendar/" },
  { key: "reports", path: "/admin/reports/" },
  { key: "clients", path: "/admin/clients/" },
  { key: "enquiries", path: "/admin/enquiries/" },
  { key: "staff", path: "/admin/staff/" },
  { key: "roles", path: "/admin/roles/" },
  { key: "services", path: "/admin/services/" },
  { key: "availability", path: "/admin/availability/" },
  { key: "emails", path: "/admin/emails/" },
  { key: "operations", path: "/admin/operations/" },
  { key: "audit", path: "/admin/audit/" },
  { key: "privacy", path: "/admin/privacy/" },
  { key: "settings", path: "/admin/settings/" },
  { key: "profile", path: "/admin/me/" },
  { key: "accountRequests", path: "/admin/account-password-requests/" },
];

/**
 * What `getAdminPageAccess` says, measured from the live role grants and pinned
 * by the 105-cell matrix in src/lib/auth/admin-access.test.ts (gate 07 case 3).
 *
 * ⛔ Written out by hand here on purpose. If this spec derived the expectation
 * from the same function the app uses, it would agree with itself by
 * construction and prove nothing about the 15 pages that never call it.
 */
const MATRIX_ALLOWS: Record<string, ReadonlySet<string>> = {
  owner: new Set(ROUTES.map((r) => r.key)), // all 17
  admin: new Set(ROUTES.map((r) => r.key).filter((k) => k !== "roles")),
  coordinator: new Set([
    "dashboard",
    "bookings",
    "calendar",
    "reports",
    "clients",
    "enquiries",
    "staff",
    "emails",
    "profile",
  ]),
  therapist_a: new Set([
    "dashboard",
    "bookings",
    "calendar",
    "reports",
    "staff",
    "emails",
    "profile",
  ]),
};

// ⛔ `access: true` IS NOT "this role can open this page". Learned the hard way:
// two therapist routes were flagged as inconsistencies, and BOTH were this
// spec's expectation being wrong rather than an app defect.
//
//   clients        matrix: access=true, dataScope="assigned"
//                  page:   requires dataScope "all" or "sensitive_hidden", and
//                          refuses with "Therapists see clients only through
//                          their assigned bookings" plus a link back to their
//                          bookings. ⚠️ DELIBERATE, and good design — the
//                          refusal tells the user where to go instead.
//
//   availability   matrix: access=true, dataScope="own"
//                  page:   /admin/availability/ is the GLOBAL availability
//                          page and requires manage_availability_global. A
//                          therapist's OWN availability lives at
//                          /admin/staff/<id>/availability/ and is reachable
//                          from their dashboard. ⚠️ Different page, same key.
//
// So several pages layer an additional dataScope requirement on top of the
// access flag. Anyone reading the 105-cell matrix as "who can open what" will
// make the same mistake this spec did.

type Outcome = "rendered" | "denied" | "redirected-to-login";

async function visit(page: import("@playwright/test").Page, path: string): Promise<Outcome> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(150);

  if (/\/admin\/login/.test(page.url())) return "redirected-to-login";

  // ⛔ Detect the AdminAccessDenied COMPONENT, not its wording.
  //
  // The first version of this matched on copy and produced a false SECURITY
  // finding: the Coordinator's correctly-refused /admin/privacy/ was classified
  // "rendered", because that page says "Ask the owner" and the pattern looked
  // for "ask the practice owner". Every page passes its own title and message,
  // so copy-matching here can only ever be a guess. The component now carries a
  // stable marker; this reads that.
  const denied = await page.locator("[data-admin-access-denied]").count();
  return denied > 0 ? "denied" : "rendered";
}

const findings: string[] = [];

test.describe("E08-19 — every admin page, requested directly, as every role", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run.");
  test.describe.configure({ mode: "serial" });

  // ⚠️ NOT a performance statement. The dev server compiles each route on its
  // first visit, and this spec is the first thing that has ever visited most of
  // them — 17 routes x 4 roles. The default 60s budget is for a page that is
  // already built. ⛔ Do not read a timeout here as a slow page in production;
  // gate 14 owns speed, and it measures the built site.
  test.setTimeout(300_000);

  for (const role of Object.keys(MATRIX_ALLOWS)) {
    test(`${role}: 17 admin routes match what the permission matrix claims`, async ({
      browser,
    }) => {
      const statePath = `${AUTH_DIR}/${role}.json`;
      test.skip(
        !fs.existsSync(statePath),
        `${statePath} not minted — run: node scripts/mint-e2e-session.mjs --all --write`
      );

      const context = await browser.newContext({ storageState: statePath });
      const page = await context.newPage();

      const escalations: string[] = [];
      const inconsistencies: string[] = [];

      for (const route of ROUTES) {
        const outcome = await visit(page, route.path);
        const matrixSaysYes = MATRIX_ALLOWS[role].has(route.key);
        const pageSaidYes = outcome === "rendered";

        if (!matrixSaysYes && pageSaidYes) {
          escalations.push(`${route.key} (${route.path}) — matrix says NO, page RENDERED`);
        } else if (matrixSaysYes && !pageSaidYes) {
          inconsistencies.push(`${route.key} (${route.path}) — matrix says YES, page ${outcome}`);
        }
      }

      for (const line of escalations) findings.push(`SECURITY  ${role}: ${line}`);
      for (const line of inconsistencies) findings.push(`INCONSIST ${role}: ${line}`);

      await context.close();

      // ⛔ The assertion that matters. A role reaching a page the permission
      // model forbids means the hidden nav link was its only protection.
      expect(
        escalations,
        `${role} reached ${escalations.length} page(s) the matrix forbids`
      ).toEqual([]);

      // ⚠️ Reported, and also asserted — a page a role is entitled to but cannot
      // open is a real usability defect even though nothing is exposed.
      expect(
        inconsistencies,
        `${role} was refused ${inconsistencies.length} page(s) the matrix grants`
      ).toEqual([]);
    });
  }

  test("blocked identities reach no admin page at all", async ({ browser }) => {
    for (const role of ["inactive", "non_staff"]) {
      const statePath = `${AUTH_DIR}/${role}.json`;
      if (!fs.existsSync(statePath)) continue;

      const context = await browser.newContext({ storageState: statePath });
      const page = await context.newPage();

      const reached: string[] = [];
      for (const route of ROUTES) {
        if ((await visit(page, route.path)) === "rendered") reached.push(route.path);
      }

      await context.close();
      expect(reached, `${role} reached ${reached.length} admin page(s)`).toEqual([]);
    }
  });

  test.afterAll(() => {
    if (findings.length > 0) {
      fs.writeFileSync("page-access-findings.txt", findings.join("\n") + "\n", "utf8");
    }
  });
});
