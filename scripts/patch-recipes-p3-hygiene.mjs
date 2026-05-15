#!/usr/bin/env node
// P3 hygiene pass:
//   (a) Step 6 — add worktree-missing fallback (STUCK if cd target missing).
//   (b) Step 0 — clarify "Skill tool invocation" vs "slash command" so the
//       evaluator sees an actual Skill(...) tool event, not just text.
//
// These changes are derived from the /goal research agent's recommendations
// (anchor-below-evidence + Skill-tool-form for evaluator visibility).

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";
let patched = 0;
const summary = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".md"))) {
  const path = join(DIR, file);
  const before = readFileSync(path, "utf8");
  let after = before;
  const local = [];

  // ── (a) Step 6 worktree-missing fallback
  // Locate the `cd "C:\Users\...\<slug>-redesign"` line and add a fallback
  // STUCK clause if not already present.
  if (!/STUCK: 6 — worktree directory missing/.test(after)) {
    // Pattern: a bash code fence containing `cd "...<slug>-redesign"` and
    // `pnpm next dev -p 3001`. Insert a pre-cd guard.
    const stepSixGuard = after.replace(
      /(```bash\ncd "C:\\Users\\mamdo\\Desktop\\rahmatherapy - Copy\\rahmatherapy-)([a-z0-9-]+)(-redesign"\npnpm next dev -p \d{4})/,
      `**Pre-flight (do this BEFORE the cd):** verify the worktree directory exists. If \`Test-Path\` (PowerShell) or \`[ -d ... ]\` (bash) returns false on \`C:\\Users\\mamdo\\Desktop\\rahmatherapy - Copy\\rahmatherapy-$2-redesign\`, emit \`STUCK: 6 — worktree directory missing — re-run the worktree setup from LAUNCH-SHEET Section 1a\` and STOP. Do not try to recreate the worktree from inside the agent.\n\n$1$2$3`,
    );
    if (stepSixGuard !== after) {
      after = stepSixGuard;
      local.push("Step 6 worktree-missing fallback");
    }
  }

  // ── (b) Step 0 Skill-tool-form clarification
  // After the "Verify these Skill-tool invocations resolve in this session:"
  // line, append a one-line clarifier emphasising the Skill tool form (so the
  // invocation appears as a transcript Skill(...) event the evaluator can see).
  const skillBlockMarker = "Verify these Skill-tool invocations resolve in this session:";
  if (
    after.includes(skillBlockMarker) &&
    !after.includes("Use the Skill tool (not the slash-command shorthand)")
  ) {
    after = after.replace(
      "Verify these Skill-tool invocations resolve in this session:",
      "Verify these Skill-tool invocations resolve in this session. **Use the Skill tool (not the slash-command shorthand) so each invocation appears as a `Skill(...)` event in the transcript the Haiku evaluator reads** — slash-command text alone is harder for the evaluator to distinguish from a mention. Invoke each with a no-op or dry argument string just to confirm it resolves:",
    );
    local.push("Step 0 Skill-tool form clarification");
  }

  if (after !== before) {
    writeFileSync(path, after, "utf8");
    patched += 1;
    summary.push(`✓ ${file}: ${local.join("; ")}`);
  } else {
    summary.push(`· ${file}: (no changes)`);
  }
}

console.log(`Patched ${patched} of ${readdirSync(DIR).filter((f) => f.endsWith(".md")).length} files.\n`);
for (const line of summary) console.log(line);
