#!/usr/bin/env node
/**
 * Reusable bundle-baseline extractor for Band B (B-0 through B-6 +
 * Phase 7 audit re-entry). Next 16 Turbopack omits per-route First Load JS
 * from its CLI route table, so we reconstruct it from the per-route client
 * reference manifests.
 *
 * First Load JS for a route = unique union of:
 *   - rootMainFiles + polyfillFiles from .next/build-manifest.json
 *   - entryJSFiles from .next/server/app/<route>/page_client-reference-manifest.js
 *
 * Plus entryCSSFiles reported separately (not historically counted against the
 * "first load JS" budget; tracked for trend).
 *
 * Usage:
 *   pnpm exec node scripts/measure-admin-bundles.mjs               # writes JSON to stdout
 *   pnpm exec node scripts/measure-admin-bundles.mjs > out.json    # capture
 *
 * Prerequisite: a successful `pnpm build` has populated .next/ in the cwd.
 *
 * Compares against `redesign/baselines/bundle-pre-B1.json` when present;
 * appends a `delta_vs_pre_B1_kb` field per route showing the gzipped change.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const NEXT_DIR = ".next";

/**
 * ITEM 5. The route list was six hardcoded entries, so the script could only
 * ever answer a question about the six routes somebody thought of in Band B —
 * every route added since was invisible to it, including the ones whose
 * ceilings this plan wants evaluated. Routes are now DISCOVERED from the build
 * output itself, so a new admin route is measured the day it ships.
 *
 * Discovery walks `.next/server/app/**` for `page_client-reference-manifest.js`,
 * which is the same artefact chunksForRoute() already reads — so a route is
 * listed if and only if it can actually be measured. That rules out a route
 * appearing in the report with null sizes, which is worse than absent.
 */
function discoverRoutes(scopePrefix = "admin") {
  const appDir = join(NEXT_DIR, "server/app");
  if (!existsSync(appDir)) return [];

  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === "page_client-reference-manifest.js") {
        const manifestRoute = relative(appDir, dir).split(sep).join("/");
        if (manifestRoute.startsWith(scopePrefix)) {
          found.push({ url: `/${manifestRoute}`, manifestRoute });
        }
      }
    }
  };
  walk(appDir);
  return found.sort((a, b) => a.manifestRoute.localeCompare(b.manifestRoute));
}

/**
 * ITEM 5. `process.argv` was never read anywhere in this script, so the
 * "explicit route filter" earlier notes credited it with did not exist. It
 * does now: any bare argument is treated as a substring match against the
 * route, so `node scripts/measure-admin-bundles.mjs bookings` measures just
 * the bookings routes. `--scope=<prefix>` widens or narrows discovery beyond
 * the admin tree.
 */
const args = process.argv.slice(2);
const scopeArg = args.find((a) => a.startsWith("--scope="));
const filters = args.filter((a) => !a.startsWith("--"));

const ROUTES = discoverRoutes(scopeArg ? scopeArg.slice(8) : "admin").filter(
  (r) => filters.length === 0 || filters.some((f) => r.manifestRoute.includes(f))
);

if (ROUTES.length === 0) {
  console.error(
    filters.length
      ? `No routes matched ${JSON.stringify(filters)}. Is .next/ built, and is the filter right?`
      : "No admin routes found in .next/server/app — run `pnpm build` first."
  );
  process.exit(1);
}

function readChunkSize(relPath) {
  const abs = join(NEXT_DIR, relPath.replace(/^\/?_next\//, ""));
  if (!existsSync(abs)) return null;
  const buf = readFileSync(abs);
  return { raw: buf.byteLength, gzip: gzipSync(buf).byteLength };
}

const buildManifest = JSON.parse(
  readFileSync(join(NEXT_DIR, "build-manifest.json"), "utf8")
);
const sharedChunks = new Set([
  ...(buildManifest.rootMainFiles ?? []),
  ...(buildManifest.polyfillFiles ?? []),
]);

function chunksForRoute(manifestRoute) {
  const manifestPath = join(
    NEXT_DIR,
    "server/app",
    manifestRoute,
    "page_client-reference-manifest.js"
  );
  if (!existsSync(manifestPath)) return null;
  const text = readFileSync(manifestPath, "utf8");
  const marker = '"] = ';
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const json = text.slice(start + marker.length, text.lastIndexOf(";")).trim();
  const data = JSON.parse(json);
  const entryKey = `[project]/src/app/${manifestRoute}/page`;
  const entryJS = data.entryJSFiles?.[entryKey] ?? [];
  const entryCSS = (data.entryCSSFiles?.[entryKey] ?? []).map((c) => c.path);
  return { entryJS, entryCSS };
}

function sumChunks(chunkPaths) {
  const seen = new Set();
  let raw = 0;
  let gzip = 0;
  const missing = [];
  for (const path of chunkPaths) {
    if (seen.has(path)) continue;
    seen.add(path);
    const size = readChunkSize(path);
    if (!size) {
      missing.push(path);
      continue;
    }
    raw += size.raw;
    gzip += size.gzip;
  }
  return { raw, gzip, missing, uniqueChunkCount: seen.size };
}

const sharedSummary = sumChunks([...sharedChunks]);

const baselinePath = "redesign/baselines/bundle-pre-B1.json";
const baseline = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : null;

const routes = ROUTES.map((route) => {
  const data = chunksForRoute(route.manifestRoute);
  if (!data) {
    return { url: route.url, error: "no client-reference-manifest found" };
  }
  const jsAll = [...sharedChunks, ...data.entryJS];
  const cssAll = data.entryCSS;
  const js = sumChunks(jsAll);
  const css = sumChunks(cssAll);
  const out = {
    url: route.url,
    first_load_js_raw_bytes: js.raw,
    first_load_js_gzip_bytes: js.gzip,
    first_load_js_gzip_kb: +(js.gzip / 1024).toFixed(2),
    first_load_css_raw_bytes: css.raw,
    first_load_css_gzip_bytes: css.gzip,
    first_load_css_gzip_kb: +(css.gzip / 1024).toFixed(2),
    chunk_counts: {
      shared: sharedChunks.size,
      route_unique_entry: data.entryJS.length,
      total_js_unique: js.uniqueChunkCount,
      css: data.entryCSS.length,
    },
  };
  if (js.missing.length || css.missing.length) {
    out.missing_chunks = [...js.missing, ...css.missing].slice(0, 5);
  }
  if (baseline) {
    const baselineRoute = baseline.routes?.find((r) => r.url === route.url);
    if (baselineRoute) {
      out.baseline_first_load_js_gzip_kb = baselineRoute.first_load_js_gzip_kb;
      out.delta_vs_pre_B1_kb = +(out.first_load_js_gzip_kb - baselineRoute.first_load_js_gzip_kb).toFixed(2);
    }
  }
  return out;
});

const result = {
  captured_at: new Date().toISOString(),
  next_version: "16.2.4 (Turbopack)",
  measurement_method:
    "Sum of (rootMainFiles + polyfillFiles from build-manifest.json) + (entryJSFiles + entryCSSFiles from per-route page_client-reference-manifest.js). Gzip via Node zlib at default level 6.",
  shared_baseline: {
    chunk_count: sharedChunks.size,
    raw_bytes: sharedSummary.raw,
    gzip_bytes: sharedSummary.gzip,
    gzip_kb: +(sharedSummary.gzip / 1024).toFixed(2),
  },
  routes,
  baseline_used: baseline
    ? { path: baselinePath, captured_at: baseline.captured_at, git_sha: baseline.git_sha }
    : null,
};

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
