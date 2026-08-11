# Item 2 — teeth-check of `src/app/(public)/privacy/page.test.tsx`

**A guard that cannot fail is worse than no guard.** Every case in the new test
file was run against a deliberately broken copy of the page to prove it goes
red. This file records the procedure, the script, and the actual output.

## Why the derived skeleton was not used

The read-only derivation agent (`C-test-harness.md`) proposed a five-case
skeleton. The adversarial verifier (`R2-refute-harness.md`) ran it and found
**all five cases pass on the unfixed source**, and two were wrong outright:

| Proposed case | Defect |
|---|---|
| `describes retention by criteria, not a fixed date` | Asserted `toContain("for 7 years after your last visit with us")` — the **old** text, i.e. exactly what the rewrite deletes. It would have gone red *after* the fix, for the wrong reason. |
| `does not promise a specific retention duration` | Asserted the text does not match an **absolute calendar date** (`/\d{1,2}\s+Month\s+\d{4}/`). No such string was ever present, so the case passed before and after and guarded nothing about durations. |

The shipped test file was written from scratch against the verified harness
facts, not from that skeleton.

## Harness facts (verified, `R2-refute-harness.md`)

- React 19.2.4 · `@testing-library/react` 16.3.2 (peer `^18 || ^19`) · vitest
  4.1.5 · jsdom 29.1.1.
- **No `@testing-library/jest-dom`** — no `toBeInTheDocument`. Plain DOM
  assertions only. The one textual mention of that matcher in `src/` is inside
  a comment in `AboutYouStep.test.tsx` stating this convention.
- `vitest.config.ts` has **no `setupFiles`** and no `testTimeout`; the vitest
  default of 5000 ms applies. `environment: "jsdom"`, `globals: true`,
  `@` → `src`.
- Nothing in the page's transitive import chain imports `server-only`,
  `next/headers`, `next/navigation` or `next/font`. `next/image` appears only
  as a **type-only** import in `@/types/content.ts`, erased at compile time.
  The page renders under RTL with no mocking and no console output.
- JSX decodes `&apos;` to **U+0027** (straight), not U+2019 — verified by
  char-code dump. Newline + indentation inside a JSX text node collapses to a
  single space, and there is **no separator** between the `<h3>` and `<p>`
  text in `section.textContent`.

## The mutants

Three broken copies of the page, each paired with a **verbatim** copy of the
real test file (which imports `./page`, so it binds to the mutant):

| Mutant | What is broken |
|---|---|
| `m1-prefix` | The pre-fix file, straight from `git show HEAD:src/app/(public)/privacy/page.tsx` — still says "7 years" and "around 12 months" |
| `m2-no-analytics-sentence` | Post-fix, with the kept Google-analytics sentence deleted |
| `m3-section-6-deleted` | Post-fix, with the whole `<section id="how-long-we-keep-it">` removed — the §2.3 deletion path that was **not** taken |

Every anchor used to build a mutant was asserted to occur **exactly once**
before the slice was taken (gotcha 6 — Python/JS substring matching is not line
matching), and each mutant was asserted to no longer contain the string it was
supposed to have lost.

## Result — 7 failures across 15 cases

```
❯ m1-prefix/page.test.tsx                 (5 tests | 2 failed)
    × does not promise a specific retention duration in section 6
    × describes retention by criteria, not a fixed date
❯ m2-no-analytics-sentence/page.test.tsx  (5 tests | 1 failed)
    × keeps the analytics retention sentence in section 6
❯ m3-section-6-deleted/page.test.tsx      (5 tests | 4 failed)
    × keeps the analytics retention sentence in section 6
    × keeps section headings numbered contiguously with no gap
    × keeps the how-long-we-keep-it anchor
    × describes retention by criteria, not a fixed date

 Test Files  3 failed (3)
      Tests  7 failed | 8 passed (15)
```

Against the real, fixed page: **5 passed (5)**.

| Case | Goes red on | Kind |
|---|---|---|
| does not promise a specific retention duration | `m1-prefix` | red-before / green-after |
| describes retention by criteria, not a fixed date | `m1-prefix`, `m3` | red-before / green-after |
| keeps the analytics retention sentence | `m2`, `m3` | invariant guard |
| keeps section headings numbered contiguously | `m3` | invariant guard |
| keeps the how-long-we-keep-it anchor | `m3` | invariant guard |

The three invariant guards pass before **and** after the rewrite by design —
they exist to catch a *future* silent deletion, which no banned-string grep can
do. They were therefore teeth-checked against targeted mutants rather than
against the pre-fix file, which is the only check that can prove them capable
of failing.

## Why the mutant files are not committed

`tsconfig.json`'s `include` is `["**/*.ts", "**/*.tsx", …]` with `exclude`
only `["node_modules", "worker-entrypoint.ts"]`. **Anything `.tsx` anywhere in
the repo — `redesign/evidence/**` included — is inside the `npx tsc --noEmit`
gate.** Committing duplicated copies of a page component into the evidence
tree would put stale source permanently inside a gate, where a later change to
the page's dependencies could break the typecheck for a reason unrelated to the
change being made.

(`redesign/**` is excluded from **lint**, and vitest's `include` is only
`src/**` and `scripts/**`, so evidence files cannot pollute those two gates.
The tsc gate is the exception, and it is not documented anywhere else.)

The harness is therefore regenerated on demand rather than stored. Run this
from the repo root; it writes only under
`redesign/evidence/post-band-c-impl/item-2/teeth-check/`, which should be
deleted again afterwards:

```js
// build-teeth-check.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGE = "src/app/(public)/privacy/page.tsx";
const TEST = "src/app/(public)/privacy/page.test.tsx";
const OUT = path.join(ROOT, "redesign/evidence/post-band-c-impl/item-2/teeth-check");

function assertOnce(haystack, needle, label) {
  let n = 0, i = 0;
  for (;;) {
    const j = haystack.indexOf(needle, i);
    if (j === -1) break;
    n++; i = j + 1;
  }
  if (n !== 1) throw new Error(`ASSERT FAILED: ${label} occurs ${n} times, expected exactly 1`);
  return haystack.indexOf(needle);
}

const postFix = fs.readFileSync(path.join(ROOT, PAGE), "utf8");
const testSrc = fs.readFileSync(path.join(ROOT, TEST), "utf8");
const preFix = execFileSync("git", ["show", `HEAD:${PAGE}`], { cwd: ROOT, encoding: "utf8" });

if (!/7 years/.test(preFix) || !/12 months/.test(preFix)) throw new Error("HEAD copy lacks the pre-fix durations");
if (/7 years/.test(postFix) || /12 months/.test(postFix)) throw new Error("working copy still has a removed duration");

const aStart = " above. Analytics information";
const aEnd = "retention settings.";
const i2 = assertOnce(postFix, aStart, "M2 start anchor");
const j2 = assertOnce(postFix, aEnd, "M2 end anchor");
const m2 = postFix.slice(0, i2 + " above.".length) + postFix.slice(j2 + aEnd.length);
if (m2.includes("Analytics information")) throw new Error("M2 still has the sentence");

const sStart = '          <section id="how-long-we-keep-it"';
const sNext = '          <section id="your-rights"';
const i3 = assertOnce(postFix, sStart, "M3 section-6 anchor");
const j3 = assertOnce(postFix, sNext, "M3 section-7 anchor");
if (i3 >= j3) throw new Error("section order unexpected");
const m3 = postFix.slice(0, i3) + postFix.slice(j3);
if (m3.includes("how-long-we-keep-it")) throw new Error("M3 still has the anchor");

fs.rmSync(OUT, { recursive: true, force: true });
for (const [name, src] of Object.entries({
  "m1-prefix": preFix,
  "m2-no-analytics-sentence": m2,
  "m3-section-6-deleted": m3,
})) {
  fs.mkdirSync(path.join(OUT, name), { recursive: true });
  fs.writeFileSync(path.join(OUT, name, "page.tsx"), src);
  fs.writeFileSync(path.join(OUT, name, "page.test.tsx"), testSrc);
}
```

with a throwaway config beside it:

```ts
// vitest.teeth.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["redesign/evidence/post-band-c-impl/item-2/teeth-check/*/page.test.tsx"],
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "..", "..", "..", "..", "..", "src") } },
});
```

```
npx vitest run --config redesign/evidence/post-band-c-impl/item-2/teeth-check/vitest.teeth.config.ts
```
