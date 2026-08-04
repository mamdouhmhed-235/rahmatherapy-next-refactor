# C-18 Phase A — DELTA RE-VERIFICATION (commit `d7ee2bb` only)

VERDICT: FAIL

**Repo `master` @ `d7ee2bb`. Scope: this is a delta pass over the two fixes landed in `d7ee2bb`
only, per the orchestrator's explicit scoping decision — it does not re-derive the whole page.
Verifier role: read-only. No writes made anywhere except this file. Git limited to
`log`/`diff`/`show`/`status`. No server started/stopped; curled the Owner's warm dev server at
`localhost:3000` only. `src/lib/maintenance.ts` was not touched.**

Defect 10 (the heading) is confirmed fixed. Defect 11 (the scope claim) is **not** correctly
fixed: the reworded intro sentence is directly contradicted by content rendered on the same page,
and the adjacent, untouched sentence still over-claims relative to the new narrower scope — which
is exactly the interaction the dispatch flagged as the reason a delta check exists. That is enough
on its own to hold the freeze; everything else checked below is clean.

---

## CHECK 1 — the two fixes in `d7ee2bb`

### Defect 10 — the heading — CONFIRMED FIXED

`src/app/(public)/cookies/page.tsx:55` now reads `How you&apos;ll change your choices`. Verified:

- Live render (`curl -s -L http://localhost:3000/cookies`): `How you'll change your choices`
  present; the old string `Change your choices</h2>` is absent (grep exit 1).
- Matches its own card: body directly below (`page.tsx:58-63`) is "There's no live control for
  this yet... Once our cookie preferences panel ships, you'll be able to change your choices..."
  and the button (`page.tsx:70`) reads "Not available yet" — heading, body, and button are now all
  consistently future-tense/no-current-control.
- Mirrors the sibling card's pattern exactly: `page.tsx:41` "How we'll record your consent" —
  same "How [subject] + future-tense verb" construction, confirmed live at
  `curl http://localhost:3000/cookies | grep "How we.ll record your consent"`.

TRUE, no issues.

### Defect 11 — the scope claim — NOT CORRECTLY FIXED

`page.tsx:33` changed from `"...every cookie and browser-storage item rahmatherapy.uk uses..."`
to `"...every cookie and browser-storage item our own code sets on rahmatherapy.uk..."`. Confirmed
live: `curl http://localhost:3000/cookies` renders exactly `our own code sets on rahmatherapy.uk`;
the old `browser-storage item rahmatherapy.uk uses` string is absent (grep exit 1).

**What the narrowing gets right:** it does genuinely and correctly exclude the two categories both
evidence files leave unresolved — Cloudflare-platform cookies (`cookie-inventory-source.md`
§6 item 5; `cookie-inventory-browser.md` §4, "Cloudflare platform cookies... set by the production
edge, not by the local dev server") and OpenNext-Cloudflare build-pipeline storage (`source.md`
§6 item 6; `browser.md` §4, "build-pipeline half needs a check against a real Cloudflare deploy...
this pass had no access to"). Neither is "our own code," so a literal reading of the new sentence
no longer implicitly claims coverage of those unknowns. This part of the fix works as intended.

**What it breaks — a new, directly-visible contradiction on the same page.** The registry the
intro sentence introduces, rendered immediately below it via `CookieRegistryGroups.tsx`, displays
a `Set by:` field per entry (`CookieRegistryGroups.tsx:41-42`, `entry.provider`). Live-rendered
values, confirmed by `curl`:

```
Set by: Rahma Therapy       (zam-therapy-booking-draft-v3)
Set by: Rahma Therapy       (rahma-booking-contact-v1)
Set by: Rahma Therapy       (maintenance-modal-seen)
Set by: Google (Google Analytics 4)          (_ga / _ga_*)
Set by: Sentry (Functional Software, Inc.)   (sentryReplaySession)
```

Two of the five entries the intro claims are things "our own code sets" are labelled, two
paragraphs later on the identical page, as set by named third parties. This is not my inference —
it is the codebase's own stated framing. `src/lib/consent/cookie-registry.ts:119-120` (comment on
the `_ga` entry): *"Set by Google, not by this repo's code, so the exact attributes are Google's
own defaults."* `cookie-registry.ts:153` (comment on the `sentryReplaySession` entry): *"Written
by the @sentry-internal/replay package"* — configured, but not written, by `sentry.client.config.ts`
(verified: `Sentry.init` at `sentry.client.config.ts:38-47` only sets sample rates and a
`beforeSend` hook; the actual `sentryReplaySession` write happens inside the third-party
`@sentry-internal/replay` package per `cookie-inventory-source.md` line 29). The source audit that
this whole registry is built from explicitly treats "set by this repo's code" and "set by a
third party our code loads" as two different things — and the intro's new wording collapses that
distinction back into a single claim that isn't true for 2 of the 5 disclosed items. A visitor
reading the intro, then scanning down to the Analytics group, hits a direct textual contradiction:
"our own code sets [this]" immediately followed by "Set by: Google" / "Set by: Sentry."

**The adjacent, unchanged sentence makes the problem worse, not better.** The next sentence —
`page.tsx:33`, untouched by `d7ee2bb` (confirmed: `git show d7ee2bb` diff shows only the "our own
code sets on" insertion within this same line; "We keep this list in one place so it always
matches what your browser actually receives." is byte-identical before and after) — asserts an
unqualified completeness guarantee against the *browser's actual behaviour*, not against "our own
code." That is a strictly stronger claim than the sentence it now follows. If Cloudflare's edge
adds a platform cookie, or the OpenNext build pipeline emits a service-worker/cache manifest that
writes storage — both explicitly left open by `cookie-inventory-source.md` §6 items 5–6 and
`cookie-inventory-browser.md` §4 — "what your browser actually receives" would include those
items, and the list would *not* match, contradicting this sentence's own claim. Defect 11's fix
narrowed the first sentence specifically to stop over-claiming about things nobody has observed
(Cloudflare/build-pipeline), but left the very next sentence making that same over-claim in
different words. This is the precise interaction the dispatch predicted was worth checking.

**Verdict on defect 11: not correctly fixed.** The rewording is a partial improvement (it correctly
narrows away from claiming coverage of unobserved platform/build storage) but introduces a fresh,
directly-verifiable self-contradiction against the page's own `Set by:` fields, and leaves the
following sentence's broader "matches what your browser actually receives" claim standing
unreconciled with the new narrower scope. A hostile/skimming reader — the standard this whole
verification chain has applied throughout — comes away from this paragraph with contradictory
information about who sets what.

---

## CHECK 2 — did the fix introduce anything new?

`git show d7ee2bb --stat`:
```
 src/app/(public)/cookies/page.tsx | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```
Exactly one file, 2 insertions / 2 deletions, as expected — matches the dispatch's stated
expectation exactly.

`git diff --stat d7ee2bb~1 d7ee2bb -- "src/app/(public)/cookies/CookieRegistryGroups.tsx" "src/lib/consent/cookie-registry.ts"` → empty output, confirming both files are genuinely untouched by this commit.

`cookie-registry.ts:195-218` — the `PHASE D OBLIGATION` comment block survives intact, still
listing all five items (`PURPOSE_DESCRIPTIONS.functional`, `PURPOSE_DESCRIPTIONS.analytics`, the
non-essential group badge in `CookieRegistryGroups.tsx`, the `_ga` entry description, the
`sentryReplaySession` entry description), unmodified by `d7ee2bb`.

TRUE, no issues — `d7ee2bb` touched exactly what it claimed to.

---

## CHECK 3 — independent spot-check of the previous 21-string sweep

Three highest-risk candidates checked directly against source (not re-trusted from the prior
report):

1. **Non-essential badge "Currently on — no cookie choice yet"** (`CookieRegistryGroups.tsx:85`) —
   verified TRUE for all three non-essential items by reading the actual write/load paths, not
   just re-citing the prior report:
   - `rahma-booking-contact-v1`: `src/features/booking/utils/returning-customer.ts:39`,
     `window.localStorage.setItem(STORAGE_KEY, ...)` inside `saveReturningCustomer` — unconditional,
     no consent check anywhere in the file (the file's own comment at `:5-6` states consent choices
     are "deliberately never stored," confirming no gate exists to check against).
   - `_ga` / `_ga_*`: `src/components/GoogleAnalytics.tsx:6` — gated only on `GA_ID` presence and
     `NODE_ENV === "production"`; line 17 is a bare comment (`// C-18 consent insertion point`),
     not an actual check.
   - `sentryReplaySession`: `sentry.client.config.ts:81-106` (`syncSessionReplay`) — gates only on
     `isReplayBlockedPath(pathname)` (the `/booking/manage` exclusion), no consent condition
     anywhere in the function or in `Sentry.init` (`:38-47`).
   All three genuinely run with zero consent gate today. TRUE.

2. **Type badge "Browser storage (stays until cleared or it expires)"** (`CookieRegistryGroups.tsx:9`,
   applied to both localStorage entries) — verified against both entries' actual persistence code:
   - `zam-therapy-booking-draft-v3`: `src/features/booking/store/booking-store.ts:75-79`, zustand
     `persist` with `storage: createJSONStorage(() => localStorage)` and no `MAX_AGE`/expiry logic
     anywhere in the file — confirmed "no fixed expiry," matches the registry's own duration text
     ("No fixed expiry — stays on this device...", `cookie-registry.ts:97-98`).
   - `rahma-booking-contact-v1`: `returning-customer.ts:8,56-58`, `MAX_AGE_MS = 180 * 24 * 60 * 60
     * 1000`, checked and auto-removed on next read past that age — genuinely self-expiring.
   The badge is a single generic label shared by the `StorageMechanism` type, not a per-entry
   promise (`TYPE_LABELS` in `CookieRegistryGroups.tsx:7-11` keys only on `cookie`/`localStorage`/
   `sessionStorage`, not on individual entries). Read as a disjunction ("ends via clearing, or via
   expiry, whichever applies"), it is literally true for both: the first entry only ever ends via
   the "cleared" branch (no expiry fires, but the statement doesn't promise one will), and the
   second entry genuinely satisfies both branches. Each entry's own `duration` field directly below
   the badge (`CookieRegistryGroups.tsx:46`) gives the entry-specific truth, so a reader isn't left
   with only the generic badge. TRUE, standing alone, though it is worth noting this is a shared
   type-level label rather than an entry-specific one — a reader relying on the badge in isolation
   (not reading "How long:") would not learn that one entry never expires.

3. **"Last updated: {date} (policy version {version})"** (`page.tsx:83-85`) — verified the date is
   not derived from any commit/edit timestamp. `formatBannerVersionDate()`
   (`cookie-registry.ts:261-275`) parses only the leading `YYYY-MM-DD` out of the
   `CONSENT_BANNER_VERSION` string constant (`cookie-registry.ts:24`,
   `"2026-07-16.1"`) — there is no `Date.now()`, `git log`, file-mtime, or any other real-world
   clock read anywhere in this function or its caller. `CONSENT_BANNER_VERSION` is a hand-set,
   brief-locked constant: `redesign/briefs/C-18-cookie-consent-brief.md:50,178` — *"Q8.2 — Banner
   version string format: date + counter (`2026-07-16.1`) locked."* Pinned by test:
   `src/lib/consent/__tests__/registry-completeness.test.ts:110`
   (`expect(CONSENT_BANNER_VERSION).toBe("2026-07-16.1")`) and `:120`
   (`expect(formatBannerVersionDate(CONSENT_BANNER_VERSION)).toBe("16 July 2026")`). Live render
   confirms `Last updated: 16 July 2026 (policy version 2026-07-16.1).` TRUE — not a real-edit-date
   claim, a locked spec version string, exactly as the prior full reverify concluded and I
   independently re-derived the same result from source rather than trusting that conclusion.

All three spot-checked strings hold up. No new defect found in this check.

---

## CHECK 4 — gates

- **`curl -s -L http://localhost:3000/cookies`** → `200`. New strings confirmed present
  (`How you'll change your choices`, `our own code sets on rahmatherapy.uk`); old strings confirmed
  absent (`Change your choices</h2>` — grep exit 1; `browser-storage item rahmatherapy.uk uses` —
  grep exit 1).
- **`npx tsc --noEmit`** → 0 errors (no output).
- **`npx vitest run`** (full suite) → tail:
  ```
  Test Files  2 failed | 191 passed (193)
       Tests  5 failed | 1845 passed (1850)
  ```
  Failures by identity, individually confirmed: `src/lib/auth/admin-access.test.ts` — "gives Owner
  broad access while keeping owner-only role actions permission-gated", "gives Admin broad
  operational access without role template management" (×2); `src/app/admin/bookings/new/
  ManualBookingForm.test.tsx` — "renders step 1 on first load", "moves focus to the first invalid
  field when continuing with errors", "shows the consent error when trying to create booking
  without consent" (×3). Exactly matches the inherited baseline identity — no new failures, no
  swapped failures. `src/lib/consent/__tests__/registry-completeness.test.ts` run in isolation:
  **1 file, 18/18 passed**, matching the inherited "consent suite is 18 tests" baseline.
- **`npx eslint .`** → `66 problems (59 errors, 7 warnings)`, structured JSON parsed per-file:
  `design_handoff_area_pages/prototype/area-page.jsx` (48 err/1 warn), `.../shared.jsx` (2 err/5
  warn), `.../site-chrome.jsx` (5 err/0 warn), `src/features/booking/BookingExperience.tsx` (3
  err/0 warn), `.../BookingExperienceLoader.tsx` (1 err/0 warn), `.../utils/returning-customer.ts`
  (0 err/1 warn) — exactly the six baseline files, matching identity. None of the C-18 files
  (`page.tsx`, `CookieRegistryGroups.tsx`, `cookie-registry.ts`) appear.

All gates match the inherited baseline by identity. No regressions from `d7ee2bb`.

---

## Summary

**Fail-causing:** defect 11's fix is incomplete. The narrowed scope claim ("our own code sets") is
directly contradicted by the `Set by: Google (Google Analytics 4)` and `Set by: Sentry (Functional
Software, Inc.)` fields rendered for two of the five registry entries on the same page — a
contradiction the codebase's own comments (`cookie-registry.ts:119-120,153`) already state in
their own words ("not by this repo's code" / "written by the @sentry-internal/replay package").
The untouched follow-on sentence ("...always matches what your browser actually receives")
compounds this: it re-asserts, in the very next clause, the broader completeness claim the fix was
supposed to retreat from, against exactly the Cloudflare/build-pipeline unknowns both evidence
files leave open. This was introduced by `d7ee2bb` itself, not inherited from a pre-existing,
already-flagged residual risk — the previous FULL reverify's "residual risk, not fail-causing" note
on this same paragraph applied to the *old* wording ("...item rahmatherapy.uk uses"), which made
no claim about who does the setting and so never collided with the `Set by:` fields. This new
wording does collide, on the same page, verifiably.

Suggested direction for the next fix round (not prescriptive — the orchestrator's call): either
(a) revert to a "what this site provides" framing that doesn't make a code-authorship claim at
all — e.g. "every cookie and browser-storage item you may receive when you visit... whether set by
our own code or by a service we've added, such as Google Analytics or Sentry" — which would make
the `Set by:` fields corroborate rather than contradict the intro, and would also require softening
the following "always matches what your browser actually receives" sentence to something scoped to
"what's listed here is everything our source code and its configured services can account for," or
(b) keep "our own code sets" but explicitly split it into two clauses that separately name
first-party and third-party-but-code-configured items, and hedge the following sentence to match.

**Confirmed accurate:** defect 10 (heading fix, fully correct, matches sibling pattern); `d7ee2bb`'s
file scope (exactly one file, 2/2 diff, `CookieRegistryGroups.tsx` and `cookie-registry.ts`
untouched, PHASE D OBLIGATION comment intact); all three independently spot-checked strings from
the prior 21-string sweep (non-essential badge, storage-type badge, last-updated line); all four
gates (`curl` 200 with correct strings, `tsc` 0 errors, `vitest` baseline identity + 18/18 consent
suite, `eslint` baseline identity).

**No opinion offered on whether the delta scoping itself was wrong** — the two in-scope fixes were
fully checkable within the delta, and the defect found here is local to the exact two lines
`d7ee2bb` touched, so a full re-pass would not have surfaced anything this delta pass couldn't.
