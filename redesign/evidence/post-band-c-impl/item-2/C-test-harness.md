# C — Test harness derivation: first render test for `src/app/(public)/`

Target: `src/app/(public)/privacy/page.tsx` (sync default-exported RSC).
Method: every claim below was checked against the actual repo files/commands
shown, not assumed. Where the repo itself supplies documented precedent
(comments explaining a convention), that precedent is quoted verbatim.

All commands were run from repo root:
`C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`.

---

## 1. `vitest.config.ts` — read in full

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

| Field | Value |
|---|---|
| `environment` | `"jsdom"` |
| `include` | `src/**/*.test.{ts,tsx}`, `scripts/**/*.test.{ts,tsx}` |
| `exclude` | `e2e/**`, `node_modules/**` |
| `setupFiles` | **absent** — the plan's claim is TRUE. There is no `setupFiles`/`globalSetup` key in this file at all (verified by grepping the file for both keys: 0 matches). |
| `"@/"` alias | `path.resolve(__dirname, "src")` — maps to the repo's `src/` directory |
| `globals` | `true` — `describe`/`it`/`expect`/`beforeEach`/`afterEach` are injected as globals (existing tests still `import` them explicitly from `"vitest"` anyway — see §3) |
| `testTimeout` | **not set** in this file. Verified the Vitest 4.1.5 built-in default by reading the installed package source: `node_modules/vitest/dist/chunks/coverage.DM_a_rWm.js:538` → `resolved.testTimeout ??= resolved.browser.enabled ? 15e3 : 5e3;`. Browser mode is not enabled here, so the effective default is **5000ms**. |

No `plugins` array is configured (no `@vitejs/plugin-react`) — JSX is handled by esbuild's built-in JSX transform, driven by `tsconfig.json`'s `"jsx": "react-jsx"` (verified: `tsconfig.json:18`).

---

## 2. Testing libraries actually installed

Checked both `package.json` and `node_modules` directly (not just the manifest, since manifest presence doesn't guarantee install).

```
devDependencies (package.json):
  "@testing-library/react": "^16.3.2"
  "@testing-library/user-event": "^14.6.1"
  "vitest": "^4.1.5"
  "jsdom": "^29.1.1"
  "react" (dependencies): "19.2.4"
  "react-dom" (dependencies): "19.2.4"
  "next" (dependencies): "16.2.4"

node_modules (installed versions, read from each package's own package.json):
  @testing-library/react      16.3.2
  @testing-library/user-event 14.6.1
  react                       19.2.4
  vitest                      4.1.5
  jsdom                       29.1.1

  @testing-library/jest-dom   NOT INSTALLED
    $ ls node_modules/@testing-library
    react
    user-event
    → "jest-dom" is absent from the directory listing.
    → also absent from package.json devDependencies (confirmed above).
```

**`@testing-library/jest-dom` is not present, and this is a deliberate, documented
repo convention**, not an oversight. `src/components/__tests__/GoogleAnalytics.test.tsx`
carries this comment verbatim:

```
// No @testing-library/jest-dom in this repo (see BookingRowActions.test.tsx
// / MobileStickyActionBar.test.tsx for the established convention) — assert
// via plain DOM properties/attributes, not `toBeEmptyDOMElement()`-style
// matchers.
```

and `src/features/booking/components/AboutYouStep.test.tsx` carries the same
convention independently:

```
// No @testing-library/jest-dom in this repo (see AddressAutocompleteField.test.tsx
// / BookingSummary.test.tsx) — assert via plain DOM properties, not
// `toBeInTheDocument()`-style matchers.
```

A repo-wide grep for the literal string `toBeInTheDocument` returns exactly
one hit, and it is inside that same explanatory comment (not a live matcher
call) — confirming no test anywhere actually depends on jest-dom matchers.

**Consequence for the proposed skeleton:** assertions must use plain Vitest/
Jest-style matchers (`toBeNull`, `not.toBeNull`, `toContain`, `toMatch`,
`toEqual`, `.textContent`, `.getAttribute()`), never `toBeInTheDocument()`,
`toHaveTextContent()`, `toBeEmptyDOMElement()`, etc.

---

## 3. Existing tests that render a component (verbatim idioms)

No test in the repo currently renders anything from `src/app/(public)/`, and
no test currently renders `SectionContainer` or `SectionHeading`:

```
$ rg -l --glob '*.test.tsx' "SectionContainer|SectionHeading" src   → no files found
$ rg --glob '*.test.tsx' "." "src/app/(public)"                     → no files found
```

So this genuinely is the first test in either category. Three existing tests
establish the idiom to follow:

### 3a. `src/components/layout/__tests__/SiteFooter.test.tsx` (renders a shared, server-component layout piece)

```tsx
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookieBanner } from "@/components/consent/CookieBanner";
import { resetConsentStoreForTests } from "@/components/consent/consent-store";
import { SiteFooter } from "../SiteFooter";
```
render idiom:
```tsx
render(<SiteFooter />);
const link = screen.getByRole("link", { name: "Cookie settings" });
expect(link.getAttribute("data-cookie-settings-trigger")).toBe("true");
```
This file uses `screen` (document-wide queries) and therefore explicitly
calls `afterEach(() => { cleanup(); })` — necessary because `screen` queries
`document.body`, which would otherwise accumulate nodes across `it()` blocks.

### 3b. `src/app/admin/dashboard/MobileStickyActionBar.test.tsx` (renders `next/link` transitively)

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MobileStickyActionBar } from "./MobileStickyActionBar";
import type { MobileStickyAction } from "./dashboard-helpers-b5";
```
render idiom:
```tsx
const { container } = render(<MobileStickyActionBar action={action} />);
expect(getByText("Assign 3 unassigned →")).toBeTruthy();
const link = container.querySelector("a");
expect(link?.getAttribute("href")).toBe("/admin/bookings?view=claimable");
```
This file queries the `container` returned by `render()` (scoped to that
render's own wrapper div), and — critically — has **no explicit cleanup call
at all**, across 8 separate `it()` blocks that each call `render()` again.
This works because `container`-scoped queries never see other tests' leaked
DOM nodes (they're scoped to the div `render()` itself created), unlike
`screen.*` queries which hit `document.body` globally. This file proves
`next/link` renders under this repo's plain `jsdom` environment with **no**
router-context provider, no mock of `next/navigation`, and no `setupFiles` —
it Just Works.

### 3c. Confirms no test renders a `page.tsx` default export today

```
$ rg --glob '*.test.tsx' "from ['\"]\.\./page['\"]|from ['\"]\./page['\"]" src
src\app\admin\bookings\__tests__\bookings-page-param.test.tsx:  import { buildClearSearchHref } from "../page";
src\app\admin\clients\__tests__\clients-page-param.test.tsx:    } from "../page";
src\app\admin\enquiries\__tests__\enquiries-page-param.test.tsx: import { buildEnquiryPageHref, buildEnquiryUrlParams } from "../page";
```
These three import **named helper functions** out of admin `page.tsx` files,
never the default-exported React component, and never call `render()` on it.
So beyond being the first `(public)` test, this is also the first test in the
repo to `render()` a `page.tsx` default export at all.

---

## 4. Transitive import chain of `privacy/page.tsx` — traced, then empirically executed

### Static trace

```
src/app/(public)/privacy/page.tsx
├─ import type { Metadata } from "next"                         [type-only → elided]
├─ import Link from "next/link"                                 [RUNTIME]
├─ import { SectionContainer, SectionHeading } from "@/components/shared"
│    └─ src/components/shared/index.ts (barrel — ALL 4 named exports are
│       evaluated at import time, not just the 2 the page uses):
│         ├─ export { ImagePlaceholder } from "./ImagePlaceholder"
│         │    └─ import type { HTMLAttributes } from "react"      [type-only]
│         │    └─ import { cn } from "@/lib/utils"                 [RUNTIME]
│         ├─ export { SectionContainer } from "./SectionContainer"
│         │    └─ import type { HTMLAttributes, ReactNode } from "react" [type-only]
│         │    └─ import { cn } from "@/lib/utils"                 [RUNTIME]
│         ├─ export { SectionHeading } from "./SectionHeading"
│         │    └─ import type { HTMLAttributes, ReactNode } from "react" [type-only]
│         │    └─ import { cn } from "@/lib/utils"                 [RUNTIME]
│         └─ export { StarsRating } from "./StarsRating"
│              └─ import { Star } from "lucide-react"              [RUNTIME, npm pkg]
│              └─ import { cn } from "@/lib/utils"                 [RUNTIME]
│                   └─ src/lib/utils/index.ts (barrel):
│                        ├─ export * from "./cn"     → clsx, tailwind-merge [RUNTIME, npm]
│                        └─ export * from "./format"  → no imports
├─ import { contactLinks } from "@/content/site/contact"
│    └─ import type { ActionLink, ContactLink } from "@/types/content" [type-only]
│         └─ src/types/content.ts:
│              import type { StaticImageData } from "next/image"    [type-only → elided]
└─ import { siteUrl } from "@/content/site/site-url"
     └─ no imports (pure constant module)
```

**Every `next/image` reference in this whole chain is `import type` only**
(`src/types/content.ts:1`), which TypeScript/esbuild strip entirely at
compile time — it never becomes a runtime `require`/`import` of the real
`next/image` module. The only runtime-executed external packages pulled in
are: `next/link`, `lucide-react`, `clsx`, `tailwind-merge` (plus React
itself via the automatic JSX runtime).

### `server-only`

```
$ rg 'from "server-only"|require\("server-only"\)' src   → no matches (whole src/, not just this chain)
$ rg 'server-only' src                                    → 1 hit, in a comment:
    src/app/admin/bookings/_helpers.ts:5:
    " * Shared booking predicates. Deliberately free of server-only imports so the"
```
No file in the transitive chain — and no file anywhere in `src/` — imports the
`server-only` npm package. The one hit is an unrelated prose comment.

### Empirical verification (not just static reading)

Static tracing can miss runtime-only behavior (e.g. a component that throws
only when actually rendered, or a hook that needs a real Next request
context). So the chain was **actually executed**: a throwaway Vitest config
+ spec were written to the one permitted evidence path, imported the real
`src/app/(public)/privacy/page.tsx` default export, rendered it under the
repo's real `jsdom` environment/alias config, queried the real rendered DOM,
and were deleted immediately after capturing the output (this file and its
sibling report are the only files left in this directory from this task).

```
$ pnpm vitest run --config redesign/evidence/post-band-c-impl/item-2/scratch.vitest.config.ts --reporter=verbose

 RUN  v4.1.5 ...
 ✓ scratch: privacy page render probe > dumps section 6 textContent and char codes 25ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

Zero console errors/warnings were emitted besides the test's own two
`console.log` lines (no React key warnings, no "next/link outside Link
context" warnings, nothing). This directly confirms: rendering
`PrivacyPolicyPage` under this repo's plain `jsdom` config, with no
`setupFiles` and no router mocking, produces a clean, complete render.

**Verdict: nothing in this import chain breaks under jsdom.**

---

## 5. `"server-only"` usage in the chain

Already answered in §4: zero uses anywhere in `src/`, in this chain or
outside it.

---

## 6. Asserting on "the text inside `#how-long-we-keep-it`"

### Does the section element carry the id in rendered DOM?

Yes — read directly from source, `src/app/(public)/privacy/page.tsx:165`:
```tsx
<section id="how-long-we-keep-it" className="flex flex-col gap-3">
```
`id` is a plain DOM attribute passed straight through by React; it is present
on the rendered `<section>` unconditionally. Confirmed empirically too: the
scratch probe's `container.querySelector("#how-long-we-keep-it")` found the
node and returned real text (not `null`).

### What container query works

`container.querySelector("#how-long-we-keep-it")` (or `#how-long-we-keep-it p`
to reach only the paragraph, skipping the `<h3>` heading prefix) — both work
against the `container` returned by `@testing-library/react`'s `render()`,
following the `container`-scoped idiom from §3b (no `screen`, no cleanup
needed since each `it()` renders fresh and queries only its own container).

### Exact rendered `textContent`, character-for-character (current source)

Captured directly from the actual render (not reconstructed):

```
6. How long we keep itOur policy is to keep booking and treatment records for 7 years after your last visit with us. If you make an enquiry that doesn't turn into a booking, we keep it for around 12 months. Analytics information, where you've given consent for it, is kept according to Google's own retention settings.
```

Two things a naive assertion would trip on, both confirmed by dumping char
codes (`Array.from(text).map(c => c.charCodeAt(0))`):

1. **No space between the heading and the paragraph.** `section.textContent`
   concatenates the `<h3>` text and the `<p>` text with nothing in between —
   `"...keep it" + "Our policy..."` → literally `keep itOur policy` — because
   the `<h3>` and `<p>` are separate JSX element siblings with no whitespace
   text node between them at the JSX level. A test that does
   `container.querySelector("#how-long-we-keep-it")?.textContent` and expects
   a space or newline after "it" will fail. (Querying `#how-long-we-keep-it p`
   instead, to isolate just the paragraph, sidesteps this entirely.)

2. **Apostrophes are U+0027 (`'`), not U+2019 (`'`).** The source uses
   `&apos;` (`doesn&apos;t`, `you&apos;ve`, `Google&apos;s`). Char-code dump
   confirms every one of these decoded to code point **39** (`0x27`,
   `APOSTROPHE`), not 8217 (`0x2019`, `RIGHT SINGLE QUOTATION MARK`). This
   matches the HTML5 named-character-reference table (`apos;` → U+0027 is
   the one common entity that maps to a plain ASCII character rather than a
   typographic glyph), and JSX text-node entity decoding follows that same
   table regardless of whether the transform is Babel, TypeScript, or (as
   here) esbuild — confirmed empirically rather than assumed. A hard-coded
   `'` in the test source will match; a curly `'` will not.

3. **Multi-line JSX text collapses correctly.** The source line-break +
   indentation between `given` and `consent` in the JSX
   (`"...where you&apos;ve given\n              consent for it..."`)
   collapsed to a single ASCII space in the render, matching ordinary JSX
   whitespace-collapse rules — no double-space, no literal newline survived.

So a literal (non-regex) `toContain()` assertion for the analytics sentence
must be written using straight `'` apostrophes and single spaces, exactly as
captured above — which is what §7's skeleton does.

---

## 7. Precedent for a "source-text anti-drift guard" test

`src/content/site/__tests__/canonical-domain.test.ts` exists and matches the
plan's description. Verbatim idiom:

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { contactLinks } from "@/content/site/contact";

const BRAND = "rahmatherapy";
const WRONG_DOMAINS = [`${BRAND}.co.uk`, `${BRAND}.com`];
const LIVE_ORIGIN = `https://${BRAND}.uk`;
const SITE_URL_MODULE = "src/content/site/site-url.ts";
```
and its core assertion idiom:
```ts
it("keeps wrong-domain literals out of src/", () => {
  expect(files.length).toBeGreaterThan(100);
  for (const domain of WRONG_DOMAINS) {
    const offenders = files.filter((file) => file.contents.includes(domain));
    expect(offenders.map((file) => file.path), `stale domain "${domain}"`).toEqual([]);
  }
});
```
This is a *filesystem-scanning* anti-drift guard (walks `src/`, greps every
file's raw contents), not a *rendered-output* anti-drift guard. It is a
useful sibling pattern (assemble needles at runtime so the spec file itself
isn't a false-positive match; assert `.toEqual([])` for "no offenders" rather
than a boolean) but it does not render anything and is not itself the
render-based test being proposed here — the privacy-page test would be a new
kind of guard, not a copy of this one.

---

## Proposed skeleton — `src/app/(public)/privacy/page.test.tsx`

**Not written to `src/` — text only, per read-only instructions.**

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import PrivacyPolicyPage from "./page";

// No @testing-library/jest-dom in this repo (see BookingRowActions.test.tsx /
// MobileStickyActionBar.test.tsx for the established convention) — assert via
// plain DOM properties/attributes, not `toBeInTheDocument()`-style matchers.
//
// Each `it()` renders fresh and queries only its own `container` (not
// `screen`), so no explicit cleanup is needed — same idiom as
// MobileStickyActionBar.test.tsx.

describe("PrivacyPolicyPage — section 6 (How long we keep it)", () => {
  it("keeps the how-long-we-keep-it anchor", () => {
    const { container } = render(<PrivacyPolicyPage />);
    expect(container.querySelector("#how-long-we-keep-it")).not.toBeNull();
  });

  it("keeps section headings numbered contiguously with no gap", () => {
    const { container } = render(<PrivacyPolicyPage />);
    const numbers = Array.from(container.querySelectorAll("section[id] > h3"))
      .map((h) => Number(h.textContent?.match(/^(\d+)\./)?.[1]));
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1));
  });

  it("describes retention by criteria, not a fixed date", () => {
    const { container } = render(<PrivacyPolicyPage />);
    const text = container.querySelector("#how-long-we-keep-it")?.textContent ?? "";
    expect(text).toContain("for 7 years after your last visit with us");
  });

  it("does not promise a specific retention duration in section 6", () => {
    const { container } = render(<PrivacyPolicyPage />);
    const text = container.querySelector("#how-long-we-keep-it")?.textContent ?? "";
    // No absolute calendar date ("DD Month YYYY") anywhere in the retention
    // section — every period is expressed relative to an event (last visit /
    // enquiry / consent), never a fixed deletion date.
    expect(text).not.toMatch(
      /\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/
    );
  });

  it("keeps the analytics retention sentence in section 6", () => {
    const { container } = render(<PrivacyPolicyPage />);
    const text = container.querySelector("#how-long-we-keep-it")?.textContent ?? "";
    // Straight apostrophes (U+0027): JSX decodes the source's `&apos;` to
    // U+0027, not the U+2019 curly quote (verified via char-code dump, §6).
    expect(text).toContain(
      "Analytics information, where you've given consent for it, is kept according to Google's own retention settings."
    );
  });
});
```

## Import-chain risks — summary

| Risk | Verdict |
|---|---|
| `next/image` runtime import anywhere in chain | **None** — only reference is `import type ... from "next/image"` in `src/types/content.ts`, elided at compile time |
| `next/headers` / other request-context APIs | **None found** anywhere in the chain |
| `server-only` package | **None found** anywhere in `src/` |
| `next/link` under jsdom with no router mock | **Confirmed safe** — precedented by `MobileStickyActionBar.test.tsx` and empirically re-confirmed by rendering the real page |
| Barrel import cost (`@/components/shared` pulls in `ImagePlaceholder` + `StarsRating` too, not just the 2 used) | Low — `StarsRating` pulls in `lucide-react` (pure SVG components), no jsdom-unsafe API used |
| `@testing-library/jest-dom` matchers | **Not installed** — must not be used; plain DOM assertions only (repo-documented convention, §2) |

## Blockers

None found. No file needed to complete this derivation was missing, and the
empirical render probe passed cleanly on the first attempt.
