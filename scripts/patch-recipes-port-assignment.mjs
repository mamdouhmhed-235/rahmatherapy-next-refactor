#!/usr/bin/env node
// Step 1 of redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md
//
// Pre-assign a unique localhost port to every per-page recipe so that 26
// parallel /goal sessions never collide. Port 3001 was the global default;
// user's main tree owns 3000. Per-page ports run 3002–3027, alphabetical.
//
// Bulk-replaces every `\b3001\b` token in each recipe with that recipe's
// assigned port (looked up by filename slug). Idempotent: re-running after
// assignment has landed produces no changes.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PORT_BY_SLUG = {
  "account-password-requests": 3002,
  "audit": 3003,
  "availability": 3004,
  "booking-detail": 3005,
  "calendar": 3006,
  "client-detail": 3007,
  "client-new": 3008,
  "clients": 3009,
  "dashboard-coordinator": 3010,
  "dashboard-owner-admin": 3011,
  "dashboard-therapist": 3012,
  "email-templates": 3013,
  "emails": 3014,
  "enquiries": 3015,
  "login": 3016,
  "operations": 3017,
  "password-reset": 3018,
  "privacy": 3019,
  "reports": 3020,
  "role-detail": 3021,
  "roles": 3022,
  "services": 3023,
  "settings": 3024,
  "staff": 3025,
  "staff-availability": 3026,
  "staff-detail": 3027,
};

const DIR = "redesign/per-page-recipes";

let patched = 0;
const skipped = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith("-recipe.md"))) {
  const slug = file.replace(/-recipe\.md$/, "");
  const port = PORT_BY_SLUG[slug];
  if (!port) {
    skipped.push(file);
    continue;
  }
  const path = join(DIR, file);
  const before = readFileSync(path, "utf8");
  const count = (before.match(/\b3001\b/g) ?? []).length;
  const after = before.replace(/\b3001\b/g, String(port));
  if (after !== before) {
    writeFileSync(path, after, "utf8");
    patched += 1;
    console.log(`✓ ${file}: 3001 → ${port} (${count} occurrences)`);
  } else {
    console.log(`· ${file}: no 3001 found (already assigned port ${port}?)`);
  }
}

if (skipped.length) {
  console.log("\nWARNING — recipes with no port assignment (filename → slug mismatch?):");
  for (const f of skipped) console.log(`  - ${f}`);
}

console.log(`\nPatched ${patched} of ${readdirSync(DIR).filter((f) => f.endsWith("-recipe.md")).length} recipes.`);
