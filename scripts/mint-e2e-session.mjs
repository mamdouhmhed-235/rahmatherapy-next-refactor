#!/usr/bin/env node

// Mint a Supabase session for one of the `phase10.*` role identities and print
// the cookies a browser needs to be signed in as them.
//
// ⛔ WHY THIS EXISTS. Gate 08 drives a real browser through the MCP browser
// tools rather than Playwright's own bundled Chromium. `e2e/helpers.ts`
// `loginAs()` injects session cookies through Playwright's `addCookies()`, which
// is not available there — so this reproduces the same mechanism and emits the
// cookies as JSON for the driver to set.
//
// ⛔ It uses exactly the method loginAs() uses: `createBrowserClient` from
// @supabase/ssr with a cookie collector, then `signInWithPassword` with the
// credential already committed to .env for these designated test identities
// (Owner ruling D-006). ⛔ NO PASSWORD IS EVER TYPED INTO A FORM, by a human or
// by an agent — the credential goes straight from .env to the auth API and the
// resulting session comes back as cookies.
//
//   node scripts/mint-e2e-session.mjs OWNER
//   node scripts/mint-e2e-session.mjs THERAPIST_A
//
// Roles: OWNER · ADMIN · COORDINATOR · THERAPIST_A · THERAPIST_B · INACTIVE ·
//        NON_STAFF
//
// Exit 0 = a session was minted. Exit 1 = it was not, which is NOT "logged in".

import fs from "node:fs";
import process from "node:process";
import { createBrowserClient } from "@supabase/ssr";

function loadEnv() {
  const envText = fs.readFileSync(".env", "utf8");
  const env = {};
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, "");
  }
  return env;
}

async function main() {
  const role = (process.argv[2] || "").toUpperCase();
  if (!role) throw new Error("Usage: node scripts/mint-e2e-session.mjs <ROLE>");

  const env = loadEnv();
  const email = env[`E2E_${role}_EMAIL`];
  const password = env[`E2E_${role}_PASSWORD`];
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!email || !password) throw new Error(`No credentials in .env for role ${role}`);
  if (!url || !anonKey) throw new Error("Missing Supabase URL or anon key in .env");

  const collected = [];
  const jar = [];

  const supabase = createBrowserClient(url, anonKey, {
    isSingleton: false,
    cookies: {
      getAll: () => jar,
      setAll(cookies) {
        for (const cookie of cookies) {
          const at = jar.findIndex((c) => c.name === cookie.name);
          if (at >= 0) jar[at] = cookie;
          else jar.push(cookie);
          collected.push(cookie);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${role} (${email}): ${error.message}`);
  if (!data?.session) throw new Error(`sign-in returned no session for ${role}`);

  const cookies = collected
    .filter((c) => c.value)
    .map((c) => ({ name: c.name, value: c.value }));

  if (cookies.length === 0) throw new Error(`no session cookies produced for ${role}`);

  // stdout is the machine-readable half; everything else goes to stderr so the
  // JSON can be piped without being polluted.
  console.error(`minted ${role}: ${email} — ${cookies.length} cookie(s)`);
  console.log(JSON.stringify({ role, email, cookies }));
}

main().catch((error) => {
  console.error(`mint-e2e-session: FAILED — ${error.message}`);
  process.exit(1);
});
