#!/usr/bin/env node

// ⛔ THE PRICE-DRIFT GUARD — the website vs the database. Read-only.
//
// Owner ruling D-044 (2026-08-22), chosen from three options: "add a safety
// check".
//
// ── THE PROBLEM, IN THE OWNER'S TERMS ────────────────────────────────────
//
// There are only five services, and their prices live in TWO independent
// places:
//
//   * THE WEBSITE quotes a price written into the code by hand
//     (src/features/booking/data/booking-packages.ts and four files that
//     mirror it).
//   * THE BOOKING is priced from the DATABASE. `create_booking_request`
//     computes `sum(price) from public.services` — measured in the live
//     function body, not inferred — and `create_recurring_booking_series`
//     does the same with `v_service.price`.
//
// So the moment somebody edits a price on the admin Services screen, the site
// keeps QUOTING the old number while the system CHARGES the new one. The
// customer is told £40 and billed £45, and nothing anywhere complains.
//
// ⚠️ They agree today — verified against production 2026-08-22, all five.
// This script exists so they cannot silently stop agreeing.
//
// ── ⛔ WHY THIS SCRIPT AND `price-parity.test.ts` ARE BOTH NEEDED ────────
//
// They cover different halves and neither is redundant:
//
//   price-parity.test.ts   the five CODE copies agree WITH EACH OTHER
//   this script            the code agrees WITH THE DATABASE
//
// Together they are transitive: database ↔ booking-packages.ts ↔ the other
// four files. ⛔ That is why this script deliberately reads only
// `booking-packages.ts` and not all five — importing the admin form would drag
// React and Next into a plain node script for no extra coverage, and the
// existing test already pins that file to the rest.
//
//   node scripts/verify-service-prices.mjs           # human-readable
//   node scripts/verify-service-prices.mjs --json    # machine-readable
//
// Exit 0 = the website and the database agree.
// Exit 1 = they have DRIFTED, and it says exactly which service and which way.
// Exit 2 = could not run at all, which is ⛔ NOT a pass.
//
// ⛔ WHEN THIS FAILS, THE DATABASE IS RIGHT AND THE CODE IS STALE — the
// database is what customers are actually charged. Update the code to match,
// in all five files (price-parity.test.ts will tell you if you miss one).

import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { BOOKING_PACKAGES } from "../src/features/booking/data/booking-packages.ts";

const JSON_MODE = process.argv.includes("--json");

/** Mirrors e2e/global-setup.ts and e2e/helpers.ts: process.env, then .env off
 *  disk. ⛔ Fails closed — a value it cannot resolve is an exit 2, never a pass. */
function resolveEnvValue(name) {
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

/**
 * "90 mins" -> 90, "1 hour" -> 60, "30 mins" -> 30.
 *
 * ⛔ Throws rather than returning null. A label this cannot read would
 * otherwise become a service that is silently NOT checked — a hole that looks
 * exactly like a pass. If the copy changes shape, teach this parser; do not
 * loosen it.
 */
function durationLabelToMinutes(label, slug) {
  const text = String(label ?? "").trim().toLowerCase();
  const hours = /^(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)$/.exec(text);
  if (hours) return Math.round(Number(hours[1]) * 60);
  const mins = /^(\d+)\s*(min|mins|minute|minutes)$/.exec(text);
  if (mins) return Number(mins[1]);
  throw new Error(
    `cannot read the duration label ${JSON.stringify(label)} on "${slug}". ` +
      `Teach durationLabelToMinutes() the new form — do not skip the service.`,
  );
}

async function main() {
  const url = resolveEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const key = resolveEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (process.env or .env).",
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("services")
    .select("slug, name, price, duration_mins, is_active");
  if (error) throw new Error(`could not read public.services — ${error.message}`);

  const live = new Map((data ?? []).map((row) => [row.slug, row]));
  const failures = [];
  const rows = [];

  for (const pkg of BOOKING_PACKAGES) {
    const row = live.get(pkg.id);
    if (!row) {
      failures.push(
        `${pkg.id}: the website offers this package but there is NO services row with that slug — ` +
          `a customer could pick something the booking engine cannot price.`,
      );
      rows.push({ slug: pkg.id, ok: false, detail: "missing in database" });
      continue;
    }

    const codeDuration = durationLabelToMinutes(pkg.durationLabel, pkg.id);
    const dbPrice = Number(row.price);
    const problems = [];

    if (dbPrice !== pkg.price) {
      problems.push(
        `PRICE: website says £${pkg.price}, database charges £${dbPrice}` +
          ` — a customer would be quoted £${pkg.price} and billed £${dbPrice}.`,
      );
    }
    if (Number(row.duration_mins) !== codeDuration) {
      problems.push(
        `DURATION: website says ${codeDuration} mins, database books ${row.duration_mins} mins.`,
      );
    }
    if (String(row.name).trim() !== String(pkg.name).trim()) {
      problems.push(`NAME: website says "${pkg.name}", database says "${row.name}".`);
    }
    // ⛔ Not cosmetic: `create_booking_request` and the recurring RPC both
    // filter `is_active = true`, so an inactive service is unbookable while the
    // website still advertises it.
    if (row.is_active !== true) {
      problems.push(
        `INACTIVE: the website still advertises this package, but the database has ` +
          `is_active = ${row.is_active} — the booking engine will refuse it.`,
      );
    }

    if (problems.length > 0) {
      for (const problem of problems) failures.push(`${pkg.id}: ${problem}`);
    }
    rows.push({
      slug: pkg.id,
      ok: problems.length === 0,
      codePrice: pkg.price,
      dbPrice,
      codeDuration,
      dbDuration: Number(row.duration_mins),
    });
  }

  // ⛔ THE OTHER DIRECTION, which a per-package loop cannot see: a service that
  // exists in the database and is bookable but that the website never offers.
  for (const [slug, row] of live) {
    if (row.is_active !== true) continue;
    if (BOOKING_PACKAGES.some((pkg) => pkg.id === slug)) continue;
    failures.push(
      `${slug}: the database has an ACTIVE service ("${row.name}", £${Number(row.price)}) ` +
        `that the website never offers.`,
    );
    rows.push({ slug, ok: false, detail: "active in database, absent from the website" });
  }

  const ok = failures.length === 0;

  if (JSON_MODE) {
    console.log(JSON.stringify({ ok, checked: BOOKING_PACKAGES.length, rows, failures }, null, 2));
  } else {
    console.log("");
    console.log(`service prices — website vs database, ${BOOKING_PACKAGES.length} packages`);
    console.log("");
    for (const row of rows) {
      if (row.detail) {
        console.log(`  FAIL ${row.slug.padEnd(18)} ${row.detail}`);
        continue;
      }
      console.log(
        `  ${row.ok ? "ok  " : "FAIL"} ${row.slug.padEnd(18)} ` +
          `£${String(row.codePrice).padStart(3)} / ${String(row.codeDuration).padStart(3)} mins  ` +
          `(database: £${row.dbPrice} / ${row.dbDuration} mins)`,
      );
    }
    console.log("");
    if (ok) {
      console.log("PASS — every website price, duration and name matches the live database.");
    } else {
      console.log(`FAIL — ${failures.length} problem(s):`);
      for (const failure of failures) console.log(`  ${failure}`);
      console.log("");
      console.log("⛔ The DATABASE is what customers are actually charged. Update the code");
      console.log("   to match it, in all five files — price-parity.test.ts names any you miss.");
    }
  }

  // ⛔ , NOT . Measured on Windows: calling
  // process.exit() here aborts inside libuv with
  // "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" and returns
  // 3221226505 — supabase-js still holds an open handle, and the node:24
  // TypeScript-stripping loader is also still live from the .ts import above.
  // ⛔ That crash would make this gate WORSE THAN USELESS: it printed PASS and
  // then exited non-zero, so the check said one thing and the exit code said
  // another. Setting exitCode lets node drain and exit on its own.
  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  // ⛔ Exit 2, never 0: "could not check" is not "checked and fine".
  console.error(`verify-service-prices: could not run — ${error.message}`);
  process.exitCode = 2;
});
