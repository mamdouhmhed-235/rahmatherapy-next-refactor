# C-18 Phase A — FINAL RE-VERIFICATION (commit `93a3185` only)

VERDICT: PASS

**Repo `master` @ `93a3185`. Read-only verifier. No writes made anywhere except this file.
Git limited to `log`/`diff`/`show`/`status`. No server started/stopped; curled the Owner's
warm dev server at `localhost:3000` only (`localhost`, never `127.0.0.1`).
`src/lib/maintenance.ts` was not touched by this pass or by the commit under review.**

Scope: `93a3185` rewrites exactly two sentences (both inside the single `description` prop
on one JSX line) in `src/app/(public)/cookies/page.tsx:33`. This closes defect 12
(documented in `redesign/evidence/C-18/phase-a-delta-reverify.md`): the fix for defect 11
narrowed the intro to "our own code sets," which directly contradicted the registry's own
`Set by: Google (Google Analytics 4)` / `Set by: Sentry (Functional Software, Inc.)` labels
for two of the five entries.

---

## CHECK 1 — intro and registry read together, on the rendered page

Fetched `http://localhost:3000/cookies` once (`curl -s -L`, single request, 200 after the
canonical `/cookies` → `/cookies/` redirect that any visitor's browser follows transparently).
Parsed the one saved response for both the intro paragraph and the five registry entries, in
document order, as a visitor would encounter them.

Live-rendered intro (verbatim, byte-checked against the dispatch's quoted text):

> "This page lists every cookie and browser-storage item our own code sets on
> rahmatherapy.uk, or that a service we use (such as Google Analytics or Sentry) sets on
> our behalf, when you visit as a member of the public or use our booking system — what it
> does and how long it lasts. We keep this list in one place so it stays consistent
> wherever it's shown."

Matches exactly, including the apostrophe in "it's" and the em dash. Confirmed both in the
initial-HTML payload and independently in the RSC flight-data payload embedded further down
the same response (Next.js serializes the tree twice; both copies are identical — not two
different pieces of content).

**1. Does every registry entry fall into one of the two named categories?**
Live-rendered `Set by:` values, read in document order:

| Entry | `Set by:` (rendered) | Category |
|---|---|---|
| `zam-therapy-booking-draft-v3` | Rahma Therapy | our own code |
| `maintenance-modal-seen` | Rahma Therapy | our own code |
| `rahma-booking-contact-v1` | Rahma Therapy | our own code |
| `_ga / _ga_*` | Google (Google Analytics 4) | service on our behalf |
| `sentryReplaySession` | Sentry (Functional Software, Inc.) | service on our behalf |

All five fall cleanly into one of the two named categories. No entry is neither. TRUE — no
contradiction, which is the exact defect-12 mechanism this check exists to catch.

**2. Do the two named providers match `Set by:` exactly?**
Intro names "Google Analytics" and "Sentry" as examples (`"such as Google Analytics or
Sentry"`). Rendered `Set by:` values are "Google (Google Analytics 4)" and "Sentry
(Functional Software, Inc.)" — same two companies, fuller legal/product naming in the
registry, no mismatch in *which* companies. TRUE.

**3. Does the intro now imply coverage of anything unobserved (Cloudflare-platform cookies,
OpenNext build-pipeline storage)?**
Both are still recorded as unresolved in `cookie-inventory-source.md` §6 items 5–6 and
`cookie-inventory-browser.md` §4. The new intro is bounded to two categories only: "our own
code sets" and "a service we use ... sets on our behalf." Neither Cloudflare's edge platform
nor the OpenNext build pipeline is "our own code," and neither is described anywhere on the
page as "a service we use" in the sense the registry entries use that phrase (a
visitor-facing feature we've added, not infrastructure we're deployed on). Nothing in the
rendered page names Cloudflare or OpenNext. No implied coverage. TRUE.

**4. Is "so it stays consistent wherever it's shown" true, and does it avoid claiming
anything about total browser behaviour?**
Read `src/lib/consent/cookie-registry.ts:11-15`:
> "This file drives THREE surfaces from one array: the /cookies notice page ..., and — in
> later phases — the preferences panel's toggle list and per-cookie table. No surface may
> hold its own hand-maintained copy of this list; add an entry here and every consumer
> updates itself."

Verified against actual code, not just the comment: `src/app/(public)/cookies/page.tsx:78`
renders `<CookieRegistryGroups />`, and `src/app/(public)/cookies/CookieRegistryGroups.tsx:69`
calls `groupRegistryByPurpose()` (imported from `cookie-registry.ts`) with no separately
maintained list anywhere in either file — confirmed by reading both files in full. Today
there is exactly one live consumer of the registry (the /cookies page itself); the
"preferences panel" surfaces are explicitly future ("in later phases"). The sentence's claim
is about the *sourcing mechanism* (single array, no surface may hold its own copy), which is
true today and architecturally enforced for whichever surfaces exist now or later — it is
not a claim that multiple surfaces currently exist. Separately, the sentence no longer makes
any assertion about what the visitor's browser actually receives (the prior wording's "...
so it always matches what your browser actually receives" — the clause that directly
collided with the unresolved Cloudflare/build-pipeline gaps in the delta-reverify FAIL — is
gone; confirmed absent by grep against the live-rendered response, 0 occurrences). TRUE.

**5. Is "every" still doing work it cannot support?**
"Every" is now bounded by two named categories rather than by unqualified totality. Per row 1
above, all five registry entries fit one of the two categories with no residual, and per row
3, the intro doesn't reach for anything outside those two categories (no claim about
Cloudflare/OpenNext). A visitor reading the intro then scanning the registry sees the same
two-category framing corroborated by every `Set by:` field, not contradicted by any of them.
Not misleading. TRUE.

---

## CHECK 2 — commit scope

`git show 93a3185 --stat`:
```
 src/app/(public)/cookies/page.tsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```
One file, one line (both rewritten sentences live inside a single JSX `description="..."`
prop on one source line, hence 1/1 not 2/2). Full diff reviewed directly (`git show 93a3185`)
— confirms this is purely a string-literal change to the `description` prop; no other prop,
import, or line touched.

`git diff --stat 93a3185~1 93a3185 -- src/lib/consent` → empty output (untouched).
`git diff --stat 93a3185~1 93a3185 -- "src/app/(public)/cookies/CookieRegistryGroups.tsx"` →
empty output (untouched).

No registry entry, classification, `provisionalNote`, badge, heading, or the PHASE D
OBLIGATION comment (`cookie-registry.ts:195-218`, confirmed still present and unmodified via
the empty diff above) was touched by this commit. TRUE, no issues.

---

## CHECK 3 — did this fix introduce a thirteenth?

Re-fetched the page fresh (`curl -s -L http://localhost:3000/cookies`, second independent
request) and read the stripped visible text of the full intro section plus the "How we'll
record your consent" / "How you'll change your choices" cards plus the entire Essential
group and the start of the Functional/Analytics groups, in one continuous pass, with fresh
eyes.

Findings:
- Tense is internally consistent throughout: "There's no cookie banner on this site yet, so
  no consent choice is being recorded today" (present) → "Once one ships... will create...
  We'll keep..." (future, correctly hedged) → "There's no live control for this yet...
  non-essential items currently run automatically, without asking, as explained above" — and
  "as explained above" genuinely does match what the Functional/Analytics group descriptions
  say ("stored automatically today... don't yet wait for you to say yes").
- No leftover trace of any prior wording anywhere in the response: grepped the full rendered
  HTML for `"always matches what your browser"` and `"rahmatherapy.uk uses"` (both prior
  intro phrasings from earlier fix rounds) — 0 occurrences of either.
- The "Under review" note on `rahma-booking-contact-v1` (a purpose-classification caveat) and
  the new intro's who-sets-it framing are orthogonal claims — the intro says nothing about
  purpose classification, so there's no new interaction to go wrong there.
- No entry's `Set by:` value, badge text, or duration was altered by this commit (confirmed
  in Check 2), so nothing downstream of the intro changed to create a new mismatch.

Nothing new is over-claimed, contradictory, or wrong. Stated with confidence: no thirteenth
defect found in this pass.

---

## CHECK 4 — gates

- **`npx tsc --noEmit`** → 0 errors (no output).
- **`npx vitest run`** (full suite) → tail:
  ```
  Test Files  2 failed | 191 passed (193)
       Tests  5 failed | 1845 passed (1850)
  ```
  Failures by identity: `src/lib/auth/admin-access.test.ts` ×2 + `src/app/admin/bookings/new/
  ManualBookingForm.test.tsx` ×3 — exactly the inherited baseline identity, no new or swapped
  failures. `src/lib/consent` suite run in isolation: **1 file, 18/18 passed**, matching the
  inherited "consent suite is 18 tests" baseline.
- **`npx eslint .`** → `66 problems (59 errors, 7 warnings)`. Files with problems, confirmed
  by grepping the full output for file paths:
  `design_handoff_area_pages/prototype/area-page.jsx`,
  `design_handoff_area_pages/prototype/shared.jsx`,
  `design_handoff_area_pages/prototype/site-chrome.jsx`,
  `src/features/booking/BookingExperience.tsx`,
  `src/features/booking/BookingExperienceLoader.tsx`,
  `src/features/booking/utils/returning-customer.ts` — exactly the six baseline files. None
  of the C-18 files (`page.tsx`, `CookieRegistryGroups.tsx`, `cookie-registry.ts`) appear.

All gates match the inherited baseline by identity. No regressions from `93a3185`.

---

## Summary

Defect 12 is correctly fixed. The new intro explicitly names both categories that the
registry's `Set by:` field actually uses ("our own code" / "a service we use ... on our
behalf"), and all five live-rendered registry entries corroborate rather than contradict it.
The previously over-claiming second sentence ("...so it always matches what your browser
actually receives," the clause that collided with the unresolved Cloudflare/build-pipeline
gaps) has been replaced with an architecturally-grounded, verified-true claim about
single-sourcing that makes no assertion about total browser behaviour. The commit is scoped
to exactly the two sentences it should be, on exactly one file, with the registry, its
classifications, badges, and the PHASE D OBLIGATION comment all untouched. A fresh read of
the full rendered intro and first registry group surfaced no new defect. All four gates
(`tsc`, `vitest`, `eslint`, and the live `curl` render) match the inherited baseline by
identity.

**Freeze cleared.** C-18 Phase A closes; the plan may proceed to Phase B.
