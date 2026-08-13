// The manifest is a committed generated file, so the one thing that can go
// wrong is DRIFT: someone adds a photo, forgets to regenerate, and the image
// silently renders as a placeholder in production while looking fine in dev —
// which is exactly the failure mode the manifest was written to end.
//
// These specs make drift a red test rather than a live bug.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { collectImagePaths, renderManifest } from "./gen-image-manifest.mjs";
import { PUBLIC_IMAGE_PATHS, publicImageExists } from "@/lib/media/image-manifest";

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "src", "lib", "media", "image-manifest.ts");

describe("image manifest", () => {
  it("matches what is actually on disk — regenerate if this fails", () => {
    // The failure message matters: whoever trips this is mid-way through adding
    // a photo and needs the command, not a diff of 86 strings.
    const onDisk = collectImagePaths();
    const missing = onDisk.filter((p: string) => !PUBLIC_IMAGE_PATHS.includes(p as never));
    const extra = PUBLIC_IMAGE_PATHS.filter((p) => !onDisk.includes(p));
    expect(
      { missing, extra, fix: "node scripts/gen-image-manifest.mjs" }
    ).toEqual({ missing: [], extra: [], fix: "node scripts/gen-image-manifest.mjs" });
  });

  it("is byte-identical to a fresh render, so the build never rewrites it", () => {
    // Guards determinism as well as content: an unsorted walk would churn the
    // file on every build and bury real changes in review noise.
    expect(readFileSync(MANIFEST, "utf8").replace(/\r\n/g, "\n")).toBe(
      renderManifest(collectImagePaths()).replace(/\r\n/g, "\n")
    );
  });

  it("stays client-safe — no node builtin may reach a \"use client\" bundle", () => {
    // PackageFinder.tsx and AftercareTabs.tsx are client components that render
    // these wrappers. A node: import here would break both pages, which is the
    // original reason two wrappers hand-maintained a hardcoded list.
    const source = readFileSync(MANIFEST, "utf8");
    expect(source).not.toMatch(/from "node:/);
    expect(source).not.toMatch(/require\(/);
  });

  it("answers membership, not mere presence of a string", () => {
    expect(publicImageExists(PUBLIC_IMAGE_PATHS[0])).toBe(true);
    expect(publicImageExists("/images/definitely/not-here.jpg")).toBe(false);
    // A path that exists but is not an /images/ asset must not pass: next.config
    // only permits next/image to optimise /images/**.
    expect(publicImageExists("/logos/rahma-logo.svg")).toBe(false);
  });

  it("lists only renderable image types", () => {
    for (const p of PUBLIC_IMAGE_PATHS) {
      expect(p).toMatch(/\.(jpg|jpeg|png|webp|avif|gif|svg)$/i);
      expect(p.startsWith("/images/")).toBe(true);
    }
  });
});
