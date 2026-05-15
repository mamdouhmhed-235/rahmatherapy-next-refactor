#!/usr/bin/env node
// Bulk-patch the per-page recipes in redesign/per-page-recipes/.
// Applies the 4 cross-cutting fixes the audit batch identified:
//
//   1. Token-drift regex bugs (ERE pipe escaping + Bash double-escape on \d).
//   2. font-family/spacing regex: switch to POSIX-ERE [[:space:]] for portability.
//   3. BACKEND_FAKE_SURFACES anchor + emission line for FAKE pages missing them.
//   4. Ralph-loop "N native sections + Recipe Context + Implementation Notes"
//      wording drift (all briefs have 14 sections, not 5/10/11).
//
// Page-specific edits (reports [288px] exemption, booking-detail quick-ref
// addition, etc.) are handled outside this script via direct Edit calls.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const RECIPE_DIR = "redesign/per-page-recipes";

// Recipes that are FAKE-backend but currently lack BACKEND_FAKE_SURFACES anchor.
// Confirmed by audit batch 3 (emails, email-templates, enquiries) + batch 4
// (privacy, operations, role-detail) + batch 5 (staff).
const FAKE_WITHOUT_ANCHOR = new Set([
  "email-templates-recipe.md",
  "emails-recipe.md",
  "enquiries-recipe.md",
  "privacy-recipe.md",
  "operations-recipe.md",
  "role-detail-recipe.md",
  "staff-recipe.md",
]);

const files = readdirSync(RECIPE_DIR).filter((f) => f.endsWith(".md"));
let total = 0;
let changedCount = 0;
const summary = [];

for (const file of files) {
  const path = join(RECIPE_DIR, file);
  const before = readFileSync(path, "utf8");
  let after = before;
  const localChanges = [];

  // ── Fix 1: raw-px regex
  // Before: grep -nE '\\d+px' <files>
  // After:  grep -nE '[0-9]+px' <files> | grep -v '@media'
  // We match the entire grep line because file lists vary by recipe.
  const reRawPxLine = /grep -nE '\\\\d\+px' (.*?)$/gm;
  if (reRawPxLine.test(after)) {
    after = after.replace(
      /grep -nE '\\\\d\+px' (.*?)$/gm,
      "grep -nE '[0-9]+px' $1 | grep -v '@media'",
    );
    localChanges.push("raw-px regex (ERE digit class + @media exclusion)");
  }

  // ── Fix 2: spacing regex
  // Before: grep -nE '(margin\|padding):\s*\d' <files>
  // After:  grep -nE '(margin|padding):[[:space:]]*[0-9]' <files>
  const reSpacingLine = /grep -nE '\(margin\\\|padding\):\\s\*\\d' (.*?)$/gm;
  if (reSpacingLine.test(after)) {
    after = after.replace(
      /grep -nE '\(margin\\\|padding\):\\s\*\\d' (.*?)$/gm,
      "grep -nE '(margin|padding):[[:space:]]*[0-9]' $1",
    );
    localChanges.push("spacing regex (ERE alternation + space class)");
  }

  // (font-family regex left as-is — `\s` is a GNU grep -E extension that works
  // on the target environment, Git Bash on Windows. Not broken in practice.)

  // ── Fix 4: ralph-loop wording drift
  // Replace "N native sections + Recipe Context + Implementation Notes" (and
  // close variants) with "all brief sections (5 native + Recipe Context + ...)".
  // Briefs vary in section count; the safe wording avoids a misleading number.
  const reRalphSections =
    /(\d+) native sections \+ Recipe Context \+ Implementation Notes/g;
  if (reRalphSections.test(after)) {
    after = after.replace(
      /(\d+) native sections \+ Recipe Context \+ Implementation Notes/g,
      "all brief sections (native + Recipe Context + Implementation Notes)",
    );
    localChanges.push("ralph-loop wording drift");
  }
  const reRalphSectionsAlt = /(\d+) native sections \+ Role variants/g;
  if (reRalphSectionsAlt.test(after)) {
    after = after.replace(
      /(\d+) native sections \+ Role variants/g,
      "all brief sections (native + Role variants)",
    );
    localChanges.push("ralph-loop wording drift (variant form)");
  }

  // ── Fix 5: "All N grep results" sentence in Step 11a evidence block
  // Replace ordinal-word ("four"/"five"/"six"/"seven"/"eight"/"nine") with
  // "token-drift" so the count never drifts again.
  const reGrepCount =
    /All (?:four|five|six|seven|eight|nine|ten|eleven|twelve) grep results/g;
  if (reGrepCount.test(after)) {
    after = after.replace(
      /All (?:four|five|six|seven|eight|nine|ten|eleven|twelve) grep results/g,
      "All token-drift grep results",
    );
    localChanges.push("Step 11a grep-count wording");
  }

  // ── Fix 6: FAKE recipes missing BACKEND_FAKE_SURFACES anchor + emission line
  if (FAKE_WITHOUT_ANCHOR.has(file)) {
    // Step 3 evidence section: insert a new bullet if not present.
    if (!/BACKEND_FAKE_SURFACES:/.test(after)) {
      // Insert after the SCOPE_PROPOSAL evidence bullet. Pattern:
      //   - Literal line `SCOPE_PROPOSAL:` followed by the files-to-edit list
      //   - `/redesign/per-page-scope/<slug>-scope.md` written; print its contents to chat
      // We add a bullet immediately after the second bullet (scope file path).
      const evidenceInsertion = after.replace(
        /(- `\/redesign\/per-page-scope\/[a-z0-9-]+-scope\.md` written; print its contents to chat\n)/,
        '$1- List of `data-redesign-backend="FAKE"` surfaces printed to chat as `BACKEND_FAKE_SURFACES:` bullets\n',
      );
      if (evidenceInsertion !== after) {
        after = evidenceInsertion;
        localChanges.push("Step 3 BACKEND_FAKE_SURFACES emission bullet");
      }

      // Quick-reference list: insert at position 6 (after SCOPE_PROPOSAL).
      // We renumber 6-16 → 7-17. The list always ends at HANDOFF_READY.
      const qrPattern =
        /(\n5\. `SCOPE_PROPOSAL:`\n)(6\. `CRAFT_COMPLETE`\n7\. `PAGE-POLISH-COMPLETE` \(inside `<promise>` tags\)\n8\. `DEV_SERVER_READY at http:\/\/localhost:3001`\n9\. `ITERATE_DECISION:`\n10\. `HORIZONTAL_SCROLL_TABLET: false` and `HORIZONTAL_SCROLL_MOBILE: false`\n11\. `TOKEN_DRIFT: 0` \(or each drift explicitly addressed\)\n12\. `CONSOLE_NEW_ERRORS: 0`\n13\. (`## [a-z0-9-]+ — audit` and `## [a-z0-9-]+ — critique` headings appended \(printed to chat from the file\))\n14\. `SMOKE_TEST: all PASS`\n15\. `SCOPE_CLEAN: only scoped files changed`\n16\. `HANDOFF_READY — awaiting user approval`)/;
      const qrReplacement =
        '$1' +
        '6. `BACKEND_FAKE_SURFACES:` (list of `data-redesign-backend="FAKE"` surfaces)\n' +
        '7. `CRAFT_COMPLETE`\n' +
        '8. `PAGE-POLISH-COMPLETE` (inside `<promise>` tags)\n' +
        '9. `DEV_SERVER_READY at http://localhost:3001`\n' +
        '10. `ITERATE_DECISION:`\n' +
        '11. `HORIZONTAL_SCROLL_TABLET: false` and `HORIZONTAL_SCROLL_MOBILE: false`\n' +
        '12. `TOKEN_DRIFT: 0` (or each drift explicitly addressed)\n' +
        '13. `CONSOLE_NEW_ERRORS: 0`\n' +
        '14. $3\n' +
        '15. `SMOKE_TEST: all PASS`\n' +
        '16. `SCOPE_CLEAN: only scoped files changed`\n' +
        '17. `HANDOFF_READY — awaiting user approval`';
      const qrReplaced = after.replace(qrPattern, qrReplacement);
      if (qrReplaced !== after) {
        after = qrReplaced;
        localChanges.push("quick-ref BACKEND_FAKE_SURFACES anchor (#6)");
      } else {
        localChanges.push("WARNING: quick-ref pattern did not match — manual fix needed");
      }
    }
  }

  total += 1;
  if (after !== before) {
    writeFileSync(path, after, "utf8");
    changedCount += 1;
    summary.push(`✓ ${file}: ${localChanges.join("; ")}`);
  } else {
    summary.push(`· ${file}: (no changes)`);
  }
}

console.log(`Scanned ${total} recipes, patched ${changedCount}.\n`);
for (const line of summary) console.log(line);
