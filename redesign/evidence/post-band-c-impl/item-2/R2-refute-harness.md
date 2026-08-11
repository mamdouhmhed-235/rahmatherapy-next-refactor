# R2 — Adversarial refutation of the test-harness derivation report

Scope: the JSON derivation report about the vitest harness and the proposed
`src/app/(public)/privacy/page.test.tsx` skeleton. Read-only against `src/`;
all commands below were re-run by me, not trusted from the report. Working
evidence (scratch test files, a simulated post-fix page copy, and raw run
logs) lives in `redesign/evidence/post-band-c-impl/item-2/R2-scratch/`, the
only place I wrote to. `src/`, `scripts/`, `e2e/`, `supabase/` untouched; no
git state changed.

## Verdict summary

The report's factual claims about the harness (versions, config, import
chain, rendered text, character codes) all **CONFIRM**. The proposed test
file **is runnable as-is** and **all 5 assertions pass against the current,
unfixed source** — which is exactly the "no teeth" failure mode I was asked
to hunt for. Worse than "no teeth": one case, (c), is actively **wired
backwards** — it hard-codes the old "7 years" wording that Item 2's own
recommended fix (`D-wording-candidates.md`, Candidate 2) deletes, so it will
need to be rewritten, not merely left to "keep passing," once the real copy
change lands. I built a simulated post-fix copy of the page and proved this
empirically: 4/5 cases still pass, but (c) fails.

## 1. Library / version claims

```
$ cat node_modules/react/package.json | grep version        → 19.2.4
$ cat node_modules/react-dom/package.json | grep version     → 19.2.4
$ cat node_modules/@testing-library/react/package.json | grep -A5 peerDependencies
  react: "^18.0.0 || ^19.0.0", react-dom: "^18.0.0 || ^19.0.0"  → version 16.3.2
$ cat node_modules/vitest/package.json | grep version        → 4.1.5
$ cat node_modules/jsdom/package.json | grep version         → 29.1.1
```

**CONFIRM.** React 19.2.4 satisfies @testing-library/react 16.3.2's peer
range. package.json devDependencies match node_modules exactly.

```
$ ls node_modules/@testing-library/    → react  user-event   (no jest-dom)
```

**CONFIRM.** `@testing-library/jest-dom` is not installed. Grepped the whole
`src` tree for the literal string `toBeInTheDocument`: exactly one hit,
`src/features/booking/components/AboutYouStep.test.tsx:22`, and reading it in
context (lines 19–23) shows it is inside a `//` comment describing the
convention, not live code. **CONFIRM — zero live jest-dom matcher usage.**
Consequence for the proposal: it uses only `toBeNull`, `toEqual`, `toContain`,
`not.toMatch` — all plain Vitest/expect matchers, none from jest-dom. No
substitution is needed; the proposal already avoids the unavailable matchers.

## 2. vitest.config.ts

Read directly:

```ts
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

**CONFIRM** on every point: no `setupFiles`/`globalSetup` key (grepped the
whole repo for `setupFiles|globalSetup` across `*.{ts,tsx,js,json}` — zero
hits anywhere, not just in this file), no `plugins` array, alias matches
tsconfig's `"@/*": ["./src/*"]`.

`testTimeout` default: grepped `node_modules/vitest/dist/chunks/coverage.DM_a_rWm.js`
directly — line 538 reads verbatim `resolved.testTimeout ??= resolved.browser.enabled
? 15e3 : 5e3;`. Browser mode is not configured (no `test.browser` key), so the
default is 5000ms. **CONFIRM, exact line match.**

## 3. Import-chain trace of `src/app/(public)/privacy/page.tsx`

Read every file in the chain directly rather than trusting the summary:

- `page.tsx` → `next/link` (default import, used as `<Link>`), `@/components/shared`
  (barrel), `@/content/site/contact`, `@/content/site/site-url`, `type Metadata`
  from `next` (type-only).
- `@/components/shared/index.ts` unconditionally re-exports all four files:
  `ImagePlaceholder`, `SectionContainer`, `StarsRating`, `SectionHeading` — so
  importing only `{ SectionContainer, SectionHeading }` still evaluates
  `ImagePlaceholder.tsx` and `StarsRating.tsx`. **CONFIRM the barrel-cost claim.**
- `ImagePlaceholder.tsx` → `@/lib/utils` (for `cn`) only.
- `StarsRating.tsx` → `lucide-react` (`Star`, a pure SVG component,
  `node_modules/lucide-react` version 1.8.0 confirmed present) + `@/lib/utils`.
- `SectionContainer.tsx`, `SectionHeading.tsx` → `@/lib/utils` only.
- `@/lib/utils` is `src/lib/utils/index.ts` → `export * from "./cn"` (clsx +
  tailwind-merge) and `export * from "./format"` (pure `Intl.NumberFormat` /
  string helpers). No I/O, no Next APIs.
- `@/content/site/contact.ts` → `@/types/content` (type-only) + plain object
  literals.
- `@/content/site/site-url.ts` → pure constant + `new URL(...)`. No env reads.
- `@/types/content.ts` → `import type { StaticImageData } from "next/image"` —
  type-only, elided by esbuild/TS at compile time, never a runtime import.

Grepped the whole `src` tree for the three risky imports:

```
$ rg "from ['\"]server-only['\"]|from ['\"]next/headers['\"]|from ['\"]next/font" src -l
src/app/admin/password-reset/actions.ts
src/app/layout.tsx
src/app/admin/password-reset/page.tsx
src/lib/supabase/server.ts
```

None of these four files is anywhere in the privacy page's transitive chain
traced above. `src/app/layout.tsx` in particular is the root layout — Next's
App Router wires layouts in by file-system convention at build/route time,
not as a JS import of the page module, so rendering `<PrivacyPolicyPage />`
directly with RTL never touches it (confirmed empirically below: zero
console errors on render). **CONFIRM — next/font, next/headers, and
server-only are all absent from the actual chain that RTL will execute.**

`next/link` under jsdom: rendered the real page (see §5) and it produced no
errors — `<Link href="/cookies/">` resolved to a plain `<a>`, matching the
cited precedent. **CONFIRM.**

## 4. Runnability — empirical, not inferred

I cannot write into `src/`, so I could not place the file at the exact
proposed path. Instead I wrote the **exact proposed skeleton**, changing only
the import from the relative `"./page"` to the alias `"@/app/(public)/privacy/page"`
(alias resolution is root-relative, not import-location-relative — this
changes nothing about what code runs), into
`redesign/evidence/post-band-c-impl/item-2/R2-scratch/privacy-page.test.tsx`,
and ran it through a scratch vitest config that reproduces the real
`vitest.config.ts` verbatim (same `environment: "jsdom"`, `globals: true`,
same alias target), differing only in `include` (pointed at the scratch
file instead of `src/**`) because that's the only way to run a file outside
`src/` without writing there:

```
$ npx vitest run --config redesign/evidence/post-band-c-impl/item-2/R2-scratch/vitest.evidence.config.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

**Runnable: yes.** Had I been allowed to write the file at the actual
proposed path (`src/app/(public)/privacy/page.test.tsx`), it would be picked
up automatically by the existing `include: ["src/**/*.test.{ts,tsx}", ...]`
with zero additional config — my scratch config is not doing anything the
real config wouldn't already do.

No console errors or warnings were emitted during the render (checked full
output, not just the summary) — no React `act()` warnings, no missing-module
errors, no Next-API-not-available errors.

## 5. Teeth-check — the important part

**All 5 proposed assertions PASS on the current, unfixed source** (run
above: 5/5 green, source still reads "7 years" / "around 12 months"). Per
case:

- **(a) "keeps the how-long-we-keep-it anchor"** — passes on current source.
  Structural smoke test only (section id exists). It is *supposed* to pass
  before and after any copy edit — it isn't testing wording at all, so "no
  teeth for the wording change" is by design here, not a defect.
- **(b) "keeps section headings numbered contiguously with no gap"** —
  passes on current source. Same story: guards heading numbering (1–9, no
  gaps), completely orthogonal to what section 6's paragraph says. By
  design, not a defect.
- **(c) "describes retention by criteria, not a fixed date"** — passes on
  current source, but **this is the one that should worry the implementer**.
  Its name promises a criteria-based, non-fixed-duration description, but
  its actual assertion is `toContain("for 7 years after your last visit
  with us")` — that is the literal fixed-duration sentence Item 2 exists to
  remove. I built a scratch copy of the page
  (`R2-scratch/page-postfix.tsx`) with Item 2's own recommended wording
  applied verbatim (Candidate 2 from `D-wording-candidates.md`: "We don't
  keep your records for a fixed number of years. Instead, we hold on to
  booking, treatment and enquiry records for as long as they're needed...")
  and reran the same 5 assertions against it
  (`R2-scratch/privacy-page-postfix.test.tsx`):

  ```
  ✓ (a) keeps the how-long-we-keep-it anchor
  ✓ (b) keeps section headings numbered contiguously with no gap
  × (c) describes retention by criteria, not a fixed date
    → expected '...We don't keep…' to contain 'for 7 years after your last visit wit…'
  ✓ (d) does not promise a specific retention duration in section 6
  ✓ (e) keeps the analytics retention sentence in section 6
  ```

  **(c) fails once the actual intended fix is applied.** So as delivered,
  (c) provides **zero forward guard** for the rewrite it's supposedly
  guarding — it currently passes only because it's still pinned to the text
  scheduled for deletion, and it will need to be *rewritten* (new expected
  string), not just "left to keep passing," on the same commit that changes
  the copy. If someone lands the copy change without touching this test, CI
  will correctly go red — but for the accidental reason that the test still
  expects deleted text, not because it was designed to detect the class of
  regression ("did we reintroduce a fixed duration?") its name claims to
  check.

  If I was handed a hint that "(c) legitimately passes before and after" —
  **I refute that specific claim empirically**: (c) passes before, fails
  after, confirmed by the run above.

- **(d) "does not promise a specific retention duration in section 6"** —
  passes on current source *and* on the simulated post-fix source. This one
  is legitimately teeth-neutral by design: it checks for an absolute
  calendar-date pattern (`DD Month YYYY`), which the current text never had
  either (its "7 years"/"12 months" are durations, not dates) and the new
  text doesn't introduce one. It guards a general style rule ("never state
  an absolute deletion date"), not the specific wording being swapped.
  Confirmed accurate as a before/after-stable guard.
- **(e) "keeps the analytics retention sentence in section 6"** — passes on
  current source *and* on the simulated post-fix source, because the
  analytics sentence is the byte-for-byte sentence every wording candidate
  in `D-wording-candidates.md` keeps verbatim (confirmed by reading that
  file, §0 and §2). Legitimately guards an unrelated, intentionally-frozen
  sentence — correct that it's stable both ways, but it says nothing about
  the retention-duration rewrite either.

**Net: only (c) is sensitive to the rewrite at all, and it is wired
backwards** — pinned to the old text, not the new. Whoever executes Item 2
must replace assertion (c)'s expected string with the actual new wording (or
drop the "fixed date" framing and assert something like `not.toContain("7
years")` plus a positive match on the real replacement sentence) as part of
the same change, not treat this test file as already-adequate coverage for
the rewrite.

## 6. Character-level claims

Dumped `container.querySelector("#how-long-we-keep-it").textContent`
directly rather than trusting the report's transcription
(`R2-scratch/char-check.test.tsx`, forced-fail to surface the diff,
`R2-scratch/out2.log`):

```
EXACT_TEXT_JSON:"6. How long we keep itOur policy is to keep booking and
treatment records for 7 years after your last visit with us. If you make an
enquiry that doesn't turn into a booking, we keep it for around 12 months.
Analytics information, where you've given consent for it, is kept according
to Google's own retention settings."

BOUNDARY:"ep it|Our p"
APOS_doesnt_charCode:39   char='
APOS_youve_charCode:39    char='
APOS_googles_charCode:39  char='
```

**CONFIRM, exact match to the report on every point:**
1. Zero separator between the `<h3>` and `<p>` text nodes — `"...keep
   it"` is immediately followed by `"Our policy..."` (BOUNDARY dump proves
   it: `"ep it|Our p"`, no space/newline). A query against
   `#how-long-we-keep-it` (the whole section) would indeed trip on this if
   someone tried to assert a space there; the proposal correctly avoids it
   by scoping to `#how-long-we-keep-it p` for the retention-text assertions.
2. All three apostrophes (`doesn't`, `you've`, `Google's`) decode to
   character code **39** (U+0027, plain ASCII apostrophe), not U+2019. The
   proposal's literal `toContain(...)` strings use straight `'` — they match.
3. The JSX line-break between `given` and `consent` (source lines 170–171)
   collapses to exactly one space in the rendered text — confirmed by the
   `EXACT_TEXT_JSON` dump showing `"...given consent for it..."` with a
   single space, no double space, no literal newline.

The proposed assertion (e)'s literal string —
`"Analytics information, where you've given consent for it, is kept
according to Google's own retention settings."` — was diffed character-for-
character against the dump above: **identical.**

## 7. Minor, non-blocking inaccuracy in the report itself

The report's `renderIdiom` field quotes what it presents as a single literal
line from `src/app/admin/dashboard/MobileStickyActionBar.test.tsx`:

> `const { container, getByText } = render(<MobileStickyActionBar
> action={action} />); expect(getByText("Assign 3 unassigned →")).toBeTruthy();
> const link = container.querySelector("a"); expect(link?.getAttribute("href")).toBe("/admin/bookings?view=claimable");`

I read the actual file. This is a **splice of two different `it()` blocks**,
not a verbatim quote: the label `"Assign 3 unassigned →"` appears in the
*"primary-only action renders one link"* test, paired there with
`href: "/admin/bookings?view=unassigned"` (not `claimable`); the href
`"/admin/bookings?view=claimable"` appears in a separate test, *"internal
items render via next/link"*, paired with a different label (`"Browse
claimable →"`). No such combined line exists in the file. The underlying
substance of the claim — container-scoped queries, no `cleanup()` call
across the file's 8 `it()` blocks, `describe`/`expect`/`it` imported
explicitly from `"vitest"` despite `globals: true` — **is accurate** (I
counted 8 `it()` blocks and confirmed no `afterEach`/`cleanup` anywhere in
the file), so this doesn't affect the proposal's validity, but the quote as
given is a reconstruction, not something you could `grep` for verbatim.

The `SiteFooter.test.tsx` quote, by contrast, **is accurate** — I diffed it
against the file directly (lines 32–35 for the first quoted block, lines
26–28 for `afterEach(() => { cleanup(); });`, whitespace-collapsed but
otherwise exact).

## Files touched (all inside the permitted evidence path)

- `redesign/evidence/post-band-c-impl/item-2/R2-refute-harness.md` (this file)
- `redesign/evidence/post-band-c-impl/item-2/R2-scratch/privacy-page.test.tsx`
  — the proposed skeleton, import adjusted to alias form, run against current source
- `redesign/evidence/post-band-c-impl/item-2/R2-scratch/page-postfix.tsx`
  — scratch copy of the real page with Candidate 2 wording applied, for the teeth-check only
- `redesign/evidence/post-band-c-impl/item-2/R2-scratch/privacy-page-postfix.test.tsx`
  — same 5 assertions run against the postfix copy
- `redesign/evidence/post-band-c-impl/item-2/R2-scratch/char-check.test.tsx`
  — char-code/whitespace diagnostic
- `redesign/evidence/post-band-c-impl/item-2/R2-scratch/vitest.evidence.config.ts`
  — scratch vitest config reproducing the real one, `include` repointed since I cannot write into `src/`
- `redesign/evidence/post-band-c-impl/item-2/R2-scratch/out2.log`, `out3.log`
  — raw run output

No file under `src/`, `scripts/`, `e2e/`, or `supabase/` was modified. No git
state was changed.
