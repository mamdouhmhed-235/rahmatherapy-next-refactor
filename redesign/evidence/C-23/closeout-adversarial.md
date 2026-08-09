# C-23 — Adversarial Closeout Review

**VERDICT: PASS**

**Reviewer:** independent, read-only, fresh context (no prior C-23 involvement). Git limited to `log`/`diff`/`show`/`status` throughout; no `checkout`/`stash`/`switch`/`restore` used; no booking created, modified, or submitted; no authentication performed.

**Scope swept:** `git diff 7b1db05..8eb2d8a -- src/app/admin/bookings/new/ src/lib/booking/availability.ts src/app/api/admin/ src/app/api/availability/`

**⚠️ HEAD correction (per the dispatch's own instruction to confirm from git log, not trust it):** the dispatch states HEAD is `8c2270a`. The actual current HEAD is one commit further, **`8eb2d8a`** — `docs(redesign): C-23 gate 9 evidence — all three branches at 375 + 1280`. Verified this extra commit is **pure evidence** (`git show 8eb2d8a --stat` → 4 PNG files, 0 code lines) and produces **zero diff** against `8c2270a` on any C-23-scoped code path (`git diff 8c2270a..8eb2d8a --stat -- src/app/admin/bookings/new/ src/lib/booking/availability.ts src/app/api/admin/ src/app/api/availability/` → empty). All findings below are therefore unaffected by the correction; I ran every gate against the real current tree (`8eb2d8a`).

**Confirmed commit list** (`git log --oneline 7b1db05..8eb2d8a`, C-23-attributed only, other plans' commits interleaved and excluded per the dispatch): `61111ee`, `16c700e`, `a345d99`, `d701d9a`, `d142897`, plus docs-only commits `8504746`, `0ade989`, `425556b`, `ed19eae`, `8acfb5d`, `f6ae498`, `8c2270a`, `8eb2d8a`. The five code commits named in the dispatch are confirmed complete and correctly attributed — nothing missing, nothing extra in the code path.

---

## 1 — Scope creep

**None found.** `git diff 7b1db05..8eb2d8a --stat` on the four scoped path roots returns exactly 9 files, 1633 insertions / 10 deletions:

```
AvailabilityCalendarField.test.tsx | 298 (new)
AvailabilityCalendarField.tsx      | 285 (new)
ManualBookingForm.test.tsx         | 407 (edited)
ManualBookingForm.tsx              |  81 (edited)
use-month-availability.test.ts     | 106 (new)
use-month-availability.ts          | 121 (new)
route.test.ts (admin)              | 218 (new)
route.ts (admin)                   | 106 (new)
availability.ts                    |  21 (edited, +14/-7)
```

This is exactly the plan's §2 "Files touched" list — no extra file, no public-flow file, no unrelated admin surface. `src/app/api/availability/route.ts` (public per-day), `src/features/booking/**` (public flow), and `/admin/calendar/**` are all absent from the diff (confirmed directly, not inferred). `calculateAvailableSlots` is untouched — the only exported function edited in `availability.ts` is `calculateAvailableDays`, confirmed by re-reading the file's diff myself (two guarded conditionals + the options-type literal, nothing else).

## 2 — Lost steps (plan Phases B/C/D + brief §4.3–4.4, walked against the diff)

| Item | Present? | Evidence |
|---|---|---|
| Phase A verify-only (no re-implementation) | ✅ | No commit lands for it; `git log --oneline 7b1db05..8eb2d8a -- src/lib/booking/availability.ts` shows only the Phase B options commit, nothing port-shaped |
| Step 3 — additive options bag, two guarded sites, defaults preserved | ✅ | `availability.ts:867-911`, re-derived myself (§7 below) |
| Step 4 — `POST /api/admin/availability/month`, auth+permission before admin client, zod mirror, `{ ignoreBookingWindow: true, ignorePublicPause: true }` | ✅ | `route.ts` read in full; auth check (`getStaffProfile`) precedes `createSupabaseAdminClient()`; return shape `{ month, ...result }` matches `AvailableDaysResult` (`availability.ts:47-52`) |
| Step 5 — `AvailabilityCalendarField.tsx`, `disabled` never exceeds `{ before: min }`, marker resolution, non-colour encoding | ✅ | Read in full; `disabled={[{ before: minDate }]}` is the entire prop (`:231`); `resolveMarkerState` matches spec exactly |
| Step 6 — month-cache hook, cache key `month|services|genders|city`, `AbortController`, `enabled` = no new precondition | ✅ | `use-month-availability.ts:55` cache key, `:59-118` abort/cleanup |
| Step 7 — branch 1 wiring, identical handler body | ✅ | `ManualBookingForm.tsx:1704` onChange body textually identical to the native input's |
| Step 8 — branch 2 wiring, two cohorts, one calendar, one `start_time` | ✅ | `:1774` single `AvailabilityCalendarField` with `cohorts={mixedCohorts}` (2 entries); test at `ManualBookingForm.test.tsx:597` asserts exactly one `[data-day="2026-08-12"]` and one `input#booking_date` |
| Step 9 — fallback branch decision recorded | ✅ | Branch 3 kept as plain `AdminInput`, byte-identical text across all three commits (verified myself, §7 below) |
| Step 10 — non-removal audit, 13 items | ✅ | Re-derived independently, §7 below — all 13 present |
| Brief §4.3 — direct date entry preserved alongside calendar | ✅ | Both `AdminInput type="date"` and `AvailabilityCalendarField` render in branches 1 and 2 |
| Brief §4.3 — month navigation triggers a fetch | ✅ (after `d142897`) | `displayedMonth` state drives all three `useMonthAvailability` calls; tests `ManualBookingForm.test.tsx:678,710,762` exercise paging |
| Brief §4.5 — nothing auto-ported (auto-select, auto-hop, disabling days) | ✅ | No such logic found anywhere in the diff |

**No lost step found.**

## 3 — Cross-phase seams

Checked the two seams most likely to break silently across four separate dispatches:

1. **Does Phase B's options bag actually reach the engine on Phase D's path?** Yes — traced end-to-end: `AvailabilityCalendarField` (Phase C) → `use-month-availability.ts` (Phase C) fetches `POST /api/admin/availability/month` (Phase B) → `route.ts:99-103` calls `calculateAvailableDays(..., { ignoreBookingWindow: true, ignorePublicPause: true })` (Phase B's own options bag). Confirmed the hook targets the **admin** route, not the public one it was lifted from (`use-month-availability.ts:82`, `fetch("/api/admin/availability/month", ...)`) — this is the one seam that would have silently broken brief §5.8 if it pointed at the wrong route, and it doesn't.
2. **Does the hook's cache key match what the route expects?** Yes — `[monthKey, serviceIdsKey, gendersKey, city.trim().toLowerCase()].join("|")` (`use-month-availability.ts:55`) and the POST body `{ month, serviceIds, participantGenders: genders, city }` (`:83-88`) match the route's zod schema field names exactly (`route.ts:33-38`).

**One genuine, previously-undetected seam gap — NON-BLOCKING (§9, finding 1).** The calendar's displayed month and the typed native `<input type="date">` are **not kept in sync**. Traced through react-day-picker 9.14.0's actual shipped source (`node_modules/react-day-picker/dist/esm/helpers/getInitialMonth.js` + `useControlledValue.js`): because `ManualBookingForm` always passes a non-empty `month` prop (`displayedMonth` state, initialized once, changed only by `onMonthChange`), the calendar's rendered month is `props.month`-controlled on every render and is **never** re-derived from `selected`/`value`. Typing a date into the native input (`ManualBookingForm.tsx:1700` / `:1762`) changes `bookingDate` and hence `selected`, but never calls `setDisplayedMonth`. Result: if staff type a date in a different month than the calendar currently shows, the calendar keeps showing the old month with no visible selection, until the operator manually pages there. No test exercises this — every Phase D test drives the calendar's own day buttons (`dayButton(...)`), never `fireEvent.change` on `input#booking_date` (confirmed by grep: the native input is only read for `.type`/`.min`, never driven). This does not affect payload identity (gate §3.3 unaffected — `bookingDate`/hidden inputs are correct regardless) and does not violate any brief clause literally, but it is a real UX inconsistency between the two "direct entry" and "calendar" paths brief §4.3 asks to coexist, and it was never surfaced by any of the three phase verifications.

## 4 — Model drift (Phase B/D opus, Phase C sonnet)

No seam-level evidence of drift: naming (`--admin-*` tokens, `AdminInput`/`AdminPanel` idiom), comment density (heavy, rationale-first headers in every new file), and test idiom (`describe`/`it` blocks, DOM-property assertions rather than `@testing-library/jest-dom` matchers, matching the repo's documented convention) are consistent across all three phases' files. The progress file's own §0.4 already flags that the Phase C dispatch pinned `sonnet` but the agent self-reported running as Opus 5, and correctly notes self-reports aren't verifiable and the routing rule (§5) only forbids downgrading, not running stronger. I have no way to independently confirm which model actually executed Phase C either — noted as an open, already-disclosed uncertainty, not a new finding. Whichever model wrote it, `AvailabilityCalendarField.tsx`'s header comment (documenting the "no admin idiom precedent" problem and the two-mechanism non-colour-encoding solution) reads as more discursive/rationale-heavy than the terser Phase B/D commit-adjacent comments, but this is a stylistic observation, not a functional inconsistency — nothing behaves differently at the seam because of it.

## 5 — The three orchestrator rulings, audited

1. **Branch 3 left untouched, real condition `overrideAvailability || (isMixedGenderGroup && (femaleOverride || maleOverride))`.** CONFIRMED — `ManualBookingForm.tsx:1874` is exactly that expression, verbatim. The plan's own text (`!canCheckAvailability`) is indeed wrong; the progress file's correction is right. **Ruling sound.**
2. **Typed date input kept because it's the only render site of `stepErrors.booking_date`.** CONFIRMED — `grep -n "stepErrors.booking_date"` returns exactly three hits (`:1702`, `:1764`, `:1903`), all three `AdminInput` date fields, no other render site. Checked the only error-summary mechanism in the file (`multiErrorBanner`, `:1158-1168`): it renders only a generic `stepBannerError` string, never `stepErrors.booking_date` specifically. A literal "replace" per plan Step 7 would have deleted the only place the "Pick a date from today onwards" message can appear. **Ruling sound.**
3. **Gate §3.2 declared spent, a pre-condition satisfied before Phase B.** Re-derived the underlying diff myself: `git diff master redesign/start-state --numstat -- src/lib/booking/availability.ts` → `7 14` (not literally zero), because Phase B's edit is inline-additive (append `&& !options.ignorePublicPause` to an existing condition, wrap an existing filter in `(options.ignoreBookingWindow || ...)`, widen a one-line options type to seven) — git's line-granular diff necessarily renders any edit to an *existing* line as delete+add. I independently confirmed every one of the 7 "+" lines in that direction is character-for-character identical to code that already existed pre-Phase-B, by diffing the reverse direction (`git diff master redesign/start-state -- src/lib/booking/availability.ts`, read in full) — it is exactly the mirror image of Phase B's own commit diff, nothing else. The semantic property the gate protects ("master has everything start-state has, on these paths") holds; the literal "zero insertions" wording cannot hold for any inline edit, which is precisely what a minimal, guard-only Phase B edit is. **Ruling sound** — re-running this gate post-Phase-B would be meaningless as the plan itself acknowledges Phase B intentionally edits this file.

## 6 — Honesty spot-checks (3+ claims verified against code/git, not taken on trust)

1. **"Branch 3 byte-identical across `d701d9a` and `d142897`, only its line number shifted."** VERIFIED myself: `git show 8acfb5d:...ManualBookingForm.tsx`, `git show d701d9a:...`, and `git show 8eb2d8a:...` (current HEAD) all produce the **exact same text** for the branch-3 `AdminInput` line, at lines 1824 → 1895 → 1903 respectively. Claim is true, not overstated.
2. **"Unauthenticated `POST /api/admin/availability/month` → 401 `{"error":"Not signed in."}`; wrong method → 405."** VERIFIED live against the running dev server myself (read-only, no session, no booking): `curl -X POST -L .../api/admin/availability/month` with a well-formed body → `{"error":"Not signed in."}"` / `STATUS:401`; `curl -X GET -L` → `STATUS:405`. Exact match to the claim.
3. **"Admin's last available day beyond the window is `2026-09-30`, public's is `2026-09-07` — exactly today (2026-08-09) + booking_window_days (29)."** Independently re-derived the **public half** of this claim myself (the admin half requires an authenticated session I'm not permitted to drive): `curl -X POST -L .../api/availability/month` for September 2026, unauthenticated — returned `hasSlots: true` for exactly six dates (09-01 through 09-05, 09-07; 09-06 correctly `false` as a closed Sunday) and `false` for every date from 09-08 onward. `2026-08-09 + 29 days = 2026-09-07` — the arithmetic checks out exactly as claimed, and independently corroborates `booking_window_days = 29` without reading the settings table directly.
4. **Gate identities (lint/vitest/tsc) — see §8.** All three match the progress file's claimed numbers and named failures exactly, re-run by me from a clean invocation.

**No overstated claim found** in the three-plus checks I ran. One claim in the progress file is now **understated**, not overstated: §3.4a gate 9 says "375 + 1280 screenshots captured for branch 2; branches 1 and 3 outstanding" — but the later commit `8eb2d8a` (after that text was written) added `phase-d-branch1-single-{375,1280}-AFTER.png` and `phase-d-branch3-override-{375,1280}-AFTER.png`, closing the gap. The progress file's own table was never updated to reflect it (confirmed: `git diff 8c2270a..8eb2d8a` touches only the 4 PNGs, not the progress `.md`). Noted as a minor paperwork lag (§9, finding 2), not a defect and not a dishonest claim — the evidence is more complete than the record admits, the opposite direction of concern.

## 7 — Independent re-derivation (supporting §2/§5/§6)

**Engine diff (`availability.ts`), read in full myself:**
```diff
 export async function calculateAvailableDays(
   input: CalculateAvailableDaysInput,
   supabase: SupabaseClient,
-  options: { now?: Date } = {}
+  options: { now?: Date; ignoreBookingWindow?: boolean; ignorePublicPause?: boolean } = {}
 ...
-  if (!settings.booking_status_enabled) {
+  if (!settings.booking_status_enabled && !options.ignorePublicPause) {
 ...
-      isDateInBusinessWindow({ date, now, bookingWindowDays: settings.booking_window_days })
+      (options.ignoreBookingWindow || isDateInBusinessWindow({ date, now, bookingWindowDays: settings.booking_window_days }))
```
Exactly the two guarded sites the plan specifies (`booking_status_enabled` early return, `datesInWindow` filter), nothing else touched. `!undefined === true` / `undefined || x === x`, so both guards are behaviourally inert when options are omitted — algebra checked by hand, matches the Phase B verifier's independent derivation.

**Non-removal audit (13 items), re-walked myself against current HEAD:**
- Three `type="date"` branches: exactly 3 (`grep -n 'type="date"'` → `:1700`, `:1762`, `:1903`)
- State: `bookingDate` (`:595`), `startTime` (`:596`), `overrideAvailability` (`:597`)
- Hidden inputs: `booking_date` (`:1136`), `start_time` (`:1137`), `override_availability` (`:1139`, conditional), `send_confirmation_email` (`:1144`)
- `canCheckAvailability` (`:744`), `checkAvailability` (`:750`) — present, unwidened
- All present and correctly located; matches both prior verifiers' independent derivations.

**Code rules, checked myself across every new/touched file:**
- `border-l-4`: zero matches.
- Hardcoded light-colour literals (`bg-white`, `text-black`, hex/rgb/oklch, `gray-`/`slate-`/`neutral-`/`zinc-` Tailwind classes): zero matches in `AvailabilityCalendarField.tsx` or in the new hunks of `ManualBookingForm.tsx` — every colour reference is a `var(--admin-*)` token.
- `Set`/`Map`/`Date` through `unstable_cache`: zero `unstable_cache` imports anywhere in the touched files — not applicable.
- `prefers-reduced-motion`/`motion-reduce`: vacuously satisfied — no `transition`/`animate-*`/`duration-*` class exists in either new file to guard.

## 8 — Live-surface risk

**Confirmed:** `src/app/api/availability/route.ts` (per-day public) and `src/app/api/availability/month/route.ts` (public month) are **absent from the entire C-23 diff** — zero lines touched by any C-23 commit. Read the public month route in full at current HEAD: it still calls `calculateAvailableDays({ dates, serviceIds, participantGenders, city }, supabase)` with the **two-argument form**, relying entirely on the options-bag default (`= {}`), so `ignoreBookingWindow`/`ignorePublicPause` are both `undefined` on the public path — same as before Phase B existed. `src/features/booking/**` (the whole public booking flow) is absent from the diff.

**Independently exercised the public path live** (read-only, unauthenticated, no booking created): `POST /api/availability/month` for `2026-09` returned `hasSlots: true` for exactly six days, all ≤ `2026-09-07` (today `2026-08-09` + `booking_window_days` 29) — proving the public route's booking-window guard is still fully enforced and the defaults genuinely preserve prior behaviour, not merely by reading the code but by hitting the live endpoint myself.

**Defaults-preserve-behaviour proof (re-derived, not just accepted):** with `ignorePublicPause` omitted, `!settings.booking_status_enabled && !undefined` ⇒ `!settings.booking_status_enabled && true` ⇒ collapses to the pre-Phase-B expression exactly. With `ignoreBookingWindow` omitted, `undefined || isDateInBusinessWindow(...)` ⇒ always evaluates and returns `isDateInBusinessWindow(...)`, identical to before. Both re-derived by hand from the current file, matching the Phase B verifier's independent algebra.

**Conclusion: the public routes and the public booking flow are functionally unchanged by C-23** apart from Phase B's deliberate, defaulted, options-bag addition — confirmed live, not merely by code reading.

## 9 — Findings

**BLOCKING:** none.

**NON-BLOCKING:**

1. **Calendar month does not follow a typed date into a different month** — `src/app/admin/bookings/new/ManualBookingForm.tsx:1700,1762` (native date inputs' `onChange`, never call `setDisplayedMonth`) vs. `AvailabilityCalendarField.tsx` always receiving a controlled, non-empty `month` prop from `displayedMonth` state that only `onMonthChange` (calendar paging) updates. Verified against react-day-picker 9.14.0's actual shipped source (`getInitialMonth.js`, `useControlledValue.js`): `initialMonth = props.month || defaultMonth || today`, recomputed every render, and since `props.month` is always truthy here, the calendar's grid never re-derives from `selected`. Typing a date in a different month than currently displayed leaves that date correctly stored (payload unaffected, gate §3.3 unaffected) but visually unreflected on the calendar until the operator manually pages there. Untested by any of the three phase verifications (no test drives the native input's `onChange` at all — grepped `ManualBookingForm.test.tsx`, confirmed). Does not violate any brief clause literally (§4.3 requires the two entry modes coexist, not that they stay visually synced) or any blocking gate. Recommend a follow-up: sync `displayedMonth` to `bookingDate`'s month whenever the typed input changes it.
2. **Brief §8 acceptance criterion 9 ("Ported files are byte-identical to `redesign/start-state`, verified by diff") was never amended**, unlike plan gate §3.2 which was explicitly reworded (progress §0.1) to survive Phase B's approved, intentional edit to `availability.ts`. Taken completely literally, criterion 9 is now false post-Phase-B (confirmed: `git diff master redesign/start-state --numstat -- src/lib/booking/availability.ts` → `7 14`, not zero). This is a documentation-consistency gap in the brief itself, not a code defect — the plan-side gate was correctly updated, the brief-side acceptance criterion was not. Recommend amending brief §8.9 to match the plan's §3.2 rewording.
3. **Progress file §3.4a gate 9 text is stale** ("375 + 1280 screenshots captured for branch 2; branches 1 and 3 outstanding") — commit `8eb2d8a`, landed after that text, added the missing branch-1 and branch-3 screenshots at both viewports, closing the gap the text still describes as open. Cosmetic paperwork lag; the evidence is more complete than the record, not less.
4. **Dispatch's stated HEAD (`8c2270a`) is one commit stale** relative to the actual current HEAD (`8eb2d8a`) — confirmed the extra commit is pure evidence with zero code delta, so this does not change any gate result, but is recorded per the dispatch's own instruction to confirm from git log rather than trust the stated commit.

## 10 — Gates, run by identity (this session, current HEAD `8eb2d8a`)

| Gate | Command | Result | Identity match |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit` | **0 errors** | ✅ matches claimed baseline |
| Vitest (full) | `pnpm vitest run` | **5 failed / 2041 passed / 2046 total** | ✅ failures by name, re-confirmed myself: `admin-access.test.ts` — "gives Owner broad access while keeping owner-only role actions permission-gated", "gives Admin broad operational access without role template management"; `ManualBookingForm.test.tsx` — "renders step 1 on first load", "moves focus to the first invalid field when continuing with errors", "shows the consent error when trying to create booking without consent". Exact match to the claimed identity list, no swapped-in failure |
| Lint | `pnpm lint` | **59 errors / 7 warnings (66 problems)** | ✅ confirmed the file set myself: `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}` — grepped for any C-23 file appearing, zero matches |
| Build | — | **NOT RUN** | banned for agents this session per standing rule; recorded, not claimed |
| Isolation | `git status --porcelain -- src/lib/booking src/app/api src/app/admin/bookings/new` | **empty** | ✅ clean; `src/lib/maintenance.ts` excluded per standing rule (confirmed still the only tracked modification in the wider tree); remaining untracked entries in the wider `git status` are pre-existing dirt (`.playwright-mcp/*` deletions, `design_handoff_*` deletions, C-20/C-21 evidence) unrelated to C-23, none newly introduced by it |
| RBAC (live) | `curl -X POST/GET .../api/admin/availability/month` | **401 unauthenticated, 405 wrong method** | ✅ independently reproduced live |
| Public-route window guard (live) | `curl -X POST .../api/availability/month` for `2026-09` | **6 days true, all ≤ 2026-09-07** | ✅ independently reproduced live, confirms `booking_window_days=29` arithmetic |
| Code rules | grep sweep | **clean** — no `border-l-4`, no hardcoded light-colour literals, no `unstable_cache` with `Set`/`Map`/`Date`, `prefers-reduced-motion` vacuously satisfied | ✅ |

## 11 — Checks I could not run

- **Live authenticated admin-session checks** (gate §3.4a items 6 "paused half" and 7 "partial marker", branches 2/3 payload identity via a real browser, live AT-tree confirmation for Phase D specifically) — Zone-2/orchestrator-only per the dispatch; I have no session and am forbidden from authenticating. These were already honestly flagged as open in the progress file's own gate table ("2 need Owner ruling") — I did not find them overstated, only confirmed they remain genuinely open.
- **`pnpm build` / bundle-ceiling measurement (+6 kB)** — banned for agents this session; not run by me or by any prior verifier this programme. Recorded as not run, per instruction.
- **The admin-side half of the month↔day equivalence and window-relaxation claims** (6 sampled dates, September 26/30 marked) — requires the authenticated admin route; I independently reproduced the **public**-side half of the same underlying arithmetic (§6, §8) as the closest available substitute, and it checks out exactly.
- **A dedicated unmount-specific `AbortController` test** — flagged as a pre-existing gap by the Phase C verifier (cleanup is unconditional by code inspection, not separately tested); I did not attempt to close it, consistent with the read-only mandate.
