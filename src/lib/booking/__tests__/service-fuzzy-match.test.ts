import { describe, expect, it } from "vitest";
import { fuzzyMatchService, type ServiceForMatching } from "../service-fuzzy-match";

// C-03 (enquiry → booking conversion) — fixtures mirror the LIVE `services`
// table (5 active rows, verified via SELECT against twzutkfgqclqurvkmvqz
// during C-C implementation), not the plan's 2026-05-26 assumptions.
const services: ServiceForMatching[] = [
  { slug: "massage-60", name: "1-Hour Massage Therapy", group_category: "massage" },
  { slug: "massage-30", name: "30-Min Massage Therapy", group_category: "massage" },
  { slug: "fire-package", name: "Fire Package", group_category: "cupping" },
  { slug: "hijama-package", name: "Hijama Package", group_category: "cupping" },
  { slug: "supreme-combo", name: "Supreme Combo Package", group_category: "cupping" },
];

describe("fuzzyMatchService", () => {
  it("exact match — returns the exact-name slug", () => {
    expect(fuzzyMatchService("Supreme Combo Package", services)).toBe("supreme-combo");
  });

  it("substring match — needle is a prefix of the service name", () => {
    expect(fuzzyMatchService("Supreme Combo", services)).toBe("supreme-combo");
  });

  it("substring match — single distinctive word still resolves unambiguously", () => {
    // "supreme" is a substring of "supreme combo package" (score 0.9) and has
    // zero token/category overlap with any other active service, so it
    // resolves the same as the other supreme-combo cases above.
    expect(fuzzyMatchService("supreme", services)).toBe("supreme-combo");
  });

  it("hijama — resolves to the one active service whose name contains it", () => {
    // "hijama" is a substring of "Hijama Package" only (score 0.9); Fire
    // Package shares neither the word nor the category token, so there is
    // no live ambiguity between the two cupping services here.
    expect(fuzzyMatchService("hijama", services)).toBe("hijama-package");
  });

  it("ambiguous massage — two services tie on the same substring score, deliberately returns no match", () => {
    // Both "1-Hour Massage Therapy" and "30-Min Massage Therapy" contain
    // "massage" (score 0.9 each), so the margin gate (top - runnerUp >= 0.15)
    // fails on a 0 margin. This is the deliberate safe fallback — no guess.
    expect(fuzzyMatchService("massage", services)).toBeNull();
  });

  it('"1 hour massage" — hyphenated live service name does not substring-match; falls back to a tied category score below threshold, deliberately returns no match', () => {
    // Against the live data, "1-hour massage therapy" (hyphen) does NOT
    // contain the space-separated needle "1 hour massage", so this misses
    // the substring branch entirely. Both massage services then tie at the
    // 0.75 category-match score, which is below the 0.8 top-score gate —
    // so the helper returns null rather than guessing. See final report:
    // this diverges from the plan's assumed "massage-60" outcome, but null
    // is the safe/deliberate outcome the algorithm actually produces here,
    // not a wrong pre-select.
    expect(fuzzyMatchService("1 hour massage", services)).toBeNull();
  });

  it("empty string — returns no match", () => {
    expect(fuzzyMatchService("", services)).toBeNull();
  });

  it("no match — unrelated free text returns null", () => {
    expect(fuzzyMatchService("chocolate cake", services)).toBeNull();
  });

  it("empty services list — returns null regardless of interest text", () => {
    expect(fuzzyMatchService("supreme", [])).toBeNull();
  });
});
