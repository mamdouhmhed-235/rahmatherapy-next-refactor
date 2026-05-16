#!/usr/bin/env node
// Renumber the runtime-files reference in all 26 recipes:
// "Step 0+ append per step" → "Step 1+ append per step"
// Step 0 (skill availability check) was removed in an earlier patch; the
// progress file's first entry is now Step 1 (re-prime).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RECIPES_DIR = "redesign/per-page-recipes";
const OLD = "Step 0+ append per step";
const NEW = "Step 1+ append per step";

const files = readdirSync(RECIPES_DIR).filter((f) => f.endsWith("-recipe.md"));
let touched = 0;
let skipped = 0;

for (const file of files) {
  const path = join(RECIPES_DIR, file);
  const content = readFileSync(path, "utf8");
  if (!content.includes(OLD)) {
    skipped++;
    continue;
  }
  const next = content.replaceAll(OLD, NEW);
  writeFileSync(path, next, "utf8");
  console.log(`patched: ${file}`);
  touched++;
}

console.log(`\ntouched: ${touched} | skipped (no match): ${skipped} | total recipes: ${files.length}`);
