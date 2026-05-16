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
//   4. Junctions node_modules from main tree as a true Windows directory
//      junction (Node-native fs.symlinkSync(...,'junction'), with pre-existing
//      removal + post-creation verification + cmd /c dir /AL sanity check),
//      so the worktree's dev server starts fast without a fresh `pnpm install`
//      and webpack/Turbopack accept it (MSYS-style symlinks would be rejected).
//   5. Copies the CURRENT main-tree per-page recipe + progress file +
//      test-credentials.md into the worktree (overwriting the stale-committed
//      versions, since recipes evolve in the main tree faster than commits land).
//   6. Ensures the deferrals directory exists in the worktree.
//   7. Prints the next steps for the user, including the literal /goal kickoff
//      command (slug + worktree path + port already substituted) the user
//      pastes into the new Claude Code session.
//
// Designed for Windows (uses fs.symlinkSync with type 'junction' which is the
// Windows-native directory-junction form). The 'junction' type is a Windows-only
// symlink type; on other OSes you'd use type 'dir' or 'file' instead.
// Everything else (file copies, git worktree add, validation) is portable Node.

import { existsSync, mkdirSync, copyFileSync, symlinkSync, rmSync } from "node:fs";
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

// ─── node_modules junction (Windows directory junction, Node-native) ────────

console.log(`\n[5/6] Setting up node_modules junction ...`);
const junctionTarget = `${WORKTREE}\\node_modules`;
const junctionSource = `${MAIN_TREE}\\node_modules`;

// Always start from a clean slate. If a node_modules already exists in the
// worktree (real junction, MSYS/Cygwin symlink, real directory, broken link,
// or anything else), remove it. The junction is reproducible and cheap to
// recreate; trying to detect-and-conditionally-replace is more fragile than
// always-resetting.
if (existsSync(junctionTarget)) {
  console.log(`      ✓ pre-existing node_modules found at target — removing for clean junction`);
  try {
    rmSync(junctionTarget, { recursive: true, force: true });
  } catch (err) {
    console.error(`      ✗ failed to remove pre-existing node_modules: ${err.message}`);
    console.error(`        Manual fix (PowerShell): Remove-Item "${junctionTarget}" -Force -Recurse`);
    exit(1);
  }
}

// Verify the SOURCE node_modules exists (main tree must have installed deps)
if (!existsSync(junctionSource)) {
  console.error(`      ✗ source node_modules missing: ${junctionSource}`);
  console.error(`        Run \`pnpm install\` in the main tree first, then re-run this script.`);
  exit(1);
}

// Use Node's native fs.symlinkSync with 'junction' type — equivalent to
// `cmd /c mklink /J <target> <source>` but does NOT go through any shell.
// This bypasses the Git Bash / MSYS shell-environment hazards that can cause
// `cmd /c mklink` invoked via execSync to produce an MSYS-style symlink
// instead of a real Windows directory junction (which webpack + Turbopack
// both reject with "Symlink is invalid, it points out of the filesystem
// root" or "Cannot find module" errors during the first compile).
try {
  symlinkSync(junctionSource, junctionTarget, "junction");
  console.log("      ✓ junction created (Node-native, type='junction')");
} catch (err) {
  console.error(`      ✗ junction creation failed: ${err.message}`);
  console.error(`        Source: ${junctionSource}`);
  console.error(`        Target: ${junctionTarget}`);
  console.error(`        Manual fix (PowerShell):`);
  console.error(`          cd "${WORKTREE}"`);
  console.error(`          cmd /c mklink /J node_modules "${junctionSource}"`);
  exit(1);
}

// Verify the junction actually exposes the main-tree node_modules content by
// resolving a known-present package through it. If the junction is somehow
// broken (wrong type, dangling, etc.), this catches it BEFORE the spawned
// agent hits a compile-time blocker.
const verifyPath = `${junctionTarget}\\next\\package.json`;
if (!existsSync(verifyPath)) {
  console.error(`      ✗ junction verification FAILED — cannot resolve next/package.json through the junction`);
  console.error(`        Expected: ${verifyPath}`);
  console.error(`        This usually means the junction was created but doesn't expose the expected content.`);
  console.error(`        Manual fix (PowerShell):`);
  console.error(`          cd "${WORKTREE}"`);
  console.error(`          Remove-Item node_modules -Force`);
  console.error(`          cmd /c mklink /J node_modules "${junctionSource}"`);
  console.error(`          cmd /c dir /AL   # should show <JUNCTION> on node_modules`);
  exit(1);
}
console.log("      ✓ junction verified (resolved next/package.json through it)");

// Defensive Windows-junction sanity check via `cmd /c dir /AL`. If this
// output doesn't include "<JUNCTION>", the symlink might be an MSYS/Cygwin
// symlink that LOOKS resolvable from Node.js but will fail webpack/Turbopack.
try {
  const dirOutput = execSync(
    `cmd /c "dir /AL \\"${WORKTREE}\\""`,
    { encoding: "utf8" },
  );
  if (!dirOutput.includes("<JUNCTION>") || !dirOutput.includes("node_modules")) {
    console.warn(`      ! cmd /c dir /AL does not show <JUNCTION> for node_modules`);
    console.warn(`        This may be an MSYS-style symlink instead of a Windows junction;`);
    console.warn(`        webpack + Turbopack will reject it on first compile.`);
    console.warn(`        Recovery (PowerShell):`);
    console.warn(`          cd "${WORKTREE}"`);
    console.warn(`          Remove-Item node_modules -Force`);
    console.warn(`          cmd /c mklink /J node_modules "${junctionSource}"`);
  } else {
    console.log("      ✓ Windows-junction sanity check passed (cmd /c dir /AL shows <JUNCTION>)");
  }
} catch (err) {
  // Sanity check is best-effort; don't fail the spawn on cmd /c errors.
  console.warn(`      ! could not run sanity check: ${err.message}`);
}

// ─── Copy current main-tree files into worktree ──────────────────────────────

console.log(`\n[6/6] Copying current main-tree files into worktree ...`);
console.log("      (overwrites the stale-committed versions — recipes evolve faster than commits)");

const filesToCopy = [
  // [src-relative-to-MAIN_TREE, dst-relative-to-WORKTREE, dir-relative-to-WORKTREE, required (bool)]
  [
    `redesign\\per-page-recipes\\${slug}-recipe.md`,
    `redesign\\per-page-recipes\\${slug}-recipe.md`,
    `redesign\\per-page-recipes`,
    true,
  ],
  [
    `redesign\\per-page-progress\\${slug}-progress.md`,
    `redesign\\per-page-progress\\${slug}-progress.md`,
    `redesign\\per-page-progress`,
    true,
  ],
  [
    `redesign\\test-credentials.md`,
    `redesign\\test-credentials.md`,
    `redesign`,
    true,
  ],
  [
    // .env contains the dev Supabase URL + anon key + Resend dev key. Without
    // this in the worktree, the Next dev server boots but admin pages 500 on
    // first request because the Supabase client can't read its env vars. The
    // calendar redesign (run 2026-05-16) hit this; the spawned agent had to
    // hand-copy .env mid-flight before Step 11b could proceed. Now copied
    // proactively. Marked optional in case .env is intentionally absent.
    `.env`,
    `.env`,
    ``,
    false,
  ],
];

for (const [src, dst, dir, required] of filesToCopy) {
  const fullSrc = `${MAIN_TREE}\\${src}`;
  const fullDst = `${WORKTREE}\\${dst}`;
  const fullDir = dir ? `${WORKTREE}\\${dir}` : WORKTREE;
  if (!existsSync(fullSrc)) {
    if (required) {
      // ERROR — not a warning. Required files are necessary for the agent to
      // even start. Continuing past a missing required source would leave the
      // spawned agent unable to proceed.
      console.error(`      ✗ ERROR: required source file missing: ${src}`);
      console.error(`        Cannot continue spawn. Either:`);
      console.error(`          (a) the file was never created (per-page progress stub) — generate it first;`);
      console.error(`          (b) the file path moved — fix the recipe convention before re-running.`);
      console.error(`        Cleaning up partial worktree at: ${WORKTREE}`);
      try {
        execSync(`git worktree remove "${WORKTREE}" --force`, { cwd: MAIN_TREE, stdio: "inherit" });
      } catch (cleanupErr) {
        console.error(`        (worktree-remove failed; manually clean up via POST-AGENT-AUDIT-PROTOCOL.md §3A)`);
      }
      exit(1);
    } else {
      console.warn(`      ! optional source missing, skipped: ${src}`);
      continue;
    }
  }
  if (dir) mkdirSync(fullDir, { recursive: true });
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
console.log(`/goal STEP A (first, do not search): Read the recipe file with the Read tool using this exact absolute path — ${WORKTREE}\\redesign\\per-page-recipes\\${slug}-recipe.md — do NOT use Glob or search; the file exists at that exact path. STEP B: Execute every step in that recipe in order. All /redesign/... paths inside the recipe are RELATIVE TO YOUR CWD (the worktree) — they are NOT C: drive absolute paths. STEP C: Maintain the progress scratchpad at ${WORKTREE}\\redesign\\per-page-progress\\${slug}-progress.md — append "step-N: COMPLETE — <one-line>" after each step and cat the full file to chat. Never modify the files in the recipe's "Files to NEVER touch" list. Never use git add . or git add -A. Never commit until I type "approved". GOAL IS MET when ALL of these conditions hold: (1) every literal string in the recipe's "/goal evaluator quick-reference" section has appeared in this transcript, each preceded by the tool output that proves it (no retrospective summary blocks — fabrication shape); (2) the final assistant message contains "HANDOFF_READY — awaiting user approval". STOP IMMEDIATELY (do not take another turn) if any of these holds: (a) the most recent assistant message begins with "STUCK:"; (b) 40 main-model turns have elapsed since this goal was set (emit "TURN_CAP_REACHED — <summary of complete vs missing>" before stopping); (c) the user types "approved" or "/goal clear".`);
console.log("\n──────────────── COPY UNTIL HERE ────────────────\n");

console.log("4. Watch the first 2 turns live (per LAUNCH-SHEET Section 1e):");
console.log("   - Turn 1: agent reads the recipe file (visible Read tool call)");
console.log("   - Turn 2: begins re-prime (reads PRODUCT, DESIGN, brief; emits summary)");
console.log("   (Skills are not re-verified inside the spawned session — your /skills");
console.log("    preflight in Section 0b is the canonical check.)");
console.log("");

console.log("5. When the agent emits HANDOFF_READY, ping the main agent in your");
console.log("   primary session with: \"goal met for " + slug + "\"");
console.log("   The main agent will run the POST-AGENT-AUDIT-PROTOCOL checklist");
console.log("   and present merge / conflict / re-dispatch options.");
console.log("");

console.log(`Dev URL when running:   http://localhost:${port}/admin/${slug}`);
console.log(`Test creds (in worktree): redesign/test-credentials.md`);
console.log("");
