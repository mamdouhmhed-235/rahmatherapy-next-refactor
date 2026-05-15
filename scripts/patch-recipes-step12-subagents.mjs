#!/usr/bin/env node
// Step 5 of redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md
//
// Replace each recipe's Step 12 heading + 12a (Audit) + 12b (Critique) with
// subagent-dispatched versions. Preserves the page-specific Step 12c
// (Functional smoke test + Evidence to surface) intact — the smoke checklist
// is the page-specific Feature Preservation Manifest cross-check and varies
// per recipe.
//
// Why subagents: self-scoring inflation is a known failure mode. Login self-
// scored 20/20 audit + 37/40 critique — almost certainly inflated. Subagents
// re-prime from disk fresh and have no "I just did this work" bias.
//
// Caveats baked into the recipe text:
//   - Subagent internal turns are invisible to the parent /goal Haiku
//     evaluator — only the returned summary appears in main transcript.
//   - Main agent MUST paste subagent output verbatim into chat.
//   - Subagents do NOT write to PER-PAGE-SCORES.md — main agent writes.
//
// Idempotent: skips recipes that already contain the new heading marker.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";
const MARKER = "Audit + Critique (via subagents)";

function newStep12Body(slug) {
  return `## Step 12 — Audit + Critique (via subagents) + Smoke Test

This step dispatches subagents for the audit and critique commands. The reason: self-scoring inflation is a known failure mode (login self-scored 20/20 audit + 37/40 critique — almost certainly inflated by recency bias). Subagents start with no "I just did this work" bias and re-prime from disk fresh; the scores you bring back are objective.

**Subagent model + thinking:** subagents inherit your model + thinking level. The user must already be on Opus 4.7 + medium thinking in \`/config\` (preflight in LAUNCH-SHEET Section 0b). The Agent tool does NOT expose a per-subagent thinking override.

**Why both — and how it lands in the transcript:** subagent internal turns are invisible to the parent /goal Haiku evaluator. Only the subagent's *returned summary* reaches the main transcript. Therefore: subagents do NOT write to PER-PAGE-SCORES.md (their writes are invisible to the parent loop); they return text; the main agent performs the append + prints the appended section to chat. That print is what the Haiku evaluator sees.

### 12a — Audit (subagent)

**Action:** Use the Agent tool with \`subagent_type=general-purpose\`. Subagent prompt (the slug \`${slug}\` is already substituted below — pass this prompt verbatim):

\`\`\`
You are auditing the redesign of admin page ${slug} for Phase 6 of the Rahma Therapy admin redesign. The page has just been crafted, polished, adapted, and hardened by another agent. Your job is an objective code + design audit — you have NO bias from doing the work.

Re-prime (read these in order, in full):
1. /redesign/briefs/${slug}-brief.md
2. PRODUCT.md
3. DESIGN.md (full, including ## Admin-Specific Patterns)
4. /redesign/IMPLEMENTATION-PLAN.md — find the ${slug} row to determine Backend status (N-A / FAKE / HANDLED) and any BUILD plan dependencies
5. /redesign/BUSINESS-COMPLETENESS.md — to identify any Track A items this page contributes to
6. The post-polish screenshots at /redesign/screenshots/${slug}-redesign/${slug}-polish-final-{375,768,1440}.png
7. The current source code: src/app/admin/${slug}/** and any other files in the recipe's "Files to edit" list

Severity rubric (impeccable v5 L884-890 — quote it verbatim, do not paraphrase):
- P0 — Blocks release — fix before shipping anything
- P1 — Fix this sprint — significant impact on users
- P2 — Next cycle — noticeable but not blocking
- P3 — Polish — minor, fix when time allows

Task: invoke the impeccable Skill with \`audit ${slug}\`. Score 5 dimensions and surface all P0/P1/P2/P3 findings with file:line references.

Return format — the full audit text, formatted to be appendable to PER-PAGE-SCORES.md under heading \`## ${slug} — audit\`, with these required subsections:
- 5 dimension scores
- P0/P1/P2/P3 findings (each on its own line with file:line refs)
- Backend status (N-A / FAKE / HANDLED — if FAKE, name the blocking BUILD plan filename(s) verbatim from IMPLEMENTATION-PLAN.md)
- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line. If zero, write \`none\`. Phase 7 \`/impeccable audit admin\` re-scans this section.
- **BUSINESS-COMPLETENESS impact:** subsection — name any Track A items this page newly contributes to (e.g. \`2A-6\` if form-level \`role="alert" aria-live="polite"\` was implemented). If none, write \`none\`.

Do NOT write to PER-PAGE-SCORES.md. The main agent will perform the append. Return the full audit text verbatim.
\`\`\`

After the subagent returns:
1. Read the returned audit text from the Agent tool result.
2. Append it verbatim to \`/redesign/PER-PAGE-SCORES.md\` under heading \`## ${slug} — audit\`.
3. **Print the appended section to chat verbatim.** This is critical — the subagent's internal turns are invisible to the parent /goal evaluator. Without surfacing the appended section, the audit is invisible to the parent loop.
4. If any P0 finding exists: emit \`P0_FOUND:\` followed by the list and STOP. Do not proceed to 12b. The user decides fix-now vs defer.

### 12b — Critique (subagent)

**Action:** Use the Agent tool with \`subagent_type=general-purpose\`. Subagent prompt (\`${slug}\` already substituted):

\`\`\`
You are critiquing the redesign of admin page ${slug} for Phase 6. The page has been crafted + polished + adapted + hardened + audited by another agent. Your job is an objective UX critique — you have NO bias from doing the work.

Re-prime (read in full):
1. /redesign/briefs/${slug}-brief.md
2. PRODUCT.md
3. DESIGN.md (full)
4. The post-polish screenshots at /redesign/screenshots/${slug}-redesign/${slug}-polish-final-{375,768,1440}.png
5. The current source code: src/app/admin/${slug}/**

Task: invoke the impeccable Skill with \`critique ${slug}\`. Return:
- 10 Nielsen heuristic scores (Visibility of system status; Match between system and real world; User control and freedom; Consistency and standards; Error prevention; Recognition rather than recall; Flexibility and efficiency; Aesthetic and minimalist design; Help users recognize, diagnose, and recover from errors; Help and documentation)
- AI-slop verdict (PASS / REGRESSED / FAIL) with one-sentence reasoning
- Brief commentary on UX-quality, mapping concrete observations to PRODUCT.md anti-references (no generic SaaS feel, no identical-card grids, no decorative blobs, etc.)

Return format — the full critique text, formatted to be appendable to PER-PAGE-SCORES.md under heading \`## ${slug} — critique\`.

Do NOT write to PER-PAGE-SCORES.md. Return the full critique text verbatim.
\`\`\`

After the subagent returns:
1. Append verbatim to \`/redesign/PER-PAGE-SCORES.md\` under heading \`## ${slug} — critique\`.
2. **Print to chat verbatim** — same reasoning as 12a.
3. If AI-slop verdict is REGRESSED or FAIL: re-run \`/impeccable bolder ${slug}\` or \`/impeccable distill ${slug}\` (whichever fits the verdict's reasoning), then re-dispatch the critique subagent with the same prompt. Loop max 2 times. If after 2 loops the verdict is still REGRESSED/FAIL, append the verdict + reasoning to \`/redesign/per-page-deferrals/${slug}-deferrals.md\` with **Defer to: Phase 7** and proceed to 12c.

`;
}

let patched = 0;
const skipped = [];
const failed = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith("-recipe.md"))) {
  const slug = file.replace(/-recipe\.md$/, "");
  const path = join(DIR, file);
  let content = readFileSync(path, "utf8");

  if (content.includes(MARKER)) {
    skipped.push(file);
    continue;
  }

  // Find Step 12 start
  const step12Match = content.match(/^## Step 12 — /m);
  if (!step12Match) {
    failed.push(`${file}: ## Step 12 — not found`);
    continue;
  }
  const step12Idx = step12Match.index;

  // Find 12c start (boundary for preservation)
  const step12cIdx = content.indexOf("### 12c — Functional smoke test", step12Idx);
  if (step12cIdx === -1) {
    failed.push(`${file}: ### 12c — Functional smoke test not found`);
    continue;
  }

  // Replace [step12Idx, step12cIdx) with the new heading + 12a + 12b
  content =
    content.slice(0, step12Idx) +
    newStep12Body(slug) +
    content.slice(step12cIdx);

  writeFileSync(path, content, "utf8");
  patched += 1;
  console.log(`✓ ${file}`);
}

if (skipped.length) {
  console.log("\nSkipped (already rewritten):");
  for (const f of skipped) console.log(`  · ${f}`);
}

if (failed.length) {
  console.log("\nFAILED:");
  for (const f of failed) console.log(`  ! ${f}`);
}

console.log(`\nPatched ${patched} recipes.`);
