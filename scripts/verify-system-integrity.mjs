#!/usr/bin/env node

// Layer 5 of DATABASE-SAFETY-PLAN: the before/after control for every gate that
// writes to the database.
//
// ⛔ WHAT THIS PROTECTS. Not the data — the data is disposable test data by Owner
// ruling D-005. It protects "the system": the rules seed (roles, permissions,
// role_permissions, services, business_settings, availability_rules) and the one
// real client record, `Badar`. Losing the rules means rebuilding the business
// logic by hand; losing Badar means losing the clinic's only real customer row.
//
// ⛔ HOW TO USE IT. Run it BEFORE and AFTER every write-touching gate and diff
// the two outputs. A non-zero exit, or any diff outside `counts.volatile`, stops
// the run immediately.
//
//   node scripts/verify-system-integrity.mjs                 # human-readable
//   node scripts/verify-system-integrity.mjs --json          # stable JSON
//   node scripts/verify-system-integrity.mjs --save <path>   # write JSON to disk
//
// Exit 0 = every invariant holds. Exit 1 = at least one failed. Exit 2 = the
// script could not run at all (missing env, network), which is NOT a pass.
//
// ⚠️ HONEST LIMIT — read this before trusting it. This script reaches the
// database through PostgREST with the service-role key, which is the only
// credential this repo holds. PostgREST cannot read the Postgres catalogs, so
// this script CANNOT verify RLS policies, function bodies, ACLs, triggers,
// constraints or indexes. Those are pinned separately by the catalog digests in
// `.production-readiness/runs/2026-08-18_baseline/03-tests/05-database/evidence/catalog-baseline.json`,
// which are checked by running the SQL recorded in that file through the
// Supabase MCP. ⛔ Do not read a green run here as "the schema is unchanged".
// It means "the rules seed and Badar are unchanged".

import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

// ⛔ Owner ruling D-005: the one real customer. Never modify, delete, re-book,
// re-assign, anonymise or email this row.
const BADAR_CLIENT_ID = "4978ae6d-79d0-4119-a8c0-fd374e8dc75d";
const BADAR_EXPECTED_BOOKINGS = 1;

// The rules seed. These are the system; everything else is data.
const EXPECTED = {
  roles: 5,
  permissions: 40,
  role_permissions: 95,
  services: 5,
  business_settings: 1,
  availability_rules: 7,
};

const EXPECTED_ROLE_NAMES = [
  "Admin",
  "Booking Coordinator",
  "Inactive",
  "Owner",
  "Therapist",
];

// Counts that legitimately move when a gate creates test data. Recorded so a
// diff is explainable, but never asserted.
const VOLATILE_TABLES = [
  "bookings",
  "clients",
  "booking_participants",
  "booking_items",
  "booking_assignments",
  "audit_logs",
  "staff_profiles",
  "enquiries",
];

function loadEnv() {
  const envText = fs.readFileSync(".env", "utf8");
  const env = {};

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex);
    env[key] = line.slice(separatorIndex + 1).replace(/^"|"$/g, "");
  }

  return env;
}

function createAdminClient() {
  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase URL or service role key in .env.");
  }

  // Recorded so a diff shows WHICH database was measured. Host only — ⛔ never
  // the key, and never the full URL's credentials.
  const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host;

  return {
    host,
    client: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`count(${table}) failed: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const saveIndex = args.indexOf("--save");
  const savePath = saveIndex >= 0 ? args[saveIndex + 1] : null;

  const { host, client } = createAdminClient();
  const failures = [];
  const report = {
    // ⛔ No timestamp field. Two runs of an unchanged system must be
    // byte-identical so `diff` is the whole test.
    database_host: host,
    seed: {},
    role_names: [],
    role_permission_pairs_md5: null,
    permission_names_md5: null,
    badar: {},
    counts: { volatile: {} },
    failures: [],
  };

  // --- 1. the rules seed, by exact count ------------------------------------
  for (const [table, expected] of Object.entries(EXPECTED)) {
    const actual = await countRows(client, table);
    report.seed[table] = actual;
    if (actual !== expected) {
      failures.push(`${table}: expected ${expected}, found ${actual}`);
    }
  }

  // --- 2. the roles themselves, by name -------------------------------------
  const { data: roles, error: rolesError } = await client
    .from("roles")
    .select("name")
    .order("name");
  if (rolesError) throw new Error(`roles read failed: ${rolesError.message}`);
  report.role_names = roles.map((r) => r.name);
  const roleNamesMatch =
    JSON.stringify(report.role_names) === JSON.stringify(EXPECTED_ROLE_NAMES);
  if (!roleNamesMatch) {
    failures.push(
      `role names changed: expected ${EXPECTED_ROLE_NAMES.join(",")}, found ${report.role_names.join(",")}`
    );
  }

  // --- 3. the 95 grants as PAIRS, not just a count --------------------------
  // A count of 95 survives swapping a grant between two roles. The pair digest
  // does not, which is the whole point of hashing rather than counting.
  const { data: rolePerms, error: rpError } = await client
    .from("role_permissions")
    .select("roles(name), permissions(name)");
  if (rpError) throw new Error(`role_permissions read failed: ${rpError.message}`);
  const pairs = rolePerms
    .map((row) => `${row.roles?.name ?? "?"}|${row.permissions?.name ?? "?"}`)
    .sort();
  report.role_permission_pairs_md5 = await md5(pairs.join("\n"));
  report.counts.role_permission_pairs = pairs.length;

  const { data: perms, error: permError } = await client
    .from("permissions")
    .select("name")
    .order("name");
  if (permError) throw new Error(`permissions read failed: ${permError.message}`);
  report.permission_names_md5 = await md5(perms.map((p) => p.name).join("\n"));

  // --- 4. Badar ------------------------------------------------------------
  const { data: badar, error: badarError } = await client
    .from("clients")
    .select("id, deleted_at")
    .eq("id", BADAR_CLIENT_ID)
    .maybeSingle();
  if (badarError) throw new Error(`Badar read failed: ${badarError.message}`);

  if (!badar) {
    failures.push(`⛔ PROTECTED RECORD MISSING: clients.id = ${BADAR_CLIENT_ID}`);
    report.badar = { present: false, deleted: null, bookings: null };
  } else {
    const bookings = await client
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("client_id", BADAR_CLIENT_ID);
    if (bookings.error) throw new Error(`Badar bookings failed: ${bookings.error.message}`);

    report.badar = {
      present: true,
      deleted: badar.deleted_at !== null,
      bookings: bookings.count ?? 0,
    };

    if (badar.deleted_at !== null) {
      failures.push(`⛔ PROTECTED RECORD SOFT-DELETED: clients.id = ${BADAR_CLIENT_ID}`);
    }
    if ((bookings.count ?? 0) !== BADAR_EXPECTED_BOOKINGS) {
      failures.push(
        `⛔ PROTECTED RECORD booking count changed: expected ${BADAR_EXPECTED_BOOKINGS}, found ${bookings.count}`
      );
    }
  }

  // --- 5. volatile counts — recorded, never asserted ------------------------
  for (const table of VOLATILE_TABLES) {
    report.counts.volatile[table] = await countRows(client, table);
  }

  report.failures = failures;
  const ok = failures.length === 0;

  const json = JSON.stringify(report, null, 2);
  if (savePath) fs.writeFileSync(savePath, json + "\n", "utf8");

  if (asJson) {
    console.log(json);
  } else {
    console.log(`system integrity — ${host}`);
    console.log("");
    for (const [table, expected] of Object.entries(EXPECTED)) {
      const actual = report.seed[table];
      console.log(`  ${actual === expected ? "ok  " : "FAIL"} ${table.padEnd(20)} ${actual} (expect ${expected})`);
    }
    console.log(`  ${roleNamesMatch ? "ok  " : "FAIL"} role names          ${report.role_names.join(", ")}`);
    console.log(`  ..   grant pairs md5     ${report.role_permission_pairs_md5} (${report.counts.role_permission_pairs} pairs)`);
    console.log(`  ..   permission md5      ${report.permission_names_md5}`);
    console.log("");
    const badarOk =
      report.badar.present &&
      !report.badar.deleted &&
      report.badar.bookings === BADAR_EXPECTED_BOOKINGS;
    console.log(`  ${badarOk ? "ok  " : "FAIL"} protected client     present=${report.badar.present} deleted=${report.badar.deleted} bookings=${report.badar.bookings}`);
    console.log("");
    console.log("  volatile counts (recorded, not asserted):");
    for (const [table, n] of Object.entries(report.counts.volatile)) {
      console.log(`       ${table.padEnd(22)} ${n}`);
    }
    console.log("");
    if (ok) {
      console.log("PASS — the rules seed and the protected record are unchanged.");
      console.log("⚠️  This says nothing about policies, functions, ACLs or triggers.");
      console.log("    Those are pinned by catalog-baseline.json via the Supabase MCP.");
    } else {
      console.log(`FAIL — ${failures.length} problem(s):`);
      for (const f of failures) console.log(`  - ${f}`);
    }
  }

  process.exit(ok ? 0 : 1);
}

async function md5(text) {
  const { createHash } = await import("node:crypto");
  return createHash("md5").update(text, "utf8").digest("hex");
}

main().catch((error) => {
  // ⛔ Exit 2, not 1 and never 0: "could not check" is not "checked and fine".
  console.error(`verify-system-integrity: could not run — ${error.message}`);
  process.exit(2);
});
