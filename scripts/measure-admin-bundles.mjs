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

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const NEXT_DIR = ".next";

const ROUTES = [
  { url: "/admin/dashboard", manifestRoute: "admin/dashboard" },
  { url: "/admin/reports", manifestRoute: "admin/reports" },
  { url: "/admin/clients/[clientId]", manifestRoute: "admin/clients/[clientId]" },
  { url: "/admin/staff/[staffId]", manifestRoute: "admin/staff/[staffId]" },
];

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
