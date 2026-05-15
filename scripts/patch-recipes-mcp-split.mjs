#!/usr/bin/env node
// Step 4 of redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md
//
// MCP role split: align recipes with workflow-guide canon (which uses both
// MCPs — playwright for screenshots/interactions, chrome-devtools for
// console + network). Retire the earlier "playwright NOT chrome-devtools"
// guidance that crept into Step 7.
//
// Four sub-changes per recipe:
//   1. Insert a new "## MCP usage" section in the recipe header, between
//      "## Oversize file handling" content and the "---\n\n# Steps" divider.
//   2. Strip the parenthetical "(NOT `chrome-devtools` — playwright handles
//      redirects)" from Step 7 (and any other steps that have it).
//   3. Update the Step 11c heading "### 11c — Console + Network" to
//      "### 11c — Console + Network (via `chrome-devtools` MCP)".
//   4. Rewrite the Step 11c bullets to invoke specific chrome-devtools tools:
//      `chrome-devtools__list_console_messages` and
//      `chrome-devtools__list_network_requests`.
//
// Idempotent: skips recipes that already contain the MCP_MARKER.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";
const MCP_MARKER = "## MCP usage";

const MCP_SECTION = `## MCP usage

| MCP | Role | Used in |
|---|---|---|
| \`playwright\` | Screenshots, form fills, click-through, viewport resize, navigation | Steps 7, 7b, 8, 11b, 12c |
| \`chrome-devtools\` | Console messages, network requests, performance trace, runtime metrics | Step 11c, optional Step 12c console replay |

Both MCPs must be connected per \`/mcp\` in your session (preflight check in LAUNCH-SHEET Section 0b). They don't conflict — each does what it's best at. The earlier "playwright NOT chrome-devtools" guidance from older recipe drafts is retired.

**Credentials:** every sign-in step references \`/redesign/test-credentials.md\`. The recipe inlines the specific account for clarity (the account that holds the RBAC permissions for this page), but the canonical source is always \`test-credentials.md\`.

`;

let patched = 0;
const skipped = [];
let parenthetical = 0;
let heading11c = 0;
let consoleBullet = 0;
let networkBullet = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith("-recipe.md"))) {
  const path = join(DIR, file);
  let content = readFileSync(path, "utf8");

  if (content.includes(MCP_MARKER)) {
    skipped.push(file);
    continue;
  }

  // 1. Insert MCP usage section just before the --- divider that precedes "# Steps"
  const stepsIdx = content.indexOf("# Steps");
  if (stepsIdx === -1) {
    console.log(`! ${file}: # Steps not found`);
    continue;
  }
  const boundaryIdx = content.lastIndexOf("\n---\n\n", stepsIdx);
  if (boundaryIdx === -1) {
    console.log(`! ${file}: --- boundary before # Steps not found`);
    continue;
  }
  content =
    content.slice(0, boundaryIdx + 1) +
    MCP_SECTION +
    content.slice(boundaryIdx + 1);

  // 2. Remove "(NOT `chrome-devtools` — playwright handles redirects)" parenthetical
  const before2 = content;
  content = content.replace(
    / \(NOT `chrome-devtools` — playwright handles redirects\)/g,
    "",
  );
  if (content !== before2) parenthetical += 1;

  // 3. Update Step 11c heading
  const before3 = content;
  content = content.replace(
    /### 11c — Console \+ Network\n/g,
    "### 11c — Console + Network (via `chrome-devtools` MCP)\n",
  );
  if (content !== before3) heading11c += 1;

  // 4. Update Step 11c bullets to use chrome-devtools tools
  const before4 = content;
  content = content.replace(
    /- Print last 20 console messages to chat/g,
    "- Use `chrome-devtools__list_console_messages` to print the last 20 console messages to chat",
  );
  if (content !== before4) consoleBullet += 1;

  const before5 = content;
  content = content.replace(
    /- Print network requests during/g,
    "- Use `chrome-devtools__list_network_requests` during",
  );
  if (content !== before5) networkBullet += 1;

  writeFileSync(path, content, "utf8");
  patched += 1;
  console.log(`✓ ${file}`);
}

if (skipped.length) {
  console.log("\nSkipped (already has MCP usage):");
  for (const f of skipped) console.log(`  · ${f}`);
}

console.log(`\nPatched ${patched} recipes.`);
console.log(`- "(NOT chrome-devtools)" parenthetical removed in: ${parenthetical} recipes`);
console.log(`- Step 11c heading updated in: ${heading11c} recipes`);
console.log(`- Step 11c console bullet updated in: ${consoleBullet} recipes`);
console.log(`- Step 11c network bullet updated in: ${networkBullet} recipes`);
