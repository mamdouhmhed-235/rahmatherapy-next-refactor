#!/usr/bin/env node

// ⛔ GATE 07 CASE 2 — THE FIXTURE-DRIFT GUARD. Read-only.
//
// The role → permission mapping lives in ONE place: the `role_permissions` rows
// in the database. Every authorization test in this repo builds a synthetic
// profile from a hand-written permission list, so if the database and those
// lists ever disagree, the whole suite goes on passing while testing a role that
// no longer exists.
//
// This script is the only thing that can notice. It reads the live grants and
// compares them to the expected set below, naming every added and removed
// permission per role.
//
//   node scripts/verify-rbac-grants.mjs           # human-readable
//   node scripts/verify-rbac-grants.mjs --json    # machine-readable
//
// Exit 0 = the database matches. Exit 1 = drift, and it says exactly what moved.
// Exit 2 = could not run at all, which is NOT a pass.
//
// ⛔ `role_permissions` is a READ-ONLY system table for the whole
// production-readiness programme, and the 95 grants below are intentional
// (Owner ruling: "whatever is present on my site now is my doing and with my
// permission"). This script pins them; it never questions or changes them.
// If a grant genuinely changes, update EXPECTED_GRANTS in the same commit and
// say why in the message.
//
// Measured live 2026-08-20: 5 roles · 40 permissions · 95 grants.

import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_GRANTS = {
  // Every permission in the system.
  Owner: [
    "assign_bookings", "assign_staff_roles", "claim_assignments",
    "create_client_session_notes", "export_reports_own", "export_reports_revenue",
    "manage_account_requests", "manage_audit_logs", "manage_availability_global",
    "manage_availability_own", "manage_bookings_all", "manage_bookings_assigned",
    "manage_client_destructive_ops", "manage_client_identity_fields", "manage_clients_all",
    "manage_email_settings", "manage_email_templates", "manage_enquiries",
    "manage_permission_overrides", "manage_privacy_operations", "manage_role_templates",
    "manage_sensitive_client_notes", "manage_services", "manage_settings",
    "manage_staff_profiles", "manage_travel_origin", "resend_booking_emails",
    "view_bookings_all", "view_bookings_assigned", "view_client_contact_details",
    "view_client_health_notes_assigned", "view_clients_all", "view_clients_assigned",
    "view_dashboard", "view_email_logs", "view_reports_business",
    "view_reports_operational", "view_reports_own", "view_reports_revenue", "view_staff",
  ],
  // Owner minus 8: the three Owner-exclusive admin powers (permission overrides,
  // role templates, travel origin) and the five "own/assigned" personal-scope
  // permissions that only a practising therapist needs.
  Admin: [
    "assign_bookings", "assign_staff_roles", "claim_assignments",
    "export_reports_revenue", "manage_account_requests", "manage_audit_logs",
    "manage_availability_global", "manage_availability_own", "manage_bookings_all",
    "manage_bookings_assigned", "manage_client_destructive_ops",
    "manage_client_identity_fields", "manage_clients_all", "manage_email_settings",
    "manage_email_templates", "manage_enquiries", "manage_privacy_operations",
    "manage_sensitive_client_notes", "manage_services", "manage_settings",
    "manage_staff_profiles", "resend_booking_emails", "view_bookings_all",
    "view_bookings_assigned", "view_client_contact_details", "view_clients_all",
    "view_dashboard", "view_email_logs", "view_reports_business",
    "view_reports_operational", "view_reports_revenue", "view_staff",
  ],
  // Practising therapist: everything scoped to their OWN assignments. ⛔ Holds
  // view_client_health_notes_assigned — they are the person treating the client.
  Therapist: [
    "claim_assignments", "create_client_session_notes", "export_reports_own",
    "manage_availability_own", "manage_bookings_assigned", "resend_booking_emails",
    "view_bookings_assigned", "view_client_contact_details",
    "view_client_health_notes_assigned", "view_clients_assigned", "view_dashboard",
    "view_reports_own",
  ],
  // ⛔ Front-desk scope. Deliberately holds NEITHER health-note permission, which
  // is what makes the booking-detail redaction observable — see
  // src/app/admin/bookings/[bookingId]/__tests__/booking-detail-data.test.ts.
  // Also holds assign_bookings but NOT claim_assignments: they hand work out,
  // they do not take it.
  "Booking Coordinator": [
    "assign_bookings", "manage_bookings_all", "manage_clients_all", "manage_enquiries",
    "resend_booking_emails", "view_bookings_all", "view_client_contact_details",
    "view_clients_all", "view_dashboard", "view_email_logs", "view_reports_operational",
  ],
  // ⛔ Deliberately empty. The role exists so a deactivated staff member keeps a
  // role_id rather than a dangling reference. Zero grants is the assertion.
  Inactive: [],
};

const EXPECTED_ROLE_COUNT = 5;
const EXPECTED_PERMISSION_COUNT = 40;
const EXPECTED_GRANT_COUNT = 95;

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

function createAdminClient() {
  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase URL or service role key in .env.");
  }
  return {
    host: new URL(env.NEXT_PUBLIC_SUPABASE_URL).host,
    client: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

async function main() {
  const asJson = process.argv.includes("--json");
  const { host, client } = createAdminClient();

  const { data: roles, error: rolesError } = await client.from("roles").select("id, name");
  if (rolesError) throw new Error(`roles read failed: ${rolesError.message}`);

  const { count: permissionCount, error: permError } = await client
    .from("permissions")
    .select("*", { count: "exact", head: true });
  if (permError) throw new Error(`permissions read failed: ${permError.message}`);

  const { data: grants, error: grantsError } = await client
    .from("role_permissions")
    .select("roles(name), permissions(name)");
  if (grantsError) throw new Error(`role_permissions read failed: ${grantsError.message}`);

  const live = {};
  for (const role of roles) live[role.name] = [];
  for (const row of grants) {
    const roleName = row.roles?.name;
    const permissionName = row.permissions?.name;
    if (roleName && permissionName) live[roleName].push(permissionName);
  }
  for (const name of Object.keys(live)) live[name].sort();

  const failures = [];
  const drift = {};

  if (roles.length !== EXPECTED_ROLE_COUNT) {
    failures.push(`roles: expected ${EXPECTED_ROLE_COUNT}, found ${roles.length}`);
  }
  if (permissionCount !== EXPECTED_PERMISSION_COUNT) {
    failures.push(`permissions: expected ${EXPECTED_PERMISSION_COUNT}, found ${permissionCount}`);
  }
  if (grants.length !== EXPECTED_GRANT_COUNT) {
    failures.push(`role_permissions: expected ${EXPECTED_GRANT_COUNT}, found ${grants.length}`);
  }

  const allRoleNames = new Set([...Object.keys(EXPECTED_GRANTS), ...Object.keys(live)]);
  for (const roleName of [...allRoleNames].sort()) {
    const expected = EXPECTED_GRANTS[roleName];
    const actual = live[roleName];

    if (!expected) {
      failures.push(`⛔ role "${roleName}" exists in the database but not in this file`);
      continue;
    }
    if (!actual) {
      failures.push(`⛔ role "${roleName}" is expected but missing from the database`);
      continue;
    }

    const added = actual.filter((p) => !expected.includes(p));
    const removed = expected.filter((p) => !actual.includes(p));
    drift[roleName] = { expected: expected.length, actual: actual.length, added, removed };

    if (added.length || removed.length) {
      failures.push(
        `⛔ ${roleName}: ${added.length} added [${added.join(", ")}], ` +
          `${removed.length} removed [${removed.join(", ")}]`
      );
    }
  }

  const ok = failures.length === 0;
  const report = {
    database_host: host,
    roles: roles.length,
    permissions: permissionCount,
    grants: grants.length,
    drift,
    failures,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`rbac grants — ${host}`);
    console.log("");
    console.log(`  ${roles.length === EXPECTED_ROLE_COUNT ? "ok  " : "FAIL"} roles              ${roles.length} (expect ${EXPECTED_ROLE_COUNT})`);
    console.log(`  ${permissionCount === EXPECTED_PERMISSION_COUNT ? "ok  " : "FAIL"} permissions        ${permissionCount} (expect ${EXPECTED_PERMISSION_COUNT})`);
    console.log(`  ${grants.length === EXPECTED_GRANT_COUNT ? "ok  " : "FAIL"} grants             ${grants.length} (expect ${EXPECTED_GRANT_COUNT})`);
    console.log("");
    for (const [roleName, d] of Object.entries(drift)) {
      const clean = d.added.length === 0 && d.removed.length === 0;
      console.log(`  ${clean ? "ok  " : "FAIL"} ${roleName.padEnd(20)} ${String(d.actual).padStart(2)} grants`);
      for (const p of d.added) console.log(`         + ${p}   (in the database, not expected)`);
      for (const p of d.removed) console.log(`         - ${p}   (expected, not in the database)`);
    }
    console.log("");
    if (ok) {
      console.log("PASS — the live role→permission mapping matches the expected set exactly.");
    } else {
      console.log(`FAIL — ${failures.length} problem(s):`);
      for (const f of failures) console.log(`  ${f}`);
      console.log("");
      console.log("⛔ If this drift is INTENTIONAL, update EXPECTED_GRANTS in this file in the");
      console.log("   same commit as the database change, and say why in the commit message.");
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  // ⛔ Exit 2, never 0: "could not check" is not "checked and fine".
  console.error(`verify-rbac-grants: could not run — ${error.message}`);
  process.exit(2);
});
