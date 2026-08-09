# C-23 — Availability-aware calendar on the admin create-booking page — PROGRESS

**Plan:** `redesign/plans/C-phase/C-23-admin-availability-calendar-plan.md`
**Brief:** `redesign/briefs/C-23-admin-availability-calendar-brief.md`
**Programme:** Band C, C-C implementation — plan **#19 executed** (§4 order position 20). **Taken ahead of C-19 and C-20 under an Owner-approved reorder (2026-08-04)**: C-19 is blocked on the registered company name/number and C-20 on a Maps API key absent from the repo. C-23-before-C-14 is preserved.
**Predecessor:** C-18, closeout `7b1db05`.
**Migrations:** none. **Zone-2 actions:** one (pre-flight #4).

**Governing constraint (Owner direction 2026-07-16):** *"ensure it doesn't cause any discrepancies or issues nor remove anything unnecessarily."* C-23 changes how staff **see** dates, never what the form **submits**. Brief §2's non-removal list is a hard blocking gate (§3.4), not advice.

---

## 0 — Pre-flight (2026-08-04, at `7b1db05`)

| # | Check | Result |
|---|---|---|
| 1 | branch `master`; `git merge-base --is-ancestor ea97932 HEAD` | ✅ `master`, exit 0 |
| 1 | `git status --porcelain -- src/lib/booking src/app/api src/app/admin/bookings/new` | ✅ **empty** |
| 2 | dev server | ✅ 200 (Owner-run; never spawned or killed by an agent) |
| 3 | port-parity identity assertion | ⚠️ **NON-EMPTY — see §0.1** |
| 4 | behavioural baseline | ⛔ **HELD — see §0.2** |
| 5 | anchor greps | ✅ all re-located by symbol — see §0.3 |
| 6 | sibling-plan collision check | ✅ C-02, C-03, C-06 all shipped; **C-20 not started**; C-22 shipped (see §0.1) |
| — | serialization: C-14 must not have landed | ✅ `git log --grep="feat(redesign): C-14"` empty; `src/lib/booking/working-hours-segments.ts` absent |

**Baselines inherited from C-18 §5.3, by identity:** tsc 0 · build clean 54/54 static · vitest **5 failed / 1975 passed (1980)**, failures exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 · eslint **59E/7W** in exactly the six baseline files. **Three of the five vitest failures sit in `ManualBookingForm.test.tsx`, this plan's primary edited file** — so every "prove nothing changed" run diffs against those three named failures, never against green.

### 0.1 — ⚠️ Pre-flight #3 came back non-empty. Plan-vs-reality contradiction, STOPPED, Owner resolved.

The plan's assertion (`plan:30`) requires `git diff master redesign/start-state --stat -- src/lib/booking/availability.ts src/app/api/availability/` to be **empty**, and states: *"Non-empty output → the parity premise broke — stop and surface to the user."* It returned:

```
src/app/api/availability/month/route.ts |  17 ---
src/app/api/availability/route.test.ts  | 177 ---
src/app/api/availability/route.ts       |  15 ---
3 files changed, 209 deletions(-)
```

**Diagnosed before surfacing, and the premise it protects is intact:**
- **`src/lib/booking/availability.ts` is absent from the diff — the engine is byte-identical.** Every C-23 Phase B anchor therefore still holds exactly (confirmed in §0.3).
- **Zero insertions.** Every line is a deletion in the master→start-state direction, i.e. master is strictly *ahead*; start-state contains nothing master lacks. The property the port gate exists to protect — *master has everything start-state has* — holds perfectly.
- **The entire 209-line divergence is C-22's rate limiting**, added to master after the `ea97932` merge. Confirmed by reading the hunks: both route files gain the `// C-22 Step 4a (D23)` import + `checkRateLimit` guard block, and `route.test.ts` is 177 lines of C-22's rate-limit tests. **This plan's own header told us to check for exactly this** ("C-22 (D23) adds rate limiting to the public `/api/availability*` routes — check `git log --oneline --grep=\"feat(redesign): C-22\"` before touching those files"). C-22 is shipped: `a63de0b`, `ceb028d`.

**Owner decision 2026-08-04, in chat: amend the gate to its actual intent.** The blocking assertion (pre-flight #3 and gate §3.2) becomes **"the diff has ZERO INSERTIONS"** — start-state contains nothing master lacks — rather than "the diff is empty". The literal empty-diff form is now permanently unsatisfiable, because C-22 is shipped and staying, and the merge the gate was originally protecting already happened at `ea97932`. Rejected alternative: porting C-22's rate limiting onto `redesign/start-state` purely to restore literal parity — writing to a branch outside this plan's scope to satisfy a check whose purpose is already served.

**Gate §3.2 is therefore re-stated as:** `git diff master redesign/start-state -- src/lib/booking/availability.ts src/app/api/availability/` shows **zero insertions**, and `src/lib/booking/availability.ts` specifically is **byte-identical**. Both true at `7b1db05`.

### 0.2 — ⛔ Pre-flight #4 — HELD, awaiting Owner approval

Plan `:34-39`. Submitting three real admin bookings end-to-end against the **production** database, via the live admin form (no SQL), to capture the behavioural baseline that blocking gate §3.3 compares against. Fixture guard: `*.example.test` clients and standard test staff only; every created row id recorded here for cleanup; Badar's `9d55ce2a` and all real customer rows untouched.

**Two blockers, both surfaced in chat:**
1. **No agent may authenticate** (password entry is prohibited; protocol §3b records the same). The Owner authorised agents to use the admin logins directly on 2026-08-04; **that authorisation cannot be accepted** — the prohibition holds regardless of who grants it. **Substitute offered:** the Owner signs in once in their own Chrome and the orchestrator drives the already-authenticated session, which is not credential entry.
2. **Open question raised with the ⛔, not yet answered:** does completing an admin booking send a real confirmation email? If so that is a second Zone-2 trigger (rule 2's effect-based catch-all). `*.example.test` addresses do not receive mail, but the send would still occur.

**Re-sequencing proposed to the Owner, not acted on unilaterally:** pre-flight #4's baseline is load-bearing only for gate §3.3, which compares the admin form's *submitted payload* before and after. Phases B and C do not touch that form — B adds a defaulted options bag to the engine plus a new admin route, C builds a component that is not wired in until Phase D. So the baseline could be captured after B and C and remain a valid "before", provided the diff confirms `ManualBookingForm.tsx` was untouched (trivially checkable). That would unblock 3 of 5 commits. **Awaiting the Owner's decision; nothing proceeds without it.**

### 0.3 — Anchors, re-located by symbol (plan line numbers are 2026-07-16 vintage)

The divergence is instructive: **`availability.ts` has not moved a single line since `ea97932`**, so every Phase B anchor is exact — while `ManualBookingForm.tsx` grew **2,019 → 2,254 lines** under C-02/C-03/C-06.

| Anchor | Plan cites | Actual at `7b1db05` | |
|---|---|---|---|
| `calculateAvailableDays` | 867 | **867** | exact |
| `booking_status_enabled` early return | 887-889 | **887** | exact |
| `datesInWindow` filter | 896-904 | **896** | exact |
| `ignoreBookingWindow` / `ignorePublicPause` | — | **absent** | correct; Phase B adds them |
| `bookingDate` / `startTime` / `overrideAvailability` state | ~527-530 | **593-595** | drifted |
| `canCheckAvailability` | 665 | **742** | drifted |
| `checkAvailability` useCallback | — | **748** | |
| hidden `booking_date` / `override_availability` inputs | — | **1075 / 1078** | |
| the three `type="date"` branches | 1445 / 1498 / 1630 | **1639 / 1692 / 1824** | drifted; **still exactly three** |
| `getStaffProfile` | `rbac.ts:308` | **`rbac.ts:340`** | drifted |
| `src/app/api/admin/` | expected absent | **absent** | Step 4 creates the first route there |

### 0.4 — Verification tiers and model routing, declared in advance (§2.9c, §5)

| Phase | Tier | Model | Why |
|---|---|---|---|
| A | verify-only, no commit | — | Superseded by C23-F1/D25 — a commit here would be empty |
| B — engine options + admin route | **FULL** | **opus** | `availability.ts` and `/api/availability/month` serve the **LIVE public customer calendar** (`ScheduleStep.tsx:94-104`, unauthenticated, service-role). D25 makes this a production customer surface, not a dormant port |
| C — calendar component + month hook | TARGETED | sonnet | Presentational component plus a cache/abort hook, not wired in until Phase D |
| D — wire the three branches | **FULL** | **opus** | Where payload identity is actually at risk, on a shared file five Band-C plans edit |
| E — closeout | FULL | sonnet fan-out | Three blocking gates (§3.2, §3.3, §3.4), none waivable |

---

## 1 — Phase B (Steps 3–4) — **VERIFIED FULL — PASS**

| Commit | What | Model |
|---|---|---|
| `61111ee` | Step 3 — additive `{ ignoreBookingWindow?, ignorePublicPause? }` on `calculateAvailableDays`; two guarded sites; defaults preserve behaviour | `opus` |
| `16c700e` | Step 4 — `POST /api/admin/availability/month`, authenticated + permission-gated; first route under `src/app/api/admin/` | `opus` |

**Opus justification (§5):** `availability.ts` and `/api/availability/month` serve the **live public customer calendar** (`ScheduleStep.tsx:94-104`, unauthenticated, service-role) — decision D25 makes this a production customer surface.

**How "nothing changed" was actually proved** (not asserted): the implementer wrote `src/lib/booking/__tests__/availability-options.test.ts` **first**, ran it against the **unmodified** engine so its `FROZEN_DEFAULTS` literal is captured pre-change output, and observed the two new-behaviour assertions failing red before editing. The clock is frozen with `toFake: ["Date"]` only, so the guard test genuinely calls `calculateAvailableDays(input, client)` with **two arguments**, exactly as the one production caller does.

### Independent verification (FULL, fresh verifier, `model: sonnet`) — `redesign/evidence/C-23/phase-b-verify-full.md`
- **Options-omitted path CONFIRMED by executed mutation testing**, not by reading: a scratchpad harness ran the real test shape against two hostile mutant engines plus an unmutated control. Control **7/7 pass**; guard 1 broken (`&&`→`||`) → **5/7 fail**; guard 2 broken (`||`→`&&`) → **4/7 fail** — both regression guards catching it each time. `FROZEN_DEFAULTS` confirmed a genuine literal, not derived from the function under test.
- **Diff minimality CONFIRMED** — the +14/−7 in `availability.ts` is fully accounted for by the two guards plus the type-literal expansion. `calculateAvailableSlots` and both public routes **byte-unchanged** in both commits.
- **`ManualBookingForm.tsx` absent from both commits** (`git show --stat`) — the condition the Owner's re-sequencing approval rests on.
- **Admin route:** auth ordering correct (`getStaffProfile()` before `createSupabaseAdminClient()`); tests exercise real branches with non-tautological assertions; zod shape and `datesOfMonth` byte-identical to the public route and timezone/leap-year safe (pure UTC arithmetic); the rate-limit omission is deliberate, commented and tested.
- **Gates by identity:** tsc 0 · new suites 18/18 · full vitest **5 failed / 1993 passed (1998)**, identities exact · eslint 59E/7W in exactly the six baseline files · isolation clean.

### Two corrections the verifier made
1. **The orchestrator's dispatch was imprecise about the permission gate.** It claimed `createManualBooking` uses the broader `canManageBookings`. It does not — a second explicit check at `src/app/admin/bookings/actions.ts:1471` enforces `canManageAllBookings` and overrides the broader first check. **All three surfaces — page render, actual submission, and the new route — converge on the same permission.** The implementer's choice of `canManageAllBookings` is coherent for a better reason than either agent originally gave.
2. **Gate §3.2 was re-run in the wrong place, by orchestrator error.** It is a **pre-condition** — the plan requires the parity diff be clean *before Phase B starts*, and it was (§0.1). Re-running it *after* Phase B is meaningless, because Phase B intentionally edits `availability.ts` on master. The 7 "insertions" the post-hoc run reports are git rendering an inline additive edit as delete+add; every one is character-for-character identical to pre-Phase-B code. **No code defect. Do not re-run this gate again — it is spent.**

### Judgement calls recorded
- **`datesOfMonth` duplicated (8 lines)** rather than exported from the live public route — declining to edit a customer-facing file for a non-behavioural reason. The brief's "no duplicated logic" requirement is about the availability **engine**, which is fully reused. Verifier confirmed the duplicate is behaviourally byte-equivalent.
- **`calculateAvailableDays` now has two production callers by design** (the public month route and the new admin route). `calculateAvailableSlots` still has exactly one and its contract is untouched.

## 2 — Phase C (Steps 5–6) — IMPLEMENTED, **NOT YET INDEPENDENTLY VERIFIED**

| Commit | What | Model |
|---|---|---|
| `a345d99` | Step 5 `AvailabilityCalendarField.tsx` (+11 tests) · Step 6 `use-month-availability.ts` (+3 tests) | `sonnet` |

All four files are **new**; nothing existing was edited. `ManualBookingForm.tsx` and the public flow are absent from the diff (`git show a345d99 --stat`).

**Self-gates at `a345d99`:** tsc 0 · new suites 14/14 · full vitest **5 failed / 2007 passed (2012)**, identities exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 · eslint 59E/7W, none of the four new files appearing. Bundle not measured (builds forbidden to agents this session — see §3.1); the component is wired nowhere yet, so its route delta is structurally 0 this phase.

**The admin-idiom gap, solved deliberately.** `CalendarDatePopover.tsx` — Step 5's stylistic reference — uses **no** `disabled`, `modifiers` or `modifiersClassNames`, and the only in-repo precedent for that combination is the **public** `DatePickerField.tsx`, which does exactly what Step 5 forbids. So there was no admin precedent to copy. Marker styling was built from `--admin-*` tokens directly, reusing the `--admin-status-confirmed-*` / `--admin-status-attention-*` tokens `AdminStatusBadge` already uses, with `--rdp-*` custom properties nudged via Tailwind arbitrary properties rather than a new CSS module. Documented in a header comment.

**Non-colour encoding (gate §3.9) — two independent mechanisms:** a custom `DayButton` rendering a distinct shape glyph (filled circle = available, rotated square = partial), and `labels.labelDayButton` wrapping react-day-picker's own default label function so the availability suffix reaches the `aria-label` without losing the library's today/selected text.

---

# ▶▶ INTERRUPT CHECKPOINT — 2026-08-04 — READ THIS FIRST ON RESUME

**Owner ended the session here deliberately to continue in a fresh one. Nothing is mid-flight; no agent is running; the tree is clean over every C-23 path.**

| Field | Value |
|---|---|
| Plan | **C-23** (admin availability calendar) |
| Phase / step | **Phase C (Steps 5–6) committed. NOT independently verified.** Phase D (Steps 7–10) not started |
| Last-good commit | **`a345d99`** — this checkpoint commit follows it |
| Files mid-flight | **NONE.** Only `src/lib/maintenance.ts` (standing Owner change — never stage) |
| Programme | **18 plans shipped ✅** (counted directly from the master-plan checklist, not from memory). **5 remain:** C-23 (in progress), C-19, C-14, C-10, C-20. Note the "22" in the §4 order table counts C-17+C-18 as ONE row, so "N of 22" and "N plans shipped" are different denominators — an earlier chat statement of "19 of 22" was wrong; 18 shipped is the verified figure |

### EXACT NEXT ACTION
**Dispatch a TARGETED-tier independent verifier for Phase C** (`a345d99`), `model: sonnet`, writing to `redesign/evidence/C-23/phase-c-verify.md`. Tier TARGETED was declared in advance (§0.4) because the component is presentational and wired nowhere. Lead it on:
1. **`disabled` never exceeds `{ before: min }`** — the calendar must *inform*, never block. An operator with a requested date in hand must always be able to pick it (brief finding 3).
2. **Marker resolution** — 2 cohorts: both → available, exactly one → **partial**, neither → de-emphasised; 1 cohort: available / de-emphasised.
3. **Non-colour encoding genuinely reaches assistive tech** — verify the `aria-label` suffix and the shape glyph, and that wrapping `labelDayButton` did not drop react-day-picker's own today/selected text.
4. **The hook** — cache keyed `month|services|genders|city`, `AbortController` firing on key change *and* unmount, failure → `null` (silent, unmarked), and `enabled` introducing **no new preconditions** (brief finding 4).
5. **Renders unmarked but not broken** when `cohorts` is empty or `loading`.

### THEN Phase D — and it is ⛔ BLOCKED
Phase D (Steps 7–9) rewires the three date-input branches. **It must not start until the ⛔ behavioural baseline in §0.2 is captured**, because gate §3.3 compares the admin form's submitted payload before and after, and Phase D is what changes it. Phases B and C were explicitly allowed ahead of the baseline *because they leave `ManualBookingForm.tsx` untouched* — verified true for both.

**Branch anchors for Phase D, re-verified at `7b1db05`** (the plan's 1445/1498/1630 are stale):
| Branch | Line | Condition | `onChange` |
|---|---|---|---|
| single/same-gender | **1639** | `canCheckAvailability && !overrideAvailability && !isMixedGenderGroup` | `const d = e.target.value; setBookingDate(d); setStartTime(""); if (d) checkAvailability(d);` |
| mixed-gender | **1692** | `canCheckAvailability && !overrideAvailability && !femaleOverride && !maleOverride && isMixedGenderGroup` | identical to above |
| fallback/override | **1824** | `overrideAvailability \|\| (isMixedGenderGroup && (femaleOverride \|\| maleOverride))` — **not** `!canCheckAvailability` as the plan says | `(e) => setBookingDate(e.target.value)` — **materially different: no `setStartTime("")`, no `checkAvailability`** |

**⚠️ That third row is a real trap.** Step 7 requires the replacement to run an *identical* handler body, and branch 3's body is genuinely different. Copy-pasting branch 1's handler into branch 3 would silently change behaviour. Step 9 explicitly permits keeping branch 3's plain `AdminInput` (zero risk, recommended) — **record whichever choice is made.**

Full surface map, including the 13-item non-removal checklist with a `file:line` for every item: `redesign/evidence/C-23/implementation-surface-map.md`.

### INHERITED BASELINE — BY IDENTITY (use this, never plan text)
- tsc **0 errors** · build clean; public routes prerendered.
- vitest → failures exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3. Totals at `a345d99`: **5 failed / 2007 passed (2012)**. **Judge by identity, never by count.** Three of the five sit in `ManualBookingForm.test.tsx` — Phase D's primary file — so diff the named failure list, never the exit code.
- eslint → **59 errors / 7 warnings** in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`.
- The plan's own §0/§3 baseline text (485/491, six failures incl. `createBookingTransaction`) is a **frozen 2026-07 snapshot and is superseded**.

## 3 — Standing facts a fresh session must not relearn the hard way

- **`src/lib/maintenance.ts` is deliberately dirty** (`MAINTENANCE_MODE = false`, Owner-authorised). Never stage, commit or revert it; exclude from isolation checks. **HEAD carries `true`** — for any claim about *deployed* behaviour read `git show HEAD:<path>`, never the working tree. That distinction already caused one false public statement in C-18.
- **The dev server is Owner-run** at `localhost:3000` (never `127.0.0.1`). Agents must never spawn, restart or kill it. `/` 308s to `/home/`; paths 308 to trailing-slash form — normal.

### 3.1 — Agents must NOT run production builds
`pnpm build` / `next build` in this tree while `next dev` holds it **knocked the Owner's dev server over twice** in this session. Builds were banned in every later dispatch and run **once by the orchestrator, last** — which the server survived (200 in 0.13 s immediately after). Keep that rule.

### 3.2 — No in-place mutation testing while another agent runs
A prep agent read a verifier's transient in-place mutation as a shipped defect and reported a green phase as broken. It was not: the committed blob and working tree were byte-identical and the suite was green. **Scratchpad copies only.** Later agents complied and proved non-vacuity via scratchpad harnesses instead.

### 3.3 — The agent cannot authenticate, and Owner authorisation does not change it
The Owner authorised agents to use the admin logins directly (repeatedly, 2026-08-04). **That authorisation cannot be accepted** — entering a password is prohibited for the agent regardless of who grants it, which protocol §3b records independently. **The workable substitute, offered and not yet completed: the Owner signs in once at `http://localhost:3000/admin/login/` in their own Chrome, and the orchestrator drives that already-authenticated session** (operating a session the Owner created is not credential entry). A tab was left open at `/admin/login/?redirectTo=%2Fadmin%2Fdashboard%2F`. As of session end **no session existed** — a probe of `/admin/dashboard/` still redirected to login. The Owner's earlier "I logged in" referred to a tab sitting on `http://localhost:3000/home/admin/`, which is a 404 (`/home/admin/`, not `/admin/`).

**Blocked on that single sign-in:** C-23's ⛔ baseline (§0.2) and **all** of C-10 Phase A.

### 3.4 — Addendum: what changed after the checkpoint commit (`0ade989`)

Recorded at the Owner's request as the closing act of the session. **No code changed** — everything below is state, decisions and one correction.

**C-19 is now FULLY UNBLOCKED.** The controller identity arrived and was **verified against Companies House** rather than taken on trust: **`RAHMATHERAPY LIMITED`, company number `16769945`** — Active, private limited company, incorporated 7 October 2025. With contact details and retention already answered, all three of C-19's ⏸ inputs are closed. It needs nothing further from the Owner and is the most immediately runnable plan remaining: one new file, one commit. Detail in `C-19-privacy-policy-page-progress.md` §1.1.

**C-20's key blocker is cleared, but a security item replaced it.** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is now in `.env` — verified present, 39 chars, `AIza` prefix, not a placeholder, with `.env` confirmed gitignored and untracked. Pre-flight #3 will now pass. **However, a live key was pasted into the chat transcript during this session** (embedded twice in a Google reference snippet the Owner shared), so the ⏸ rotation decision the plan already carried is now materially more urgent. Whether the key in `.env` is that same one is **unconfirmed — no agent read the value.** See the C-20 row in `OWNER-ACTION-BACKLOG.md`.

**Two proposed shortcuts for C-20 were assessed and rejected, with reasons**, so a future session does not re-litigate them:
- **Google's sample HTML** (the Quick Builder "Address Selection" page) — requests the `name` field, which is **Pro tier**: free allowance halves 10,000→5,000/month and unit price triples $5→$17 per 1,000. Also US-shaped (`administrative_area_level_1`/`postal_code` rather than `postal_town`/`administrative_area_level_2`), hardcodes the key, loads from a CDN, uses `window.alert`, has no session tokens, no debounce and no `componentRestrictions:{country:'gb'}`. It is the same snippet the plan already quotes **and corrects**.
- **Embedding Google's hosted demo in an `<iframe>`** — fatal on its own: the iframe is cross-origin (`storage.googleapis.com`), so the parent page **cannot read the selected address**, and that page does not `postMessage`. The four form fields would stay empty. It would also **break C-18's regulator test** by loading Google code before any consent, depends on an SLA-less demo bucket, renders its own US-shaped form, and exposes a key in a page the Owner cannot rotate.

**`NEXT_PUBLIC_GA_MEASUREMENT_ID` does NOT belong in local `.env`** — question raised and settled. `GoogleAnalytics.tsx:47-48` gates on three conditions: the ID is set, `NODE_ENV === "production"`, **and** stored consent grants analytics. `next dev` is always development, so setting it locally has no effect whatever; that is deliberate, so dev and test runs never pollute real analytics. It is needed **only in the Cloudflare BUILD environment** (already tracked), because `NEXT_PUBLIC_*` is inlined at build time.

**Programme count corrected.** A chat statement of "19 of 22" was wrong. Verified by counting the master-plan checklist directly: **18 plans shipped**, 5 remaining.

**Environment at session end:** dev server **DOWN** (`curl` → 000; needs `pnpm dev`). **No admin session exists.** Working tree clean over `src/` and `supabase/` apart from the standing `maintenance.ts` change. HEAD `0ade989` at the time of writing.

**Nothing was left uncommitted.** The only modified tracked file is `src/lib/maintenance.ts` (never to be staged); all other working-tree entries are pre-existing untracked material from earlier plans (C-21 evidence screenshots, `design_handoff_area_pages/`, `photos-rahma-therapy/`, `test-results/`), none of it produced by this session.
