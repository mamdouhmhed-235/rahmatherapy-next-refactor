#!/usr/bin/env node
// P1 follow-up to PHASE6-AUTONOMOUS-AGENT-PLAN.md execution.
//
// Step 13's tightened SCOPE_CLEAN check reads "any file changed outside the
// list → SCOPE_VIOLATION". Taken literally, an autonomous agent would flag
// runtime support files (per-page-progress, scope, deferrals, screenshots,
// HARDEN-RECS, PER-PAGE-SCORES appends) as scope violations because they
// aren't in the recipe's "Files to edit" list — even though those writes
// are EXPECTED per recipe instructions. That blocks autonomous handoff.
//
// Fix: clarify the SCOPE_CLEAN bullet to distinguish source files (subject
// to scope) from runtime support files (expected, not violations).
//
// Idempotent: skips recipes that already contain the "Runtime support files"
// marker added by this script.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";
const MARKER = "Runtime support files";

const OLD = `- [ ] Changed files match the recipe's "Files to edit" scope. Any file changed outside the list → emit \`SCOPE_VIOLATION: <file>\` and STOP. Otherwise emit \`SCOPE_CLEAN: only scoped files changed\`.`;

const NEW = `- [ ] **Source files** changed match the recipe's "Files to edit" scope. **Runtime support files** written per recipe instructions are EXPECTED and **NOT** scope violations even though they appear in \`git diff\` / \`git status\`. Expected runtime writes:
    - \`redesign/per-page-progress/<slug>-progress.md\` — Step 0+ append per step
    - \`redesign/per-page-scope/<slug>-scope.md\` — Step 3 writes
    - \`redesign/per-page-deferrals/<slug>-deferrals.md\` — Decision-making + Step 13 (sentinel if no deferrals)
    - \`redesign/screenshots/<slug>-redesign/*.png\` — Steps 7, 7b, 8, 11b, 12c
    - \`redesign/baseline/<slug>-adapt-after-{mobile,tablet}.png\` — Step 8
    - \`redesign/HARDEN-RECS-<slug>.md\` — Step 9
    - \`redesign/PER-PAGE-SCORES.md\` — Step 12 audit + critique appends
  Any **source file** (under \`src/\` or other code paths) changed outside the recipe's scope list → emit \`SCOPE_VIOLATION: <file>\` and STOP. Otherwise emit \`SCOPE_CLEAN: only scoped source files + expected runtime support files changed\`.`;

let patched = 0;
const skipped = [];
const failed = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith("-recipe.md"))) {
  const path = join(DIR, file);
  let content = readFileSync(path, "utf8");

  if (content.includes(MARKER)) {
    skipped.push(file);
    continue;
  }

  if (!content.includes(OLD)) {
    failed.push(`${file}: SCOPE_CLEAN bullet not found in expected form`);
    continue;
  }

  content = content.replace(OLD, NEW);
  writeFileSync(path, content, "utf8");
  patched += 1;
  console.log(`✓ ${file}`);
}

if (skipped.length) {
  console.log("\nSkipped (already patched):");
  for (const f of skipped) console.log(`  · ${f}`);
}

if (failed.length) {
  console.log("\nFAILED:");
  for (const f of failed) console.log(`  ! ${f}`);
}

console.log(`\nPatched ${patched} recipes.`);
