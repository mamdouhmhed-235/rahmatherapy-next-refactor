#!/usr/bin/env node
// Strip the node_modules-junction fallback paragraph from every recipe's
// Step 6. Agents should be focused on the page redesign, not on
// infrastructure recovery. The spawn-worktree.mjs script handles junction
// creation correctly (Node-native fs.symlinkSync('junction') + pre-existing
// removal + post-creation verification + sanity-check), so the recipes
// don't need a recovery fallback at all. If a junction does break, the
// user fixes it out-of-band — the spawned agent stays focused on its
// actual task.
//
// Idempotent: skips recipes where the fallback paragraph isn't present.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";

const OLD = `\n\n**If node_modules junction is broken** (junction got removed or stale), fall back to:\n\`\`\`powershell\ncmd /c mklink /J node_modules "C:\\Users\\mamdo\\Desktop\\rahmatherapy - Copy\\rahmatherapy-next-refactor\\node_modules"\n\`\`\``;

let patched = 0;
const skipped = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith("-recipe.md"))) {
  const path = join(DIR, file);
  let content = readFileSync(path, "utf8");

  if (!content.includes(OLD)) {
    skipped.push(file);
    continue;
  }

  content = content.replace(OLD, "");
  writeFileSync(path, content, "utf8");
  patched += 1;
  console.log(`✓ ${file}`);
}

if (skipped.length) {
  console.log(`\nSkipped (fallback already absent):`);
  for (const f of skipped) console.log(`  · ${f}`);
}

console.log(`\nStripped fallback from ${patched} recipes.`);
