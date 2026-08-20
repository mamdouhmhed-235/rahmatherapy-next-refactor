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

  // ⛔ REAL-IDENTITY GUARD (added 2026-08-20, gate 08 P0).
  //
  // `E2E_OWNER_EMAIL` was pointing at `rahmatherapy@outlook.com` -- the Owner's
  // OWN login, flagged `bootstrap_owner` in auth.users. Every authenticated
  // browser run was therefore signing in as the real business owner, creating
  // real sessions on that account, and any destructive persona case would have
  // acted as them. Nothing had noticed, because the specs had never run.
  //
  // The seeded test identities all end in `example.test` -- either directly
  // (`phase10.owner@example.test`) or as a subdomain
  // (`test.admin@rahmatherapy.example.test`). That is the rule: every configured
  // E2E identity must be one. A real mailbox cannot be one by accident.
  //
  // ⚠️ The first version of this pattern required a DOT before "example" and so
  // rejected the `@example.test` accounts too. It failed CLOSED, which is the
  // right direction for a guard to be wrong in.
  //
  // ⛔ Fails CLOSED and names the offender. Do NOT "fix" a failure here by
  // relaxing the check -- point the variable at a seeded test account instead
  // (`pnpm test:e2e:setup` creates them).
  const IDENTITY_VARS = [
    "E2E_OWNER_EMAIL",
    "E2E_ADMIN_EMAIL",
    "E2E_COORDINATOR_EMAIL",
    "E2E_THERAPIST_A_EMAIL",
    "E2E_THERAPIST_B_EMAIL",
    "E2E_INACTIVE_EMAIL",
    "E2E_NON_STAFF_EMAIL",
  ];

  const realIdentities = IDENTITY_VARS.map((name) => ({ name, value: resolveEnvValue(name) }))
    // An unset identity self-skips its specs, which PRE-1b handles separately.
    // This guard is only about identities that ARE configured.
    .filter((entry) => entry.value && entry.value.trim() !== "")
    .filter((entry) => !/(?:@|\.)example\.test$/i.test(entry.value!.trim()));

  if (realIdentities.length > 0) {
    fail([
      "One or more E2E identities is NOT a seeded test account.",
      "",
      ...realIdentities.map((entry) => `  ${entry.name} = ${entry.value}`),
      "",
      "Every E2E identity must be on a `.example.test` domain. Anything else is",
      "a real mailbox, and signing in as it creates real sessions on a real",
      "person's account -- which is exactly what was happening before this guard",
      "existed: E2E_OWNER_EMAIL pointed at the Owner's own login.",
      "",
      "Run `pnpm test:e2e:setup` to create the seeded identities, then point the",
      "variable at one of them.",
      "",
      "⛔ Do NOT relax this check to get past it.",
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
