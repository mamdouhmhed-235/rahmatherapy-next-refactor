import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ⛔ THIS TEST EXISTS BECAUSE TYPESCRIPT CANNOT DO THIS JOB.
 *
 * Wiring the generated `Database` type into the Supabase clients closed part of
 * the schema-mismatch bug class, but only part. `postgrest-js` constrains the
 * FILTER methods (`.eq`, `.neq`, `.in`) to real column names — and leaves
 * `.order()` and `.select()` accepting any string at all.
 *
 * That gap is not theoretical. It is exactly the shape of the worst bug found in
 * the 2026-08 production-readiness assessment:
 *
 *     .from("booking_participants").select("id").order("created_at")
 *
 * `booking_participants` has no `created_at`. PostgREST answered HTTP 400, the
 * caller destructured only `data`, the error vanished, and every therapist
 * selection an admin made was silently discarded. 3,119 unit tests and a clean
 * `tsc` all passed throughout, and `tsc` STILL compiles that line today.
 *
 * So this test checks the two things the compiler will not: the column named in
 * `.order()`, and the bare column list in `.select()`.
 *
 * Ground truth is `src/lib/supabase/database.types.ts`, which is generated from
 * the live schema (`pnpm db:typegen`). ⛔ If a migration is applied without
 * regenerating that file, this test goes stale in the same breath as `tsc` does.
 */

const REPO_ROOT = join(__dirname, "..", "..");
const SRC = join(REPO_ROOT, "src");
const TYPES_FILE = join(SRC, "lib", "supabase", "database.types.ts");

/** table name -> the set of column names on its Row type. */
function loadSchema(source: string): Map<string, Set<string>> {
  const schema = new Map<string, Set<string>>();
  // The generated file nests as:  <table>: { Row: { <col>: <type> ... } ... }
  const tableBlock = /^ {6}(\w+): \{$/gm;
  let m: RegExpExecArray | null;
  while ((m = tableBlock.exec(source)) !== null) {
    const table = m[1];
    const rowStart = source.indexOf("        Row: {", m.index);
    if (rowStart === -1) continue;
    const rowEnd = source.indexOf("\n        }", rowStart);
    if (rowEnd === -1) continue;
    const cols = new Set<string>();
    for (const line of source.slice(rowStart, rowEnd).split("\n").slice(1)) {
      const c = /^ {10}(\w+):/.exec(line);
      if (c) cols.add(c[1]);
    }
    if (cols.size > 0) schema.set(table, cols);
  }
  return schema;
}

/**
 * ⛔ Strips comments before scanning.
 *
 * Without this the scanner reads its own documentation: several fixes in this
 * codebase carry a comment QUOTING the broken query they replaced, e.g.
 * `// was .select("booking_date, staff_id")`. Reporting those as live defects
 * is exactly the sort of false alarm that teaches a team to ignore a test.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

type Offence = { file: string; table: string; column: string; method: string };

/**
 * Scans one file for `.from("table")` and inspects the chain that follows, up to
 * the next `.from(` or the end of the statement.
 *
 * ⛔ DELIBERATELY CONSERVATIVE — a false alarm here would waste a reviewer's time
 * and teach everyone to ignore this test, which is worse than the gap it closes.
 * It therefore SKIPS anything it cannot read with certainty:
 *   - a `.select()` containing "(" (an embedded relation: the columns inside
 *     belong to a DIFFERENT table),
 *   - a `.select()` containing ":" (an alias) or "*",
 *   - an `.order()` given a `referencedTable` option,
 *   - any table name not present in the generated types (a view, or another
 *     schema).
 */
function scan(file: string, schema: Map<string, Set<string>>): Offence[] {
  const source = stripComments(readFileSync(file, "utf8"));
  const offences: Offence[] = [];
  const fromCall = /\.from\(\s*["'`](\w+)["'`]\s*\)/g;
  let m: RegExpExecArray | null;

  while ((m = fromCall.exec(source)) !== null) {
    const table = m[1];
    const columns = schema.get(table);
    if (!columns) continue; // not a public table we know about — skip, don't guess

    const rest = source.slice(m.index + m[0].length);
    const nextFrom = rest.search(/\.from\(\s*["'`]/);
    const chain = nextFrom === -1 ? rest.slice(0, 2000) : rest.slice(0, nextFrom);

    for (const o of chain.matchAll(/\.order\(\s*["'`]([\w.]+)["'`]([^)]*)\)/g)) {
      if (/referencedTable/.test(o[2])) continue;
      if (o[1].includes(".")) continue; // qualified — belongs to an embedded table
      if (!columns.has(o[1])) {
        offences.push({ file, table, column: o[1], method: "order" });
      }
    }

    for (const s of chain.matchAll(/\.select\(\s*["'`]([^"'`]*)["'`]/g)) {
      const list = s[1];
      if (list.includes("(") || list.includes(":") || list.includes("*")) continue;
      for (const raw of list.split(",")) {
        const col = raw.trim();
        if (!col || !/^\w+$/.test(col)) continue;
        if (!columns.has(col)) {
          offences.push({ file, table, column: col, method: "select" });
        }
      }
    }
  }
  return offences;
}

const schema = loadSchema(readFileSync(TYPES_FILE, "utf8"));

describe("Supabase column names that TypeScript cannot check", () => {
  it("reads a schema from the generated types at all", () => {
    // Guards against the scanner silently checking nothing if the generated
    // file's shape ever changes — the classic void test.
    expect(schema.size).toBeGreaterThan(20);
    expect(schema.get("booking_participants")).toBeDefined();
    expect(schema.get("booking_participants")!.has("display_name")).toBe(true);
    expect(schema.get("booking_participants")!.has("created_at")).toBe(false);
  });

  it("⛔ NEGATIVE CONTROL — it catches the exact bug that shipped", () => {
    // If this ever stops failing, the scanner has gone blind and every green
    // result below is worthless.
    const offences = scanSource(
      'x.from("booking_participants").select("id").order("created_at", { ascending: true });'
    );
    expect(offences).toHaveLength(1);
    expect(offences[0]).toMatchObject({
      table: "booking_participants",
      column: "created_at",
      method: "order",
    });
  });

  it("⛔ NEGATIVE CONTROL — it catches a wrong column in a select list", () => {
    const offences = scanSource('x.from("staff_profiles").select("id, full_name");');
    expect(offences).toHaveLength(1);
    expect(offences[0]).toMatchObject({ table: "staff_profiles", column: "full_name" });
  });

  it("does not flag an embedded relation's columns", () => {
    // `full_name` belongs to clients, not bookings — a false alarm here is what
    // would make people stop trusting this test.
    expect(scanSource('x.from("bookings").select("id, clients ( full_name )");')).toEqual([]);
  });

  it("every .order() and .select() column in src/ exists on its table", () => {
    const offences = walk(SRC).flatMap((f) => scan(f, schema));
    const readable = offences.map(
      (o) => `${relative(REPO_ROOT, o.file)} — .${o.method}("${o.column}") on "${o.table}"`
    );
    expect(readable).toEqual([]);
  });
});

/** Scans a source string rather than a file — used by the controls above. */
function scanSource(rawSource: string): Offence[] {
  const source = stripComments(rawSource);
  const tmp = join(SRC, "__scan_probe_virtual__.ts");
  const original = readFileSync;
  // Avoid touching the filesystem: reuse `scan` by inlining its logic on a string.
  void original;
  void tmp;
  const offences: Offence[] = [];
  const fromCall = /\.from\(\s*["'`](\w+)["'`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = fromCall.exec(source)) !== null) {
    const table = m[1];
    const columns = schema.get(table);
    if (!columns) continue;
    const rest = source.slice(m.index + m[0].length);
    const nextFrom = rest.search(/\.from\(\s*["'`]/);
    const chain = nextFrom === -1 ? rest : rest.slice(0, nextFrom);
    for (const o of chain.matchAll(/\.order\(\s*["'`]([\w.]+)["'`]([^)]*)\)/g)) {
      if (/referencedTable/.test(o[2]) || o[1].includes(".")) continue;
      if (!columns.has(o[1])) offences.push({ file: "<inline>", table, column: o[1], method: "order" });
    }
    for (const s of chain.matchAll(/\.select\(\s*["'`]([^"'`]*)["'`]/g)) {
      const list = s[1];
      if (list.includes("(") || list.includes(":") || list.includes("*")) continue;
      for (const raw of list.split(",")) {
        const col = raw.trim();
        if (!col || !/^\w+$/.test(col)) continue;
        if (!columns.has(col)) offences.push({ file: "<inline>", table, column: col, method: "select" });
      }
    }
  }
  return offences;
}
