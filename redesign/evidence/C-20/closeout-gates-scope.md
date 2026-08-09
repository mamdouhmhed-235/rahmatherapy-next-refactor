# C-20 — Closeout verification: GATES + SCOPE + ISOLATION

**Verifier:** read-only subagent, dimension = GATES + SCOPE + ISOLATION
**Repo state at verification:** branch `master`, HEAD `5233518`
**Commits verified (by identity, confirmed via `git log`):** `92f031d`, `cc32657`, `ac0a283`, `af2c5b1`, `9593a74`, `83c670f`

---

## 1 — Diff scope across the six commits

Per-commit `git show --stat` (NOT a range diff, which would include interleaved C-19/C-23 work landed between these six commits):

| Commit | Files touched |
|---|---|
| `92f031d` | `src/lib/address/parse-place.test.ts`, `src/lib/address/parse-place.ts` |
| `cc32657` | `src/lib/address/parse-place.test.ts` |
| `ac0a283` | `src/components/address/AddressAutocompleteField.test.tsx`, `src/components/address/AddressAutocompleteField.tsx` |
| `af2c5b1` | `src/components/address/AddressAutocompleteField.test.tsx`, `src/components/address/AddressAutocompleteField.tsx` |
| `9593a74` | `src/features/booking/components/AboutYouStep.test.tsx`, `src/features/booking/components/AboutYouStep.tsx` |
| `83c670f` | `.env.example`, `src/app/admin/bookings/new/ManualBookingForm.test.tsx`, `src/app/admin/bookings/new/ManualBookingForm.tsx` |

**Result: PASS.** Every touched path falls inside the expected set (`src/lib/address/**`, `src/components/address/**`, `AboutYouStep.tsx(+test)`, `ManualBookingForm.tsx(+test)`, `.env.example`). No file outside this set was touched by any of the six commits.

- **Consent files:** `git diff <parent>..<commit> -- src/lib/consent` run for all six commits → empty in every case. No consent-registry change landed (matches the progress file's §0.4 item 2 — deferred, still open).
- **Dependencies:** `git log --oneline -- package.json pnpm-lock.yaml` filtered against the six SHAs → no match. Neither file was touched by any C-20 commit.

## 2 — API key literal search

`git show <sha> | grep -n "AIza"` run individually for all six commits → **zero matches** in every commit. No Google Maps API key literal was committed anywhere in the range.

## 3 — `.env.example`

`git show 83c670f -- .env.example` shows exactly one new block: a commented explanation plus
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-api-key
```
One entry, placeholder value only, no real key. **PASS.**

## 4 — Gates by identity

- **`npx tsc --noEmit`** → **0 errors** (clean exit, no output). **PASS.**

- **`pnpm vitest run`** (full suite) → **2 files failed | 207 passed (209)**, **5 tests failed | 2055 passed (2060)**. Failures by name, confirmed via targeted grep of the run output:
  - `src/lib/auth/admin-access.test.ts` > `admin access matrix` > `gives Owner broad access while keeping owner-only role actions permission-gated`
  - `src/lib/auth/admin-access.test.ts` > `admin access matrix` > `gives Admin broad operational access without role template management`
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx` > `ManualBookingForm` > `renders step 1 on first load`
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx` > `ManualBookingForm` > `moves focus to the first invalid field when continuing with errors`
  - `src/app/admin/bookings/new/ManualBookingForm.test.tsx` > `ManualBookingForm` > `shows the consent error when trying to create booking without consent`

  This is exactly admin-access.test.ts ×2 + ManualBookingForm.test.tsx ×3, judged by name as instructed — not by count, though the totals (5 failed / 2055 passed / 2060) also match the dispatch's ~5/2055/2060 figure. **PASS.**

- **`pnpm lint`** → **66 problems (59 errors, 7 warnings)**. Full list of files carrying any lint diagnostic, extracted from the run:
  - `design_handoff_area_pages/prototype/area-page.jsx`
  - `design_handoff_area_pages/prototype/shared.jsx`
  - `design_handoff_area_pages/prototype/site-chrome.jsx`
  - `src/features/booking/BookingExperience.tsx`
  - `src/features/booking/BookingExperienceLoader.tsx`
  - `src/features/booking/utils/returning-customer.ts`

  Exactly six files, exactly the expected set — no seventh file appeared. Confirmed specifically that none of C-20's own touched files (`AboutYouStep.tsx`, `AddressAutocompleteField.tsx`, `parse-place.ts`, `ManualBookingForm.tsx`) carry any lint diagnostic, and that the three pre-existing `src/features/booking/` files were not "fixed" (their errors/warnings are present, unchanged in kind: `react-hooks/set-state-in-effect` ×3, `react-hooks/immutability` ×1 in `BookingExperience.tsx`, plus the `returning-customer.ts` unused-var warning). **PASS.**

- **`pnpm build`** — **deliberately NOT run**, per hard restriction (banned for agents this session).

## 5 — Plan-scoped suites

`pnpm vitest run src/lib/address src/components/address src/features/booking src/app/admin/bookings/new`:

**1 file failed | 10 passed (11) — 3 tests failed | 95 passed (98).**

The 3 failures are exactly the three `ManualBookingForm.test.tsx` baseline failures identified above (`renders step 1 on first load`, `moves focus to the first invalid field…`, `shows the consent error…`). `src/lib/address`, `src/components/address`, and `AboutYouStep.test.tsx` all pass fully; `admin-access.test.ts` is outside this scoped path set so its 2 baseline failures do not appear here (they were already confirmed in §4's full-suite run). **PASS.**

## 6 — Isolation

`git status --porcelain`, filtered to exclude `.playwright-mcp/`, `design_handoff_public_pages/`, `design_handoff_area_pages/`, `photos-rahma-therapy/`, `redesign/evidence/`, `test-results/`, and `src/lib/maintenance.ts` (the standing Owner-owned uncommitted change) →

**Empty.** No output survives the filter. The working tree carries only the pre-existing/expected dirt plus the standing `maintenance.ts` change; nothing else is uncommitted anywhere in the repo. **PASS.**

---

## Summary

All six gates/scope/isolation checks PASS. No scope violations, no committed key literal, `.env.example` correct, tsc/vitest/lint all match expected baselines by identity, plan-scoped suites show only the known baseline failures, and the tree is isolated.

**No findings.**

Checks not run: `pnpm build` (deliberately excluded per hard restriction — no build permitted this session).
