import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkPairs,
  contrastRatio,
  derivePairs,
  oklchToRgb,
  parseTokensCss,
  resolveColour,
  run,
  TOKENS_PATH,
  verifyRatioComments,
} from "./verify-admin-token-contrast.mjs";

// This suite deliberately avoids asserting on tokens.css's current colour
// VALUES — ITEM 7 (Phase A/B) is expected to change many of them. What it
// asserts instead:
//   - the colour maths against known, permanent reference values;
//   - that the four-block parser finds a structurally sane token set, on a
//     synthetic CSS string AND on the real file;
//   - the self-consistency check's match/mismatch logic, on synthetic CSS;
//   - that the real tokens.css's *currently declared* ratio comments are
//     internally self-consistent (a real regression guard: if ITEM 7 changes
//     a token's value without updating its ratio comment, this fails).

describe("colour maths — known reference values", () => {
  it("converts oklch lightness extremes to white/black", () => {
    expect(oklchToRgb(100, 0, 0)).toEqual([255, 255, 255]);
    expect(oklchToRgb(0, 0, 0)).toEqual([0, 0, 0]);
  });

  it("computes WCAG contrast ratio correctly at both ends of the scale", () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBe(21);
    expect(contrastRatio([100, 100, 100], [100, 100, 100])).toBe(1);
  });

  it("resolves hex, rgb() and named colours", () => {
    expect(resolveColour("#ff0000", {})).toEqual([255, 0, 0]);
    expect(resolveColour("rgb(10, 20, 30)", {})).toEqual([10, 20, 30]);
    expect(resolveColour("white", {})).toEqual([255, 255, 255]);
    expect(resolveColour("black", {})).toEqual([0, 0, 0]);
  });

  it("resolves var() references, including nested chains and fallbacks", () => {
    const scope = { "--foo": "#ff0000", "--bar": "var(--foo)" };
    expect(resolveColour("var(--bar)", scope)).toEqual([255, 0, 0]);
    expect(resolveColour("var(--missing, #00ff00)", {})).toEqual([0, 255, 0]);
    expect(resolveColour("var(--missing-no-fallback)", {})).toBeNull();
  });
});

describe("parseTokensCss — block extraction, structure only", () => {
  // A minimal synthetic stand-in for tokens.css's real shape: :root, a dark
  // theme block, a light theme block, and an @media print block containing a
  // NESTED selector (mirrors the real file's brace nesting at tokens.css:543).
  // Proves the brace-matching block extraction, independent of any real
  // colour value that ITEM 7 might later change.
  const SYNTHETIC_CSS = `
:root {
  --admin-canvas: #ffffff;
  --admin-panel: #f0f0f0;
  --admin-alias: var(--admin-canvas);
}

[data-theme="dark"],
[data-admin-theme-root][data-theme="dark"] ~ * {
  --admin-canvas: #111111;
  --admin-panel: #222222;
}

[data-theme="light"],
[data-admin-theme-root][data-theme="light"] ~ * {
  --admin-canvas: #ffffff;
  --admin-panel: #f0f0f0;
}

@media print {
  :root,
  [data-theme="dark"],
  [data-theme="light"] {
    --admin-canvas: #ffffff;
    --admin-panel: #f0f0f0;
  }
}
`;

  it("extracts declarations from all four blocks and resolves aliases per theme", () => {
    const parsed = parseTokensCss(SYNTHETIC_CSS);

    expect(parsed.tokens["--admin-canvas"]).toEqual({ light: "#ffffff", dark: "#111111" });
    expect(parsed.tokens["--admin-panel"]).toEqual({ light: "#f0f0f0", dark: "#222222" });
    // Alias declared only in :root must still resolve per-theme through its scope.
    expect(parsed.scopes.dark["--admin-alias"]).toBe("var(--admin-canvas)");
    expect(resolveColour(parsed.scopes.dark["--admin-alias"], parsed.scopes.dark)).toEqual([0x11, 0x11, 0x11]);
    expect(resolveColour(parsed.scopes.light["--admin-alias"], parsed.scopes.light)).toEqual([255, 255, 255]);
  });

  it("throws a clear error if an expected block cannot be found (a real structural break, not a silent 0)", () => {
    expect(() => parseTokensCss(":root { --admin-x: #fff; }")).toThrow(/could not find the "\[data-theme="dark"\]" block/);
  });

  it("finds a structurally sane --admin-* token set in the real tokens.css, resolved in both themes", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const parsed = parseTokensCss(css);

    const tokenCount = Object.keys(parsed.tokens).length;
    // ~92 tokens at time of writing (redesign/plans/POST-BAND-C-FOLLOWUP-plan.md
    // ITEM 7 §7.2). A wide band, not an exact count: ITEM 7 Phase A adds new
    // token pairs, so this must not pin an exact number.
    expect(tokenCount).toBeGreaterThan(70);
    expect(tokenCount).toBeLessThan(150);

    const lightResolved = Object.values(parsed.tokens).filter((t) => t.light !== undefined).length;
    const darkResolved = Object.values(parsed.tokens).filter((t) => t.dark !== undefined).length;
    // Every parsed token must resolve in BOTH themes — a token declared in
    // only one theme block (and not in :root) is exactly the omission
    // §7.6 warns about ("any new token must be added to every block that
    // needs it").
    expect(lightResolved).toBe(tokenCount);
    expect(darkResolved).toBe(tokenCount);
  });
});

describe("verifyRatioComments — self-consistency logic", () => {
  it("flags a match and a mismatch correctly on synthetic, deliberately-crafted CSS", () => {
    const css = `
:root {
  --admin-panel: #ffffff;
  --admin-text-correct: #000000;   /* 21.00:1 vs panel */
  --admin-text-wrong: #777777;     /* 21.00:1 vs panel */
}
[data-theme="dark"] { --admin-panel: #000000; }
[data-theme="light"] { --admin-panel: #ffffff; }
@media print { :root { --admin-panel: #ffffff; } }
`;
    const parsed = parseTokensCss(css);
    const results = verifyRatioComments(parsed);

    const correct = results.find((r) => r.token === "--admin-text-correct");
    const wrong = results.find((r) => r.token === "--admin-text-wrong");

    expect(correct?.pass).toBe(true);
    expect(correct?.actualRatio).toBeCloseTo(21, 1);
    expect(wrong?.pass).toBe(false);
    expect(wrong?.actualRatio).not.toBeCloseTo(21, 1);
  });

  it("reports the real tokens.css's self-declared ratio comments as self-consistent (regression guard)", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const parsed = parseTokensCss(css);
    const results = verifyRatioComments(parsed);

    // The tool must find some ratio comments to verify at all — if this
    // drops to zero, the regex or the file's comment convention broke.
    expect(results.length).toBeGreaterThan(0);

    const unresolved = results.filter((r) => r.pass === null);
    const mismatches = results.filter((r) => r.pass === false);

    // Every named token/background in a ratio comment must resolve to a
    // real colour — an unresolved reference means the comment names a token
    // that no longer exists.
    expect(unresolved).toEqual([]);
    // A stale ratio comment is a claim tokens.css makes about itself and is
    // worse than no comment. This is the guard: if ITEM 7 changes a token's
    // value without updating its paired comment, this must fail.
    expect(mismatches).toEqual([]);
  });
});

describe("derivePairs + checkPairs — structural exercise against the real file", () => {
  it("derives a non-trivial set of pairs and checks each in both themes without crashing", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const parsed = parseTokensCss(css);
    const pairs = derivePairs(parsed.tokens, parsed.ratioComments);
    const results = checkPairs(pairs, parsed.tokens);

    expect(pairs.length).toBeGreaterThan(20);
    expect(results.length).toBe(pairs.length * 2); // dark + light

    for (const r of results) {
      // Every check must resolve to a real ratio (both colours in tokens.css
      // are real, resolvable declarations) — a null here means a pair
      // derivation referenced a token that doesn't actually resolve.
      expect(r.ratio).not.toBeNull();
      expect(r.ratio).toBeGreaterThanOrEqual(1);
      expect(r.ratio).toBeLessThanOrEqual(21);
    }
  });
});

describe("run() — CLI-facing entry point", () => {
  it("produces consistent summary counts between human-readable and --json output", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const human = run(css, { json: false });
    const json = run(css, { json: true });

    expect(human.summary).toEqual(json.summary);
    expect(typeof human.output).toBe("string");
    expect(() => JSON.parse(json.output)).not.toThrow();
  });

  it("respects --max-failures for the exit code, without mutating the failure count", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const { summary, exitCode: permissive } = run(css, { maxFailures: Infinity });
    const { exitCode: strict } = run(css, { maxFailures: -1 });

    expect(permissive).toBe(0);
    // -1 is stricter than any possible real failure count (>= 0), so this
    // must fail whenever there is at least one failure of any kind. If there
    // are currently zero failures, both are 0 — assert relative to the
    // measured count rather than assuming which case we're in.
    expect(strict).toBe(summary.totalFailures > -1 ? 1 : 0);
  });
});
