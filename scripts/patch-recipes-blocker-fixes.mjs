#!/usr/bin/env node
// Bulk-patch the 26 per-page recipes to address blockers surfaced by the
// 2026-05-16 verification audit:
//
//   P0 #2 — Signout: route is POST-only; recipes were instructing the agent
//           to "Sign out via /admin/signout" which a browser navigation would
//           GET → 405 → agent thinks it succeeded with stale auth.
//
//   P0 #3 — Step 11a token-drift: fenced bash code block of `grep | grep -v`
//           pipelines silently fails on certain Windows shell environments;
//           TOKEN_DRIFT: 0 from a parsing failure looks the same as a clean
//           lint. Reframe as "use the Grep tool" + change the fence to text.
//
//   P1 #4 — Step 6 readiness poll: 60s is on the edge for cold Next.js 15
//           admin-route compile; bump to 120s.
//
//   Step 11c — chrome-devtools naming: was prescribing specific MCP tool
//             methods (chrome-devtools__list_console_messages, etc.). Per
//             user directive: don't name specific MCP methods, let the agent
//             pick the right tool. Plus add an RSC server-action POST note
//             so NETWORK_BASELINE_MATCH doesn't false-positive on Next.js
//             15 server actions that go through the RSC stream.
//
//   P2 #8 — Step 7b first iteration: currently mandatory even when the page
//           already looks clean post-axes. Allow skipping iteration 2 if
//           iteration 1 found zero issues.
//
//   P2 #11 — Step 2 BROKEN guard: long-form prompt that for the 24 remaining
//           pages will produce "none" — burns a turn for ~zero signal.
//           Soften to a 1-line check.
//
// Idempotent: each transform skips files where the OLD pattern isn't present.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";

// ─── P0 #2: Signout (use playwright MCP to POST, NOT a GET navigation) ─────
const SIGNOUT_OLD = "- Sign out via `/admin/signout` to leave a clean session for downstream pages";
const SIGNOUT_NEW = "- Sign out cleanly: use the playwright MCP to send a POST to `/admin/signout` from the browser context (the route is POST-only — a regular browser navigation would issue GET and receive 405, leaving the session intact). After the POST, navigate to `/admin/login` and verify the sign-in page renders. This leaves a clean session for downstream pages.";

// ─── P0 #3: Step 11a token-drift wrap — bash → text + Grep-tool note ───────
const STEP11A_OLD = "For files changed in this redesign, grep:\n```bash";
const STEP11A_NEW = "For files changed in this redesign, search for these patterns using the **Grep tool** (do NOT execute them as literal shell pipelines — chained `grep | grep -v` commands behave inconsistently across Windows shell environments, and `TOKEN_DRIFT: 0` from a parsing failure is indistinguishable from a clean lint):\n```text";

// ─── P1 #4: Step 6 readiness poll 60s → 120s ───────────────────────────────
const POLL_OLD = "Max wait: 60 seconds.";
const POLL_NEW = "Max wait: 120 seconds (cold compile of admin routes in Next.js 15 can exceed 60s — be patient on a fresh worktree).";

// ─── Step 11c chrome-devtools: stop naming specific MCP methods ────────────
const CD_HEADING_OLD = "### 11c — Console + Network (via `chrome-devtools` MCP)";
const CD_HEADING_NEW = `### 11c — Console + Network (via the chrome-devtools MCP)

_Note for \`NETWORK_BASELINE_MATCH\`: Next.js 15 server actions don't appear as literal POSTs to the action endpoint — they go through the RSC stream as a POST to the page URL with a \`next-action\` header. Count EITHER the literal action POST OR an RSC POST with \`next-action\` header as a match._`;

const CD_CONSOLE_OLD = "- Use `chrome-devtools__list_console_messages` to print the last 20 console messages to chat";
const CD_CONSOLE_NEW = "- Use the chrome-devtools MCP to read the last 20 console messages and print them to chat";

const CD_NETWORK_OLD = "- Use `chrome-devtools__list_network_requests`";
const CD_NETWORK_NEW = "- Use the chrome-devtools MCP to inspect network requests";

// ─── P2 #8: Step 7b first iteration optional when post-axes already clean ──
const STEP7B_OLD = "**Re-audit, list remaining issues, fix again.** Loop maximum 2 iterations. If after 2 iterations there are still issues";
const STEP7B_NEW = "**Re-audit, list remaining issues, fix again.** Loop maximum 2 iterations. If iteration 1 finds zero issues (the page already looks clean post-axes), emit `POLISH_ISSUES_ITER_1: none` AND `POLISH_ISSUES_ITER_2: none — clean (skipped, iteration 1 already clean)` and proceed directly to Step 8. If after 2 iterations there are still issues";

// ─── P2 #11: Step 2 BROKEN guard softened to 1-line check ──────────────────
// The blockquote is a single long line; slug substitution mid-text. Use regex
// with [\s\S]*? for non-greedy multi-anything match.
const STEP2_PATTERN = /> Read `\/redesign\/BUSINESS-COMPLETENESS\.md`\. List every Track A \/ BLOCKS-REDESIGN item whose tag line includes Zone 1 and status BROKEN\. For each item, report: item id\/title, page sessions that cover it per its Phase 5 brief coverage note, whether the current page session \([\w-]+\) should handle it, and whether the normal Ralph Zone 1 command would miss it because it only selects NOT-STARTED\/PARTIAL\. Do not edit files\. Do not modify the recipe Ralph command\. Stop after the list\./;
const STEP2_REPLACEMENT = "> Quick check: have you read `/redesign/BUSINESS-COMPLETENESS.md`? Note any Track A / BLOCKS-REDESIGN Zone 1 items still tagged BROKEN that this page should handle (typically `none` — login already flipped 2A-6 + 2A-9 to PARTIAL). Read-only; do not edit.";

let summary = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith("-recipe.md"))) {
  const path = join(DIR, file);
  let content = readFileSync(path, "utf8");
  const before = content;
  const changes = [];

  if (content.includes(SIGNOUT_OLD)) {
    content = content.replaceAll(SIGNOUT_OLD, SIGNOUT_NEW);
    changes.push("signout");
  }

  if (content.includes(STEP11A_OLD)) {
    content = content.replace(STEP11A_OLD, STEP11A_NEW);
    changes.push("step11a-token-drift");
  }

  if (content.includes(POLL_OLD)) {
    content = content.replace(POLL_OLD, POLL_NEW);
    changes.push("step6-poll");
  }

  if (content.includes(CD_HEADING_OLD)) {
    content = content.replace(CD_HEADING_OLD, CD_HEADING_NEW);
    changes.push("step11c-heading+rsc-note");
  }

  if (content.includes(CD_CONSOLE_OLD)) {
    content = content.replace(CD_CONSOLE_OLD, CD_CONSOLE_NEW);
    changes.push("step11c-console-tool");
  }

  if (content.includes(CD_NETWORK_OLD)) {
    content = content.replace(CD_NETWORK_OLD, CD_NETWORK_NEW);
    changes.push("step11c-network-tool");
  }

  if (content.includes(STEP7B_OLD)) {
    content = content.replace(STEP7B_OLD, STEP7B_NEW);
    changes.push("step7b-skip-iter2");
  }

  if (STEP2_PATTERN.test(content)) {
    content = content.replace(STEP2_PATTERN, STEP2_REPLACEMENT);
    changes.push("step2-broken-guard");
  }

  if (content !== before) {
    writeFileSync(path, content, "utf8");
    summary.push(`✓ ${file}: ${changes.join(", ")}`);
  } else {
    summary.push(`· ${file}: (no changes — patterns not found)`);
  }
}

console.log(summary.join("\n"));
const patched = summary.filter((s) => s.startsWith("✓")).length;
console.log(`\nPatched ${patched} of ${summary.length} recipes.`);
