/**
 * Gate 15 case 15.11 — cron dispatch parity.
 *
 * ⛔ WHY THIS EXISTS. Cloudflare fires ONE `scheduled()` handler for every entry
 * in `wrangler.jsonc`'s `triggers.crons`, passing the triggering expression
 * verbatim as `event.cron`. `worker-entrypoint.ts` dispatches on that string
 * with a `switch`. The two lists are maintained BY HAND, and a mismatch does not
 * throw: an unmatched expression falls into `default`, writes one
 * `console.error` into the Worker log stream, and the job simply never runs.
 *
 * That is a total-outage-of-a-feature bug with no customer-visible symptom and
 * no operator-visible symptom — the reminder emails, or the review emails, or
 * the recurring-horizon extension, just stop. Nothing on /admin says so.
 *
 * This test is the mechanical guard. It reads both files as text and asserts a
 * bijection between the two lists.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..");

function readWranglerCrons(source: string): string[] {
  // wrangler.jsonc is JSON with `//` comments. The crons array is a single
  // line of string literals; read it directly rather than pulling in a JSONC
  // parser, so this test has no dependency that could itself drift.
  const block = source.split('"crons"')[1];
  if (!block) throw new Error('wrangler.jsonc has no "crons" key');
  const array = block.slice(block.indexOf("["), block.indexOf("]") + 1);
  return [...array.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function readWorkerCases(source: string): string[] {
  const scheduled = source.split("async scheduled(")[1];
  if (!scheduled) throw new Error("worker-entrypoint.ts has no scheduled() handler");
  const body = scheduled.slice(scheduled.indexOf("switch (event.cron)"));
  return [...body.matchAll(/case\s+"([^"]+)"\s*:/g)].map((m) => m[1]);
}

const wranglerSource = readFileSync(path.join(repoRoot, "wrangler.jsonc"), "utf8");
const workerSource = readFileSync(path.join(repoRoot, "worker-entrypoint.ts"), "utf8");

describe("cron dispatch parity — wrangler.jsonc ↔ worker-entrypoint.ts", () => {
  const crons = readWranglerCrons(wranglerSource);
  const cases = readWorkerCases(workerSource);

  it("reads a non-empty list from each side (the instrument works)", () => {
    // Guards against the silent pass where a parser change makes both lists
    // empty and the set comparisons below trivially succeed.
    expect(crons.length).toBeGreaterThan(0);
    expect(cases.length).toBeGreaterThan(0);
  });

  it("registers exactly four triggers, matching the four cron routes", () => {
    expect(crons).toHaveLength(4);
    expect(cases).toHaveLength(4);
  });

  it("has a handler case for every registered cron expression", () => {
    const missing = crons.filter((cron) => !cases.includes(cron));
    expect(missing).toEqual([]);
  });

  it("has a registered cron expression for every handler case", () => {
    const orphaned = cases.filter((c) => !crons.includes(c));
    expect(orphaned).toEqual([]);
  });

  it("registers no duplicate expression on either side", () => {
    expect(new Set(crons).size).toBe(crons.length);
    expect(new Set(cases).size).toBe(cases.length);
  });

  it("keeps the default branch as a log, never a throw", () => {
    // An unrecognised cron must not take down the invocation for the ones that
    // ARE handled — but it must still leave a trace.
    const scheduled = workerSource.split("async scheduled(")[1] ?? "";
    const defaultBranch = scheduled.slice(scheduled.indexOf("default:"));
    const branchBody = defaultBranch.slice(0, defaultBranch.indexOf("}"));
    // Strip `//` comments first — the branch is commented "Never throw", and a
    // naive substring check would match the comment rather than the code.
    const code = branchBody
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(defaultBranch).toContain("console.error");
    expect(code).not.toMatch(/\bthrow\b/);
  });
});

describe("cron parity detector — mutation checks", () => {
  // ⛔ These prove the assertions above can FAIL. Without them the four set
  // comparisons could be vacuous and nobody would know.
  it("detects a cron expression that has no handler case", () => {
    const mutated = workerSource.replace('case "0 3 * * *":', 'case "0 4 * * *":');
    const mutatedCases = readWorkerCases(mutated);
    const crons = readWranglerCrons(wranglerSource);
    expect(crons.filter((c) => !mutatedCases.includes(c))).toEqual(["0 3 * * *"]);
  });

  it("detects a handler case that has no cron expression", () => {
    const mutated = wranglerSource.replace('"*/15 * * * *", ', "");
    const mutatedCrons = readWranglerCrons(mutated);
    const cases = readWorkerCases(workerSource);
    expect(cases.filter((c) => !mutatedCrons.includes(c))).toEqual(["*/15 * * * *"]);
  });
});
