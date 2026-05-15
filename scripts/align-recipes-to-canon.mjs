#!/usr/bin/env node
// One-shot script: align all per-page recipes to canonical impeccable v5 + phase 6 workflow guide.
// Applies 3 surgical edits across redesign/per-page-recipes/*-recipe.md:
//   G4 — restore canon's broad-px grep (\d+px) and add canon's spacing-literal grep
//   G2 — inline the canonical P0/P1/P2/P3 severity rubric in Step 12a
//   G1+G5 — extend Step 12a's PER-PAGE-SCORES.md append spec to require
//           **P1 (tag for Phase 7 gauntlet):** subsection and
//           **BUSINESS-COMPLETENESS impact:** subsection
// Does NOT create new files, NOT add new evaluator anchors, NOT touch source code.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RECIPES_DIR = 'redesign/per-page-recipes';
const recipes = readdirSync(RECIPES_DIR)
  .filter((f) => f.endsWith('-recipe.md'))
  .sort();

console.log(`Found ${recipes.length} recipes to align.\n`);

const RUBRIC_BLOCK = `**Severity rubric — anchor every finding before tagging (impeccable v5 L884-890):**
- **P0** Blocks release — fix before shipping anything
- **P1** Fix this sprint — significant impact on users
- **P2** Next cycle — noticeable but not blocking
- **P3** Polish — minor, fix when time allows

`;

let totalUpdates = 0;
const report = [];

for (const recipeFile of recipes) {
  const path = join(RECIPES_DIR, recipeFile);
  let content = readFileSync(path, 'utf8');
  const original = content;
  const changes = [];

  // ─── EDIT G4 — Token-drift canonical alignment ───────────────────────────
  // Substitute arbitrary-px `\[[0-9]+px\]` with canon's broad `\d+px` outside @media.
  // The arbitrary-px form catches Tailwind `text-[2px]`-style literals but misses
  // raw `2px` in style props. Canon's broader form catches both.
  const arbPxLineRe = /grep -nE '\\\[\[0-9\]\+px\\\]'/g;
  if (arbPxLineRe.test(content)) {
    content = content.replace(arbPxLineRe, `grep -nE '\\\\d+px'`);
    changes.push('G4a — arbitrary-px → broad px (\\d+px) per canon');
  }

  // Update the preceding comment for that grep to mention "outside @media" (canon).
  // Look for the existing "# Raw px" comment line and rewrite it.
  const pxCommentRe = /# Raw px [^\n]*\n/g;
  if (pxCommentRe.test(content)) {
    content = content.replace(
      pxCommentRe,
      '# Raw px values outside @media queries (canon: should be 0 outside @media rules)\n'
    );
    changes.push('G4b — px grep comment updated to canonical phrasing');
  }

  // Add canon's spacing-literal grep `(margin|padding):\s*\d` if not present.
  // Insert it AFTER the font-family grep line. Use the recipe's existing path
  // suffix (everything after the grep pattern) so we preserve per-page paths.
  if (!content.includes(`grep -nE '(margin\\|padding)`)) {
    // Find the font-family grep line and capture its path suffix.
    const fontFamRe = /(grep -nE "font-family:\\s\*\['\\"]" )([^\n]+\n)/;
    const match = content.match(fontFamRe);
    if (match) {
      const pathSuffix = match[2]; // includes trailing newline
      const insertion =
        '\n# Raw spacing literals (canon: should match the spacing scale in DESIGN.md)\n' +
        `grep -nE '(margin\\|padding):\\s*\\d' ${pathSuffix}`;
      // Insert right after the font-family grep line (i.e. after the entire match)
      content = content.replace(fontFamRe, `$1$2${insertion}`);
      changes.push('G4c — added canonical spacing-literal grep after font-family');
    }
  }

  // ─── EDIT G2 — Inline canonical severity rubric in Step 12a ──────────────
  // Insert the rubric block right after "### 12a — Audit\nInvoke Skill..." and
  // before the "Append to /redesign/PER-PAGE-SCORES.md..." block.
  const auditInvokeRe = /(### 12a — Audit\nInvoke Skill with `\/impeccable audit [^`]+`\.\n\n)(Append to `\/redesign\/PER-PAGE-SCORES\.md`)/;
  if (auditInvokeRe.test(content)) {
    content = content.replace(auditInvokeRe, `$1${RUBRIC_BLOCK}$2`);
    changes.push('G2 — canonical severity rubric inlined in Step 12a');
  }

  // ─── EDIT G1+G5 — Extend PER-PAGE-SCORES.md required structure ──────────
  // Add two required sub-list items inside the "Append to PER-PAGE-SCORES.md
  // under heading `## <page> — audit`:" block:
  //   - **P1 (tag for Phase 7 gauntlet):** subsection
  //   - **BUSINESS-COMPLETENESS impact:** subsection
  //
  // Anchor: find the line ending "- P0/P1/P2/P3 findings, each on its own line"
  // and append the two new requirements right after the Backend status line.
  const backendStatusRe = /(- Backend status: `[A-Z\-]+`[^\n]*\n)/;
  if (
    backendStatusRe.test(content) &&
    !content.includes('**P1 (tag for Phase 7 gauntlet):**')
  ) {
    const newLines =
      '- **P1 (tag for Phase 7 gauntlet):** subsection — list each P1 finding with location + file:line; if zero, write `none`. Phase 7 `/impeccable audit admin` re-scans this section.\n' +
      '- **BUSINESS-COMPLETENESS impact:** subsection — name any `redesign/BUSINESS-COMPLETENESS.md` items this page newly contributes to (e.g. `2A-6` if form-level error `role="alert"` was implemented). Lets the universal flag flip `PARTIAL` → `HANDLED` when all form-bearing pages adopt.\n';
    content = content.replace(backendStatusRe, `$1${newLines}`);
    changes.push('G1+G5 — added P1 subsection + BUSINESS-COMPLETENESS impact requirements');
  }

  if (content !== original) {
    writeFileSync(path, content);
    totalUpdates++;
    report.push({ file: recipeFile, changes });
    console.log(`✓ ${recipeFile}`);
    for (const c of changes) console.log(`    ${c}`);
  } else {
    console.log(`  ${recipeFile} — no changes (already aligned or pattern not matched)`);
    report.push({ file: recipeFile, changes: ['NO MATCH — manual review needed'] });
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Files modified: ${totalUpdates} / ${recipes.length}`);
console.log('');
const noMatches = report.filter((r) =>
  r.changes.some((c) => c.includes('NO MATCH'))
);
if (noMatches.length > 0) {
  console.log(`Files with no changes (manual review needed):`);
  noMatches.forEach((r) => console.log(`  - ${r.file}`));
}
