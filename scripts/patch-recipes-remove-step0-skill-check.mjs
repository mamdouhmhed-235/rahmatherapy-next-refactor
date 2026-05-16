#!/usr/bin/env node
// Remove the upfront skill-availability check from every per-page recipe.
//
// Why: skills are pre-verified during the user's CC session preflight via the
// /skills command (LAUNCH-SHEET §0b). The autonomous spawned agent should NOT
// perform proactive dry-runs / no-op invocations / "test that skills resolve"
// before real work. If a skill invocation fails when actually USED mid-run,
// the agent should emit STUCK with the skill name and stop — no upfront
// ritual.
//
// Two changes per recipe:
//   1. Delete the entire "## Step 0 — Skill availability check (FIRST, do not
//      skip)" block — from the heading through the trailing `---` separator
//      before "## Step 1 — Turn 1: Re-prime".
//   2. In the `# /goal evaluator quick-reference` section near EOF: delete
//      the `1. \`SKILLS_OK: craft, adapt, harden, clarify, audit, critique,
//      ralph-loop\`` item, then decrement all subsequent numbered items by 1.
//
// Idempotent: skips recipes that no longer contain a Step 0 block.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";

let patched = 0;
const skipped = [];
const failed = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith("-recipe.md"))) {
  const path = join(DIR, file);
  let content = readFileSync(path, "utf8");

  // Step A: delete the Step 0 block.
  // Match from "## Step 0 — Skill availability check" up to (but not
  // including) "## Step 1 — ". Lazy match across newlines.
  const step0Pattern = /## Step 0 — Skill availability check[\s\S]*?(?=## Step 1 — )/;
  const step0Match = content.match(step0Pattern);

  if (!step0Match) {
    skipped.push(file);
    continue;
  }

  content = content.replace(step0Pattern, "");

  // Step B: quick-reference list — remove SKILLS_OK item + renumber.
  const qrHeader = "# /goal evaluator quick-reference";
  const qrStart = content.indexOf(qrHeader);
  if (qrStart === -1) {
    failed.push(`${file}: quick-reference header not found after Step 0 removal`);
    continue;
  }

  const before = content.substring(0, qrStart);
  const qrSection = content.substring(qrStart);
  const lines = qrSection.split("\n");

  // Find the SKILLS_OK line: starts with "1. `SKILLS_OK:" (could have either
  // backtick form depending on file)
  const skillsOkIdx = lines.findIndex((line) =>
    /^1\. `SKILLS_OK:/.test(line),
  );
  if (skillsOkIdx === -1) {
    failed.push(`${file}: SKILLS_OK item #1 not found in quick-reference`);
    continue;
  }

  // Remove the SKILLS_OK line
  lines.splice(skillsOkIdx, 1);

  // Decrement every subsequent numbered list line by 1.
  // We only renumber lines starting with `\d+\. ` (numbered list items).
  for (let i = skillsOkIdx; i < lines.length; i++) {
    const m = lines[i].match(/^(\d+)\. (.*)$/);
    if (m) {
      const num = parseInt(m[1], 10);
      lines[i] = `${num - 1}. ${m[2]}`;
    }
  }

  content = before + lines.join("\n");
  writeFileSync(path, content, "utf8");
  patched += 1;
  console.log(`✓ ${file}`);
}

if (skipped.length) {
  console.log(`\nSkipped (already removed):`);
  for (const f of skipped) console.log(`  · ${f}`);
}

if (failed.length) {
  console.log(`\nFAILED:`);
  for (const f of failed) console.log(`  ! ${f}`);
}

console.log(`\nPatched ${patched} recipes.`);
