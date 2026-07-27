import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { contactLinks } from "@/content/site/contact";

// Anti-drift guard for the canonical domain (C-21). Two failure modes, both of
// which had actually happened before this test existed:
//   1. a wrong-domain literal (rahmatherapy .co.uk / .com) anywhere in src/;
//   2. a SECOND hard-coded copy of the CORRECT origin — the drift mode that let
//      area-json-ld.ts carry its own file-local SITE_URL const.
//
// The domain needles are assembled at runtime so this spec file itself carries no
// matchable literal: the scan covers every source file under src/, this one
// included. (`.example` / `.example.test` fixture addresses cannot match these
// needles, so no fixture exclusion is needed.)
const BRAND = "rahmatherapy";
const WRONG_DOMAINS = [`${BRAND}.co.uk`, `${BRAND}.com`];
const LIVE_ORIGIN = `https://${BRAND}.uk`;
const SITE_URL_MODULE = "src/content/site/site-url.ts";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".css"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}

describe("canonical domain", () => {
  const files = sourceFiles(join(process.cwd(), "src")).map((file) => ({
    path: relative(process.cwd(), file).split(sep).join("/"),
    contents: readFileSync(file, "utf8"),
  }));

  it("keeps wrong-domain literals out of src/", () => {
    // Guards against a vacuous pass if the walk above ever stops finding files.
    expect(files.length).toBeGreaterThan(100);

    for (const domain of WRONG_DOMAINS) {
      const offenders = files.filter((file) => file.contents.includes(domain));
      expect(offenders.map((file) => file.path), `stale domain "${domain}"`).toEqual([]);
    }
  });

  it("hard-codes the live origin in exactly one module", () => {
    const carriers = files.filter((file) => file.contents.includes(LIVE_ORIGIN));
    expect(carriers.map((file) => file.path)).toEqual([SITE_URL_MODULE]);
  });

  it("publishes the clinic's live contact address", () => {
    expect(contactLinks.email.value).toBe("rahmatherapy@outlook.com");
    expect(contactLinks.email.href).toBe("mailto:rahmatherapy@outlook.com");
  });
});
