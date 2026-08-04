# C-18 fix round — independent verification (FULL tier)

**Verifier:** fresh read-only subagent, model unknown to itself (Claude Code CLI / Sonnet family — not directly introspectable; treat as `sonnet` per dispatch convention).
**Scope:** four commits on top of `295f4d2` → HEAD `26a7d3f`:
`7873693` Sentry Replay off on /admin + registry copy · `0d2246c` purposes_offered derives from the registry · `7daee77` consent transition tests stop hitting the network · `26a7d3f` panel focus-trap test no longer races Base UI.
**Method:** read-only (`git log`/`diff`/`show`/`status` only); no build; no server actions; no auth. All findings below are from source I read myself and test runs I executed myself, not restated claims.

---

## Lead item 1 — `/booking/manage` Replay block still holds unconditionally

Read `sentry.client.config.ts` at HEAD. `syncSessionReplay(pathname)` checks in this exact order:

1. `if (isReplayBlockedPath(pathname))` → `void replay?.stop(); return;` (line 151-159)
2. `if (isAdminPath(pathname))` → `void replay?.stop(); return;` (line 161-169, new in this round)
3. `if (replayRequiresConsent(pathname) && !hasAnalyticsConsent())` → stop/return (line 171-178)
4. else add the integration.

`/booking/manage` matches check (1) unconditionally — it never reaches the consent check, and it never reaches the new admin check either, because `/booking/manage` doesn't match `isAdminPath`. This means: with analytics consent **GRANTED**, a Replay session that a client-side navigation carries onto `/booking/manage` is still force-stopped by check (1) before any consent logic runs. The new admin arm was inserted **after** the booking/manage arm, not before it and not merged into it — ordering is intact.

`hasAnalyticsConsent()`/a "sticky `sentryReplaySession`" resuming: there is no code path that re-adds the integration once check (1) or (2) has returned early; `Sentry.getReplay()` is re-queried fresh on each call, and the function returns before `Sentry.addIntegration(...)` can run for a blocked path.

Credential-guard tests (unmodified by this fix round, still present in `SentryProvider.test.tsx`):
- `blocks /booking/manage and nothing that merely looks like it`
- `never starts Replay on a direct load of /booking/manage`
- `still never starts Replay on /booking/manage when analytics consent IS granted`
- `stops a running Replay when a client-side navigation enters /booking/manage`

Ran `npx vitest run src/components/__tests__/SentryProvider.test.tsx` myself: **16/16 passed**, including the four above and the three new `/admin` tests.

**Verdict: CONFIRMED.** Ordering preserved; block is unconditional; tests green.

---

## Lead item 2 — Replay genuinely off on `/admin`, unconditional (Owner decision 9)

`isAdminPath()` (new function, lines 54-57) is checked in `syncSessionReplay` **before** the consent branch, and its own doc comment states it is not a consent question. Confirmed by test: `still does not start Replay on /admin even with a valid analytics grant` calls `grantAnalytics()` then renders at `/admin/login/` and asserts `addIntegration`/`replayIntegration` were never called. Ran this test myself — passes. A second test confirms a session already running (carried in via client-side nav from a public page) is stopped on entering `/admin`. `replayRequiresConsent("/admin")` still returns `false`, but the doc comment correctly reclassifies this as "no live question" rather than "runs unconditionally" — matches the code, since `isAdminPath` short-circuits before `replayRequiresConsent` is ever consulted for admin paths.

**Verdict: CONFIRMED unconditional**, not merely consent-gated.

---

## Lead item 3 — `Sentry.init` untouched; error reporting ungated everywhere

Diffed the `Sentry.init({...})` block itself between `295f4d2` and `26a7d3f`:

```
git diff 295f4d2..26a7d3f -- sentry.client.config.ts
```

The `Sentry.init` call (dsn, sendDefaultPii, tracesSampleRate, replaysSessionSampleRate, replaysOnErrorSampleRate, enableLogs, beforeSend, integrations: []) is **byte-identical** — the diff hunk touching this file starts above and below the init block but never inside it. Confirmed independently: `git show 295f4d2:sentry.client.config.ts` shows the same 8-key object verbatim.

`integrations: []` is unchanged — still the merge-with-defaults form Phase 0 established (not a replace). `Sentry.init` is called once, unconditionally, on module load, before any path check exists — so it runs on `/admin` exactly as it does everywhere else. Test `never starts Replay on any /admin path, with no consent record at all` explicitly asserts `sentryMocks.init` was called exactly once even on `/admin/dashboard/`.

**Verdict: CONFIRMED untouched. Error reporting stays ungated everywhere, admin included.**

---

## Lead item 4 — `NON_ESSENTIAL_PURPOSES` judgment call

Read `cookie-registry.ts`, `consent-store.ts`, `ConsentPreferencesPanel.tsx`, and `registry-completeness.test.ts` in full.

- `NON_ESSENTIAL_PURPOSES = PURPOSE_ORDER.filter(p => p !== "essential")` — a static taxonomy list, independent of whether `COOKIE_REGISTRY` actually has any entries for each purpose.
- `GATED_PURPOSES` (in `ConsentPreferencesPanel.tsx`, unchanged by this round) = `groupRegistryByPurpose().map(g => g.purpose).filter(p => p !== "essential")`, and `groupRegistryByPurpose()` **filters out purposes with zero entries** (`.filter((group) => group.entries.length > 0)`, `cookie-registry.ts:327`, a Phase A behaviour, pinned by the pre-existing test `omits purposes with no entries rather than rendering an empty group`).
- `consent-store.ts`'s `logConsentEvent` now sends `purposes_offered: NON_ESSENTIAL_PURPOSES` — the taxonomy list, **not** `GATED_PURPOSES` — into the consent-proof beacon.

**The question the dispatch asks is real.** If a purpose existed in `PURPOSE_ORDER`/`NON_ESSENTIAL_PURPOSES` with zero live `COOKIE_REGISTRY` entries (e.g. because every entry for that purpose was removed, or a new purpose was added to the taxonomy before any registry entry existed for it), then:
- `groupRegistryByPurpose()` would omit it → no group renders on `/cookies` → `GATED_PURPOSES` would omit it → **no toggle renders in the panel** for that purpose.
- `purposes_offered` in the logged consent-proof beacon would **still include it**, because `NON_ESSENTIAL_PURPOSES` is registry-entry-agnostic.
- Net effect: the legal proof log would claim a purpose was "offered" (shown as a control) when no control was ever shown for it.

**Is it reachable today?** No. Checked `COOKIE_REGISTRY` directly: purpose counts are essential=3, functional=1 (`rahma-booking-contact-v1`), analytics=2 (`_ga`/`_ga_*`, `sentryReplaySession`). Both non-essential purposes in `PURPOSE_ORDER` (`functional`, `analytics`) have ≥1 live entry, so `NON_ESSENTIAL_PURPOSES` and `GATED_PURPOSES` are member-for-member identical at HEAD. Not a live defect.

**Does the added parity test catch it?** No. `registry-completeness.test.ts`'s new test (`ConsentChoices cannot silently drift from the registry`) only asserts `Object.keys(sample: ConsentChoices)` equals `NON_ESSENTIAL_PURPOSES` — i.e. it guards the `ConsentChoices` interface (consent-state.ts) against drifting from the `PURPOSE_ORDER` taxonomy. It does **not** assert that every purpose in `NON_ESSENTIAL_PURPOSES` has ≥1 registry entry (i.e. that `NON_ESSENTIAL_PURPOSES === GATED_PURPOSES`). The pre-existing `groupRegistryByPurpose` tests only describe the *filtering* behaviour, not its consequence for the beacon's truthfulness. No test in the suite would fail if, say, the `functional` entry were deleted from `COOKIE_REGISTRY` tomorrow while `functional` stayed in `PURPOSE_ORDER`/`ConsentChoices`.

**Risk rating: real but currently dormant — MEDIUM as a coverage gap, not a live bug.** This is exactly the failure class the plan is worried about (a legal proof-of-consent record making a claim the UI doesn't back up), and it is plausible future-maintenance bait: removing the last cookie for a purpose (e.g. retiring the booking-contact cookie) is a far more likely edit than adding a whole new purpose, and nothing currently guards against it. Flagging for the orchestrator/Owner as a disclosed residual, not blocking this round — the implementer's stated trade-off (keep six prose descriptions off the public bundle) is reasonable, but the derivation should arguably be `GATED_PURPOSES`-equivalent (registry-entry-driven) rather than `PURPOSE_ORDER`-driven, or a completeness test should assert `NON_ESSENTIAL_PURPOSES` entries all have ≥1 registry match.

---

## Lead item 5 — flaky focus-trap test, re-verified in isolation

Diffed `ConsentPreferencesPanel.test.tsx`: the fix replaces `expect(dialog.contains(document.activeElement)).toBe(true)` (asserted synchronously right after the click resolves) with `await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))`. This polls the real DOM condition (Base UI's async focus-management effect) rather than sleeping a fixed duration — no `setTimeout`/`vi.advanceTimersByTime` involved, and the assertion itself (focus actually lands inside the dialog) is unchanged and still meaningful.

Ran the full file **8 times in isolation** myself (`npx vitest run src/components/consent/__tests__/ConsentPreferencesPanel.test.tsx`, one full process per run):

```
Run 1: Tests  15 passed (15)
Run 2: Tests  15 passed (15)
Run 3: Tests  15 passed (15)
Run 4: Tests  15 passed (15)
Run 5: Tests  15 passed (15)
Run 6: Tests  15 passed (15)
Run 7: Tests  15 passed (15)
Run 8: Tests  15 passed (15)
```

Also ran the specific test alone 8 more times (`-t "moves focus into the dialog when it opens"`) — 1/1 passed every time. **16/16 isolated runs, 100% pass.**

**Verdict: CONFIRMED fixed**, waits on the real condition, assertion still meaningful.

---

## Lead item 6 — copy truthfulness

All strings read standing alone, compared against the actual code at `26a7d3f`:

| String | Claim | Verified against | True? |
|---|---|---|---|
| `sentryReplaySession` description | "It only runs on our public pages, and only once you switch Analytics on" | `syncSessionReplay`'s consent-gated branch, `(public)` mount only | TRUE (see note below) |
| " | "It never runs at all on our staff-only admin area, whatever anyone's choice — we've switched it off there outright" | `isAdminPath()` unconditional block, checked before consent | TRUE |
| " | "Sentry's separate error-reporting tool... keeps working everywhere, admin included" | `Sentry.init` unconditional, `sentryMocks.init` called once even on `/admin` in tests | TRUE |
| `PURPOSE_DESCRIPTIONS.analytics` | "Nothing in this group runs on our staff-only admin pages either, whatever anyone's choice" | `GoogleAnalytics`/`ConsentScripts` mounted only in `(public)/layout.tsx` (grepped `src/app/{layout,admin/layout,(public)/layout}.tsx` — neither import appears outside `(public)`); Replay blocked by `isAdminPath` | TRUE |
| PHASE D OBLIGATION item 5 comment | "Its wording states plainly that /admin has Replay switched off outright, not gated by consent" | Matches the actual `sentryReplaySession` description text verbatim | TRUE |
| `ConsentPreferencesPanel.tsx` inline comment (not user-facing) | Describes the Analytics group description as carrying the admin carve-out | Matches `PURPOSE_DESCRIPTIONS.analytics` text | TRUE |

**One residual noted, not newly introduced by this round:** the `sentryReplaySession` description says Replay "only runs on our public pages" but doesn't separately disclose the stricter `/booking/manage` carve-out (Replay never runs there even with consent granted, tighter than the general public-page rule). This omission predates the fix round — the pre-round text had the identical gap — so it isn't a truthfulness regression from `295f4d2`→`26a7d3f`, and the sentence isn't literally false (it states a necessary condition, not "runs on every public page unconditionally"). Recorded for completeness per the §3.1 lesson, not counted as a defect of this round.

**Verdict: all six items TRUE at HEAD.**

---

## Gates, run myself, by identity

**`npx tsc --noEmit`** — exit code 0, zero output. **0 errors.**

**Targeted suites** (`SentryProvider.test.tsx`, `ConsentPreferencesPanel.test.tsx`, `consent-transitions.test.ts`, `consent-logging.test.ts`, `registry-completeness.test.ts`, run together):
```
Test Files  5 passed (5)
     Tests  83 passed (83)
```

**Full vitest suite** (`npx vitest run`, entire repo):
```
Test Files  2 failed | 200 passed (202)
     Tests  5 failed | 1974 passed (1979)
```
Failing test identities (grepped `FAIL` lines from my own run):
- `src/lib/auth/admin-access.test.ts > admin access matrix > gives Owner broad access while keeping owner-only role actions permission-gated`
- `src/lib/auth/admin-access.test.ts > admin access matrix > gives Admin broad operational access without role template management`
- `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > renders step 1 on first load`
- `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > moves focus to the first invalid field when continuing with errors`
- `src/app/admin/bookings/new/ManualBookingForm.test.tsx > ManualBookingForm > shows the consent error when trying to create booking without consent`

**Exact match to the inherited baseline by identity** — `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3, and the totals (5 failed / 1974 passed / 1979 total) match the dispatch's stated baseline exactly. No new failure, no swapped-in failure.

**`npx eslint .`** — `66 problems (59 errors, 7 warnings)`. Files with issues, extracted from my own run's output:
- `design_handoff_area_pages/prototype/area-page.jsx`
- `design_handoff_area_pages/prototype/shared.jsx`
- `design_handoff_area_pages/prototype/site-chrome.jsx`
- `src/features/booking/BookingExperience.tsx`
- `src/features/booking/BookingExperienceLoader.tsx`
- `src/features/booking/utils/returning-customer.ts`

**Exact match to the inherited baseline** — same six files, same 59E/7W split.

**`git status --porcelain` isolation** — ran against the nine files touched by this fix round (`sentry.client.config.ts`, `src/components/__tests__/SentryProvider.test.tsx`, `src/components/consent/ConsentPreferencesPanel.tsx`, `src/components/consent/__tests__/ConsentPreferencesPanel.test.tsx`, `src/lib/consent/__tests__/consent-logging.test.ts`, `src/components/consent/__tests__/consent-transitions.test.ts`, `src/components/consent/consent-store.ts`, `src/lib/consent/__tests__/registry-completeness.test.ts`, `src/lib/consent/cookie-registry.ts`): **zero output — no uncommitted changes to any of them.**

The wider repo tree remains dirty exactly as documented in the dispatch/progress file — `src/lib/maintenance.ts` (Owner's standing authorised change, excluded), `redesign/per-page-progress/C-18-cookie-consent-progress.md` (in-progress orchestrator edit, not part of this diff), a large batch of deleted `.playwright-mcp/` logs and `design_handoff_public_pages/` files, and several untracked evidence/screenshot directories from other plans (C-19, C-21). None of these are inside the fix round's files-touched list; none were staged or modified by this verification pass.

---

## Summary verdict

**PASS.** All six lead items confirmed by direct source reading and my own test execution, not restated claims:
1. `/booking/manage` block ordering intact, unconditional, credential-guard tests green (16/16).
2. `/admin` Replay off unconditionally, not consent-gated, confirmed with a granted-consent test still blocking it.
3. `Sentry.init` byte-identical; error reporting confirmed ungated everywhere including `/admin`.
4. `NON_ESSENTIAL_PURPOSES` judgment call: correctly not reachable today (registry counts checked directly), but the new parity test guards the wrong direction of drift — a real, disclosed, currently-dormant coverage gap for the consent-proof log, not a live defect. Recommend the orchestrator/Owner decide whether to close it (e.g. assert `NON_ESSENTIAL_PURPOSES` all have ≥1 registry entry) in a future round.
5. Flaky focus-trap test: 16/16 isolated runs passed; fix polls the real condition, not a sleep.
6. All six copy claims verified TRUE at HEAD; one pre-existing, non-regressed completeness gap noted (not a new false statement).

Gates: tsc 0 errors · targeted suites 83/83 · full suite 5 failed/1974 passed (1979), identity-exact to baseline · eslint 59E/7W in the exact six baseline files · isolation clean for all nine fix-round files.
