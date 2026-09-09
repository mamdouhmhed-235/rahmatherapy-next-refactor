#!/usr/bin/env node
/**
 * READ-ONLY row-count baseline for the production database.
 *
 * ⛔ WHY THIS EXISTS AND WHAT IT IS FOR.
 * `verify-system-integrity.mjs` answers a different question — it checks that the
 * rules seed is unchanged and that one deleted record has not returned. It is
 * NOT a "nothing was written" check, and it has been quoted as one. This script
 * is the missing half: a fixed expected row count for every table, so that after
 * any change you can ask "did anything move that should not have?" and get an
 * exact answer instead of an impression.
 *
 * Run it BEFORE and AFTER any piece of work that touches the database:
 *     node --env-file=.env scripts/verify-baseline.mjs
 *
 * ⛔ HOW TO READ A MISMATCH. A mismatch is not automatically a fault. Three of
 * these tables move for legitimate reasons and the numbers below already include
 * such movement:
 *   - `audit_logs` grows whenever anyone does anything, INCLUDING reading a
 *     report — `/admin/reports/export` writes an audit row on a GET. 30 rows were
 *     added that way on 2026-08-29 and deliberately left in place: deleting audit
 *     entries to make a number match falsifies the trail.
 *   - `operational_events` grows on a failed booking attempt, which is what a
 *     paused-booking probe produces.
 *   - `email_delivery_events` grows whenever an email is queued or sent.
 * Everything else moving means something wrote to real clinic data.
 *
 * ⚠️ PostgREST caps a normal read at 1000 rows and answers HTTP 206, which is a
 * SUCCESS. This uses a HEAD request with `Prefer: count=exact` and reads the
 * Content-Range header instead, so the count is true above 1000.
 *
 * ⛔ UPDATE THE NUMBERS DELIBERATELY, NEVER TO GET A GREEN RUN. If a count has
 * legitimately changed, change it here in the same commit that caused it and say
 * why in the commit message. A baseline edited to silence a warning is worse than
 * no baseline.
 */

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "⛔ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "   Run with:  node --env-file=.env scripts/verify-baseline.mjs"
  );
  process.exit(2);
}

/**
 * ⛔ REBASELINED 2026-09-03 after the authorised test-data wipe.
 *
 * The previous numbers (captured 2026-08-30 at commit 01fbf30) described the
 * test fixtures that the Owner then instructed be deleted permanently. Every
 * one of them is now zero, so the old baseline reported 7 mismatches and the
 * script could no longer do its real job — telling you when something wrote to
 * data that should not have moved.
 *
 * ⛔ THIS IS THE ONE LEGITIMATE REASON TO CHANGE THESE NUMBERS. The header rule
 * — never edit them to make a mismatch go away — still stands absolutely. It is
 * being changed here because a deliberate, documented, Owner-approved deletion
 * moved the real state, and the reason is recorded rather than the evidence
 * being quietly erased. Full account:
 * `redesign/admin-ui-audit/PLAN-account-and-data-reset-FINAL.md`.
 *
 * What was deleted: 14 clients, 14 bookings and their children, 3 enquiries,
 * 84 consent_events, 4 operational_events, 38 email_delivery_events,
 * 11 staff_profiles and 12 auth logins. `audit_logs` was NOT touched — 318
 * before, 318 after — and 186 of its rows had their author's name written into
 * `after_state` first, so none of them silently became "System".
 *
 * ⚠️ EXPECT staff_profiles TO CHANGE AGAIN, ONCE, SOON. The Owner is creating
 * two new accounts (one Therapist, one Admin). When they exist:
 *     staff_profiles: 1  ->  3
 * That is the ONLY expected movement. Update it then and note the date here.
 * Anything else moving still means something wrote to data that should not have.
 */
const EXPECTED = {
  // Clinic data — ⛔ any movement here is real client data changing.
  // All zero since the 2026-09-03 wipe. The FIRST real customer booking will
  // move these, which is correct and expected once bookings reopen.
  clients: 0,
  bookings: 0,
  booking_participants: 0,
  booking_items: 0,
  booking_assignments: 0,
  enquiries: 0,
  // ⚠️ consent_events is NOT listed here on purpose. It holds 84 rows before the
  // 2026-09-03 wipe and 0 after, but it is not exposed through PostgREST — this
  // script's HEAD request returns HTTP 403. Adding it produces a permanent
  // ERROR line, which trains people to ignore a red result. Check it directly
  // with SQL if you ever need to: `select count(*) from consent_events;`

  // Configuration — should only move when someone deliberately changes settings.
  // ⚠️ staff_profiles: 1 today (the Owner alone). Becomes 3 when the two new
  // accounts are created — see the note above.
  staff_profiles: 1,
  services: 5,
  business_settings: 1,
  availability_rules: 7,
  blocked_dates: 0,
  staff_blocked_dates: 0,
  availability_overrides: 0,
  staff_availability_rules: 0,
  staff_availability_overrides: 0,

  // Access control — ⛔ movement here is a permission change. Treat as serious.
  roles: 5,
  permissions: 40,
  role_permissions: 95,

  // Append-only / volatile — these grow in normal use. See the header.
  // ⛔ audit_logs was deliberately NOT deleted in the 2026-09-03 wipe and must
  //    never be. 318 is the true figure; a DROP here is a red flag, not drift.
  audit_logs: 318,
  operational_events: 0,
  email_delivery_events: 0,
};

const VOLATILE = new Set(["audit_logs", "operational_events", "email_delivery_events"]);

async function count(table) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*`, {
    method: "HEAD",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const range = response.headers.get("content-range");
  if (!response.ok && response.status !== 206) return { err: `HTTP ${response.status}` };
  if (!range) return { err: "no content-range header" };
  return { n: Number(range.split("/")[1]) };
}

let hard = 0;
let soft = 0;

for (const [table, want] of Object.entries(EXPECTED)) {
  const result = await count(table);
  if (result.err) {
    console.log(`ERROR     ${table.padEnd(30)} ${result.err}`);
    hard += 1;
    continue;
  }
  if (result.n === want) {
    console.log(`OK        ${table.padEnd(30)} ${String(want).padStart(5)}`);
    continue;
  }
  const drift = result.n - want;
  const sign = drift > 0 ? `+${drift}` : String(drift);
  if (VOLATILE.has(table)) {
    console.log(
      `MOVED     ${table.padEnd(30)} want ${String(want).padStart(5)}  got ${String(result.n).padStart(5)}  (${sign}, append-only)`
    );
    soft += 1;
  } else {
    console.log(
      `MISMATCH  ${table.padEnd(30)} want ${String(want).padStart(5)}  got ${String(result.n).padStart(5)}  (${sign})`
    );
    hard += 1;
  }
}

console.log("");
if (hard === 0 && soft === 0) {
  console.log("BASELINE EXACT — every table matches.");
} else if (hard === 0) {
  console.log(
    `BASELINE HOLDS — ${soft} append-only table(s) grew, which is normal. No clinic data moved.`
  );
} else {
  console.log(
    `⛔ ${hard} TABLE(S) DO NOT MATCH. Something wrote to data that should not have moved.\n` +
      "   Find out what before continuing. Do NOT edit the numbers to make this pass."
  );
}
process.exit(hard === 0 ? 0 : 1);
