import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

// Anti-drift guard (C-17 fix round). `/booking/manage` receives the
// customer's booking-management bearer token as a URL query parameter
// (`?token=...` — see src/app/booking/manage/page.tsx). GA4's default
// `page_location` field is `window.location.href`, including the query
// string, so mounting <GoogleAnalytics /> anywhere under src/app/booking/
// would send that live credential to Google on every page_view. A prior
// commit (05f251e) did exactly this via src/app/booking/layout.tsx, was
// caught by an independent verifier, and the mount was removed. This test
// makes a re-introduction fail loudly instead of shipping silently.
const SOURCE_EXTENSIONS = [".ts", ".tsx"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}

describe("no GoogleAnalytics under src/app/booking/", () => {
  const bookingDir = join(process.cwd(), "src", "app", "booking");
  const files = sourceFiles(bookingDir)
    .filter((file) => !file.split(sep).join("/").includes("/__tests__/"))
    .map((file) => ({
      path: relative(process.cwd(), file).split(sep).join("/"),
      contents: readFileSync(file, "utf8"),
    }));

  it("finds files to scan (guards against a vacuous pass)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("never imports or mounts GoogleAnalytics", () => {
    const offenders = files.filter((file) => file.contents.includes("GoogleAnalytics"));
    expect(
      offenders.map((file) => file.path),
      "the manage-booking token is a bearer credential carried in the URL " +
        "query string; GA's page_location would exfiltrate it to Google — " +
        "see src/app/booking/manage/page.tsx and redesign/evidence/C-17/phase-a-verify-full.md"
    ).toEqual([]);
  });
});
