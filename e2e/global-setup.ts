// Playwright globalSetup — fail LOUDLY rather than skip silently.
//
// Why this file exists (P-3, production-readiness run 2026-08-19):
//
// Every spec in e2e/ opens with `test.skip(!hasBaseUrl(), ...)`. Playwright does
// not load .env, so a bare `playwright test` left E2E_BASE_URL unset, every spec
// self-skipped, and the run reported SUCCESS while asserting nothing. A green
// exit code meant "36 skipped", which is indistinguishable from a real pass to
// anyone reading the exit status.
//
// This setup turns that silent pass into a hard failure. It runs before any
// spec, so a misconfigured run stops at the door.
//
// It also enforces the database boundary that was previously only a comment at
// the top of helpers.ts: E2E_BASE_URL points the APP at localhost, but the
// Supabase URL decides which DATABASE the run authenticates against and writes
// to. Those are independent, and the dangerous combination -- local app, live
// database -- looks perfectly safe at a glance.

// The live customer project. A run may only target it with explicit opt-in.
const PRODUCTION_SUPABASE_REF = "twzutkfgqclqurvkmvqz";

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  if (supabaseUrl.includes(PRODUCTION_SUPABASE_REF) && !process.env.E2E_ALLOW_PRODUCTION_DB) {
    fail([
      "This run would authenticate against and write to the PRODUCTION database.",
      "",
      "E2E_BASE_URL points the app at localhost, but NEXT_PUBLIC_SUPABASE_URL",
      "still resolves to the live customer project. loginAs() creates real",
      "auth.sessions rows, and any booking-mutating spec writes real rows.",
      "",
      "Point NEXT_PUBLIC_SUPABASE_URL at a Supabase branch/preview database, or",
      "set E2E_ALLOW_PRODUCTION_DB=1 to acknowledge the target deliberately.",
      "",
      "⛔ The client `Badar` and its booking are REAL. Nothing may modify them.",
    ]);
  }

  // Surface what the run will actually do, so the target is never a surprise.
  // Booleans and hostnames only -- never a credential value.
  const target = supabaseUrl.includes(PRODUCTION_SUPABASE_REF) ? "PRODUCTION (opt-in)" : "non-production";
  console.log(`[e2e] app: ${process.env.E2E_BASE_URL}`);
  console.log(`[e2e] database: ${target}`);
}
