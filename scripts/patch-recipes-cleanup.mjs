#!/usr/bin/env node
// Cleanup pass: remove the nested-paren artifact introduced by the wording-drift
// fix in patch-recipes-bulk.mjs. Replaces the awkward
//   "(all brief sections (native + Recipe Context + Implementation Notes))"
// with the more natural
//   "(every section of the brief, including Recipe Context and Implementation Notes)"
// and the matching Role-variants form.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "redesign/per-page-recipes";
let patched = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".md"))) {
  const path = join(DIR, file);
  const before = readFileSync(path, "utf8");
  let after = before
    .replace(
      /\(all brief sections \(native \+ Recipe Context \+ Implementation Notes\)\)/g,
      "(every section of the brief, including Recipe Context and Implementation Notes)",
    )
    .replace(
      /\(all brief sections \(native \+ Role variants\)\)/g,
      "(every section of the brief, including Role variants)",
    );
  if (after !== before) {
    writeFileSync(path, after, "utf8");
    patched += 1;
    console.log(`✓ ${file}`);
  }
}

console.log(`\nCleaned ${patched} files.`);
