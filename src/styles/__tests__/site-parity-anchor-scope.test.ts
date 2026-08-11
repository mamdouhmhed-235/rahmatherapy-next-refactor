import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SITE_PARITY_PATH = path.resolve(__dirname, "../site-parity.css");

/**
 * Anti-drift guard for D12 — the cascade-layer inversion.
 *
 * `site-parity.css` is imported from the root layout BEFORE `globals.css`, and
 * for a long time it was imported entirely unlayered. Under CSS cascade layers,
 * unlayered styles beat layered ones regardless of specificity, so its
 * `a { color: inherit }` reset defeated EVERY Tailwind text-colour utility on
 * EVERY anchor, site-wide — admin and public.
 *
 * Measured before the fix: /booking/manage's `bg-[var(--rahma-green)] text-white`
 * CTA rendered its label in inherited dark blue at 1.78:1 instead of white at
 * 5.18:1, on a live customer page.
 *
 * Disclosed limit: this is a SOURCE-TEXT check. It proves the rule is written
 * inside a layer block in this file; it cannot prove the browser resolves the
 * cascade as intended, and it will not catch the same inversion reintroduced
 * from a different stylesheet or via an inline style. The live proof is the
 * computed-style evidence recorded alongside the fix.
 */
describe("site-parity.css — the `a` reset must stay inside a cascade layer", () => {
  const css = readFileSync(SITE_PARITY_PATH, "utf8");

  it("declares the canonical layer order before using any @layer block", () => {
    const orderIndex = css.indexOf("@layer theme, base, components, utilities;");
    expect(orderIndex, "the layer-order statement is missing").toBeGreaterThanOrEqual(0);

    const firstBlockIndex = css.search(/@layer\s+[a-z-]+\s*\{/);
    if (firstBlockIndex >= 0) {
      // This file is imported ahead of globals.css, where the same order is
      // declared. Without this statement first, a bare `@layer base {}` here
      // would register `base` ahead of `theme` and silently reorder the cascade.
      expect(orderIndex).toBeLessThan(firstBlockIndex);
    }
  });

  it("keeps the site-parity 'a { color: inherit }' rule scoped so an unlayered import can't defeat Tailwind text-colour utilities site-wide", () => {
    // Locate the anchor reset, then count braces before it to establish whether
    // it sits inside a layer block or at the top level of the stylesheet.
    //
    // The lookbehind matters: anchoring on the PRECEDING `}` would put ruleIndex
    // on that brace, counting one level too many and making this test pass on an
    // unlayered file — i.e. silently toothless. Verified against the pre-fix
    // source: it must report depth 0 there and depth > 0 here.
    const match = /(?<=^|[\s}])a\s*\{[^}]*color:\s*inherit/m.exec(css);
    expect(match, "the `a { color: inherit }` reset was not found at all").not.toBeNull();
    const ruleIndex = match!.index;

    let depth = 0;
    for (let i = 0; i < ruleIndex; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }

    // depth 0 => the rule is unlayered and beats every layered utility.
    expect(
      depth,
      "the `a` reset is at the top level of site-parity.css, i.e. unlayered — it will defeat every Tailwind text-colour utility on every anchor, site-wide"
    ).toBeGreaterThan(0);

    // And specifically inside `@layer base`, not some other wrapper.
    const enclosing = css.slice(0, ruleIndex).lastIndexOf("@layer base {");
    expect(enclosing, "the `a` reset is nested, but not inside `@layer base`").toBeGreaterThanOrEqual(0);
  });

  it("layers only the `a` reset, not the whole stylesheet", () => {
    // Layering the entire file would also reprioritise its ~30 class-qualified
    // colour rules against utilities — an unmeasured change nobody asked for.
    const layerBlocks = css.match(/@layer\s+[a-z-]+\s*\{/g) ?? [];
    expect(layerBlocks.length).toBe(1);
  });
});
