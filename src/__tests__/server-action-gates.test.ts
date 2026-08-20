import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ⛔ GATE 07 CASE 21 — THE REPO GUARD.
//
// Why this exists: a prior audit hand-checked all admin server actions and found
// every one of them gated. That result was true on the day and protected by
// nothing. A new `"use server"` module shipping with no permission check would
// have failed no test, and writes here run through `createSupabaseAdminClient()`
// — the service-role key, which bypasses RLS entirely. So an ungated action is
// not "a missing check", it is an unmitigated full-table capability with nothing
// behind it.
//
// This test is what keeps that audit result true. It is deliberately structural:
// it does not verify that a check is CORRECT, only that one is present. Case-by-
// case correctness is covered by the per-action tests under
// `src/app/admin/*/__tests__/`.

const APP_ROOT = path.resolve("src/app");

// ⛔ Comments are stripped before matching. The first version of this scan was a
// plain `grep '"use server"'`, which reported 28 files. Three of them only
// MENTION the directive — two in explanatory comments, one in a test name — and
// the true figure is 25. A guard that cannot tell a directive from prose about a
// directive is not a guard.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function isServerActionModule(source: string): boolean {
  const stripped = stripComments(source);
  const firstMeaningfulLine = stripped
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  const moduleLevel =
    firstMeaningfulLine === '"use server";' || firstMeaningfulLine === "'use server';";
  // Next also honours the directive as the first statement of a function body.
  const inline = /\{\s*["']use server["'];/.test(stripped);
  return moduleLevel || inline;
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}

const toRepoPath = (absolute: string) =>
  absolute.split(path.sep).join("/").slice(absolute.indexOf("src"));

// ⛔ EVERY entry needs a justification, and the length is asserted below. Adding
// an exemption must be a deliberate, reviewed act — never a quiet append.
const ALLOWLIST: Record<string, string> = {
  "src/app/admin/login/actions.ts":
    "Pre-session by definition. This module IS the login surface; requiring an " +
    "authenticated staff profile to sign in would be circular. Its own gate is " +
    "rate limiting and Supabase auth, covered by gate 06.",
  "src/app/admin/password-reset/actions.ts":
    "Pre-session by definition. Reached by someone who cannot sign in. Gated by " +
    "a single-use reset token, not by a staff profile.",
  "src/app/booking/manage/actions.ts":
    "Customer-facing, not staff-facing. Authenticated by the booking-management " +
    "token in the request (`getCustomerManageBooking(token, …)`), which resolves " +
    "to exactly one booking. There is no staff profile in this flow at all.",
};

// The count that must not silently drop. A scan that stops finding files would
// otherwise pass by discovering nothing — the exact silent-failure mode this
// repo has hit before.
const MINIMUM_EXPECTED_SERVER_ACTION_MODULES = 25;

const serverActionModules = walk(APP_ROOT)
  .map(toRepoPath)
  .filter((repoPath) => !repoPath.includes("/__tests__/") && !/\.test\.tsx?$/.test(repoPath))
  .filter((repoPath) => isServerActionModule(fs.readFileSync(repoPath, "utf8")));

const isGated = (repoPath: string) =>
  /getStaffProfile|requirePermission/.test(fs.readFileSync(repoPath, "utf8"));

describe("AUTHZ-1 — every server-action module gates itself or is justified", () => {
  it("finds the server-action modules at all", () => {
    // Guards the guard: if the scan silently stops matching, everything below
    // would pass vacuously.
    expect(serverActionModules.length).toBeGreaterThanOrEqual(
      MINIMUM_EXPECTED_SERVER_ACTION_MODULES
    );
  });

  it("has no ungated server-action module outside the allowlist", () => {
    const ungated = serverActionModules
      .filter((repoPath) => !isGated(repoPath))
      .filter((repoPath) => !(repoPath in ALLOWLIST));

    // Named in the failure so a new offender is obvious without re-running a scan.
    expect(ungated).toEqual([]);
  });

  it("keeps the allowlist at exactly three, each with a justification", () => {
    expect(Object.keys(ALLOWLIST)).toHaveLength(3);
    for (const [repoPath, reason] of Object.entries(ALLOWLIST)) {
      expect(fs.existsSync(repoPath), `${repoPath} is allowlisted but does not exist`).toBe(true);
      expect(reason.length, `${repoPath} needs a real justification`).toBeGreaterThan(60);
    }
  });

  it("does not allowlist anything that is already gated", () => {
    // An allowlist entry that no longer needs to be there is stale permission.
    // If one of these grows a real check, remove it from the list.
    const redundant = Object.keys(ALLOWLIST).filter(
      (repoPath) => fs.existsSync(repoPath) && isGated(repoPath)
    );
    expect(redundant).toEqual([]);
  });

  it("does not allowlist a file that is no longer a server-action module", () => {
    const notServerActions = Object.keys(ALLOWLIST).filter(
      (repoPath) =>
        fs.existsSync(repoPath) && !isServerActionModule(fs.readFileSync(repoPath, "utf8"))
    );
    expect(notServerActions).toEqual([]);
  });
});
