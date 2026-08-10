import { expect, test } from "@playwright/test";
import { getCredentials, hasBaseUrl, loginAs, requireCredentials } from "./helpers";
import {
  ADMIN_CONTRAST_ROUTE_TEMPLATES,
  THEMES,
  renderRoleThemeReport,
  renderSummaryReport,
  resolveRouteFilter,
  sweepAdminRoutes,
  visitAndAudit,
  writeEvidenceFile,
  type RoleRunResult,
  type RouteEntry,
} from "./admin-contrast-helpers";

/**
 * Layer 3 of the ITEM 7 admin-contrast programme
 * (redesign/plans/POST-BAND-C-FOLLOWUP-plan.md §7.9(b)): a live Playwright
 * sweep of every admin route, every role, both themes. Complements the
 * static token-pair proof (§7.9a) and the static source analyser (§7.9a0) —
 * this is the runtime-truth layer, and the only one that authenticates.
 *
 * Report-only for now: ITEM 7's substitution fix is outstanding, so failures
 * are recorded, not asserted, unless CONTRAST_MAX_FAILURES ratchets the gate
 * down toward zero.
 *
 * Roles — verified against the live database (2026-08-10): only Owner,
 * Admin, Booking Coordinator, Therapist and Inactive exist. There is no
 * Reporting role; THERAPIST_B and NON_STAFF credentials are unpopulated. All
 * five are gated with `requireCredentials` so an absent credential skips
 * cleanly rather than failing the suite — the harness authenticates via
 * `loginAs`/`getCredentials`; this file never reads, echoes, or asserts on a
 * secret value, only on role names.
 *
 * Run (playwright.config.ts loads no env file itself):
 *   node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts
 *
 * (This is a pnpm repo: there is no node_modules/playwright/cli.js — only
 * @playwright/test is a direct dependency, and its CLI lives at the path
 * above. Confirmed against node_modules/.bin/playwright's shim.)
 *
 * Scoping for a partial/smoke run:
 *   CONTRAST_ROLES=OWNER,ADMIN            (default: all four contrast roles)
 *   CONTRAST_ROUTES=/admin/dashboard,...  (default: all 29 role-loop routes)
 *   CONTRAST_MAX_FAILURES=0               (default: unset — report-only, always passes)
 */

const CONTRAST_ROLES = ["OWNER", "ADMIN", "COORDINATOR", "THERAPIST_A"] as const;
type ContrastRole = (typeof CONTRAST_ROLES)[number];

const MAX_FAILURES = process.env.CONTRAST_MAX_FAILURES
  ? Number(process.env.CONTRAST_MAX_FAILURES)
  : Number.POSITIVE_INFINITY;

const roleFilterEnv = process.env.CONTRAST_ROLES;
const parsedRoleFilter = roleFilterEnv
  ? new Set(
      roleFilterEnv
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  : null;
const rolesToRun: ContrastRole[] = parsedRoleFilter
  ? CONTRAST_ROLES.filter((role) => parsedRoleFilter.has(role))
  : [...CONTRAST_ROLES];

const routeFilterEnv = process.env.CONTRAST_ROUTES;
const rawRouteFilterEntries = routeFilterEnv
  ? routeFilterEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;
const routeFilterResolution = rawRouteFilterEntries ? resolveRouteFilter(rawRouteFilterEntries) : null;
const routeFilter = routeFilterResolution ? routeFilterResolution.matched : null;

const roleResults: RoleRunResult[] = [];
const unauthenticatedResults: RoleRunResult[] = [];
let inactiveOutcome: "redirected" | "not-redirected" | "skipped" = "skipped";

// Use the installed Google Chrome rather than Playwright's bundled Chromium.
// @playwright/test@1.59.1 pins chromium_headless_shell revision 1217; this
// machine's cache holds only 1228 and 1234, so the bundled binary cannot
// launch. Fetching revision 1217 is a network download outside the lockfile,
// and editing playwright.config.ts would change every other e2e spec — so the
// channel is pinned HERE, scoped to this file alone.
//
// Safe for this particular suite: contrast is computed from resolved sRGB
// pixel values, which are deterministic across Chromium builds. If Chrome is
// ever absent, remove this line and run `npx playwright install
// chromium-headless-shell` instead.
test.use({ channel: "chrome" });

test.describe("Admin contrast sweep", () => {
  test.skip(!hasBaseUrl(), "Set E2E_BASE_URL to run the admin contrast sweep.");

  // An unrecognised CONTRAST_ROUTES entry must be a hard error, never a
  // silent no-op — this is what would have caught the dropped-/admin/dashboard
  // defect immediately instead of a report-only spec quietly measuring
  // nothing for that route while every other test still passed.
  test.beforeAll(() => {
    if (routeFilterResolution && routeFilterResolution.unmatched.length > 0) {
      throw new Error(
        `CONTRAST_ROUTES has ${routeFilterResolution.unmatched.length} entr` +
          `${routeFilterResolution.unmatched.length === 1 ? "y" : "ies"} matching no known route: ` +
          `${routeFilterResolution.unmatched.map((entry) => JSON.stringify(entry)).join(", ")}. ` +
          `Known routes: ${ADMIN_CONTRAST_ROUTE_TEMPLATES.join(", ")}. ` +
          "(On Git Bash/MSYS, a bare leading-slash value can be silently rewritten to a Windows path — " +
          "this is recovered automatically via a suffix match when the rewritten form still ends with a " +
          "known route, so an entry reaching this error genuinely matched nothing.)"
      );
    }
  });

  // /admin/login and /admin/password-reset are unauthenticated but still
  // admin-themed (tokens.css --admin-* vars). ThemeProvider never mounts for
  // an unauthenticated request, so they are audited once here, outside the
  // role loop, rather than per-role.
  test("unauthenticated admin surfaces — login, password-reset (audited once, outside the role loop)", async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    const entries: RouteEntry[] = [];
    entries.push(await visitAndAudit(page, "/admin/login", "/admin/login"));
    entries.push(await visitAndAudit(page, "/admin/password-reset", "/admin/password-reset"));
    unauthenticatedResults.push({ role: "UNAUTHENTICATED", entries });

    for (const theme of THEMES) {
      writeEvidenceFile(`UNAUTHENTICATED-${theme}.md`, renderRoleThemeReport("UNAUTHENTICATED", theme, entries));
    }

    for (const entry of entries) {
      expect(entry.outcome, `${entry.path} is unauthenticated and should render, not redirect/deny`).toBe(
        "audited"
      );
    }
  });

  // INACTIVE is a negative-path account, blocked from admin entirely — not
  // contrast-audited, only confirmed redirected away (middleware.ts).
  test("INACTIVE — negative path only, not contrast-audited", async ({ page }) => {
    test.skip(!requireCredentials(["INACTIVE"]), "Set E2E_INACTIVE_EMAIL/PASSWORD.");
    const credentials = getCredentials("INACTIVE");
    if (!credentials) return;

    await loginAs(page, credentials);
    await page.goto("/admin/dashboard/", { waitUntil: "domcontentloaded" });
    inactiveOutcome = /\/admin\/login/.test(page.url()) ? "redirected" : "not-redirected";
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  for (const role of rolesToRun) {
    test(`contrast sweep — ${role}`, async ({ page }) => {
      test.skip(!requireCredentials([role]), `Set E2E_${role}_EMAIL/PASSWORD.`);
      const credentials = getCredentials(role);
      if (!credentials) return;
      test.setTimeout(30 * 60_000);

      await loginAs(page, credentials);
      const entries = await sweepAdminRoutes(page, routeFilter);

      // A sweep that produced zero route entries measured nothing — that must
      // never pass silently, however many routes were requested. (Unmatched
      // CONTRAST_ROUTES entries are already caught earlier, in beforeAll; this
      // is the last-resort net for any other way the sweep could come back
      // empty.) Deliberately thrown before writing evidence, so an empty
      // sweep leaves no file behind to be mistaken for a real result.
      if (entries.length === 0) {
        throw new Error(
          `${role}: sweepAdminRoutes returned zero route entries — refusing to report success. ` +
            `routeFilter=${routeFilter ? JSON.stringify([...routeFilter]) : "null (no filter; should cover all 29 routes)"}.`
        );
      }

      roleResults.push({ role, entries });

      for (const theme of THEMES) {
        writeEvidenceFile(`${role}-${theme}.md`, renderRoleThemeReport(role, theme, entries));
      }

      const totalFailures = entries.reduce(
        (sum, e) => sum + THEMES.reduce((s, t) => s + (e.themes[t]?.failures.length ?? 0), 0),
        0
      );
      expect(
        totalFailures,
        `${role}: total contrast failures across both themes (report-only unless CONTRAST_MAX_FAILURES ratchets it)`
      ).toBeLessThanOrEqual(MAX_FAILURES);
    });
  }

  test.afterAll(() => {
    writeEvidenceFile(
      "summary.md",
      renderSummaryReport(roleResults, CONTRAST_ROLES, unauthenticatedResults, inactiveOutcome)
    );
  });
});
