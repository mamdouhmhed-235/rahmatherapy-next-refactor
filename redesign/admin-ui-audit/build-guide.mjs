#!/usr/bin/env node
/**
 * Build the client-facing admin guide into ONE self-contained HTML file.
 *
 *     node redesign/admin-ui-audit/build-guide.mjs
 *
 * ⛔ WHY A BUILD STEP. The guide has to survive being emailed, opened offline, and
 * kept on a laptop for a year — so every screenshot is inlined as a data URI and the
 * output depends on nothing. That is impossible to hand-write: each image is hundreds
 * of kilobytes of base64. So the source keeps readable `{{IMG:name}}` placeholders and
 * this fills them in.
 *
 * Reads:  guide.src.html   (the authored page, with {{IMG:...}} placeholders)
 * Images: guide-shots/<name>.png
 * Writes: ../../docs/admin-guide.html
 */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "guide.src.html");
const SHOTS = join(here, "guide-shots");
const OUT = resolve(here, "../../docs/admin-guide.html");

if (!existsSync(SRC)) {
  console.error(`⛔ Missing ${SRC}`);
  process.exit(1);
}

let html = readFileSync(SRC, "utf8");

const missing = [];
const used = new Set();
let inlinedBytes = 0;

html = html.replace(/\{\{IMG:([A-Za-z0-9._-]+)\}\}/g, (_m, name) => {
  const file = join(SHOTS, name.endsWith(".png") ? name : `${name}.png`);
  if (!existsSync(file)) {
    missing.push(name);
    return "";
  }
  const buf = readFileSync(file);
  used.add(name);
  inlinedBytes += buf.length;
  return `data:image/png;base64,${buf.toString("base64")}`;
});

// ⛔ Fail loudly. A guide that silently ships with broken images is worse than one
// that refuses to build — the whole point is that it works when nobody is watching.
if (missing.length) {
  console.error(`⛔ ${missing.length} screenshot(s) referenced but not found:`);
  for (const m of missing) console.error(`   - ${m}`);
  process.exit(1);
}

if (/\{\{IMG:/.test(html)) {
  console.error("⛔ An {{IMG:...}} placeholder survived — check for a malformed name.");
  process.exit(1);
}

writeFileSync(OUT, html, "utf8");

const mb = (n) => (n / 1024 / 1024).toFixed(2) + " MB";
const outSize = statSync(OUT).size;

console.log(`✅ Built ${OUT}`);
console.log(`   ${used.size} screenshots inlined (${mb(inlinedBytes)} raw)`);
console.log(`   final file ${mb(outSize)}`);
// A guide nobody can email is a guide nobody reads.
if (outSize > 25 * 1024 * 1024) {
  console.log("⚠️  Over 25MB — too big to email comfortably. Drop some screenshots.");
}
