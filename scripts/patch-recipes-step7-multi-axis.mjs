#!/usr/bin/env node
// Step 3 of redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md
//
// Rewrite each recipe's Step 7 (single-axis "iterate") into a multi-axis
// polish loop, and insert a new Step 7b (visual polish loop, bounded).
// Then update the /goal evaluator quick-reference: substitute
// ITERATE_DECISION: → AXES_APPLIED:, and insert POLISH_ISSUES_ITER_2:
// before the HORIZONTAL_SCROLL anchor (with renumbering of subsequent items).
//
// Preserved per recipe (not touched by this script):
//   - The page-specific screenshot list at the top of Step 7
//   - Page-specific heads-up / sign-in notes that appear before "Self-assess..."
//   - Any page-specific quick-ref anchors (BORDER_L_4, BACKEND_FAKE_SURFACES,
//     SERVER_ONLY_GUARD, HORIZONTAL_SCROLL_DESKTOP, etc.) — renumbered, not removed.
//
// Idempotent: re-running after AXES_APPLIED is in place is a no-op.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";
const STEP7_START_MARKER =
  "Self-assess against the brief. If you can identify ONE specific axis problem:";
const STEP8_BOUNDARY_REGEX = /\n---\n\n## Step 8 — /;

function newStep7And7bBody(slug) {
  return `Visually self-audit against the brief, PRODUCT.md, DESIGN.md, and the Design Route Directives at the top of this recipe.

**Identify 2 to 4 axes** where the page has *visible* problems (not plausible improvements). Skip axes that contradict each other:
- \`bolder\` + \`quieter\` contradict
- \`distill\` + \`delight\` often contradict (distill removes; delight adds)

| Symptom | Skill |
|---|---|
| Generic, like every SaaS | \`/impeccable bolder ${slug}\` |
| Too loud, too many colours | \`/impeccable quieter ${slug}\` |
| Grey, lifeless, no identity | \`/impeccable colorize ${slug}\` |
| Fonts feel default or inconsistent | \`/impeccable typeset ${slug}\` |
| Spacing is off, things feel cramped | \`/impeccable layout ${slug}\` |
| Static, jumpy, no motion | \`/impeccable animate ${slug}\` |
| Functional but cold | \`/impeccable delight ${slug}\` |
| Too much on the page | \`/impeccable distill ${slug}\` |

**Skip \`/impeccable live\`** — interactive only, doesn't work headless.

**For each chosen axis (sequential, not parallel):**
1. Invoke the impeccable Skill tool with \`<axis> ${slug}\` args. Use the Skill tool (not the slash-command shorthand) so the invocation appears as a transcript event the Haiku evaluator can see.
2. After it completes, take \`chunk1-1440-after-<axis>.png\` at 1440×900 and save to \`/redesign/screenshots/${slug}-redesign/\`.
3. Write one line stating whether the change addressed the targeted problem.
4. If the axis did NOT resolve the targeted problem, do NOT run further axes on the same problem — emit \`STUCK: 7 — <axis> did not resolve <problem>\` and let the user guide.

**Hard cap:** maximum 4 axes per page. If more would be needed, the brief is the wrong shape — emit \`STUCK: 7 — page needs more than 4 axes; brief shape needs review\` and stop.

After all axes complete, take post-polish screenshots at all 3 viewports: \`${slug}-post-axes-{375,768,1440}.png\` to \`/redesign/screenshots/${slug}-redesign/\`.

**Evidence to surface:**
- All baseline + per-axis + post-polish screenshot file paths printed to chat (\`ls redesign/screenshots/${slug}-redesign/\`)
- Literal line: \`AXES_APPLIED: <axis-1>, <axis-2>, …\` followed by one-line rationale for each axis
- Append \`step-7: COMPLETE — axes applied: <list>\` and cat progress file

---

## Step 7b — Visual polish loop (bounded refinement, max 2 iterations)

**Action:** Now that axes are applied, look for visual discrepancies, design inconsistencies, frontend issues, layout gaps, and styling conflicts. The Design Route Directives at the top of this recipe are your north star.

**Audit at all 3 viewports** (use the \`playwright\` MCP):
- 375×812 — primary mobile
- 768×1024 — tablet
- 1440×900 — desktop

**List specific issues found** in chat as \`POLISH_ISSUES_ITER_<N>:\` followed by bullet points. Be specific — e.g. "card padding inconsistent between Today panel and Attention panel at 1440px", "primary button label wraps at 375px because copy too long", "status pill icon misaligned with text at all viewports".

**Apply fixes within existing scope only:**
- No new files outside the recipe's "Files to edit" list.
- No new components — use existing primitives.
- No new DESIGN.md tokens (existing ones only).
- Polish layout, spacing, alignment, consistency — not the feature set.

**Re-audit, list remaining issues, fix again.** Loop maximum 2 iterations. If after 2 iterations there are still issues, append them to \`/redesign/per-page-deferrals/${slug}-deferrals.md\` with **Defer to: Phase 7** and proceed.

**Evidence to surface:**
- \`POLISH_ISSUES_ITER_1: <issues list>\` followed by \`POLISH_FIXES_ITER_1: <fixes applied>\` (or \`POLISH_ISSUES_ITER_1: none\` if the first audit found nothing)
- \`POLISH_ISSUES_ITER_2: none — clean\` (or the remaining-issues list, deferred to Phase 7 if any)
- Final 3-viewport screenshots: \`${slug}-polish-final-{375,768,1440}.png\` saved to \`/redesign/screenshots/${slug}-redesign/\`
- Append \`step-7b: COMPLETE — polish loop done\` and cat progress file
`;
}

function rewriteQuickRef(content) {
  // Step 1: ITERATE_DECISION: → AXES_APPLIED: (substitute text, preserve number)
  content = content.replace(
    /(`)ITERATE_DECISION:(`)/g,
    "$1AXES_APPLIED:$2 (list of impeccable axes run with one-line rationale each)",
  );

  // Step 2: find the HORIZONTAL_SCROLL_TABLET line and its number
  const horizMatch = content.match(
    /^(\d+)\. `HORIZONTAL_SCROLL_TABLET: false`/m,
  );
  if (!horizMatch) return content;

  const horizNum = parseInt(horizMatch[1], 10);

  // Step 3: renumber every list item with number >= horizNum by +1
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d+)\. (.*)$/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num >= horizNum) {
        lines[i] = `${num + 1}. ${m[2]}`;
      }
    }
  }
  content = lines.join("\n");

  // Step 4: insert POLISH_ISSUES_ITER_2 line at horizNum position (just
  // before the renumbered HORIZONTAL line, which is now at horizNum + 1).
  // Match the HORIZONTAL line preserving whatever trails after the first
  // `false`` (some recipes have 3 anchors joined by commas).
  const horizLinePattern = new RegExp(
    `^${horizNum + 1}\\. (\`HORIZONTAL_SCROLL_TABLET: false\`.*)$`,
    "m",
  );
  content = content.replace(
    horizLinePattern,
    `${horizNum}. \`POLISH_ISSUES_ITER_2: none — clean\` (or the remaining-issues list, deferred to Phase 7 if any)\n${horizNum + 1}. $1`,
  );

  return content;
}

let patched = 0;
const skipped = [];
const failed = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith("-recipe.md"))) {
  const slug = file.replace(/-recipe\.md$/, "");
  const path = join(DIR, file);
  let content = readFileSync(path, "utf8");

  if (content.includes("AXES_APPLIED:")) {
    skipped.push(file);
    continue;
  }

  const start = content.indexOf(STEP7_START_MARKER);
  if (start === -1) {
    failed.push(`${file}: Step 7 start marker not found`);
    continue;
  }

  const restMatch = content.substring(start).match(STEP8_BOUNDARY_REGEX);
  if (!restMatch) {
    failed.push(`${file}: Step 8 boundary not found`);
    continue;
  }
  const end = start + restMatch.index;

  // Splice in the new Step 7 + 7b body
  content = content.slice(0, start) + newStep7And7bBody(slug) + content.slice(end);

  // Update quick-ref
  content = rewriteQuickRef(content);

  writeFileSync(path, content, "utf8");
  patched += 1;
  console.log(`✓ ${file}`);
}

if (skipped.length) {
  console.log("\nSkipped (already has AXES_APPLIED):");
  for (const f of skipped) console.log(`  · ${f}`);
}

if (failed.length) {
  console.log("\nFAILED:");
  for (const f of failed) console.log(`  ! ${f}`);
}

console.log(`\nPatched ${patched} recipes.`);
