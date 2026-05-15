#!/usr/bin/env node
// Step 8 of redesign/PHASE6-AUTONOMOUS-AGENT-PLAN.md
//
// On-demand worktree spawner for Phase 6 per-page agent runs.
// Usage: node scripts/spawn-worktree.mjs <slug>
//
// What it does:
//   1. Verifies main-tree HEAD is on redesign/start-state.
//   2. Verifies worktree path + branch don't already exist (avoid clobbering
//      an in-progress agent).
//   3. Creates the worktree at the canonical sibling-directory path off the
//      current redesign/start-state HEAD, on branch agent/<slug>-redesign.
//   4. Junctions node_modules from main tree (Windows mklink /J) so the
//      worktree's dev server starts fast without a fresh `pnpm install`.
//   5. Copies the CURRENT main-tree per-page recipe + progress file +
//      test-credentials.md into the worktree (overwriting the stale-committed
//      versions, since recipes evolve in the main tree faster than commits land).
//   6. Ensures the deferrals directory exists in the worktree.
//   7. Prints the next steps for the user, including the literal /goal kickoff
//      command (slug + worktree path + port already substituted) the user
//      pastes into the new Claude Code session.
//
// Designed for Windows (cmd /c mklink /J). Adapt the junction step for other
// OSes if needed; everything else is portable Node.

import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { exit } from "node:process";

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

const MAIN_TREE = "C:\\Users\\mamdo\\Desktop\\rahmatherapy - Copy\\rahmatherapy-next-refactor";

// ─── Argument parsing ────────────────────────────────────────────────────────

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/spawn-worktree.mjs <slug>");
  console.error("\nValid slugs (alphabetical, with assigned port):");
  for (const [s, p] of Object.entries(PORT_BY_SLUG).sort()) {
    console.error(`  ${p}  ${s}`);
  }
  exit(1);
}

if (!(slug in PORT_BY_SLUG)) {
  console.error(`ERROR: '${slug}' is not a known page slug.`);
  console.error("\nValid slugs:");
  for (const [s] of Object.entries(PORT_BY_SLUG).sort()) {
    console.error(`  - ${s}`);
  }
  exit(1);
}

const port = PORT_BY_SLUG[slug];
const WORKTREE = `C:\\Users\\mamdo\\Desktop\\rahmatherapy - Copy\\rahmatherapy-${slug}-redesign`;
const BRANCH = `agent/${slug}-redesign`;

// ─── Header ──────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(72)}`);
console.log(`  Spawning worktree for:  ${slug}`);
console.log(`  Dev port:               ${port}`);
console.log(`  Worktree path:          ${WORKTREE}`);
console.log(`  Branch:                 ${BRANCH}`);
console.log(`${"=".repeat(72)}\n`);

// ─── Preflight checks ────────────────────────────────────────────────────────

console.log("[1/6] Verifying main-tree HEAD on redesign/start-state ...");
let headRef;
try {
  headRef = execSync("git rev-parse --abbrev-ref HEAD", { cwd: MAIN_TREE })
    .toString()
    .trim();
} catch (err) {
  console.error(`  ✗ Failed to read main-tree git HEAD: ${err.message}`);
  exit(1);
}
if (headRef !== "redesign/start-state") {
  console.error(
    `  ✗ ERROR: main-tree HEAD is on '${headRef}', expected 'redesign/start-state'.`,
  );
  console.error(`     Fix: cd "${MAIN_TREE}" && git checkout redesign/start-state`);
  exit(1);
}
console.log("      ✓ on redesign/start-state");

console.log(`\n[2/6] Verifying worktree path is free ...`);
if (existsSync(WORKTREE)) {
  console.error(`  ✗ ERROR: worktree path already exists: ${WORKTREE}`);
  console.error("     Either (a) an agent for this slug is in progress — go to that worktree;");
  console.error("            (b) a prior session left it behind — clean up via POST-AGENT-AUDIT-PROTOCOL.md Section 3A.");
  exit(1);
}
console.log("      ✓ path is free");

console.log(`\n[3/6] Verifying branch '${BRANCH}' doesn't already exist ...`);
const branches = execSync("git branch -a", { cwd: MAIN_TREE }).toString();
if (branches.split("\n").some((line) => line.trim().replace(/^\* /, "") === BRANCH)) {
  console.error(`  ✗ ERROR: branch '${BRANCH}' already exists.`);
  console.error(`     Fix: cd "${MAIN_TREE}" && git branch -d ${BRANCH}`);
  exit(1);
}
console.log("      ✓ branch name is free");

// ─── Worktree creation ───────────────────────────────────────────────────────

console.log(`\n[4/6] Creating worktree off redesign/start-state HEAD ...`);
try {
  execSync(
    `git worktree add "${WORKTREE}" -b "${BRANCH}" redesign/start-state`,
    { cwd: MAIN_TREE, stdio: "inherit" },
  );
  console.log("      ✓ worktree created");
} catch (err) {
  console.error(`  ✗ git worktree add failed: ${err.message}`);
  exit(1);
}

// ─── node_modules junction (Windows) ─────────────────────────────────────────

console.log(`\n[5/6] Junctioning node_modules from main tree ...`);
const junctionTarget = `${WORKTREE}\\node_modules`;
const junctionSource = `${MAIN_TREE}\\node_modules`;
try {
  execSync(
    `cmd /c mklink /J "${junctionTarget}" "${junctionSource}"`,
    { stdio: "inherit" },
  );
  console.log("      ✓ node_modules junctioned");
} catch (err) {
  console.warn(
    `      ! node_modules junction failed: ${err.message}`,
  );
  console.warn(
    "        Workaround: cd into the worktree and run `pnpm install --prefer-offline`.",
  );
}

// ─── Copy current main-tree files into worktree ──────────────────────────────

console.log(`\n[6/6] Copying current main-tree files into worktree ...`);
console.log("      (overwrites the stale-committed versions — recipes evolve faster than commits)");

const filesToCopy = [
  // [src-relative-to-MAIN_TREE, dst-relative-to-WORKTREE, dir-relative-to-WORKTREE]
  [
    `redesign\\per-page-recipes\\${slug}-recipe.md`,
    `redesign\\per-page-recipes\\${slug}-recipe.md`,
    `redesign\\per-page-recipes`,
  ],
  [
    `redesign\\per-page-progress\\${slug}-progress.md`,
    `redesign\\per-page-progress\\${slug}-progress.md`,
    `redesign\\per-page-progress`,
  ],
  [
    `redesign\\test-credentials.md`,
    `redesign\\test-credentials.md`,
    `redesign`,
  ],
];

for (const [src, dst, dir] of filesToCopy) {
  const fullSrc = `${MAIN_TREE}\\${src}`;
  const fullDst = `${WORKTREE}\\${dst}`;
  const fullDir = `${WORKTREE}\\${dir}`;
  if (!existsSync(fullSrc)) {
    // ERROR — not a warning. The recipe + progress + creds are required for
    // the agent to even start. Continuing past a missing source would leave
    // the spawned agent unable to `cat` the progress file on turn 1.
    console.error(`      ✗ ERROR: required source file missing: ${src}`);
    console.error(`        Cannot continue spawn. Either:`);
    console.error(`          (a) the file was never created (per-page progress stub) — generate it first;`);
    console.error(`          (b) the file path moved — fix the recipe convention before re-running.`);
    console.error(`        Cleaning up partial worktree at: ${WORKTREE}`);
    // Best-effort cleanup so the next spawn attempt has a free path
    try {
      execSync(`git worktree remove "${WORKTREE}" --force`, { cwd: MAIN_TREE, stdio: "inherit" });
    } catch (cleanupErr) {
      console.error(`        (worktree-remove failed; manually clean up via POST-AGENT-AUDIT-PROTOCOL.md §3A)`);
    }
    exit(1);
  }
  mkdirSync(fullDir, { recursive: true });
  copyFileSync(fullSrc, fullDst);
  console.log(`      ✓ ${src}`);
}

// Ensure deferrals dir exists (the recipe instructs the agent to write there)
const deferralsDir = `${WORKTREE}\\redesign\\per-page-deferrals`;
mkdirSync(deferralsDir, { recursive: true });
console.log(`      ✓ redesign\\per-page-deferrals\\ (ensured)`);

// ─── Next-steps printout ─────────────────────────────────────────────────────

console.log(`\n${"=".repeat(72)}`);
console.log("  Spawn complete. Next steps for the user:");
console.log(`${"=".repeat(72)}\n`);

console.log("1. Open a NEW Claude Code session in the worktree:\n");
console.log(`   cd "${WORKTREE}"`);
console.log("   claude");
console.log("");

console.log("2. In the new session, confirm preflight (per LAUNCH-SHEET Section 0):\n");
console.log("   /config       → Opus 4.7, thinking = medium");
console.log("   /skills       → impeccable (with subcommands) + ralph-loop listed");
console.log("   /mcp          → playwright + chrome-devtools connected");
console.log("   /hooks        → Stop hooks should be empty (NOT disableAllHooks)");
console.log("");

console.log("3. Paste the kickoff /goal command (slug + paths already substituted):\n");
console.log("──────────────── COPY FROM HERE ────────────────\n");
console.log(`/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — ${WORKTREE}\\redesign\\per-page-recipes\\${slug}-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at ${WORKTREE}\\redesign\\per-page-progress\\${slug}-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. The "using-superpowers" skill is meta — loading it is NOT what SKILLS_OK requires; you must verify the /impeccable subcommands and /ralph-loop are individually invocable via the Skill tool (not just the slash-command form). Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".`);
console.log("\n──────────────── COPY UNTIL HERE ────────────────\n");

console.log("4. Watch the first 3 turns live (per LAUNCH-SHEET Section 1e):");
console.log("   - Turn 1: agent reads the recipe file (visible Read tool call)");
console.log("   - Turn 2: emits SKILLS_OK literal");
console.log("   - Turn 3: begins re-prime");
console.log("");

console.log("5. When the agent emits HANDOFF_READY, ping the main agent in your");
console.log("   primary session with: \"goal met for " + slug + "\"");
console.log("   The main agent will run the POST-AGENT-AUDIT-PROTOCOL checklist");
console.log("   and present merge / conflict / re-dispatch options.");
console.log("");

console.log(`Dev URL when running:   http://localhost:${port}/admin/${slug}`);
console.log(`Test creds (in worktree): redesign/test-credentials.md`);
console.log("");
