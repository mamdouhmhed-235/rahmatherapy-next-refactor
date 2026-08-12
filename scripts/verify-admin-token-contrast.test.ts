import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkPairs,
  contrastRatio,
  derivePairs,
  findFrozenRootAliases,
  oklchToRgb,
  parseTokensCss,
  resolveColour,
  harvestProseRatioClaims,
  run,
  TOKENS_PATH,
  verifyProseRatioClaims,
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

describe("parseTokensCss — @media print must not be confused with an earlier prose mention", () => {
  // Mirrors the real tokens.css shape that caused the bug: a comment that
  // mentions the literal words "@media print" sits BETWEEN the :root and
  // [data-theme="dark"] blocks (tokens.css:317), well before the real
  // @media print rule (tokens.css:543). A naive css.indexOf("@media print")
  // matches the comment and then greedily consumes the next block's braces
  // (the dark block) as if they belonged to print.
  const SYNTHETIC_CSS_WITH_PRINT_DECOY = `
:root {
  --admin-canvas: #ffffff;
}

/* Historical note: these blocks MUST stay after :root, and @media print MUST stay last. */

[data-theme="dark"],
[data-admin-theme-root][data-theme="dark"] ~ * {
  --admin-canvas: #111111;
}

[data-theme="light"],
[data-admin-theme-root][data-theme="light"] ~ * {
  --admin-canvas: #ffffff;
}

@media print {
  :root,
  [data-theme="dark"],
  [data-theme="light"] {
    --admin-canvas: #eeeeee;
  }
}
`;

  it("parses the @media print block from its own selector, not from the word 'print' inside an earlier comment", () => {
    const parsed = parseTokensCss(SYNTHETIC_CSS_WITH_PRINT_DECOY);
    // The real print block declares --admin-canvas: #eeeeee. A parser that
    // mistakes the earlier comment for the print selector will instead
    // return the dark block's body (#111111) under the "print" label.
    expect(parsed.scopes.print["--admin-canvas"]).toBe("#eeeeee");
  });

  it("reports exactly 2 ratio comments attributed to the print block, not 5", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const parsed = parseTokensCss(css);
    const printRatios = parsed.ratioComments.filter((c) => c.block === "print");
    expect(printRatios.map((c) => c.token)).toEqual([
      "--admin-danger-text-strong",
      "--admin-warning-text-strong",
    ]);
    expect(printRatios.length).toBe(2);
  });
});

describe("findFrozenRootAliases — regression guard for the alias-freeze class", () => {
  // Disclosed limit: this is a SOURCE-TEXT check against tokens.css's declared
  // text. It cannot catch an alias introduced by any other mechanism — a value
  // set at runtime via element.style.setProperty(), a CSS-in-JS layer, or any
  // non-declarative source outside that file. See findFrozenRootAliases's own
  // doc comment for the full scope statement (dark + light only, not print;
  // no fallback var(); no var() wrapped in another function).

  it("flags a token declared only in :root as a bare var() alias", () => {
    // Synthetic fixture — proves the detector's OWN logic works, independent of
    // tokens.css's current state. Required because a test that only asserted
    // "zero found in the real file" would pass whether or not detection works,
    // now that the eleven real instances have been fixed.
    const css = `
:root {
  --admin-real-fine: #ffffff;
  --admin-frozen: var(--admin-real-fine);
  --notif-badge-frozen-bg: var(--admin-real-fine);
  --admin-not-frozen: var(--admin-real-fine);
  --admin-with-fallback: var(--admin-real-fine, #000000);
  --admin-not-alias: #123456;
}
[data-theme="dark"] {
  --admin-real-fine: #111111;
  --admin-not-frozen: #222222;
}
[data-theme="light"] {
  --admin-real-fine: #ffffff;
  --admin-not-frozen: #f0f0f0;
}
`;
    const frozen = findFrozenRootAliases(css);
    const flaggedNames = frozen.map((f) => f.token).sort();

    // Caught: declared only in :root, bare var(), missing from BOTH theme blocks.
    expect(flaggedNames).toContain("--admin-frozen");
    // Caught on a --notif-* name too — proves the guard is not scoped to
    // --admin-* only, which is the gap the shared DECL_RE still has.
    expect(flaggedNames).toContain("--notif-badge-frozen-bg");
    // NOT caught: redeclared with its own value in both dark and light.
    expect(flaggedNames).not.toContain("--admin-not-frozen");
    // NOT caught: not an alias at all.
    expect(flaggedNames).not.toContain("--admin-not-alias");
    // NOT caught by design: var() WITH a fallback is outside this guard's
    // declared scope — asserted so the omission reads as intentional.
    expect(flaggedNames).not.toContain("--admin-with-fallback");

    expect(flaggedNames).toEqual(["--admin-frozen", "--notif-badge-frozen-bg"]);
  });

  it("finds zero frozen :root-only alias tokens in the real tokens.css", () => {
    // Real-file assertion — meaningful only paired with the synthetic test
    // above. Before the de-alias commit this found exactly 11.
    const css = readFileSync(TOKENS_PATH, "utf8");
    const frozen = findFrozenRootAliases(css);
    expect(frozen).toEqual([]);
  });
});

describe("--notif-badge-*-bg — white-foreground chips must pass AA in every block", () => {
  // These three are the one place where de-aliasing a frozen token made things
  // WORSE, so they are pinned as theme-invariant literals. --admin-danger,
  // --admin-warning and --admin-info are FOREGROUND colours and are light in the
  // dark theme; a badge tracking them would paint white text on a light chip
  // (measured: 2.26:1, 1.65:1, 1.90:1). Asserting every declaration — rather than
  // one per block — also catches a fourth block being added later without one.
  //
  // Note this cannot go through parseTokensCss: DECL_RE only matches --admin-*,
  // so the whole --notif-* family is invisible to it.
  it("keeps every --notif-badge-*-bg declaration above AA against its white foreground", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const decls = [...css.matchAll(/(--notif-badge-(?:critical|warning|info)-bg)\s*:\s*([^;]+);/g)];

    // 3 tokens x 4 blocks (:root, dark, light, @media print).
    expect(decls.length).toBe(12);

    const white = resolveColour("#ffffff", {});
    for (const [, token, rawValue] of decls) {
      const value = rawValue.trim();
      expect(value).not.toMatch(/^var\(/); // must stay a literal, never re-aliased
      const ratio = contrastRatio(resolveColour(value, {}), white);
      expect(
        ratio,
        `${token}: ${value} on #ffffff is ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("declares each --notif-badge-*-bg with the same value in every block", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const byToken: Record<string, Set<string>> = {};
    for (const [, token, rawValue] of css.matchAll(
      /(--notif-badge-(?:critical|warning|info)-bg)\s*:\s*([^;]+);/g
    )) {
      (byToken[token] ??= new Set()).add(rawValue.trim());
    }
    for (const [token, values] of Object.entries(byToken)) {
      expect(values.size, `${token} has ${values.size} distinct values: ${[...values].join(", ")}`).toBe(1);
    }
  });
});

describe("--admin-warning / --admin-warning-bg — Step 0.2 regression guard (D8)", () => {
  it("fails when the light-theme --admin-warning / --admin-warning-bg pair is below 4.5:1", () => {
    // Synthetic CSS carrying the PRE-fix (D8-failing) value, proving the guard
    // actually flags a regression rather than being trivially green.
    const failingCss = `
:root {
  --admin-warning: #b77900;
  --admin-warning-bg: #fff7df;
}
[data-theme="dark"] {
  --admin-warning: #b77900;
  --admin-warning-bg: #fff7df;
}
[data-theme="light"] {
  --admin-warning: #b77900;
  --admin-warning-bg: #fff7df;
}
@media print {
  :root {
    --admin-warning: #b77900;
    --admin-warning-bg: #fff7df;
  }
}
`;
    const parsed = parseTokensCss(failingCss);
    const pairs = derivePairs(parsed.tokens, parsed.ratioComments);
    const results = checkPairs(pairs, parsed.tokens);
    const lightWarning = results.find(
      (r) => r.fg === "--admin-warning" && r.bg === "--admin-warning-bg" && r.theme === "light"
    );

    expect(lightWarning?.ratio).toBeCloseTo(3.41, 1);
    expect(lightWarning?.pass).toBe(false);
  });

  it("passes at the fixed 4.72:1 in the real, post-Step-0.2 tokens.css", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");
    const parsed = parseTokensCss(css);
    const pairs = derivePairs(parsed.tokens, parsed.ratioComments);
    const results = checkPairs(pairs, parsed.tokens);
    const lightWarning = results.find(
      (r) => r.fg === "--admin-warning" && r.bg === "--admin-warning-bg" && r.theme === "light"
    );

    expect(lightWarning?.ratio).toBeCloseTo(4.72, 1);
    expect(lightWarning?.pass).toBe(true);
  });

  it("checks the @media print block's own --admin-warning / --admin-warning-bg pair, not the dark block's", () => {
    // checkPairs() only ever iterates the dark and light scopes, so the print
    // block's copy of this pair is invisible to the pair checker. The print
    // block is documented to render "the light set exactly", so assert it
    // directly against light — this is the automated form of the manual diff
    // Step 0.2 would otherwise depend on a human remembering to run.
    const css = readFileSync(TOKENS_PATH, "utf8");
    const parsed = parseTokensCss(css);

    expect(parsed.scopes.print["--admin-warning"]).toBe(parsed.scopes.light["--admin-warning"]);
    expect(parsed.scopes.print["--admin-warning-bg"]).toBe(parsed.scopes.light["--admin-warning-bg"]);
    // Pin the value too, so a future edit that changes BOTH blocks in step
    // still has to be a deliberate, reviewed change rather than a silent drift.
    expect(parsed.scopes.print["--admin-warning"]).toBe("#986400");
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

// ---------------------------------------------------------------------------
// Step 0.5 (D11) — prose contrast claims.
//
// tokens.css states many ratios in prose rather than in the inline
// `--token: value; /* N:1 vs other */` form. Several are load-bearing safety
// warnings, and nothing verified any of them, so a value change could silently
// falsify one. The requirement is NOT "check them all" — it is "check what can
// be checked and SAY SO about what cannot", because quietly checking only the
// easy ones manufactures false confidence.
// ---------------------------------------------------------------------------

describe("prose contrast claims", () => {
  const realCss = readFileSync(TOKENS_PATH, "utf8");

  it("harvests ratio claims stated in prose, not just the inline `N:1 vs X` form", () => {
    const claims = harvestProseRatioClaims(realCss);

    // The plan estimated 16. The real count is far higher, because prose also
    // carries historical corrections ("the previous note said 9.74:1").
    expect(claims.length).toBeGreaterThan(30);

    // A specific, load-bearing safety warning must be among them: if this
    // sentence stops being harvested, the guard has silently narrowed.
    const bodyTextWarning = claims.find((c) =>
      c.sentence.includes("never use as body text")
    );
    expect(bodyTextWarning).toBeDefined();
  });

  it("does not double-report the inline ratio comments the 1b check already owns", () => {
    const prose = harvestProseRatioClaims(realCss);
    const parsed = parseTokensCss(realCss);
    const inlineRatios = parsed.ratioComments.map((c) => c.statedRatio);

    // 1b owns 11 inline comments. If prose harvesting swallowed them too, the
    // same ratio would be reported twice and the counts would stop meaning
    // anything. Spot-check the distinctive ones.
    expect(inlineRatios.length).toBeGreaterThan(0);
    const proseSentences = prose.map((p) => p.sentence).join(" ");
    expect(proseSentences).not.toContain("9.21:1 vs danger-bg-strong");
  });

  it("flags every claim it cannot machine-parse, with a reason, rather than skipping it silently", () => {
    const parsed = parseTokensCss(realCss);
    const { checked, unverifiable } = verifyProseRatioClaims(realCss, parsed);

    expect(checked.length + unverifiable.length).toBe(
      harvestProseRatioClaims(realCss).length
    );
    // Nothing may be dropped on the floor: every unverifiable claim carries a
    // stated reason and the sentence it came from, so a human can check it.
    for (const u of unverifiable) {
      expect(u.reason).toBeTruthy();
      expect(u.sentence.length).toBeGreaterThan(0);
    }
  });

  it("checks an explicitly written `A vs B` pair (synthetic — proves the checker actually works)", () => {
    // Real tokens.css currently yields ZERO machine-checkable prose claims, so
    // a real-file-only assertion would pass whether or not this logic works.
    // Same reasoning as Step 0.4's synthetic-fixture requirement.
    const css = `:root {
      --admin-fg: oklch(0% 0 0);
      --admin-bg: oklch(100% 0 0);
      /* Deliberate: --admin-fg vs --admin-bg measures 21.00:1 here. */
    }
    [data-theme="dark"] { --admin-fg: oklch(0% 0 0); }
    [data-theme="light"] { --admin-fg: oklch(0% 0 0); }
    @media print { --admin-fg: oklch(0% 0 0); }`;

    const { checked } = verifyProseRatioClaims(css, parseTokensCss(css));
    expect(checked).toHaveLength(1);
    expect(checked[0].pair).toEqual(["--admin-fg", "--admin-bg"]);
    expect(checked[0].pass).toBe(true);

    // And it must actually FAIL a wrong number, not just accept anything.
    const wrong = css.replace("21.00:1", "4.50:1");
    const { checked: bad } = verifyProseRatioClaims(wrong, parseTokensCss(wrong));
    expect(bad).toHaveLength(1);
    expect(bad[0].pass).toBe(false);
  });

  it("refuses to invent a pair from two tokens that merely co-occur in one comment", () => {
    // REGRESSION GUARD. An earlier draft paired "the two resolvable tokens in
    // this comment" and fabricated a 4.43 delta out of tokens.css:378-382,
    // which states a ratio for --admin-primary against the PANEL while also
    // naming --admin-on-primary. A tool that invents failures gets ignored.
    const css = `:root {
      --admin-primary: oklch(50% 0.1 240);
      --admin-on-primary: oklch(100% 0 0);
      --admin-panel: oklch(20% 0 0);
      /* --admin-primary lightens so it clears 4.5:1 as a label on the dark
       * panel, and --admin-on-primary darkens to stay readable. */
    }
    [data-theme="dark"] { --admin-primary: oklch(50% 0.1 240); }
    [data-theme="light"] { --admin-primary: oklch(50% 0.1 240); }
    @media print { --admin-primary: oklch(50% 0.1 240); }`;

    const { checked, unverifiable } = verifyProseRatioClaims(css, parseTokensCss(css));
    expect(checked).toHaveLength(0);
    expect(unverifiable).toHaveLength(1);
    expect(unverifiable[0].reason).toMatch(/judgement call|threshold/);
  });

  it("leaves the tool's failure count untouched, so an unverifiable claim cannot break the gate", () => {
    const { summary } = run(realCss, { json: true });
    expect(summary.proseClaimsFound).toBeGreaterThan(30);
    expect(summary.proseMismatches).toBe(0);
    expect(summary.totalFailures).toBe(
      summary.ratioMismatches + summary.pairFailures + summary.proseMismatches
    );
  });
});
