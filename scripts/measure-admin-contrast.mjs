#!/usr/bin/env node
// Static admin contrast analyser — no browser, no login.
// Resolves --admin-* tokens per theme from tokens.css, extracts Tailwind
// arbitrary colour utilities from source, and computes WCAG ratios.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] || ".";
const TOKENS = join(ROOT, "src/styles/tokens.css");

// ---------- colour maths ----------
function oklchToRgb(L, C, H) {
  const l = L, a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L3 = l_ ** 3, M3 = m_ ** 3, S3 = s_ ** 3;
  let r = 4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3;
  let g = -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3;
  let bb = -0.0041960863 * L3 - 0.7034186147 * M3 + 1.707614701 * S3;
  const enc = (v) => {
    v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(v * 255)));
  };
  return [enc(r), enc(g), enc(bb)];
}
function parseColour(str, tokens, theme, depth = 0) {
  if (!str || depth > 4) return null;
  str = str.trim();
  let m = str.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*(.+))?\)$/i);
  if (m) {
    const val = tokens[m[1]]?.[theme];
    if (val) return parseColour(val, tokens, theme, depth + 1);
    return m[2] ? parseColour(m[2], tokens, theme, depth + 1) : null;
  }
  m = str.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)/i);
  if (m) return oklchToRgb(parseFloat(m[1]) / 100, parseFloat(m[2]), parseFloat(m[3]));
  m = str.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = str.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return [+m[1], +m[2], +m[3]];
  if (/^white$/i.test(str)) return [255, 255, 255];
  if (/^black$/i.test(str)) return [0, 0, 0];
  return null;
}
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---------- tokens ----------
const css = readFileSync(TOKENS, "utf8");
const tokens = {};
function harvest(block, theme) {
  for (const m of block.matchAll(/(--admin-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[m[1]] ??= {};
    if (!(theme in tokens[m[1]])) tokens[m[1]][theme] = m[2].trim();
  }
}
const darkStart = css.indexOf('[data-theme="dark"]');
const lightStart = css.indexOf('[data-theme="light"]');
const printStart = css.indexOf("@media print");
harvest(css.slice(darkStart, lightStart), "dark");
harvest(css.slice(lightStart, printStart > 0 ? printStart : css.length), "light");
harvest(css.slice(0, darkStart), "light");   // :root defaults = light
harvest(css.slice(0, darkStart), "dark");    // fallback only if dark lacks it

// ---------- scan source ----------
function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|__tests__/.test(e.name)) walk(p, out); }
    else if (/\.(tsx|ts)$/.test(p) && !/\.test\./.test(p)) out.push(p);
  }
  return out;
}
const files = [...walk(join(ROOT, "src/app/admin")), ...walk(join(ROOT, "src/components/ui"))];

// capture an optional Tailwind alpha modifier: bg-[...]/12
const FG = /(?:^|[\s"'`:])text-\[([^\]]+)\](?:\/(\d{1,3}))?/g;
const BG = /(?:^|[\s"'`:])(?:hover:|active:|focus:|focus-visible:|group-hover:|data-\[[^\]]*\]:)?bg-\[([^\]]+)\](?:\/(\d{1,3}))?/g;
const composite = (c, alpha, under) =>
  alpha >= 1 ? c : [0, 1, 2].map((i) => Math.round(c[i] * alpha + under[i] * (1 - alpha)));

const results = [];
for (const f of files) {
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const fgs = [...line.matchAll(FG)].map((m) => [m[1].replace(/_/g, " "), m[2] ? +m[2] / 100 : 1]);
    const bgs = [...line.matchAll(BG)].map((m) => [m[1].replace(/_/g, " "), m[2] ? +m[2] / 100 : 1]);
    if (!fgs.length) return;
    for (const theme of ["dark", "light"]) {
      const panel = parseColour("var(--admin-panel)", tokens, theme) || [0, 0, 0];
      for (const [fgRaw, fgA] of fgs) {
        let fg = parseColour(fgRaw, tokens, theme);
        if (!fg) continue;
        const cands = bgs.length
          ? bgs.map(([b, a]) => {
              const c = parseColour(b, tokens, theme);
              return [a < 1 ? `${b}/${Math.round(a * 100)}` : b, c ? composite(c, a, panel) : null];
            })
          : [["--admin-panel", panel],
             ["--admin-canvas", parseColour("var(--admin-canvas)", tokens, theme)]];
        for (const [bgRaw, bg] of cands) {
          if (!bg) continue;
          const fgC = composite(fg, fgA, bg);
          const cr = ratio(fgC, bg);
          if (cr < 4.5) {
            results.push({ file: f.replace(/\\/g, "/").replace(ROOT.replace(/\\/g, "/") + "/", ""), line: i + 1, theme, cr: +cr.toFixed(2), fg: fgA < 1 ? `${fgRaw}/${Math.round(fgA * 100)}` : fgRaw, bg: bgRaw, assumed: !bgs.length });
          }
        }
      }
    }
  });
}

results.sort((a, b) => a.cr - b.cr);
const paired = results.filter((r) => !r.assumed);
console.log(`files scanned: ${files.length}`);
console.log(`tokens resolved: ${Object.keys(tokens).length}`);
console.log(`FAILURES (<4.5:1)  total ${results.length}   explicit-pair ${paired.length}   assumed-surface ${results.length - paired.length}`);
console.log(`  dark ${results.filter(r => r.theme === "dark").length} / light ${results.filter(r => r.theme === "light").length}`);
console.log(`\n--- worst 20 EXPLICIT pairs (both colours on the same element) ---`);
for (const r of paired.slice(0, 20)) console.log(`  ${String(r.cr).padStart(5)}:1 ${r.theme.padEnd(5)} ${r.file}:${r.line}\n           fg=${r.fg}  bg=${r.bg}`);
const byFile = {};
for (const r of results) byFile[r.file] = (byFile[r.file] || 0) + 1;
console.log(`\n--- worst 12 files by failure count ---`);
Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([f, n]) => console.log(`  ${String(n).padStart(4)}  ${f}`));
