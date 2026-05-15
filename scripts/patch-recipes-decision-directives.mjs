#!/usr/bin/env node
// Step 2 of redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md
//
// Insert two new recipe-header sections into every per-page recipe, between
// the existing "## Hard rules" block and the "## STUCK clause" block:
//
//   1. Decision-making directives — answer-source priority + forward-looking
//      criteria + deferral protocol (Phase 6 → Phase 7 bridge).
//   2. Design Route Directives — the design north star that governs every
//      visual + structural decision in steps 4–11.
//
// Idempotent: re-running after insertion has landed is a no-op (checks for
// the section heading marker before inserting).
//
// Slug substitution: the deferral file path inside the Decision-making
// section is `<slug>-deferrals.md` per recipe.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";
const MARKER = "## Decision-making directives";
const INSERTION_BEFORE = "## STUCK clause";

function sectionsFor(slug) {
  // Two sections, joined by a blank line, then a trailing blank line before
  // the existing STUCK clause that comes after.
  return `## Decision-making directives — when impeccable craft (or any tool) asks something not in the brief

The /goal session is autonomous — there's no user mid-run to consult. When impeccable craft's \`shape\` phase asks discovery questions (Purpose / User / Content / Feeling / Constraints), or any step surfaces a question or conflict, follow this order:

**Answer source priority (never invent):**
1. The brief at \`/redesign/briefs/${slug}-brief.md\` — quote the relevant section verbatim.
2. \`PRODUCT.md\` (register, brand voice, anti-references) and \`DESIGN.md\` (tokens, components, patterns).
3. \`BUSINESS-COMPLETENESS.md\` (Track A obligations).
4. \`/redesign/RECON.md\` for codebase facts.
5. If still uncovered: derive an answer using the *forward-looking criteria* below.

**Forward-looking criteria for derived answers:**
- Mobile-first; works at 375px before 1440px.
- Scales when the underlying list/data grows (pagination, load-more, virtualisation cues).
- Preserves named contracts: server-action signatures, form \`name\` attributes, IDs flagged in the recipe.
- Doesn't introduce cross-page contradictions — use shared components (\`AdminPanel\`, \`AdminEntityRow\`, \`EmptyState\`, \`BookingListCard\`, \`AdminStatusBadge\`) instead of new local equivalents.
- Uses DESIGN.md tokens, not raw colour/spacing/font literals.
- WCAG 2.1 AA: contrast, focus-visible, labels, \`role="alert"\` + \`aria-live\` on form errors, required \`*\` markers.
- Connects forward to Phase 7 (gauntlet/audit per \`impeccable-v5-latest-stable.html\`) and Phase 8 (extract/deploy) — don't bake decisions that contradict those phases' canonical scope.
- Follows the **Design Route Directives** below.

**Deferral protocol — when a question is NOT a Phase 6 blocker:**

Some questions impeccable surfaces are open suggestions, polish opportunities, or post-launch concerns that belong to Phase 7 (\`/impeccable audit admin\`) or Phase 8 (\`/impeccable extract admin\`). Do NOT answer them — defer:

1. Append to \`/redesign/per-page-deferrals/${slug}-deferrals.md\` in this format:

   \`\`\`
   ## <Question summary>
   - **Source:** <step number / skill / file:line>
   - **Verbatim:** <what impeccable or the brief or your own observation said>
   - **Defer to:** Phase 7 / Phase 8 / post-launch
   - **Why deferred:** <one sentence>
   - **Provisional Phase 6 answer used to continue this session:** <if any>
   \`\`\`

2. Proceed with the brief's documented Phase 6 answer (or the most conservative provisional that satisfies the forward-looking criteria).

Phase 7's gauntlet agent will read all 26 deferral files and resolve them globally. This is the bridge that makes Phase 6 → Phase 7 connect cleanly.

## Design Route Directives — design north star for this page

These govern every visual + structural decision in steps 4–11. Read once; apply everywhere.

1. **Beautiful, mobile-first.** 375px is the primary canvas — make it look intentional, not "the desktop scaled down". Enhance to 768 → 1440 from there.
2. **Production-ready, business-workflow ready.** This is an operational CRM/backend. Every screen should look and feel like a finished professional product, not a wireframe or default-styled component drop.
3. **Responsive, modern, reactive, interactive.** Use CSS transitions on hover/focus/tab states (DESIGN.md motion tokens — \`duration-fast\`, \`ease-gentle\`); respect \`prefers-reduced-motion\`. Feedback on every interactive element. Never static where motion would carry meaning.
4. **Simple front door that opens into the full feature set.** Progressive disclosure. The first surface a staff member sees is calm and obvious; complexity unfolds when invited (panels, \`<details>\`, \`AdminSheet\`, modals). Never strip features — hide them behind a tap or click.
5. **Professional CRM/backend feel — never awkward, weird, or mediocre.** No generic SaaS defaults. No identical-card grids. No decorative-blob-on-empty-state. Every visual element earns its place per PRODUCT.md anti-references.
6. **Designed for lists that grow.** Where data lists exist, plan for 50+ rows: pagination/load-more, visible row density at scale, A–Z index strips where alphabetical, "show more" disclosures, virtualisation cues.
7. **Polish without straying.** All improvements stay within the recipe's "Files to edit" scope, use existing DESIGN.md tokens (no new tokens without explicit user approval), and respect the brief's "Feature Preservation Manifest."

`;
}

let patched = 0;
const skipped = [];
const notFound = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith("-recipe.md"))) {
  const slug = file.replace(/-recipe\.md$/, "");
  const path = join(DIR, file);
  const before = readFileSync(path, "utf8");

  if (before.includes(MARKER)) {
    skipped.push(file);
    continue;
  }

  if (!before.includes(INSERTION_BEFORE)) {
    notFound.push(file);
    continue;
  }

  const insertion = sectionsFor(slug);
  const after = before.replace(
    INSERTION_BEFORE,
    `${insertion}${INSERTION_BEFORE}`,
  );

  writeFileSync(path, after, "utf8");
  patched += 1;
  console.log(`✓ ${file}`);
}

if (skipped.length) {
  console.log(`\nSkipped (already has Decision-making directives):`);
  for (const f of skipped) console.log(`  · ${f}`);
}

if (notFound.length) {
  console.log(`\nWARNING — recipes without "## STUCK clause" boundary marker:`);
  for (const f of notFound) console.log(`  ! ${f}`);
}

console.log(`\nPatched ${patched} recipes.`);
