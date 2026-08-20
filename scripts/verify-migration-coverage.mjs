#!/usr/bin/env node

// Does every object the live database is expected to have actually appear in
// supabase/migrations/?
//
// ⛔ WHY THIS EXISTS. There are no Supabase backups on the free tier and no
// second database, so the migration files ARE the backup. If an object exists in
// production but no migration creates it, a rebuild silently produces a database
// that is missing it. This is the cheapest possible guard against that.
//
//   node scripts/verify-migration-coverage.mjs          # human-readable
//   node scripts/verify-migration-coverage.mjs --json   # machine-readable
//
// Exit 0 = every expected object name is present somewhere in the migrations.
// Exit 1 = at least one is absent -- a real hole in the rebuild.
// Exit 2 = the script could not run (missing files), which is NOT a pass.
//
// ⚠️ HONEST LIMITS -- read these before trusting a green run.
//
//   1. THIS IS OFFLINE. It compares the migrations against
//      scripts/expected-db-objects.json, a snapshot of the live catalogue taken
//      2026-08-20. It does NOT connect to the database, so it CANNOT detect
//      drift introduced after that date -- e.g. a table added through the
//      Supabase dashboard and never written as a migration. Regenerate the
//      manifest deliberately whenever you add an object, in the same commit as
//      its migration. The SQL to regenerate it is at the bottom of this file.
//
//      (It is offline on purpose. The repo's only credential reaches PostgREST,
//      which cannot read the Postgres catalogs -- see the same limitation
//      documented in verify-system-integrity.mjs. Reading them from a script
//      would mean adding a catalog-exposing function to the public schema, which
//      is more API surface than this check is worth.)
//
//   2. NAME PRESENCE IS NOT CORRECTNESS. A name appearing in the corpus proves
//      the migrations mention it; it does not prove the object is built with the
//      right columns, predicate or body. Absence is proof of a hole; presence is
//      only the absence of that particular hole.
//
//   3. IMPLICIT INDEXES ARE SKIPPED. Indexes ending `_pkey` or `_key` are
//      created by PRIMARY KEY / UNIQUE inside CREATE TABLE, so their names are
//      never written down. They are excluded and counted separately.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const MANIFEST = path.join(HERE, "expected-db-objects.json");

const asJson = process.argv.includes("--json");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

if (!fs.existsSync(MIGRATIONS_DIR)) fail(`missing directory: ${MIGRATIONS_DIR}`);
if (!fs.existsSync(MANIFEST)) fail(`missing manifest: ${MANIFEST}`);

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) fail(`no .sql files in ${MIGRATIONS_DIR}`);

// One corpus. A name is "covered" if it appears anywhere in any migration --
// deliberately loose, because the point is to catch ABSENCE, and parsing every
// DDL form correctly would create false alarms that erode trust in the gate.
const corpus = files
  .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
  .join("\n");

const GROUPS = [
  ["tables", "TABLE"],
  ["types", "TYPE"],
  ["functions", "FUNCTION"],
  ["triggers", "TRIGGER"],
  ["policys", "POLICY"],
  ["indexs", "INDEX"],
];

const results = [];
let missingTotal = 0;
let checkedTotal = 0;
let implicitTotal = 0;

for (const [key, label] of GROUPS) {
  const names = manifest[key] ?? [];

  const implicit =
    label === "INDEX"
      ? names.filter((n) => n.endsWith("_pkey") || n.endsWith("_key"))
      : [];
  const checked = names.filter((n) => !implicit.includes(n));

  const missing = checked.filter((n) => {
    // functions are stored as schema.name; the migration writes the bare name
    const needle = label === "FUNCTION" ? n.split(".").pop() : n;
    return !corpus.includes(needle);
  });

  checkedTotal += checked.length;
  implicitTotal += implicit.length;
  missingTotal += missing.length;

  results.push({
    group: label,
    expected: names.length,
    checked: checked.length,
    implicit: implicit.length,
    missing,
  });
}

// ⛔ Guards the guard. If the manifest were emptied or the corpus failed to
// load, every group would report zero missing and this would "pass" while
// checking nothing -- the exact silent-failure mode this repo has hit before.
if (checkedTotal === 0) {
  fail("manifest produced 0 checkable names -- refusing to report a pass");
}
if (corpus.length < 10_000) {
  fail(`migration corpus is only ${corpus.length} bytes -- refusing to report a pass`);
}

if (asJson) {
  process.stdout.write(
    `${JSON.stringify(
      {
        migrationFiles: files.length,
        corpusBytes: corpus.length,
        checked: checkedTotal,
        implicitSkipped: implicitTotal,
        missing: missingTotal,
        groups: results,
        manifestGenerated: manifest._generated ?? null,
      },
      null,
      2
    )}\n`
  );
} else {
  process.stdout.write(
    `migration coverage — ${files.length} files, ${corpus.length.toLocaleString()} bytes\n` +
      `manifest generated ${manifest._generated ?? "(unknown)"}\n\n`
  );
  for (const r of results) {
    const flag = r.missing.length === 0 ? "ok  " : "FAIL";
    process.stdout.write(
      `  ${flag} ${r.group.padEnd(9)} expected ${String(r.expected).padStart(3)}` +
        `  checked ${String(r.checked).padStart(3)}` +
        (r.implicit ? `  implicit ${r.implicit}` : "") +
        `  missing ${r.missing.length}\n`
    );
    for (const m of r.missing) process.stdout.write(`        [MISSING] ${m}\n`);
  }
  process.stdout.write(
    `\n  ${checkedTotal} names checked, ${implicitTotal} implicit indexes skipped\n`
  );
  process.stdout.write(
    missingTotal === 0
      ? "\nPASS — every expected object appears in the migrations.\n" +
          "⚠️  Offline check: says nothing about drift since the manifest date.\n"
      : `\nFAIL — ${missingTotal} object(s) exist in the expected catalogue but appear in NO migration.\n` +
          "A rebuild from this directory would not create them.\n"
  );
}

process.exit(missingTotal === 0 ? 0 : 1);

// ─────────────────────────────────────────────────────────────────────────────
// To regenerate scripts/expected-db-objects.json, run this through the Supabase
// SQL editor (or MCP) and reshape the rows into the JSON groups:
//
//   select 'TABLE:'||c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
//     where n.nspname='public' and c.relkind='r'
//   union all select 'FUNCTION:'||n.nspname||'.'||p.proname from pg_proc p
//     join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private')
//   union all select 'TRIGGER:'||t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid
//     join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
//   union all select 'POLICY:'||policyname from pg_policies where schemaname='public'
//   union all select 'INDEX:'||indexname from pg_indexes where schemaname='public'
//   union all select 'TYPE:'||t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace
//     where n.nspname='public' and t.typtype='e'
//   order by 1;
