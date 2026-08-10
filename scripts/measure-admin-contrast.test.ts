import { describe, expect, it } from "vitest";
import {
  analyzeUnit,
  collectUnits,
  composite,
  oklchToRgb,
  parseTokensCss,
} from "./measure-admin-contrast.mjs";

// This suite deliberately uses small, inline fixtures — never the live repo,
// which is exactly what ITEM 7's fix is in the process of changing. Where a
// fixture mirrors a real, previously-verified bug (button.tsx's outline/
// active: shape), the numbers are copied in as literals so the assertion
// stays meaningful even after the live file is edited or the bug is fixed.

describe("colour maths — known reference values", () => {
  it("converts oklch lightness extremes to white/black", () => {
    // L is a 0..1 fraction in this file's oklchToRgb (not 0..100). Chroma 0
    // is achromatic, so the result is white/black regardless of hue.
    expect(oklchToRgb(1, 0, 0)).toEqual([255, 255, 255]);
    expect(oklchToRgb(0, 0, 0)).toEqual([0, 0, 0]);
  });

  it("produces the expected alpha-composited colour", () => {
    // 50% red over a black backing = half-strength red, rounded per channel.
    expect(composite([255, 0, 0], 0.5, [0, 0, 0])).toEqual([128, 0, 0]);
    // Fully opaque short-circuits to the colour itself, ignoring the backing.
    expect(composite([10, 20, 30], 1, [0, 0, 0])).toEqual([10, 20, 30]);
    // 12% over white pulls the effective colour almost all the way to white
    // — this is exactly what makes badge.tsx's `bg-[var(--admin-primary)]/12`
    // safe to sit under full-strength primary-coloured text (see below).
    expect(composite([0, 100, 0], 0.12, [255, 255, 255])).toEqual([224, 236, 224]);
  });
});

describe("AST-based pairing — true positives it must still catch", () => {
  it("flags a themed foreground against a hardcoded light background in dark mode only — button.tsx's outline/active: shape, 1.07:1", () => {
    // Real values captured from tokens.css and button.tsx at the time this
    // test was written: --admin-body is dark text in light mode, light text
    // in dark mode; oklch(92% 0.022 155) is button.tsx's hardcoded
    // active:bg literal (outline/ghost variants). Copied in as literals so
    // this test does not depend on either file's current content.
    const tokens = { "--admin-body": { light: "#313731", dark: "oklch(90% 0.010 88)" } };
    const unit = { text: "text-[var(--admin-body)] active:bg-[oklch(92%_0.022_155)]", line: 1, source: "jsx" as const };

    const findings = analyzeUnit(unit, "fixture.tsx", tokens);
    const dark = findings.find((f) => f.theme === "dark");
    const light = findings.find((f) => f.theme === "light");

    expect(dark).toBeDefined();
    expect(dark!.cr).toBeCloseTo(1.07, 1);
    // Light mode must NOT fail: --admin-body is dark text there, and the
    // hardcoded background is light — the token was designed correctly for
    // light, only dark is broken by the hardcoded literal.
    expect(light).toBeUndefined();
  });
});

describe("AST-based pairing — false positives this rewrite removes", () => {
  it("does not flag an alpha-composited background beside full-strength text of the same token — badge.tsx's default variant", () => {
    // Real shape from badge.tsx:56 — bg-[var(--admin-primary)]/12 beside
    // text-[var(--admin-primary)]. Before alpha support this measured 1:1
    // (both colours identical) and was a false positive; it must stay fixed.
    // Mirrors the real token design: --admin-primary flips value per theme
    // (dark in light mode, light in dark mode) so full-strength text always
    // contrasts against its own 12%-alpha fill blended into the panel.
    const tokens = {
      "--admin-primary": { light: "#003300", dark: "#99ff99" },
      "--admin-panel": { light: "#ffffff", dark: "#1a1a1a" },
    };
    const unit = { text: "bg-[var(--admin-primary)]/12 text-[var(--admin-primary)]", line: 1, source: "jsx" as const };

    const findings = analyzeUnit(unit, "fixture.tsx", tokens);

    expect(findings).toEqual([]);
  });

  it("never pairs the two branches of a ternary with each other", () => {
    // Mirrors the real bug found in attention-group-client.tsx:268 and
    // notification-bell.tsx: a ternary where one branch supplies only a
    // foreground and the other supplies only a background. Naive same-line
    // merging would report fg=#ffffff vs bg=#ffffff (1:1, a guaranteed
    // failure) even though that exact pair can never render — the two
    // colours belong to mutually exclusive branches.
    const source = `
      function Chip({ active }: { active: boolean }) {
        return (
          <span className={active ? "text-[#ffffff]" : "bg-[#ffffff]"}>
            x
          </span>
        );
      }
    `;
    const { units } = collectUnits("fixture.tsx", source);
    const tokens = {};
    const findings = units.flatMap((u) => analyzeUnit(u, "fixture.tsx", tokens));

    // The impossible pairing must never appear, in either theme.
    expect(findings.some((f) => f.fg === "#ffffff" && f.bg === "#ffffff")).toBe(false);

    // And the branches were genuinely kept apart: one unit has only the
    // foreground, the other only the background — never both together.
    expect(units.some((u) => /text-\[#ffffff\]/.test(u.text) && /bg-\[#ffffff\]/.test(u.text))).toBe(false);
  });

  it("does not flag an unconditional hover background beside a conditional branch's own, different-prefixed hover background — the tailwind-merge conflict this rewrite must not invent", () => {
    // Widening the pairing unit from "line" to "element+branch" can bring
    // two same-prefix background utilities into one unit that tailwind-merge
    // (used by this codebase's cn()) would itself dedupe at runtime, keeping
    // only the last. Without modelling that, the earlier one reads as a
    // colour pairing that can never actually render.
    const source = `
      function MenuItem({ destructive }: { destructive: boolean }) {
        return (
          <button
            className={cn(
              "hover:bg-[var(--admin-panel-muted)]",
              destructive ? "text-[#a00000] hover:bg-[#ffe0e0]" : "text-[var(--admin-body)]"
            )}
          />
        );
      }
    `;
    const tokens = { "--admin-panel-muted": { light: "#101010", dark: "#101010" } };
    const { units } = collectUnits("fixture.tsx", source);
    const findings = units.flatMap((u) => analyzeUnit(u, "fixture.tsx", tokens));

    // The destructive branch's own hover:bg-[#ffe0e0] must win (last in
    // source order); the base hover:bg-[var(--admin-panel-muted)] must not
    // survive into that branch to be wrongly paired with the destructive text.
    expect(findings.some((f) => f.fg === "#a00000" && f.bg === "var(--admin-panel-muted)")).toBe(false);
  });
});

describe("collectUnits — variant maps (cva-style, as in button.tsx / badge.tsx)", () => {
  it("treats each value in an object-literal variant map as its own pairing unit", () => {
    const source = `
      const badgeVariants = {
        variants: {
          variant: {
            confirmed: "bg-[#e0ffe0] text-[#003300] px-2.5 py-1",
            cancelled: "bg-[#ffe0e0] text-[#330000] px-2.5 py-1",
          },
        },
      };
    `;
    const { units } = collectUnits("fixture.tsx", source);
    const variantUnits = units.filter((u) => u.source === "variant-map");

    expect(variantUnits.length).toBe(2);
    // Each variant's colours stay together as one unit — never merged with
    // the other variant's colours (they can never render simultaneously).
    expect(variantUnits.some((u) => /#e0ffe0/.test(u.text) && /#330000/.test(u.text))).toBe(false);
  });
});

describe("collectUnits — unresolved elements are counted, never guessed", () => {
  it("counts a className that resolves through an unresolvable identifier as unresolved, without inventing its value", () => {
    const source = `
      import { CANCELLED_TEXT } from "./lib";
      function Marker() {
        return <span aria-hidden="true" className={cn("ml-1", CANCELLED_TEXT)}>*</span>;
      }
    `;
    const { units, unresolvedElements } = collectUnits("fixture.tsx", source);

    expect(unresolvedElements).toBe(1);
    // No unit may contain a guessed colour for CANCELLED_TEXT — the base
    // branch text has no colour-utility content because "ml-1" alone doesn't
    // resolve to any finding.
    for (const u of units) {
      expect(analyzeUnit(u, "fixture.tsx", {})).toEqual([]);
    }
  });

  it("does not count a fully static className as unresolved", () => {
    const source = `function Ok() { return <div className="text-[#000000] bg-[#ffffff]" />; }`;
    const { unresolvedElements } = collectUnits("fixture.tsx", source);
    expect(unresolvedElements).toBe(0);
  });
});

describe("parseTokensCss — structural sanity on a synthetic four-block file", () => {
  it("resolves a token per theme from :root, dark and light blocks", () => {
    const css = `
      :root { --admin-panel: #ffffff; }
      [data-theme="dark"] { --admin-panel: #111111; }
      [data-theme="light"] { --admin-panel: #ffffff; }
      @media print { :root { --admin-panel: #ffffff; } }
    `;
    const tokens = parseTokensCss(css);
    expect(tokens["--admin-panel"]).toEqual({ dark: "#111111", light: "#ffffff" });
  });
});
