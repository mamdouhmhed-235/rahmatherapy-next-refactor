// Playwright globalSetup — fail LOUDLY rather than skip silently, and fail
// CLOSED rather than assume safety.
//
// Why this file exists (P-3, production-readiness run 2026-08-19):
//
// Every spec in e2e/ opens with `test.skip(!hasBaseUrl(), ...)`. Playwright does
// not load .env, so a bare `playwright test` left E2E_BASE_URL unset, every spec
// self-skipped, and the run reported SUCCESS while asserting nothing. A green
// exit code meant "36 skipped", which is indistinguishable from a real pass to
// anyone reading the exit status.
//
// It also enforces the database boundary that was previously only a comment at
// the top of helpers.ts: E2E_BASE_URL points the APP at localhost, but the
// Supabase URL decides which DATABASE the run authenticates against and writes
// to. Those are independent, and the dangerous combination -- local app, live
// database -- looks perfectly safe at a glance.
//
// ⛔ RESOLUTION MUST MATCH helpers.ts, AND MUST FAIL CLOSED.
//
// The first version of this guard read `process.env.NEXT_PUBLIC_SUPABASE_URL`
// only. helpers.ts does NOT: its getEnvValue() falls back to parsing .env off
// disk whenever process.env is falsy. So `NEXT_PUBLIC_SUPABASE_URL= pnpm
// test:e2e` -- exactly what a developer types when told to "point it somewhere
// else" -- let the guard see an empty string, pass, print "non-production", and
// then loginAs() read the PRODUCTION url straight off disk and authenticate
// against it. A guard that prints a false all-clear is worse than no guard,
// because it converts "I did not check" into "I checked and it is safe".
//
// This version resolves the value exactly as helpers.ts does, and refuses to
// run at all when it cannot positively determine the target.

import fs from "node:fs";

// The live customer project. A run may only target it with explicit opt-in.
const PRODUCTION_SUPABASE_REF = "twzutkfgqclqurvkmvqz";

// Mirrors getEnvValue() in e2e/helpers.ts. If these two ever diverge the guard
// stops describing what the tests actually do -- keep them in step.
function resolveEnvValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];

  const envText = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const separatorIndex = line.indexOf("=");
    if (line.slice(0, separatorIndex) !== name) continue;
    return line.slice(separatorIndex + 1).replace(/^"|"$/g, "");
  }

  return undefined;
}

function fail(lines: string[]): never {
  throw new Error(`\n\n⛔ E2E run refused by globalSetup.\n\n${lines.join("\n")}\n`);
}

export default function globalSetup() {
  if (!process.env.E2E_BASE_URL) {
    fail([
      "E2E_BASE_URL is not set, so every spec would self-skip and the run would",
      "report success while asserting nothing.",
      "",
      "Run `pnpm test:e2e`, which passes the env file explicitly. A bare",
      "`playwright test` does not load .env -- Playwright is a separate process",
      "from Next.js.",
    ]);
  }

  // Resolved the way helpers.ts will resolve it, not the way this process sees it.
  const supabaseUrl = resolveEnvValue("NEXT_PUBLIC_SUPABASE_URL");

  // FAIL CLOSED. Unset, blank or unparseable means "unknown", never "safe".
  if (!supabaseUrl) {
    fail([
      "NEXT_PUBLIC_SUPABASE_URL could not be resolved, so this run's database",
      "target is UNKNOWN -- and unknown is not safe.",
      "",
      "e2e/helpers.ts does not read process.env alone: getEnvValue() falls back",
      "to parsing .env off disk. Blanking the variable in your shell therefore",
      "hides the target from this guard while the tests still resolve it, which",
      "is how a 'local' run reaches the live customer database.",
      "",
      "Set it to the database you actually intend to use.",
    ]);
  }

  const isProduction = supabaseUrl.includes(PRODUCTION_SUPABASE_REF);

  if (isProduction && !process.env.E2E_ALLOW_PRODUCTION_DB) {
    fail([
      "This run would authenticate against and write to the PRODUCTION database.",
      "",
      "E2E_BASE_URL points the app at localhost, but NEXT_PUBLIC_SUPABASE_URL",
      "still resolves to the live customer project. loginAs() creates real",
      "auth.sessions rows, and any booking-mutating spec writes real rows.",
      "",
      "Either point NEXT_PUBLIC_SUPABASE_URL at a non-production database, or",
      "set E2E_ALLOW_PRODUCTION_DB=1 to target production deliberately.",
      "",
      "⛔ Do NOT blank the variable to get past this check -- helpers.ts reads",
      "   .env off disk, so the tests would still hit production.",
      "⛔ Owner ruling D-015: the site is in maintenance mode and this database is",
      "   in testing, so the full browser programme is approved to write here.",
      "⛔ D-016: the one real customer record was hard-deleted on 2026-08-20. There",
      "   is no protected row left — but `verify-system-integrity.mjs` now asserts",
      "   that deletion STAYS undone, so do not restore a pre-2026-08-20 backup.",
    ]);
  }

  // Report the RESOLVED target, never an assumption. Hostname only -- no keys.
  const host = (() => {
    try {
      return new URL(supabaseUrl).host;
    } catch {
      return "<unparseable>";
    }
  })();

  console.log(`[e2e] app:      ${process.env.E2E_BASE_URL}`);
  console.log(`[e2e] database: ${isProduction ? "PRODUCTION (opt-in)" : host}`);

  // ⛔ Known limitation, stated so nobody mistakes this for full protection.
  // This guard inspects the PLAYWRIGHT process. The Next.js server under test
  // is a separate process with its own environment, and browser-driven writes
  // go through IT, not through this one. Redirecting the database for a
  // browser journey means restarting the dev server with the new value --
  // changing it here only affects loginAs() and any direct client calls.
  if (!isProduction) {
    console.log(
      "[e2e] note: this guard covers the test process only. The app server under " +
        "test has its own env -- restart it against the same database.",
    );
  }
}
