# C-18 Phase C — implementation-surface map

Read-only evidence pass. Every claim below was checked against the file at the
line numbers given, or a command was run and its output is quoted. Nothing
here proposes a design; it is a map of what exists.

Repo root: `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`.

---

## HEADLINE CONTRADICTION — Phase B is not green

The checkpoint commit (`dd9163b`, "phase B done, awaiting independent
verification") is contradicted by the test suite. Running:

```
pnpm exec vitest run src/components/consent/__tests__/ConsentScripts.test.tsx
```

produces **3 failing tests** (8 pass, 3 fail), all in one file:

1. `the emitted script and readConsent() > agree on every cookie in the corpus`
2. `the emitted script and readConsent() > both give the answer the corpus pins them to`
3. `ConsentScripts > interpolates the shared constants rather than restating them`

Root cause, read from source: `src/components/consent/ConsentScripts.tsx`
imports `CONSENT_BANNER_VERSION` (line 2) but **never interpolates it** into
`READ_COOKIE` (lines 64–71). The inline script's grant check (line 70) is:

```
if(s&&typeof s==='object'&&typeof s.id==='string'&&s.id&&typeof s.ts==='string'&&s.ts&&s.choices&&s.choices.analytics===true){...}
```

— no `s.v` / version check at all. `src/lib/consent/consent-state.ts`'s
`readConsent()` DOES check the version (line 110:
`if (parsed.v !== CONSENT_BANNER_VERSION) return null;`). So today the inline
script and `readConsent()` disagree on exactly one corpus entry — "version-
mismatched (otherwise perfect)" — the script wrongly grants where the reader
correctly denies. `src/lib/consent` itself (consent-state.test.ts +
registry-completeness.test.ts, 40 tests) is fully green; the break is isolated
to `ConsentScripts.tsx`/`ConsentScripts.test.tsx`.

This is a pre-existing Phase B defect, not something Phase C introduced or
something this pass touched. Flagging per SUBAGENT-RULES §3: "reality
contradicts your assigned plan text: STOP, return to the orchestrator with the
contradiction stated verbatim." Returning it now rather than fixing it — this
subagent is read-only.

---

## A — The contact-store write site

### A1. `src/features/booking/utils/returning-customer.ts` — full API surface

Storage key: `"rahma-booking-contact-v1"` (line 7). Expiry: `MAX_AGE_MS = 180
* 24 * 60 * 60 * 1000` (line 8, ~180 days), enforced in `loadReturningCustomer`
by comparing `Date.now() - parsed.data.savedAt` (line 56) — not a
storage-level expiry (localStorage has none), a read-time check that
self-deletes the key once stale.

- `saveReturningCustomer(details: BookingDetails)` (line 24–43). Writes.
  Builds a `storedContactSchema`-shaped payload (`savedAt`, `fullName`,
  `phone`, `email`, `clientGender`, `city`, `area`, `postcode`, `address`,
  `accessNotes`, `parkingNotes` — contact/address only, explicitly never
  health notes, treatment notes, participants, or consent choices per the
  file-top comment lines 4–6) and calls `window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))`
  (line 39). Wrapped in try/catch, silently no-ops on failure (private mode,
  quota).
- `loadReturningCustomer(): Partial<BookingDetails> | null` (line 45–72).
  Reads. `window.localStorage.getItem` (line 47), Zod `safeParse` (line 50),
  deletes+returns null on parse failure (line 51–54) or on staleness (line
  56–59), otherwise strips `savedAt` and re-derives `participantGenders` from
  `clientGender` (line 61–68).
- `clearReturningCustomer()` (line 74–80). Deletes.
  `window.localStorage.removeItem(STORAGE_KEY)` (line 76), try/catch no-op.

### A2. Every call site

All three exports are called from exactly one file:
`src/features/booking/BookingExperience.tsx`. Import at lines 25–29. No other
file in `src/` references `saveReturningCustomer`, `loadReturningCustomer`, or
`clearReturningCustomer` (grepped repo-wide).

| Call | file:line | Surrounding function | Read/Write |
|---|---|---|---|
| `loadReturningCustomer()` | `BookingExperience.tsx:283` | inline in a `useEffect` (the "Prefill contact + address" effect, lines 277–301) | Read |
| `clearReturningCustomer()` | `BookingExperience.tsx:304` | `clearPrefill` (lines 303–322), the handler behind the visible "clear prefill" UI action | Write (delete) |
| `saveReturningCustomer(values as BookingDetailsFormValues)` | `BookingExperience.tsx:494` | `handleConfirmSubmit` (`const handleConfirmSubmit = async () => {`, line 440) | Write |

### A3. The exact WRITE block (line 494) and the READ path

Write block, `BookingExperience.tsx:480–508` (`handleConfirmSubmit`, inside
the try after a successful `submitBookingRequest` call):

```tsx
480    setSubmitting(true);
481    setSubmissionError(undefined);
482    try {
483      const result = await submitBookingRequest({
484        selectedPackageIds,
485        selectedPackages,
486        details: values as BookingDetailsFormValues,
487        preferredDate: visitResult.success ? visitResult.data.preferredDate : "",
488        preferredTime: visitResult.success ? visitResult.data.preferredTime : "",
489        estimatedTotal,
490        company_website: values.company_website,
491      });
492      setSubmittedBookingId(result.bookingId);
493      setSubmittedManageUrl(result.manageUrl);
494      saveReturningCustomer(values as BookingDetailsFormValues);
495      clearStepErrors();
496      setAttemptedStep(null);
497      setNavDirection(1);
498      setCurrentStep("success");
499    } catch (error) {
500      setSubmissionError(
501        error instanceof Error
502          ? error.message
503          : "Unable to submit booking request."
504      );
505    } finally {
506      setSubmitting(false);
507    }
508  };
```

Line 494 is a bare synchronous call with no condition around it today — a
gate would wrap this exact line. It fires strictly after `submitBookingRequest`
resolves successfully (so it never runs on a failed submission).

READ (pre-fill) path is in **the same file**, not elsewhere:
`BookingExperience.tsx:275–301`:

```tsx
275  // Prefill contact + address from the customer's last successful booking,
276  // once per session and only while the form is still pristine.
277  useEffect(() => {
278    if (!open || prefillAttemptedRef.current) {
279      return;
280    }
281    prefillAttemptedRef.current = true;
282
283    const stored = loadReturningCustomer();
284    if (!stored) {
285      return;
286    }
287
288    const values = form.getValues();
289    const pristine =
290      !form.formState.isDirty &&
291      !values.fullName &&
292      !values.phone &&
293      !values.email &&
294      !values.address;
295    if (!pristine) {
296      return;
297    }
298
299    form.reset({ ...emptyBookingDetails, ...stored });
300    setPrefilled(true);
301  }, [open, form]);
```

Owner ruling already on record naming this exact site: commit `c8c37d6`
(`redesign/per-page-progress/C-18-cookie-consent-progress.md`, table row 6)
says verbatim: *"`rahma-booking-contact-v1` stays `functional` and gets a REAL
gate. The panel's Functional toggle must actually skip the write, so C-18's
files-touched list extends to `src/features/booking/BookingExperience.tsx`
(~:494) ... A visitor who declines loses form pre-fill on a later booking;
that is the intended consequence."* This is not this subagent's inference —
it is a prior, recorded Owner decision, and it matches the line found above.

### A4. Client component? Existing consent import? Existing tests?

- `"use client"` is the first line of `BookingExperience.tsx` (line 1). Confirmed client component.
- Grepped the file for `consent` (case-insensitive): **no matches**. It does
  not import anything from `src/lib/consent/` today.
- No dedicated test file exists for `BookingExperience.tsx` or for
  `returning-customer.ts`. Glob for `**/features/booking/**/*.test.*` returns
  only `booking-packages.test.ts`, `booking-schema.test.ts`,
  `BookingSummary.test.tsx`, `SuccessScreen.test.tsx` — none of them exercise
  `BookingExperience.tsx` itself. Repo-wide grep for
  `BookingExperience|returning-customer|rahma-booking-contact` across
  `**/*.test.*` returns only `registry-completeness.test.ts` (which asserts
  the registry entry's shape, not behaviour). The `e2e/` spec files
  (`booking-claiming.spec.ts`, `booking-public.spec.ts`, `helpers.ts`,
  `admin-roles.spec.ts`) contain zero matches for
  `returning-customer|rahma-booking-contact|localStorage`.

### A5. eslint caveat — exact current errors for `BookingExperience.tsx`

Command run: `pnpm exec eslint src/features/booking/BookingExperience.tsx`
(project's own `eslint.config.mjs`, flat config, same binary the `lint` npm
script uses). Output: **3 errors, 0 warnings**, all pre-existing (nothing in
this pass touched the file):

1. `161:5` — rule `react-hooks/set-state-in-effect` — "Avoid calling
   setState() directly within an effect" (`setSummarySheetOpen(false)` at
   line 161, inside a `useEffect` closing over `[open, currentStep]`).
2. `213:9` — rule `react-hooks/immutability` — "`applyFormIssues` accessed
   before it is declared" (used at line 213, declared later at line 346).
3. `300:5` — rule `react-hooks/set-state-in-effect` — "Avoid calling
   setState() directly within an effect" (`setPrefilled(true)` at line 300 —
   this is the tail of the SAME prefill effect quoted in A3 above, so a
   Phase C gate reader needs to know this line already carries a baseline
   error before touching anything near it).

Any Phase C diff must produce exactly these three, by rule id and line
(adjusted for line-number drift from the gate's own insertion) — not a
swapped-in new one.

---

## B — Consent surfaces Phase C must extend

### B6. `src/components/consent/ConsentScripts.tsx` — full file, quoted

82 lines total, reproduced in full (see file; not re-typed here beyond what's
load-bearing above in the HEADLINE CONTRADICTION section and below).

**How the inline script string is built:** `CONSENT_SCRIPT = \`${DEFAULT_DENIED}\n${READ_COOKIE}\`` (line 77) — two template-literal blocks concatenated. `DEFAULT_DENIED` (lines 34–36) is a fixed `gtag('consent','default',...)` call with all four Consent Mode signals denied and `wait_for_update:500`, no interpolation. `READ_COOKIE` (lines 64–71) is an IIFE wrapped in try/catch.

**Constants interpolated, and from where:**
- `CONSENT_COOKIE` (from `@/lib/consent/consent-state`, imported line 1) — interpolated via `JSON.stringify(CONSENT_COOKIE)` at line 65 (`var n=${JSON.stringify(CONSENT_COOKIE)}`).
- `CONSENT_BANNER_VERSION` (from `@/lib/consent/cookie-registry`, imported line 2) — **imported but NOT interpolated anywhere in the file.** This is the root cause of the 3 test failures above.
- `RESTORE_GRANTED` (line 38, a fixed string, not a constant from elsewhere) is spliced into `READ_COOKIE` at line 70 via template literal.

**The exact validation rules the inline parser applies, in order** (lines 64–71):
1. Find the cookie pair whose name, trimmed, exactly equals `CONSENT_COOKIE` (`"rahma_consent"`) — iterates `document.cookie.split(';')`, `p[i].slice(0,q).trim()!==n` skips non-matches; first match wins, loop breaks (line 66). Exact-name match, not substring — a cookie named `not_rahma_consent` or `rahma_consent_old` does not match (mirrors `readConsent`'s `cookieNameOf`/`readRawCookie` in consent-state.ts).
2. If no match (`!r`), `return` — falls through to the already-established denied defaults (line 67).
3. `decodeURIComponent(r)`, falling back to the raw value `r` on a throw (line 68) — mirrors `decodeCookieValue` in consent-state.ts.
4. `JSON.parse(d)` (line 69) — inside the outer try/catch, so a parse throw is swallowed.
5. Check, all in one `if` (line 70): `s` is a non-null object AND `typeof s.id==='string' && s.id` (non-empty) AND `typeof s.ts==='string' && s.ts` (non-empty) AND `s.choices` is truthy AND `s.choices.analytics===true`.
   **Missing versus `readConsent()`: no `s.v` / version check.** `readConsent` additionally requires `typeof v === 'string' && v` (parse step) and then `parsed.v !== CONSENT_BANNER_VERSION` → null (consent-state.ts:83, :110). The inline script has neither.
6. On pass, splice in `RESTORE_GRANTED` — `gtag('consent','update',{'analytics_storage':'granted'})`.
7. Whole IIFE wrapped in outer try/catch (line 64 `try{`, line 71 `}catch(_e){}`) — any exception anywhere in steps 1–6 falls through silently to denied.

### B7. Test file paths, counts, and the 31-entry equivalence corpus

- `src/lib/consent/__tests__/consent-state.test.ts` — 21 tests (`grep -c "  it("` = 21; vitest run confirms all pass). No corpus array in this file — direct unit tests of `readConsent`/`writeConsent`/`gaCookieClearDomains`/`clearGaCookies`.
- `src/lib/consent/__tests__/registry-completeness.test.ts` — 19 tests, all pass.
- `src/components/consent/__tests__/ConsentScripts.test.tsx` — 11 tests, **3 currently fail** (see HEADLINE CONTRADICTION). This is the file with the equivalence corpus.

**The 31-entry corpus** lives in
`src/components/consent/__tests__/ConsentScripts.test.tsx`, the `CORPUS`
constant, lines 82–178:

```ts
const CORPUS: { name: string; cookie: string; grants: boolean }[] = [ ... ];
```

Exactly 31 entries (counted by hand against the array; groups per the file's
own comments: "the five states named in the brief", "absence, in its other
disguises", "malformed, in its other disguises", "well-formed JSON of the
wrong shape", "a real grant, in the awkward places it can turn up"). Each
entry is `{ name, cookie, grants }` — `cookie` is a raw `document.cookie`-style
string (built with a local `cookie(payload)` helper, line 28, that
percent-encodes JSON the same way `writeConsent` does), `grants` is the
boolean answer BOTH readers are required to agree on.

**How expected answers are pinned:** two assertions per corpus, both in
`describe("the emitted script and readConsent()", ...)` (lines 180–193):
- `"agree on every cookie in the corpus"` (line 181–185) — for every entry,
  `scriptGrants(entry.cookie)` must equal `readerGrants(entry.cookie)`
  (cross-check between the two implementations, entry-by-entry, does not
  reference `entry.grants` at all — this is what stops the two copies from
  being "wrong together").
- `"both give the answer the corpus pins them to"` (line 187–192) — for every
  entry, BOTH `scriptGrants(entry.cookie)` and `readerGrants(entry.cookie)`
  must separately equal `entry.grants` (the independently-declared correct
  answer).

`scriptGrants` (lines 66–74) runs the actual `CONSENT_SCRIPT` string via
`new Function(CONSENT_SCRIPT)()` inside a `document.cookie`-getter override
(`withCookieString`, lines 39–50, `Object.defineProperty`) and inspects the
resulting `window.dataLayer` calls for a `['consent','update',{analytics_storage:'granted'}]` push. `readerGrants` (lines 76–79) calls `readConsent(cookieString)?.choices.analytics === true` directly.

**What extending it for a second `choices` key (e.g. `functional`) means:**
today `GRANTED` (line 32) is `{ v, id, choices: { analytics: true }, ts }` and
`ConsentState.choices` (consent-state.ts:23) is typed `{ analytics: boolean }`
only. Adding a second key touches: the `ConsentState` interface, every
`GRANTED`-derived corpus entry (all 31 currently assume single-key
`choices`), the inline script's `s.choices.analytics===true` check (line 70,
would need an equivalent for the new key or an explicit decision that the
inline script only ever needs to know about `analytics` since Consent Mode
only reacts to that one signal), and `readConsent`'s destructure (consent-
state.ts:88, `const { analytics } = choices as Record<string, unknown>`).

### B8. `src/lib/consent/__tests__/registry-completeness.test.ts` — every assertion

19 tests across 6 `describe` blocks:

`describe("registry completeness (inventory <-> registry parity)")` (10 tests):
1. `COOKIE_REGISTRY.length` equals `EXPECTED_NAMES.length` (5 inventoried + `rahma_consent`) — line 46.
2. Every `EXPECTED_NAMES` entry has a registry entry — line 49–54.
3. No registry entry outside `EXPECTED_NAMES` (symmetric) — line 56–64.
4. No duplicate `name`s — line 66–69.
5. Every entry has non-empty `provider`, `duration`, `description`, valid `type`, valid `purpose` — line 71–80.
6. Every `purpose:"essential"` entry's `description.length > 40` — line 82–92.
7. **`rahma-booking-contact-v1` carries a `provisionalNote`** — line 94–99:
   ```ts
   it("rahma-booking-contact-v1 carries a provisional note (Owner decision pending)", () => {
     const entry = COOKIE_REGISTRY.find((e) => e.name === "rahma-booking-contact-v1");
     expect(entry).toBeDefined();
     expect(entry?.purpose).toBe("functional");
     expect(entry?.provisionalNote, "provisionalNote").toBeTruthy();
   });
   ```
   **(a) Confirmed exactly:** this is the assertion the task said is due for
   removal. The Owner ruling that resolves it is already on record — commit
   `c8c37d6`, `redesign/per-page-progress/C-18-cookie-consent-progress.md`
   row 6: *"`rahma-booking-contact-v1` stays `functional` and gets a REAL
   gate."* Purpose stays `functional` (this test's `entry?.purpose).toBe("functional")` line does NOT need to change), but the `provisionalNote`
   field on the registry entry (`cookie-registry.ts:143–144`) and this
   test's `expect(entry?.provisionalNote, ...).toBeTruthy()` assertion are
   both now stale — the note text itself says "pending an explicit Owner
   ruling" and that ruling has happened.
8. `maintenance-modal-seen` is `dormant: true` — line 101–105.
9. `sentryReplaySession` is `purpose: "analytics"` — line 107–111.
10. `rahma_consent` entry: `type === "cookie"`, `provider === "Rahma Therapy"`, `purpose === "essential"` — line 113–122.
    **(b) Checked explicitly: no assertion in this file pins the `rahma_consent` entry's `description` text.** Only `type`/`provider`/`purpose` are pinned for that entry — the description string (`cookie-registry.ts:117–118`, which currently ends "Nothing sets this cookie yet... no visitor's browser is storing it today") is free to change without breaking this test file. (It DOES need to change per `cookie-registry.ts`'s own "PHASE D OBLIGATION" comment, item 6, lines 249–254 — see below — just not because of this test.)
11. `_ga / _ga_*` is `purpose: "analytics"`, `type: "cookie"` — line 124–129.

`describe("CONSENT_BANNER_VERSION")` (2 tests, lines 132–140): pins the exact
value `"2026-07-16.1"` and its `YYYY-MM-DD.n` shape.

`describe("formatBannerVersionDate")` (2 tests, lines 142–150).

`describe("groupRegistryByPurpose")` (4 tests, lines 152–176): entry-count
conservation, no empty groups, essential first, non-empty label/description
per group.

**Bonus finding not asked for but directly relevant to dispatch scope:**
`src/lib/consent/cookie-registry.ts` carries its own explicit
"PHASE D OBLIGATION" checklist (lines 225–254) of six present-tense sentences
that must flip together with real gates. Item 6 (lines 249–254) is scoped to
**Phase C, not Phase D** — quoted verbatim: *"The 'rahma_consent' entry's
description... 'Nothing sets this cookie yet...' This one flips EARLIER than
the other five: it stops being true the moment PHASE C's banner first calls
`writeConsent()`, not at Phase D. Drop that sentence in the same change that
ships the banner."* Items 1–3 and the non-essential badge text (see C9 below)
are Phase D's problem, not Phase C's, per this same comment.

---

## C — Where the banner/panel mount and link from

### C9. `src/app/(public)/cookies/page.tsx` and `CookieRegistryGroups.tsx`

`page.tsx` is a **server component** (no `"use client"`, grepped — zero
matches; exports `metadata`, a Next.js server-only export). **No client
island exists inside it today.**

The file contains an explicit, already-written **Phase C seam comment**,
lines 16–24:

```tsx
16  // Phase C seam (documented per C-18 plan §1 Step 6): the preferences panel
17  // does not exist yet. When it ships, it is expected to mirror
18  // BookingExperienceLoader's pattern (src/features/booking/BookingExperienceLoader.tsx) —
19  // watch for `?cookie-settings=1` in the URL on mount, AND listen for clicks
20  // on any `[data-cookie-settings-trigger="true"]` element via event
21  // delegation, so this link (and the future SiteFooter link from Phase F)
22  // need no changes when the panel lands. Until then, this link is a
23  // documented no-op.
24  const COOKIE_SETTINGS_HREF = "?cookie-settings=1";
```

The "Change your choices" card/button region, lines 53–72:

```tsx
53  <article className="rounded-2xl border border-rahma-border bg-rahma-ivory p-6">
54    <h2 className="font-display text-xl font-semibold text-rahma-charcoal sm:text-2xl">
55      How you&apos;ll change your choices
56    </h2>
57    <p className="mt-3 text-sm leading-7 text-rahma-muted sm:text-base">
58      There&apos;s no live control for this yet — non-essential items currently run
59      automatically, without asking, as explained above. Once our cookie preferences
60      panel ships, you&apos;ll be able to change your choices at any time: essential
61      items still won&apos;t be switchable off, because the site can&apos;t do what
62      you&apos;ve asked without them, but everything else will stay off unless you say
63      yes.
64    </p>
65    <a
66      href={COOKIE_SETTINGS_HREF}
67      data-cookie-settings-trigger="true"
68      className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-rahma-green/30 px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
69    >
70      Not available yet
71    </a>
72  </article>
```

Note: this `<a>` already carries `data-cookie-settings-trigger="true"` and
`href="?cookie-settings=1"` — both are named in the seam comment as the
exact hooks a Phase C loader must watch for. Nothing here needs to change
structurally; only the copy ("Not available yet" → something live) and the
loader that answers the click.

`CookieRegistryGroups.tsx` — also a **server component** (no `"use client"`).
The non-essential group badge text, lines 79–87:

```tsx
79  {group.purpose === "essential" ? (
80    <span className="text-sm font-semibold text-rahma-green">
81      Always on — can&apos;t be switched off here
82    </span>
83  ) : (
84    <span className="text-sm font-semibold text-rahma-muted">
85      Currently on — no cookie choice yet
86    </span>
87  )}
```

Per `cookie-registry.ts`'s PHASE D OBLIGATION list item 3 (line 240–242),
this badge text is explicitly scoped to Phase D, not Phase C.

### C10. `src/components/layout/SiteFooter.tsx`

**Server component** (no `"use client"`). Legal-links row, lines 76–91:

```tsx
76  {footerContent.legalLinks.length > 0 ? (
77    <nav
78      className="w-layout-grid footer_legal-list"
79      aria-label="Footer legal navigation"
80    >
81      {footerContent.legalLinks.map((item) => (
82        <Link
83          key={item.label}
84          href={item.href}
85          className="footer_legal-link"
86        >
87          {item.label}
88        </Link>
89      ))}
90    </nav>
91  ) : null}
```

`footerContent.legalLinks` is currently `[]` (`src/content/site/footer.ts:26`)
— so today **the whole `<nav>` renders `null`**; nothing is emitted in that
slot. Per `cookies/page.tsx`'s own seam comment (line 21, "the future
SiteFooter link from Phase F"), populating this is explicitly Phase F, not
Phase C.

### C11. `BookingDialog.tsx` / `BookingExperience.module.css` z-index

`BookingDialog.tsx` uses `@base-ui/react/dialog`'s `Dialog.Backdrop`
(className `styles.backdrop`, line 59) and `Dialog.Popup` (className
`styles.popup`, line 60–64). Values, `BookingExperience.module.css`:
- `.backdrop` — `z-index: 9998` — `BookingExperience.module.css:12`.
- `.popup` — `z-index: 9999` — `BookingExperience.module.css:20`.
- (bonus, mobile-only) `.sheetScrim` inside the dialog's own mobile summary sheet — `z-index: 30` — `BookingExperience.module.css:1846` (scoped inside `@media (max-width: 1023px)`, well below the dialog's own 9998/9999 since it stacks inside the same popup).

### C12. z-index table — public-page fixed/sticky chrome

| file:line | selector / element | z-index | position |
|---|---|---|---|
| `src/app/(public)/layout.tsx:23` | skip-to-content link (`focus:z-[1000]`, Tailwind arbitrary value) | 1000 | `focus:fixed` |
| `src/features/booking/BookingExperience.module.css:20` | `.popup` (booking dialog, Base UI `Dialog.Popup`) | 9999 | fixed |
| `src/features/booking/BookingExperience.module.css:12` | `.backdrop` (booking dialog backdrop) | 9998 | fixed |
| `src/features/booking/BookingExperience.module.css:1846` | `.sheetScrim` (mobile summary-sheet scrim, inside the dialog, `@media (max-width:1023px)`) | 30 | fixed |
| `src/styles/site-parity.css:504` | `.navbar31_menu-button` (header hamburger button) | 101 | relative |
| `src/styles/site-parity.css:384` | `.navbar31_component` (SiteHeader itself) | 100 | fixed |
| `src/styles/site-parity.css:620` | `.navbar31_menu` (mobile nav slide-out panel) | 99 | fixed |
| `src/components/ui/dialog.tsx:21` | `DialogBackdrop` (shared shadcn-style Dialog, Tailwind `z-50`) | 50 | fixed |
| `src/components/ui/dialog.tsx:46` | `DialogContent` (shared shadcn-style Dialog, Tailwind `z-50`) | 50 | fixed |
| `src/app/globals.css:150` | `.public-scrollbar` (PublicScrollbar.tsx custom overlay scrollbar) | 45 | fixed |

Not found: any z-index already reserved for a cookie banner/panel, and no
existing "1000+" band beyond the skip link and the booking dialog (9998/9999).
`src/components/shared/MaintenanceBanner.tsx` is in normal document flow (no
`fixed`/`sticky`, no `z-index` at all) — not overlay chrome. Grep for
`z-index`/`z-\[` across `src/` found nothing else touching public pages; the
remaining hits (`src/app/admin/**`, most of `site-parity.css`) are
admin-scoped or non-overlay (`z-index: 2`/`1`/`-1` on decorative/stacking
contexts inside cards, not fixed chrome).

A banner/panel placed above the header (100/101) but below the booking
dialog (9998/9999) would need something in the 102–9997 range; the existing
`DialogBackdrop`/`DialogContent` shared component already sits at 50, so if
the panel reuses that component directly it would render UNDER the header
(100) unless overridden — worth the implementer's attention, not something
this subagent is deciding.

---

## D — The design system the banner must match

### D13. `src/styles/tokens.css` — `--rahma-*` tokens

All defined `:root` (lines 2–26), full name+hex:

| token | value | note |
|---|---|---|
| `--rahma-ivory` | `#f7f3ec` | surface/ivory background |
| `--rahma-surface` | `#ffffff` | card surface |
| `--rahma-green` | `#1c72ac` | **misnamed** — this hex is a blue, not green. Comment at lines 4–6 calls it "Primary action blue", darkened from `#2589c8` for AA contrast. This is the site's primary action color despite the variable name. |
| `--rahma-charcoal` | `#144a78` | **also misnamed** — this hex is a dark blue, used as the main text/heading color |
| `--rahma-charcoal-strong` | `#124470` | darker variant, for text-on-`--rahma-gold` only (comment lines 9–14) |
| `--rahma-muted` | `#4a5a6a` | secondary/muted text |
| `--rahma-gold` | `#f5a623` | primary CTA fill color (e.g. "Book" buttons) |
| `--rahma-blue` | `#1b82b8` | **the actual "action blue"** — distinct from `--rahma-green`'s blue-hex; used as `--ring` (line 43), i.e. the focus-ring color |
| `--rahma-border` | `#e8ded1` | hairline border |
| `--rahma-sand` | `#f0e8d8` | alternating section tone, one step deeper than ivory |

Derived/shadcn-shape aliases also present (lines 27–43):
`--background`→ivory, `--foreground`→charcoal, `--card`→surface,
`--primary`→`--rahma-green`, `--border`→`--rahma-border`,
`--ring`→`--rahma-blue`. Also: `--radius-base: 0.75rem`,
`--radius-card: 1.5rem`, `--radius-section: 1.875rem`, and three shadow
tokens (`--shadow-soft-token`, `--shadow-elevated-token`,
`--shadow-card-token`, lines 57–59) plus `--focus-ring-token` (line 60).

**Naming trap for the implementer:** "the action blue" the task brief asks
about is ambiguous between `--rahma-green` (#1c72ac, the actual primary
button/link color) and `--rahma-blue` (#1b82b8, the focus-ring color). Both
exist and are visually almost identical blues but serve different roles.

### D14. Existing public-facing components — house style references

- **Fixed/bottom-anchored card:** `.summarySheet` in
  `src/features/booking/BookingExperience.module.css:1852–1865` — `position:
  fixed`, pinned `left/right/bottom: 0`, `border-radius: 20px 20px 0 0`
  (rounded top only), `box-shadow: 0 -18px 48px -24px rgba(12,38,60,0.5)`
  (shadow cast upward), `padding-bottom: calc(16px + env(safe-area-inset-bottom))` (safe-area aware), slide-up entrance
  (`animation: bookingSheetUp 220ms var(--ease-gentle) both`, keyframes lines
  1867–1876: `translateY(24px)→0` + opacity fade). This is the closest
  existing "bottom sheet" pattern on the public site.
- **Button pair:** `src/features/booking/components/BookingActionBar.tsx`
  (lines 39–50 "Back" + lines 80–89 primary submit/continue) — raw `<button>`
  elements styled via CSS-module classes (`styles.secondaryButton`,
  `styles.primaryButton`), not the shared `Button` component. Demonstrates
  the house pairing pattern (secondary/outline-style back action + primary
  filled forward action) but via hand-rolled CSS, not the design-system
  component.
- **Accessible dialog with focus trap:** two layers exist.
  1. Raw Base UI usage: `src/features/booking/components/BookingDialog.tsx`
     (`Dialog.Root`/`Dialog.Portal`/`Dialog.Backdrop`/`Dialog.Popup`/
     `Dialog.Title`/`Dialog.Description`/`Dialog.Close` from
     `@base-ui/react/dialog`, imported line 4).
  2. A **reusable wrapped Dialog component** already exists at
     `src/components/ui/dialog.tsx` (117 lines) — a shadcn-style wrapper
     around the same `@base-ui/react/dialog` primitive. Exports: `Dialog`
     (=`BaseDialog.Root`), `DialogTrigger`, `DialogPortal`, `DialogClose`,
     `DialogBackdrop` (fixed, `z-50`, blurred), `DialogContent` (fixed,
     centered, `z-50`, `showCloseButton?: boolean` prop, renders its own
     `DialogPortal`+`DialogBackdrop`+close button), `DialogHeader`,
     `DialogFooter`, `DialogTitle`, `DialogDescription`. Used today by
     `src/components/shared/MaintenanceModal.tsx` (a public-facing modal) —
     e.g. `<Dialog open={open} onOpenChange={setOpen}><DialogContent
     showCloseButton={false} className="bg-rahma-ivory">...`. This is a
     strong existing-component candidate for a Phase C preferences panel if
     it renders as a centered dialog rather than a bottom sheet; its z-index
     (50) collides with nothing else in the table above except itself.
  - A shared **Button** component also exists,
    `src/components/ui/button.tsx` — `buttonVariants` (cva) with public-site
    variants `primary`/`secondary`/`outline`/`ghost`/`link`, sizes
    `sm`/`md`/`lg`/`icon`, `fullWidth`, `icon`, `loading` (spinner replaces
    icon, never both, `aria-busy`) props. Used on the customer-facing
    `src/app/booking/manage/ManageBookingForms.tsx` (imports it line 5); not
    used anywhere inside the `(public)` route group's own pages (grepped —
    zero hits for `<Button` under `src/app/(public)`), so `BookingActionBar`'s
    raw buttons are, in practice, the closer precedent for booking-dialog-
    adjacent UI, while `Button` is the closer precedent for a standalone
    panel/dialog's actions.

### D15. Focus-trap utility / `prefers-reduced-motion` pattern / portal helper

- **Focus trap:** no standalone utility module exists. The only mechanism in
  the codebase is whatever `@base-ui/react/dialog`'s `Dialog.Root`/
  `Dialog.Popup` provide internally (used by both `BookingDialog.tsx` and
  `src/components/ui/dialog.tsx`). Grepped `src/` for
  `focus-trap|focusTrap` — the only two hits are a comment in
  `src/app/admin/enquiries/page.tsx:399` ("AdminSheet (focus-trapped,
  portal-rendered)") describing an admin-only component, and no hit with
  actual code.
- **`prefers-reduced-motion`:** two competing patterns exist, both real:
  1. Public-site idiom — `useReducedMotion()` imported directly from
     `framer-motion` (already a dependency, used for the booking dialog's
     step transitions). Used in `src/features/booking/components/MotionStep.tsx:4,19`,
     `src/components/faqs-aftercare/AftercareTabs.tsx:4,16`,
     `src/components/services/PackageFinder.tsx:5,18`. This is the
     established public-page convention.
  2. Admin-only hand-rolled hook — `src/app/admin/components/use-reduced-motion.ts`, a `useSyncExternalStore`-based `useReducedMotion()` matching
     `(prefers-reduced-motion: reduce)`, explicitly commented as "Used by
     Band B primitives" (admin charts/dashboard). Not intended for public
     pages per its own doc comment, though technically importable by path.
  There is also a raw CSS pattern:
  `@media (prefers-reduced-motion: reduce) { .notif-bell-pulse-once { animation: none; } }` in `src/styles/tokens.css:672–676` — CSS-only opt-out for
  one specific animation, not a general helper.
- **Portal helper:** no standalone helper module. `Dialog.Portal` from
  `@base-ui/react/dialog` (used directly in `BookingDialog.tsx:58` and inside
  `DialogContent` in `src/components/ui/dialog.tsx:41`) is the only portal
  mechanism in use anywhere in the codebase; no `createPortal` calls exist in
  `src/` outside that.

---

## E — Test conventions

### E16. Client-component behaviour tests

Framework: Vitest (`vitest.config.ts` — `environment: "jsdom"` globally,
`globals: true`, `include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"]`). Render helper: `@testing-library/react`'s `render`/`screen`.
`@testing-library/user-event` is a devDependency but **is only used in
`src/app/admin/**` test files** (10 files, all admin) — none on the public/
booking side. No `fireEvent` usage found in `src/features/booking/`. Public/
booking-side tests instead assert behaviour by (a) rendering with mocked
prop-callbacks (`vi.fn()`) and checking they were called, or (b) inspecting
rendered output via `screen`, rather than simulating user interaction — since
the components under test so far are presentational, not interactive forms.
Location convention: BOTH patterns coexist — colocated `Component.test.tsx`
next to the component (e.g. `SuccessScreen.test.tsx`,
`BookingSummary.test.tsx`) AND a `__tests__/` subfolder (used specifically by
the consent module: `src/lib/consent/__tests__/`,
`src/components/consent/__tests__/`).

Two representative examples:
1. `src/features/booking/components/SuccessScreen.test.tsx` — colocated.
   Wraps the component in `<Dialog.Root open>` (Base UI context requirement,
   lines 13–17) since `SuccessScreen` renders a `Dialog.Close`. Mocks
   `window.gtag` with `vi.fn()`, asserts call counts/args, includes a
   `<StrictMode>` double-mount test (lines 55+) to catch effect
   double-firing. No `user-event`/`fireEvent`.
2. `src/features/booking/components/BookingSummary.test.tsx` — colocated,
   `render`/`screen` only (line 1 import), no interaction simulation.

### E17. Existing tests that mock `document.cookie` or `localStorage`

- **`document.cookie` mocking — yes, two examples, both in the consent
  module (exactly the approach Phase C's own tests will need):**
  1. `src/components/consent/__tests__/ConsentScripts.test.tsx`,
     `withCookieString<T>(cookieString, fn)` (lines 39–50) —
     `Object.defineProperty(document, "cookie", { configurable: true, get: () => cookieString, set: () => {} })`, restored via `delete
     (document as unknown as Record<string, unknown>).cookie` in a `finally`.
     Used because jsdom's real cookie jar would silently normalise/reject the
     deliberately hostile corpus entries.
  2. `src/lib/consent/__tests__/consent-state.test.ts`,
     `captureCookieWrites()` (lines 46–66) — wraps the REAL
     `Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), "cookie")` getter/setter so writes are both recorded AND still applied to
     jsdom's real jar (needed because `Secure`/`SameSite`/`Max-Age`/`Domain`
     attributes are invisible to the plain `document.cookie` getter). Also
     note the file-top comment (lines 1–9): the test file's
     `@vitest-environment-options { "url": "https://localhost:3000/" }`
     pragma is load-bearing — jsdom refuses to hand back a `Secure` cookie on
     an insecure origin, so an `http://` default would break the round-trip
     tests for reasons unrelated to the code under test. Any Phase C test
     that calls `writeConsent()` (which sets `Secure`) needs the same `https`
     URL override.
- **`localStorage` mocking — not found; not needed.** No test file mocks
  `localStorage` — jsdom provides a real, working `localStorage`
  implementation by default, and the one existing example that exercises it
  heavily, `src/app/admin/bookings/__tests__/savedViews.test.ts`, calls
  `window.localStorage.clear()/.setItem()/.getItem()` directly against the
  real jsdom implementation, no mock/stub at all. A Phase C test for the
  `returning-customer.ts` gate can do the same.

---

## Files read (for the record)

`src/features/booking/utils/returning-customer.ts`,
`src/features/booking/BookingExperience.tsx` (full read, both anchor regions
+ eslint run), `src/components/consent/ConsentScripts.tsx` (full),
`src/components/consent/__tests__/ConsentScripts.test.tsx` (full),
`src/lib/consent/consent-state.ts` (full),
`src/lib/consent/__tests__/consent-state.test.ts` (full),
`src/lib/consent/__tests__/registry-completeness.test.ts` (full),
`src/lib/consent/cookie-registry.ts` (full),
`src/app/(public)/cookies/page.tsx` (full),
`src/app/(public)/cookies/CookieRegistryGroups.tsx` (full),
`src/app/(public)/layout.tsx` (full),
`src/components/layout/SiteFooter.tsx` (full),
`src/content/site/footer.ts` (grepped),
`src/components/layout/SiteHeader.tsx` (full),
`src/features/booking/components/BookingDialog.tsx` (full),
`src/features/booking/BookingExperience.module.css` (targeted reads: lines
1–35, 1835–1900),
`src/styles/site-parity.css` (targeted reads: 381–410, 495–520, 617–660),
`src/app/globals.css` (targeted reads: 1–40, 130–160),
`src/components/shared/MaintenanceBanner.tsx` (full),
`src/components/shared/MaintenanceModal.tsx` (full),
`src/components/ui/dialog.tsx` (full),
`src/components/ui/button.tsx` (full),
`src/features/booking/components/BookingActionBar.tsx` (full),
`src/styles/tokens.css` (targeted read: 1–60, plus grep for `--rahma-`),
`src/components/home/HomeReviewCarousel.tsx` (grepped),
`src/app/admin/components/use-reduced-motion.ts` (full, for contrast only —
admin-scoped),
`src/features/booking/components/SuccessScreen.test.tsx` (partial),
`src/features/booking/components/BookingSummary.test.tsx` (grepped),
`src/app/admin/bookings/__tests__/savedViews.test.ts` (grepped),
`vitest.config.ts` (full),
`package.json` (full),
`redesign/per-page-progress/C-18-cookie-consent-progress.md` (via `git show
c8c37d6`, the Owner-decisions commit).

Commands run: `pnpm exec eslint src/features/booking/BookingExperience.tsx`;
`pnpm exec vitest run src/components/consent/__tests__/ConsentScripts.test.tsx`; `pnpm exec vitest run src/lib/consent`; various `git log`/`git show`
(read-only, no checkout/stash/push).
