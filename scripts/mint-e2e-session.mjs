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
//   node scripts/mint-e2e-session.mjs OWNER            # print cookies as JSON
//   node scripts/mint-e2e-session.mjs OWNER --write     # -> e2e/.auth/owner.json
//   node scripts/mint-e2e-session.mjs --all --write     # every role at once
//
// ⛔ `--write` is the mode the multi-agent role-play uses. The MAIN SESSION runs
// it before spawning any role agent; each agent then loads only ITS OWN
// e2e/.auth/<role>.json as Playwright storage state. The credential path is
// .env -> process.env -> Supabase SDK -> cookie file, so no password and no
// token value ever enters a sub-agent's context.
//
// ⛔ e2e/.auth/ is gitignored. Every file in it is a working login.
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

const ALL_ROLES = [
  "OWNER",
  "ADMIN",
  "COORDINATOR",
  "THERAPIST_A",
  "THERAPIST_B",
  "INACTIVE",
  "NON_STAFF",
];

async function mint(role, env) {
  const email = env[`E2E_${role}_EMAIL`];
  const password = env[`E2E_${role}_PASSWORD`];
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!email || !password) throw new Error(`No credentials in .env for role ${role}`);
  if (!url || !anonKey) throw new Error("Missing Supabase URL or anon key in .env");

  // ⛔ D-017: never sign in as a real person. The seeded identities all end in
  // example.test. Mirrors the guard in e2e/global-setup.ts — if these two ever
  // disagree, one of them is lying about what the run does.
  if (!/(?:@|\.)example\.test$/i.test(email.trim())) {
    throw new Error(
      `refusing to mint a session for ${role}: ${email} is not a seeded test account (D-017)`
    );
  }

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

  return { role, email, cookies };
}

/** Playwright storageState shape, so an agent can pass the file straight in. */
function toStorageState(minted, origin) {
  return {
    cookies: minted.cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: new URL(origin).hostname,
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 3600,
      httpOnly: false,
      secure: origin.startsWith("https"),
      sameSite: "Lax",
    })),
    origins: [],
  };
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const all = args.includes("--all");
  const roles = all
    ? ALL_ROLES
    : [(args.find((a) => !a.startsWith("--")) || "").toUpperCase()].filter(Boolean);

  if (roles.length === 0) {
    throw new Error("Usage: node scripts/mint-e2e-session.mjs <ROLE|--all> [--write]");
  }

  const env = loadEnv();
  const origin = env.E2E_BASE_URL || "http://localhost:3000";
  const results = [];
  const failures = [];

  for (const role of roles) {
    try {
      const minted = await mint(role, env);
      if (write) {
        fs.mkdirSync("e2e/.auth", { recursive: true });
        const out = `e2e/.auth/${role.toLowerCase()}.json`;
        fs.writeFileSync(out, JSON.stringify(toStorageState(minted, origin), null, 2), "utf8");
        // ⛔ role -> ok only. No email, no password, no token, no cookie value.
        console.error(`  ${role.padEnd(14)} ok   -> ${out}`);
      } else {
        results.push(minted);
      }
    } catch (error) {
      failures.push(role);
      console.error(`  ${role.padEnd(14)} FAILED — ${error.message}`);
    }
  }

  if (!write) console.log(JSON.stringify(all ? results : results[0]));

  // ⛔ A partial mint is not a pass: an agent whose file is missing would run
  // unauthenticated and report "access denied" as a finding.
  if (failures.length > 0) {
    throw new Error(`${failures.length} role(s) could not be minted: ${failures.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(`mint-e2e-session: FAILED — ${error.message}`);
  process.exit(1);
});
