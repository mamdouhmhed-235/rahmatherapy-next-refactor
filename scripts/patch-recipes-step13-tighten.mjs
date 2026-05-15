#!/usr/bin/env node
// Step 6 of redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md
//
// Rewrite each recipe's Step 13 (Handoff) to:
//   1. Add a "Canon mapping" blockquote at the top, documenting how this
//      recipe's internal Step 13 maps to workflow-guide canon Step 8 (and
//      how the recipe's 14 internal steps map to canon's 8).
//   2. Tighten the preflight checklist with explicit items:
//      - all quick-reference anchors emitted
//      - SCOPE_CLEAN check
//      - git diff stat + full diff
//      - screenshots at expected paths
//      - PER-PAGE-SCORES.md appended for audit + critique
//      - deferral file written (even if empty)
//      - no commit / no git add
//   3. Spell out the handoff message shape (URL with assigned port + slug,
//      screenshot paths grouped by step, etc.).
//
// Per-recipe substitution: slug + assigned port.
// Idempotent: skips recipes that already contain the canon-mapping marker.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";
const MARKER = "canon Step 8 — NO COMMIT";

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

function newStep13Body(slug, port) {
  return `## Step 13 — Handoff (canon Step 8 — NO COMMIT, wait for user approval)

> **Canon mapping:** this recipe's internal Step 13 corresponds to workflow-guide canon Step 8 (final handoff / commit decision per \`phase6-admin-workflow-guide.html\`). The recipe expands canon's 8 steps to 14 internal steps for autonomous-agent traceability. Full mapping: canon 1 → recipe 1 (re-prime), canon 2 → recipe 3 (framing), canon 3 → recipe 4 (craft), canon 4 → recipe 5 (ralph polish), canon 5 → recipes 7 / 7b / 8 / 9 / 10 (iterate / polish loop / adapt / harden / clarify), canon 6 → recipe 11 (verify), canon 7 → recipe 12 (audit / critique / smoke), canon 8 → recipe 13 (this handoff). The recipe is canonical to itself; the workflow guide is canon for the whole admin redesign.

**Action — final preflight checklist before emitting \`HANDOFF_READY\`:**
- [ ] Every literal string in this recipe's \`/goal evaluator quick-reference\` section has appeared in this transcript, each preceded by the tool output (or appended file section) that proves it. No retrospective summary-only emissions.
- [ ] \`git diff --stat\` reviewed in the worktree; printed to chat.
- [ ] Changed files match the recipe's "Files to edit" scope. Any file changed outside the list → emit \`SCOPE_VIOLATION: <file>\` and STOP. Otherwise emit \`SCOPE_CLEAN: only scoped files changed\`.
- [ ] \`git diff\` (full) printed to chat in collapsible form; nothing surprising.
- [ ] Screenshots present at expected paths (per Steps 7, 7b, 8, 11b, 12c — list them grouped by step in the handoff message).
- [ ] PER-PAGE-SCORES.md sections appended (\`## ${slug} — audit\` + \`## ${slug} — critique\`) and printed to chat verbatim from the subagent results (Step 12a + 12b).
- [ ] Deferral file written at \`/redesign/per-page-deferrals/${slug}-deferrals.md\` — even if empty, write \`(no deferrals — Phase 6 closed cleanly for ${slug})\`. The main agent and the Phase 7 gauntlet both read this; missing file = ambiguous closure.
- [ ] No commit. No \`git add\`. The main agent in the user's primary session stages + commits scoped files after the user approves.

**Handoff message — emit to chat in this shape:**
- Dev server URL: \`http://localhost:${port}/admin/${slug}\`
- All screenshot paths grouped by step (Step 7 baseline + per-axis + post-polish, Step 7b polish-final, Step 8 adapt-after, Step 11b final, Step 12c smoke)
- Audit headline scores (5 dimensions) + critique headline (10 Nielsen heuristics + AI-slop verdict)
- Any deviations from brief, or \`DEVIATIONS: none\`
- Deferrals file path
- Final literal line: \`HANDOFF_READY — awaiting user approval\`

**STOP. Do NOT stage. Do NOT commit. Wait for the user.**

**Evidence to surface:**
- \`git diff --stat\` output
- \`SCOPE_CLEAN: only scoped files changed\` (or \`SCOPE_VIOLATION:\`)
- Full handoff message
- The literal final line: \`HANDOFF_READY — awaiting user approval\`
- Append \`step-13: COMPLETE — handoff emitted, awaiting approval\` (final line in progress file) and cat progress file

`;
}

let patched = 0;
const skipped = [];
const failed = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith("-recipe.md"))) {
  const slug = file.replace(/-recipe\.md$/, "");
  const port = PORT_BY_SLUG[slug];
  if (!port) {
    failed.push(`${file}: no port assignment`);
    continue;
  }
  const path = join(DIR, file);
  let content = readFileSync(path, "utf8");

  if (content.includes(MARKER)) {
    skipped.push(file);
    continue;
  }

  // Find Step 13 start
  const step13Match = content.match(/^## Step 13 — /m);
  if (!step13Match) {
    failed.push(`${file}: ## Step 13 — not found`);
    continue;
  }
  const step13Idx = step13Match.index;

  // Find boundary: \n---\n\n# /goal evaluator quick-reference
  const qrMatch = content
    .substring(step13Idx)
    .match(/\n---\n\n# \/goal evaluator quick-reference/);
  if (!qrMatch) {
    failed.push(`${file}: quick-reference boundary not found`);
    continue;
  }
  const boundary = step13Idx + qrMatch.index; // points at the \n before ---

  // Replace [step13Idx, boundary + 1) with new body (template ends with \n\n).
  // Skipping +1 chars = the original \n before ---. New body's trailing \n\n
  // recreates the blank line before ---.
  content =
    content.slice(0, step13Idx) +
    newStep13Body(slug, port) +
    content.slice(boundary + 1);

  writeFileSync(path, content, "utf8");
  patched += 1;
  console.log(`✓ ${file}`);
}

if (skipped.length) {
  console.log("\nSkipped (already has canon mapping):");
  for (const f of skipped) console.log(`  · ${f}`);
}

if (failed.length) {
  console.log("\nFAILED:");
  for (const f of failed) console.log(`  ! ${f}`);
}

console.log(`\nPatched ${patched} recipes.`);
