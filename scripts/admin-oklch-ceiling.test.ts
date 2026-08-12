import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Item 7 Phase C — the ratchet, so admin dark mode is fixed once rather than
 * repeatedly.
 *
 * WHY THIS EXISTS. The admin backend was unreadable in dark mode because 717
 * raw `oklch(...)` literals across 103 files carried LIGHT values that never
 * invert — a literal cannot know what theme it is in. Phase B replaced the 549
 * whose colour was numerically identical to an existing token's light value,
 * which cut Layer 1's dark-mode failures from 377 to 97 while leaving light
 * mode byte-identical. Nothing stopped the next component from adding a fresh
 * literal and undoing it, so: this.
 *
 * ⛔ DISCLOSED LIMITS — this is a SOURCE-TEXT MATCH, and it is not a substitute
 * for reading a diff:
 *   - A computed template literal, a string concatenation, or a colour imported
 *     from a constant or JSON file will NOT be caught.
 *   - The same problem reintroduced via `lab()`, `hsl()`, `color()` or a hex
 *     literal will NOT be caught. Only the `oklch(` spelling is counted.
 *   - It counts occurrences; it cannot tell a correct substitution from a
 *     semantically wrong one. A `text-` site that took a `-bg` token passes here
 *     and is still a defect.
 *
 * The ceiling lives in `admin-oklch-ceiling.json` next to this file so lowering
 * it is a deliberate, reviewable one-line edit rather than a number buried in a
 * test.
 */

const ROOT = process.cwd();
const SCAN_DIRS = ["src/app/admin", "src/components/ui"];
const EXTENSIONS = [".ts", ".tsx"];

const ceiling = JSON.parse(
  readFileSync(join(ROOT, "scripts/admin-oklch-ceiling.json"), "utf8")
) as {
  staticCeiling: number;
  dynamicAllowance: { count: number; files: string[] };
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (EXTENSIONS.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

/** Every `oklch(...)` occurrence, split by whether it interpolates at runtime. */
function census() {
  let staticCount = 0;
  const dynamicByFile = new Map<string, number>();

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/oklch\([^)]*\)/g)) {
      const rel = relative(ROOT, file).split(sep).join("/");
      if (match[0].includes("${")) {
        dynamicByFile.set(rel, (dynamicByFile.get(rel) ?? 0) + 1);
      } else {
        staticCount += 1;
      }
    }
  }
  return { staticCount, dynamicByFile };
}

describe("admin oklch ratchet", () => {
  it("actually scanned the admin tree (guards against a vacuous pass)", () => {
    // Without this, a broken walk() would return no files, find no literals,
    // and report a triumphant zero.
    expect(files.length).toBeGreaterThan(150);
    expect(files.some((f) => f.includes("ManualBookingForm"))).toBe(true);
  });

  it("never lets the raw static oklch() count rise above the ceiling", () => {
    const { staticCount } = census();
    expect(staticCount).toBeLessThanOrEqual(ceiling.staticCeiling);
  });

  it("keeps the ceiling honest — lower it when literals are removed", () => {
    // A ceiling left far above reality stops being a ratchet and becomes a
    // rubber stamp. If this fails, the sweep made progress: update the JSON.
    const { staticCount } = census();
    expect(staticCount).toBe(ceiling.staticCeiling);
  });

  it("confines runtime-computed hues to the files that already had them", () => {
    // `oklch(88% 0.025 ${hue})` derives its hue per identity so each person
    // gets their own avatar colour. It has no static token equivalent — a token
    // is one fixed value — so these are allowed, but only where they already
    // live. A computed hue in a NEW file is a new pattern and should be a
    // deliberate decision, not a silent addition.
    const { dynamicByFile } = census();
    const seen = [...dynamicByFile.keys()].sort();
    expect(seen).toEqual([...ceiling.dynamicAllowance.files].sort());

    const total = [...dynamicByFile.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(ceiling.dynamicAllowance.count);
  });
});
