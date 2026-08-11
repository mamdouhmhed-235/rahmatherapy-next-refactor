---

## 10 — Ordering, collisions and prerequisites

### 10.1 The collision matrix — every file two or more items touch

Derived by reading each item's file list and verifying each file exists and carries the named symbol. `oklch(` figures are **occurrence** counts (`grep -o`) where re-counted; where only a line count was taken it says so. *(Corrected 2026-08-11 — the previous revision mixed the two methods silently; see §7.2.)*

| File | Items | Nature of the collision |
|---|---|---|
| `src/lib/email/notifications.ts` | **1, 8** | Different functions ~230–1,100 lines apart. Item 1 edits `sendReviewRequestEmail` (`:1356`) and adds new exports; item 8 edits `BOOKING_EMAIL_SELECT` (`:123`) and `getBookingTemplateInput` (`:216`). Not logically incompatible — but item 1 lands first, so **item 8 must re-grep both symbols before editing** |
| `src/app/admin/emails/page.tsx` | **1, 7** | Item 1 adds a manual-send surface; item 7 token-drives 17 literal-lines / 29 occurrences. Item 1 lands first, so item 7 re-greps |
| `src/app/admin/settings/SettingsForm.tsx` | **7, 8** | Same component (`ServiceAreaField`). 22 lines / 37 occurrences |
| `src/app/admin/bookings/BookingManagementForm.tsx` | **7, 8** | Same section (`StatusAndPaymentSection`). 9 lines / 13 occurrences |
| `src/app/admin/bookings/[bookingId]/page.tsx` | **7, 8** | Item 8 adds a town-list fetch to `getBookingDetailData`. 13 lines / 21 occurrences |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | **7, 8** | **NEW, previously undocumented.** Highest-literal file in the tree (57 lines / 79 occurrences). It consumes `allowedCities`, derives `isCityKnown`, and renders an advisory warning whose copy becomes **false** under item 8 — on a line carrying item 7's #1 literal |
| `src/app/admin/bookings/series/[templateId]/SeriesActions.tsx` | **7, 8** | 1 literal-line, item 7 "long tail". Item 8 builds the series travel-charge control here |
| `src/app/admin/availability/page.tsx` | **3, 6, 7** | Query blocks (3, 6) then substitution (7). 7 lines / 8 occurrences |
| `src/app/admin/staff/[staffId]/availability/lib.ts` | **6, 7** | 9 lines / 9 occurrences |
| `src/app/admin/availability/AvailabilityOverridesManager.tsx` | **6, 7** | 6 lines / 7 occurrences |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` | **6, 7** | 1 line / 2 occurrences |
| `src/app/admin/staff/[staffId]/availability/page.tsx` | **3, 6** | **Zero literals** — item 7 never needs to touch it |
| `src/app/admin/availability/availability-data.ts` | **6** | **Zero literals** — same |
| `src/components/ui/{button,input,badge}.tsx` | **7 edits · 8 consumes** | Not a co-edit. Item 7 edits them; `/booking/manage` renders the result — see §10.2 |
| `src/features/booking/BookingExperience.tsx`, `BookingExperienceLoader.tsx` | **8 · lint baseline** | Item 8's own specified edits will shift the line numbers of pre-existing lint errors. See §11.3 |
| `public.bookings` (table) | **4, 8** | Different DDL (indexes vs a column). No logical conflict; Postgres serialises DDL on the table. Apply item 4 first so its `pg_indexes` check is not muddied |
| `supabase/migrations/` | **4, 8** | Up to 6 new files between them. Filename allocation rule in §11.5 |

**Checked and confirmed NOT a collision** (so nobody re-checks them): item 2 × item 8 on public copy — one incidental match, `"town or city, area and postcode"`, in the privacy page's data-collected list, unrelated. `AdminTopNav.tsx` × items 3/6 — items 3 and 6 never reference that file; the earlier claim that they did was wrong and was already retracted. `src/app/admin/emails/**` × item 8 — item 8 has zero references into that directory.

### 10.2 ⛔ The ordering defect, and the fix *(corrected 2026-08-11)*

The previous revision's order ran **item 7 at position 7 and item 8 at position 8**. That is wrong for five files.

Item 7's Phase B cannot "finish" `SettingsForm.tsx`, `BookingManagementForm.tsx`, `bookings/[bookingId]/page.tsx`, `ManualBookingForm.tsx` or `SeriesActions.tsx` before item 8 has added its new fields to them — because item 8's new UI would then ship with untokenized literals in files item 7 had already declared done, and the Phase C ratchet would immediately regress.

**The fix is to split item 7's Phase B, not to swap the two items.** Item 7 keeps its position; the batches touching those five shared files are carved out and scheduled as a **final trailing commit after item 8**. Everything else in item 7 runs where it always did.

*`ManualBookingForm.tsx` is the one that could defensibly go either way — item 8 only rewords existing copy there rather than adding new UI, so item 7 could tokenize it first. It is grouped with the other four anyway, because one rule ("these five files, after item 8") is safer to execute than a rule with an exception.*

### 10.3 The corrected order

| Order | # | Commit | Gate |
|---|---|---|---|
| — | **7 Phase 0** | Theme resolution (§7.5b). Disjoint from every other item's files — `tokens.css`, `site-parity.css`, `layout.tsx`, the Layer-2 verifier. **Can run at any point, including first.** Steps 0.1/0.2/0.4/0.5 are safe; **Step 0.3 has its own ⛔** | Step 0.3 stop-and-ask |
| 1 | 3 | `fix(availability): order override lists by start_time within a date` | |
| 2 | 6 | `fix(availability): count and cap adjustment lists by date, not segment row` | after 3 (file contention, **not** correctness — §10.3) |
| 3 | 2 | `fix(privacy): describe retention by criteria rather than a schedule we do not enforce` | |
| 4 | 4 | `chore(supabase): bookings indexes for projected query shapes` | ⛔ Zone-2 |
| 5 | 1 | `feat(email): cap review requests to once per client per 6 months + manual admin send` | |
| 6 | **7 Phases A–B** | Admin theming, **except** the five files shared with item 8 | after 3, 6 |
| 7 | 8 | Travel-charge model — multiple commits, phases 1→2→3(+5 chip gating)→4 | ⛔ Zone-2 ×5 |
| 8 | **7 Phase B tail + Phase C** | The five shared files, then the ratchet guard flipped to zero-tolerance | after 8 |
| 9 | 5 | `chore(tooling): auto-discover routes in the bundle measurement script + re-baseline` | needs the one `pnpm build` |

**Item 5 moved to last** *(changed 2026-08-11)*. It has no code dependency on anything, but its whole purpose is a re-baseline — and a baseline taken before items 7 and 8 change the admin and public bundle shape undercounts exactly what this plan adds. Its `pnpm build` also disturbs the Owner's dev server (§5.4), so doing it once, at the end, is cheapest.

**Dependency edges, each with its reason:**
- **3 → 6** — **file contention only** *(corrected 2026-08-11)*. The previous revision called item 3 a *correctness* prerequisite, on the grounds that "grouping is only deterministic once a date's segments are contiguous and in time order". **That reasoning is false:** `ORDER BY override_date` alone already makes same-date rows contiguous, and both `groupByDate` implementations are `Map`-keyed — they merge same-date rows correctly regardless of array order, and sort each day's segments by `start_time` internally. Item 6's truncation detector (`rowTotal > rowsFetched`) is an exact-count comparison and is order-independent too. So item 3 buys item 6 **nothing** in correctness. The edge survives because the two items edit the same query blocks in the same files, and doing them concurrently is how they corrupt each other. **Ship 3 first, then 6 — but if 3 slips, 6 is not blocked on it.**
- **(3, 6) → 7 Phase B** on four availability files — editing query/grouping logic and colour in the same lines at the same time is how two efforts corrupt each other.
- **1 → 8** on `notifications.ts` — same file, different functions; the second one in re-greps.
- **8 → 7 Phase B tail** on five files — §10.2.
- **8 Phase 1 → 8 Phase 2** — the form must have a setting to read.
- **8 Phase 3 ⇄ 8 Phase 5 chip-gating** — these must land **together**; see the stop condition in §10.5.

**Safe to run in parallel:** item 2 with anything; item 4 with anything in code; item 7 Phase 0 (Steps 0.1, 0.2, 0.4, 0.5) with items 1–6 and item 8's early phases — its file list intersects nothing.

### 10.4 One coherent unit per commit

Never batch items. Items 3 and 6 touch the same files and must not run concurrently with each other.

### 10.5 Abandon-safety — where stopping midway is fine, and where it is not

| Item | Safe to stop at a commit boundary? | The dangerous point |
|---|---|---|
| 1 | Yes | **Not** mid-`sendReviewRequestEmail`: the "do not write the sentinel on a cooldown skip" change must land atomically, or a booking is permanently retired |
| 2 | Yes, fully | — |
| 3 | Yes, per query | Five independent `.order()` additions |
| 4 | N/A — one atomic migration | — |
| 5 | Yes | Leaves `.next/` rebuilt; `bundle-pre-B1.json` is explicitly protected |
| 6 | **No** between the page query change and the Manager change | The component would render the wrong number or crash on a shape mismatch — which is precisely the failure mode §6.5 exists to prevent. **Treat each tree as one atomic commit** |
| 7 Phase 0 | Steps 0.1/0.2 yes, each revertable | **Step 0.3 must not be started and abandoned** — a site-wide, unverified visual change with no before/after proof |
| 7 Phase A/B | Yes at any commit boundary | **Not** mid-file with a background substituted and its paired foreground not |
| 8 | **Only at a phase boundary, in phase order** | See below |

**⛔ STOP CONDITION — item 8's most dangerous partial state.** If Phase 3 (`travel_fee` on bookings) lands but Phase 5's quick-confirm chip gating does not, an admin can one-click confirm an out-of-zone booking with `travel_fee = 0`, sending a confirmation email with no fee — and that fee is then **locked** the moment the booking is completed or fully paid, permanently losing the charge. **Phase 3 and Phase 5's chip gating ship together or neither ships.** The previous revision carried this as a parenthetical ordering note; it is a stop condition.

---

## 11 — Verification gates (whole plan)

### 11.1 The two gate blocks

**FULL — before starting, and before calling any item done:**

```powershell
git branch --show-current                    # master
git log --oneline -1
git status --porcelain -- src/ supabase/     # exactly:  M src/lib/maintenance.ts
npx tsc --noEmit                             # 0, silent, exit 0
npx vitest run                               # 5 failed / 2236 passed (2241) — the five by name
pnpm lint                                    # 59 errors / 7 warnings, the six files, by {file,ruleId}
```

**FAST — between batches within one item:**

```powershell
npx tsc --noEmit
npx vitest run <touched-path-or-directory>
pnpm lint <touched-path-or-directory>
```

A scoped run proves the files you touched are locally clean. **It is not the gate.** It cannot see a broken shared type, an import cycle, or a second consumer of a renamed symbol. Run the FULL block before closing an item.

### 11.2 vitest identity, and the flake procedure *(new — the previous revision stated the conclusion but not the method)*

The five baseline failures, by name:

- `src/lib/auth/admin-access.test.ts` — *"gives Owner broad access while keeping owner-only role actions permission-gated"*, *"gives Admin broad operational access without role template management"*
- `src/app/admin/bookings/new/ManualBookingForm.test.tsx` — *"renders step 1 on first load"*, *"moves focus to the first invalid field when continuing with errors"*, *"shows the consent error when trying to create booking without consent"*

None of the eight items touches `admin-access.ts` or `ManualBookingForm.tsx`'s test, so **all five must reproduce unchanged in every batch's post-check.**

A **sixth** failure — `ManualBookingForm > optional email > "still rejects a malformed email, and stops rejecting it once cleared"`, timing out at 5000ms — appears intermittently under full-suite load. There is no `testTimeout` override in `vitest.config.ts`, so the default 5000ms applies; this is resource contention, not a code fault. **Do not report it as a regression until you have run:**

```powershell
npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx   # exactly 3 failed / 33 passed (36)
npx vitest run src/lib/auth/admin-access.test.ts                       # exactly 2 failed / 4 passed (6)
```

If isolation reproduces exactly 3 and exactly 2, the extra failure was the flake. If it reproduces anything else, stop and report.

### 11.3 The lint identity key *(new — and it matters for item 8)*

`pnpm lint` → **59 errors / 7 warnings**, exit 1, in exactly six files:

| File | E | W | Rules |
|---|---:|---:|---|
| `design_handoff_area_pages/prototype/area-page.jsx` | 48 | 1 | `react/jsx-no-undef` ×47, `react/no-unescaped-entities` ×1 |
| `design_handoff_area_pages/prototype/shared.jsx` | 2 | 5 | `jsx-no-undef` ×2; `@next/next/no-img-element` ×4, `no-unused-vars` ×1 |
| `design_handoff_area_pages/prototype/site-chrome.jsx` | 5 | 0 | `jsx-no-undef` ×5 |
| `src/features/booking/BookingExperience.tsx` | 3 | 0 | `react-hooks/set-state-in-effect` (L201), `react-hooks/immutability` (L253), `set-state-in-effect` (L340) |
| `src/features/booking/BookingExperienceLoader.tsx` | 1 | 0 | `react-hooks/set-state-in-effect` (L34) |
| `src/features/booking/utils/returning-customer.ts` | 0 | 1 | `@typescript-eslint/no-unused-vars` (L61, `_savedAt`) |

**⚠️ Item 8 edits two of these files, and its own specified edits guarantee the line numbers move.** `BookingExperienceLoader.tsx`'s single error sits at L34 — directly *between* the two edit sites item 8 names (`:23-26` and `:89-93`). Adding a destructured prop pushes it down. That is a certainty, not a risk.

**So identity is keyed on the multiset of `{file, ruleId}` with counts — not on `file:line:column`.** After editing, `BookingExperience.tsx` must still show exactly 2× `set-state-in-effect` + 1× `immutability`, and `BookingExperienceLoader.tsx` exactly 1× `set-state-in-effect`. Line numbers are read by eye as a plausibility check (did the error move by roughly the number of lines inserted above it, or did it jump into a different function?) — never as the automated pass/fail key.

**Do not "fix" those four pre-existing errors as a drive-by** (§0.2). It would change the very baseline the gate checks.

`redesign/**` is excluded from lint entirely (`eslint.config.mjs` `globalIgnores`), so evidence files can never pollute the baseline. Files written **anywhere else** still can — which is why read-only agents must be told their single permitted write path explicitly.

### 11.4 The three contrast layers *(exit-code behaviour is new)*

```powershell
node scripts/measure-admin-contrast.mjs .        # 456 failures (377 dark / 79 light), 239 unresolved  (~0.9s)
node scripts/verify-admin-token-contrast.mjs     # 1 failure: --admin-warning vs --admin-warning-bg 3.41:1 light  (~0.4s)
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
```

**Do not rebuild these. They exist and work.**

- **⚠️ Both node scripts exit `0` regardless of how many failures they report, unless `--max-failures=N` is passed.** A bare invocation can never gate anything. Flags: positional root dir, `--json`, `--theme=dark|light`, `--max-failures=N`. Neither script writes a file.
- The Playwright command above is the correct one. *(Corrected 2026-08-11 — §7.9 previously said `--env-file=.env.e2e` and `node_modules/playwright/cli.js`; **neither exists.** `.env.example` carries the same two stale errors and is worth a separate follow-up.)*
- `--list` is safe: no login, no writes, 6 tests.
- `e2e/admin-contrast.spec.ts` pins `test.use({ channel: "chrome" })` because the bundled Chromium revision is missing. **Keep the pin.**
- The full sweep **writes** `redesign/evidence/admin-contrast/<ROLE>-<theme>.md` (tracked) plus untracked `test-results/`. It needs real credentials, so it is **orchestrator/Owner work, never a subagent's.**

### 11.5 Migration filename allocation *(new)*

Convention is `supabase/migrations/YYYYMMDDHHMMSS_<slug>.sql`. The newest existing file is `20260809160000_c14_override_breaks.sql`.

Items 4 and 8 together mint up to **six** new migrations. Before authoring any of them:

```powershell
Get-ChildItem supabase/migrations | Select-Object -Last 3
```

Mint each filename **after** the newest existing timestamp and **at least 60 seconds apart from each other**, in the order they are meant to apply. Generating several with a back-to-back `date +%Y%m%d%H%M%S` can collide within the same second.

### 11.6 Test conventions — copy these, do not invent

- **Where a test lives:** components get a **sibling** `<Name>.test.tsx` in the same directory; page/data/action modules get `__tests__/<name>.test.ts` beside them. Both patterns coexist in the same tree.
- **There are zero snapshot files in this repo** — no `*.snap`, no `toMatchSnapshot`, no `toMatchInlineSnapshot`, anywhere in `src/`, `scripts/` or `e2e/`. No item in this plan needs a snapshot update. Stated so nobody goes hunting for a `__snapshots__/` directory.
- **Mailer:** `vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(), getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"), extractEmailAddress: vi.fn((v: string) => v) }))`. Note the `*.example.test` TLD — rule 2.
- **Supabase:** mock the **factory** (`vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }))`), then hand-build a `.from()` stub per test. Functions that take `supabase` as a *parameter* get the stub passed directly instead.
- **RBAC:** `vi.mock("@/lib/auth/rbac", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/auth/rbac")>()), getStaffProfile: vi.fn() }))` — the **real** permission logic runs; only identity is a fixture.
- **Useful precedents to mirror:** `src/app/admin/bookings/__tests__/updateBookingManagement-completed-guard.test.ts` (the exact shape for a status/payment lock guard — item 8); `src/app/admin/availability/__tests__/page.test.ts` (a grouping helper tested as a pure function — item 6); `src/content/site/__tests__/canonical-domain.test.ts` (the source-text anti-drift guard idiom — item 7's and item 8's guards).
- **Coverage holes that change the verification strategy**, all confirmed: there is **no** test file for `StaffAvailabilityOverridesManager.tsx`, `src/lib/booking/availability.ts`, `src/lib/booking/booking-window-settings.ts`, or `scripts/measure-admin-bundles.mjs`; **zero** tests exist under `src/app/(public)/**` or `src/components/ui/**`. Where a plan step says "the existing tests still pass", check that any exist.
- Scoping: `npx vitest run <file>` · `npx vitest run <dir>` · `npx vitest run <file> -t "<substring>"`. Environment is jsdom globally; default timeout 5000ms; no setup files.

### 11.7 SELECT-only verification

**Zero real emails (item 1).** Capture `SELECT now();` before starting, then afterwards:

```sql
SELECT count(*) AS rows_created_during_run,
       array_agg(DISTINCT event_type) AS event_types,
       array_agg(DISTINCT to_email) FILTER (WHERE to_email IS NOT NULL) AS recipients
FROM public.email_delivery_events
WHERE created_at > '<captured timestamp>'::timestamptz;
```

**Pass condition is `0`, not "0 except test addresses".** A properly mocked suite never reaches this table. Any non-zero count is a stop-and-report event, not something to explain away. Baseline on 2026-08-11: 43 rows, latest `2026-07-29`, every `delivery_status` = `accepted`.

**Item 4, post-apply.** Re-query `pg_indexes` for `tablename='bookings'`: must return **7** rows (the pre-existing 3 plus the 4 new names), and `SELECT count(*) FROM public.bookings` must be unchanged. Check each new `indexdef` against the approved SQL — `IF NOT EXISTS` silently no-ops against a same-named index with a *different* definition, which would be a silent divergence from what was approved.

**Item 8, per phase.** Re-run `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('travel_fee','mileage_origin','free_travel_cities');` after each phase as the running proof of what has and has not landed. It returns **empty** today.

### 11.8 What each command writes into the repo

| Command | Writes | Tracked? |
|---|---|---|
| `npx tsc --noEmit` | `tsconfig.tsbuildinfo` (root) | No — gitignored |
| `npx vitest run` (any scope) | nothing | — |
| `pnpm lint` (any scope) | nothing | — |
| both contrast `.mjs` scripts | nothing | — |
| `scripts/measure-admin-bundles.mjs` | nothing (stdout JSON) | — |
| `pnpm build` (item 5 only) | `.next/**` | No |
| the full Playwright contrast sweep | `redesign/evidence/admin-contrast/<ROLE>-<theme>.md`, plus `test-results/` | Evidence **is** tracked; `test-results/` is not |

`git status --porcelain -- src/ supabase/` stays at ` M src/lib/maintenance.ts` under every one of them.

---

## 12 — ✅ RESOLVED: the ambiguous instruction

The Owner's list of items to fix opened with **"The Maps cookie label"**, while an earlier instruction in the same message said to leave that label alone. The two could not both be actioned.

**Owner confirmed, 2026-08-10:** the Maps line was a mistake. The earlier instruction stands — **the Google Maps cookie-registry entry is NOT to be touched** (§0.2) — and the intended item was **"Adjustment lists count segments, not dates"**, now specified in full as **ITEM 6**.

This was flagged rather than guessed at because the two readings led to materially different work: one meant leaving a compliance-facing label alone, the other meant a correctness fix that (on its rejected option) would have added database objects. Recorded here so the resolution is part of the plan rather than lost in chat.

---

## 13 — The final report should state

- Which items shipped, with commit SHAs.
- **Every anchor that had drifted**, and what it drifted to. Silence here means "I did not check", not "nothing moved".
- Item 4: the exact SQL applied, and the post-apply `pg_indexes` output showing 7 indexes.
- Item 1: explicit confirmation that **zero real emails** were sent, with the bounded SELECT and its `0`.
- Item 5: the new baseline figures, and whether C-20's `+3 kB` and C-23's `+6 kB` ceilings can finally be evaluated.
- Item 6: which option was taken (A or B), and confirmation that the saturated branch renders a lower bound rather than a wrong exact number.
- Item 7: the literal count before and after **by occurrence** (target 0); the guard's state (ratchet or zero-tolerance); Layer 2 at 0 in both themes; Layer 3's total against the 2,615 baseline; which roles were swept; and any token whose documented contrast comment turned out stale.
- Item 8: the applied migrations in order; the worked arithmetic assertion `(45 × 2) + 14 = 104`; and confirmation that the quick-confirm chip gating shipped **with** Phase 3.
- The three gates by identity, with the vitest five named and the lint `{file, ruleId}` multiset per file.
- The state of `src/lib/maintenance.ts` (expected: working copy `false`, `HEAD` `true`, unstaged).
