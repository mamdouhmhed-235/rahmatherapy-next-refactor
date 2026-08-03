# Drift checkpoint #3 — unowned-debt inventory (read-only lens)

Repo: `rahmatherapy-next-refactor`, branch `master`, HEAD `435472a` (confirmed via `git log -1 --format="%H"`).
`git status --porcelain | wc -l` = 277 at both start and end of this session — tree unchanged while this lens ran, consistent with the groundwork's own "F-1 did not recur" note.

This file answers the two decisions Owner-facing groundwork (`DRIFT-CHECKPOINTS.md` §"Checkpoint #3") flagged as needing fresh measurement at HEAD, plus the two unreconciled-duplicate follow-ups. All commands shown were run against this tree; nothing here is carried forward from an earlier checkpoint without being independently re-checked.

---

## The two decisions, stated as one-line questions

**DECISION A — "Approve a mechanical token-substitution fix for the light-only `oklch(...)` colour-literal debt (98 files, not the previously-cited 68), starting with the three shared UI primitives, yes/no?"**
**Recommendation: yes.** Strongest fact: the dark-mode-correct replacement values already exist in `src/styles/tokens.css` and are byte-identical to the hardcoded literals — e.g. `badge.tsx:32`'s `text-[oklch(26%_0.14_25)]` is exactly `tokens.css:155`'s `--admin-status-cancelled-text` (light arm), which already has a dark arm (`tokens.css:393`, `oklch(88% 0.058 25)`) sitting unused. This is a find-and-replace against an existing, already-designed token set for the bulk of the debt, not new design work.

**DECISION B — "Grant a Part-0 exception to add the two missing keys (`yesterday`, `last_30`) to `getRangeDefaults()` in `reporting.ts`, yes/no?"**
**Recommendation: yes.** Strongest fact: the masking is **not complete**. `/admin/me`, `/admin/staff/[staffId]/performance`, and `/admin/reports` all call `parseReportFilters(rawSearchParams)` with no `from`/`to` defaulting (unlike `/admin/dashboard`, which has its own unrelated, pre-programme `?? today` fallback that happens to blunt — but not eliminate — the same bug). A single hand-typed or bookmarked `?range=yesterday` (no `from`/`to`) on any of the first three surfaces silently returns the current-month-to-+30-business-days window, mislabelled, and two of those pages (`me/page.tsx:156`, `performance-helpers.ts:125,128`) auto-generate onward links that re-propagate the same bad key with no `from`/`to` either. This is a live, reachable hole, not a theoretical one.

---

## Decision A — the light-only `oklch(...)` colour-literal debt

### Current count at HEAD — correcting the "68 files" figure

The 68-file figure quoted in `DRIFT-CHECKPOINTS.md` and `OWNER-ACTION-BACKLOG.md` (both attributed to "checkpoint #3 groundwork, 2026-08-03") **does not reproduce under any grep methodology I tried, and the true count is materially higher.** I tried four independent definitions; none returns 68:

| Method | Command | 7fe8b4f (programme start) | HEAD |
|---|---|---|---|
| Files with any bracketed Tailwind `oklch(...)` literal | `git grep -lE '\[oklch\(' <rev> -- src` | 93 | **98** |
| Occurrences of the same (not files) | `git grep -oE '\[oklch\([^]]*\)\]' <rev> -- src \| wc -l` | 726 | 679 |
| Files carrying either exact "danger" literal (`oklch(26%_0.14_25)` / `oklch(40%_0.14_25)`) | `git grep -lE 'oklch\(26%_0\.14_25\)\|oklch\(40%_0\.14_25\)' <rev> -- src` | 54 | 59 |
| Files carrying any of the 6 badge status-family literal pairs + danger-solid pair | (12-value union pattern, see transcript) | 87 | 91 |
| Excluding `error.tsx` boilerplate from the first method | `grep -vc 'error\.tsx$'` on the file list | 74 | 79 |

None of these lands on 68. For context, **C-11's own progress file independently tracked the same debt and recorded a near-identical number**: `redesign/per-page-progress/C-11-dashboard-variants-design-system-progress.md:61` — *"Frozen inventory counts have drifted (...) colors 98→103 files, 520→532 lines)"* — and line 307 of the same file states *"The ~90-file hardcoded-colour remainder outside D9's trim."* My own independent count (98 files, bracket-literal method) sits inside that same 90–103 band. **Conclusion: the "68" figure should be treated as stale or scoped differently than described; the defensible current count is 98 files / 679 occurrences**, and I use that as the headline number below.

### Breakdown by directory (98 files, 679 occurrences)

```
git grep -lE '\[oklch\(' HEAD -- ':(glob)src/**/*.tsx' ':(glob)src/**/*.ts'   → 98 files
git grep -oE '\[oklch\([^]]*\)\]' HEAD -- src/components/ui                  → 33 occurrences (3 files)
git grep -oE '\[oklch\([^]]*\)\]' HEAD -- src/app/admin                     → 646 occurrences (95 files)
git grep -oE '\[oklch\([^]]*\)\]' HEAD -- src, minus the two dirs above      → 0 occurrences
```

| Location | Files | Occurrences |
|---|---|---|
| `src/components/ui/` (shared primitives: `badge.tsx`, `button.tsx`, `input.tsx`) | 3 | 33 |
| `src/app/admin/` | 95 | 646 |
| `src/app/(public)/` | 0 | 0 |
| Elsewhere in `src/` | 0 | 0 |

This is exclusively an admin-surface problem; the public site carries none of it.

**Zero files pair a literal with a `dark:` variant** — confirmed via `git grep -lE 'dark:[a-zA-Z0-9_\[\]/:-]*oklch\(' HEAD -- src` → 0 results. Every one of the 98 files is genuinely theme-blind, not merely verbose.

### Introduced during the programme vs pre-existing

Diffing the file *set* between `7fe8b4f` (programme start) and `HEAD`:

- **11 files are brand-new** (did not exist at `7fe8b4f`, confirmed individually via `git cat-file -e 7fe8b4f:<path>` returning nonzero for each): `bookings/BookingCard.tsx`, `bookings/[bookingId]/NextActionButton.tsx`, `bookings/new/RecurringSection.tsx`, `bookings/series/[templateId]/SeriesActions.tsx`, `clients/[clientId]/edit/ClientEditForm.tsx`, `clients/components/BulkDeleteToolbar.tsx`, `clients/components/DeleteClientButton.tsx`, `clients/components/DuplicateWarningBanner.tsx`, `emails/templates/components/LivePreview.tsx`, `emails/templates/components/TemplateEditor.tsx`, `emails/templates/components/TokenTextField.tsx`. **Every one of these files was created carrying the debt from its first commit** — direct, current-HEAD confirmation of "every new admin file re-plants them."
- **6 files dropped off the list** between the two commits, but only **one was genuinely fixed**: `admin-ui.tsx` now has 0 `oklch(` occurrences of any kind (`grep -c 'oklch(' src/app/admin/components/admin-ui.tsx` → 0) — this was C-11 Phase E's Owner-approved scope extension (`ad6a780`, `0160eef`; see below). `dashboard-cards.tsx` still has 2 `oklch(` occurrences, but they moved from the bracket-literal shape to a JS template-literal (`oklch(85% 0.035 ${hue})` at line 106, a deterministic per-name avatar tint, deliberately theme-neutral by design per C-11's closeout note quoted below) — not "fixed," just a different shape my bracket-grep doesn't catch, which is why it's a fair exclusion. The other 4 (`ManualSendSheet.tsx`, `TemplateEditForm.tsx`, `TemplatePreviewPanel.tsx`, `TemplatesTab.tsx`) **were deleted and replaced** by C-15's new template-studio files — 3 of which (`LivePreview.tsx`, `TemplateEditor.tsx`, `TokenTextField.tsx`) are in the "11 new files" list above, carrying the identical debt forward under new names.
- Net: **93 → 98 files, but the underlying churn is +11/−6, not "+5 stable"** — the debt is actively being replanted faster than anything is removing it. Total occurrence count fell 726 → 679, entirely because the 4 large `emails/components/*` files removed more literal instances than the 3 smaller replacement files added.

### Correcting "C-11 never touched them" — more precise, still the same practical outcome

The checkpoint's phrasing ("C-11's admin-wide dark-mode pass never touched them") is very slightly overstated and C-11's own progress file is the source that corrects it: `C-11-dashboard-variants-design-system-progress.md:79,105-107` records that **Phase E did run a "hardcoded-colour sweep,"** initially scoped to `dashboard/page.tsx`, `TherapistDashboard.tsx`, the `blocks/` + variant files, `dashboard-cards.tsx`, `dashboard-filters-client.tsx`, and two chart helpers — then the Owner explicitly approved **adding `admin-ui.tsx`'s 46 literals** to that scope on 2026-07-30. So C-11 did touch and fix one shared file. But **the same progress file's own re-verifier explicitly confirms the boundary**, at line 244: *"`input.tsx` and `badge.tsx` were last touched pre-C-11"* — and line 307 logs, unprompted, **"the ~90-file hardcoded-colour remainder"** as known and deferred. So the accurate statement is: **C-11 ran a deliberately narrow, Owner-scoped sweep that excluded the shared primitives and ~90 admin page files by name, and said so in its own closeout** — not an oversight, but still an unowned remainder of almost exactly the size measured above.

### What it looks like to a user in dark mode (dark is default — all 12 staff rows `theme_preference = NULL`, established fact carried from prior checkpoints, not re-queried this session)

Three concrete instances, read directly:

1. **`src/components/ui/input.tsx:116` and `:143`** — the shared `Field` wrapper used by essentially every admin form. The required-field asterisk (`text-[oklch(26%_0.14_25)]`, no background, no `var()`) and the `role="alert"` validation-error text+icon render **directly on the panel background**, not inside a coloured pill. Dark-mode panel is `--admin-panel: oklch(22% 0.008 88)` (`tokens.css:339`). A dark-maroon `L=26%` glyph on an `L=22%` panel is a 4-point lightness gap — tighter than the already-measured `oklch(40%...)`-vs-`oklch(22%...)` pairing checkpoint #2's F-4 clocked at **~1.2:1**, whose gap is 18 points. A 4-point gap will compute lower still. This is not "poor contrast" — it is **functionally invisible text for a required-field marker and every validation error message in the entire admin**, on every account, by default. This is the single worst instance found: it's load-bearing UX (sighted users can't see why a form is invalid), not decorative.
2. **`src/components/ui/badge.tsx:21-69`** — every status pill (`confirmed`/`pending`/`cancelled`/`completed`/`attention`/`restricted`, used on bookings, clients, staff, roles, emails, enquiries, privacy) renders as a light pastel pill (`L` 93–96%) with dark text (`L` 22–30%) regardless of theme. The text-on-pill contrast is internally fine (it's a self-contained light island), so this is not "unreadable" — but every single badge in the product renders as a bright, glowing rectangle floating on a near-black `L=22%` dark panel. Visually the most pervasive instance (every list view uses it), and the shared-primitive nature means every consumer inherits it silently.
3. **`src/app/admin/roles/[roleId]/DangerZonePanel.tsx:68`** — a persistently-visible informational note box (`bg-[oklch(94%_0.008_280)]` at `L=94%`, not conditional on hover/error state) sitting directly in the page's normal flow. In dark mode this is a bright near-white lilac card sitting in the middle of an otherwise dark page, every time an Owner/Admin opens a role's danger zone — the most visually jarring "light box stuck in a dark page" instance found, because it's always rendered, not just on an edge-case interaction.

### Fix-size estimate

**Mostly mechanical, not judgement-heavy — this is the most important finding for scoping the fix.** `tokens.css` already defines a complete, correctly-designed light+dark token pair for the entire badge status family and the danger-solid pair (`--admin-status-{confirmed,pending,cancelled,attention,restricted,completed}-{bg,text,border}` at `tokens.css:148-168` light / `:386-403` dark; `--admin-danger-solid`/`-solid-hover` at `:217-218` light / `:425-426` dark). The hardcoded literal values in `badge.tsx`, `button.tsx`, `DangerZonePanel.tsx`, and the bulk of the other 95 admin files are **byte-identical to these tokens' light arm** (verified: `badge.tsx:32`'s `oklch(95.5%_0.028_20)`/`oklch(26%_0.14_25)` = `tokens.css:154-155` exactly; `button.tsx:32`'s `oklch(40%_0.14_25)` = `tokens.css:217` `--admin-danger-solid` exactly). Swapping the literal for `var(--admin-status-cancelled-text)` etc. is a pure find-and-replace against a design system that already exists and is already dark-mode-correct — no new colour needs inventing for the majority of the 98 files.

A genuine minority needs real judgement, not substitution: `button.tsx`'s `active:` shade (`oklch(28%_0.14_25)`, no matching token exists — needs either a new token or a documented reuse decision) and `dashboard-cards.tsx`'s dynamic per-name avatar-hue tint (a deliberately theme-neutral decorative feature per C-11's own note, not a bug to "fix" by blind substitution).

**Risk: low for the mechanical portion** (additive/replacement only, high verifiability — a visual dark-mode screenshot pass per file would catch any miss immediately, and the token values are already proven correct by the parts of the app that already consume them via `var(...)`). The remaining risk is scale, not difficulty: ~95 files to touch, most a 1-2 line change each, best done as one dedicated sweep (which is exactly what C-11 Phase E already proved out at small scale) rather than opportunistically per-plan.

---

## Decision B — client preset map vs server range resolver

### The two functions, read directly

**`buildPresets()`** — `src/app/admin/dashboard/dashboard-filters-client.tsx:50-71`. Returns exactly 6 keys: `today`, `yesterday`, `this_week`, `this_month`, `last_30`, `custom`.

**`getRangeDefaults()`** — `src/app/admin/reports/reporting.ts:962-1017`. Handles exactly 9 named keys: `lifetime`, `year`, `today`, `tomorrow`, `week`, `this_week`, `this_month`, `custom`, `quarter` — plus a catch-all final `return` for anything else (line 1016).

**The divergence is confirmed exactly as claimed, no correction needed:**
- Both know: `today`, `this_week`, `this_month`, `custom` (4 keys)
- `buildPresets`-only (the exact claim): `yesterday`, `last_30` (2 keys)
- `getRangeDefaults`-only (used by other surfaces — Therapist worker dashboard chips, Reports' own range select — not by the dashboard preset UI): `lifetime`, `year`, `tomorrow`, `week`, `quarter` (5 keys)

### Is the masking complete? No — this is the most valuable finding here.

C-07 B1's fix (`ef1d4b6`, referenced in `C-07-routing-and-per-role-defaults-progress.md:62`) made `buildPresetHref()` (`dashboard-filters-client.tsx:227-237`) **always** set `range`, `from`, and `to` together for every non-custom preset — confirmed by reading the function directly. That closes the one path C-07 actually reviewed (the dashboard's own chip-click UI). **It does not close the resolver-level hole, and three other live surfaces reach it unguarded:**

1. **`/admin/me/page.tsx:151`** — `const filters = parseReportFilters(params)` on **raw searchParams**, no defaulting of any kind.
2. **`/admin/staff/[staffId]/performance/page.tsx:119`** — same: `parseReportFilters(queryParams)` on raw searchParams.
3. **`/admin/reports/page.tsx:117`** and **`/admin/reports/export/route.ts:33`** — same pattern, raw searchParams straight into `parseReportFilters`.

Only **`/admin/dashboard/page.tsx:79-82`** has any insulation, and it's incidental, not a fix for this bug: `range: params.range ?? "today", from: params.from ?? today, to: params.to ?? today` — this pattern predates the whole Band C programme (`git log -L 79,82:src/app/admin/dashboard/page.tsx` traces it to pre-`7fe8b4f` commits `e4dfe88`/`6068154`/`e13b212`). It means a bare `/admin/dashboard?range=yesterday` (hand-typed, no dates) resolves to `{range:"yesterday", from: today, to: today}` — **wrong data (today's, not yesterday's) but not the catastrophic month-wide catch-all**, because `from`/`to` are always truthy by the time `parseReportFilters` sees them. The other three pages have no such luck.

**Concretely reachable, not just theoretical:** `/admin/me/page.tsx:156` and `staff/[staffId]/performance/page.tsx:125` both build `` `/admin/reports?staffId=${id}&scope=personal&range=${filters.range}` `` — echoing whatever `filters.range` resolved to, **with no `from`/`to`**. `performance-helpers.ts:125,128` do the same for the "Completed sessions" and "Revenue attributed" KPI-tile links. So: land on `/admin/me?range=yesterday` (bookmarked, shared link, or hand-edited) → wrong month-window data with no chip showing active (`buildRangeChips` in `performance-surface-helpers.ts:13-19` only defines `today`/`week`/`month`/`quarter`/`custom` chips, so `yesterday` matches none — the one visible tell, easy to miss) → click through to "Revenue attributed" or "View all reports" → the **same unknown key propagates onward with still no dates**, landing on `/admin/reports` with the identical silent fallback. I confirmed the Reports page's own `<select name="range">` (`RANGE_OPTIONS` in `reports-helpers.ts:20-26`) only ever emits `lifetime`/`year`/`month`/`week`/`custom` itself, so Reports cannot originate the bad key on its own — but it does **not defend against receiving it** from an inbound link either.

I also traced a false lead to rule out: `report-insights.ts:163`'s `` drillUrl: `/admin/staff/${worstDrop.staffId}?range=${data.filters.range}` `` looks like a fourth propagation path, but **`/admin/staff/[staffId]/page.tsx` never calls `parseReportFilters` or reads `?range=` at all** (confirmed: zero matches for either), so that particular link's query param is inert — not a real hole, just a dead param.

### What the catch-all fallback actually does — named precisely

`reporting.ts:1016`: `return { from: `${currentMonth}-01`, to: addBusinessDays(today, 30) };` — this is **exactly the same computation the intentional default `"month"` range already relies on** (there is no explicit `range === "month"` branch; `month` reaches this same final line). So an unknown key like `yesterday` or `last_30` doesn't crash or error — it silently becomes **"current calendar month's 1st through 30 business days past today,"** the same window a user would get from doing nothing at all. On `/admin/me`/`/admin/staff/.../performance`, this renders as a plain date-range string (`buildRangeWindowLabel` in `performance-surface-helpers.ts:81-92` formats raw `from`/`to` as text — it never shows the word "Yesterday" or "Month," so there's no label/data mismatch to notice, just a bigger date range than the user asked for, unlabelled).

### Fix-size and risk — the two options, honestly not the same on both axes

**(i) Add the 2 missing cases to `getRangeDefaults()`.** Mirrors patterns already in the same function almost verbatim (`yesterday` = `addBusinessDays(today, -1)` for both `from`/`to`, exactly as `buildPresets` already computes it at `dashboard-filters-client.tsx:62`; `last_30` = today−29 to today, matching `buildPresets:60-61,68`). 2 new `if` branches, ~8 lines total, plus 2 new tests following the existing one-`it()`-per-key pattern already in `reporting.test.ts:57-113`. **This is smaller** — one file, additive only, no existing behaviour touched. It needs the Owner's explicit exception because `reporting.ts` is a Part-0 untouchable.

**(ii) Avoid touching `reporting.ts` — guard at each call site instead.** Since all four vulnerable pages (`me`, `staff/[staffId]/performance`, `reports`, `reports/export`) call `parseReportFilters` directly, closing the hole without touching `reporting.ts` means adding a pre-validation/normalisation step to each of those 4+ call sites (or a new shared helper called from all of them) that maps `yesterday`/`last_30` to explicit dates before the call — replicating, in a new location, the exact logic `dashboard-filters-client.tsx`'s `buildPresetHref` already has. This is **not smaller** (4+ sites vs. 1), and it recreates precisely the class of problem this checkpoint's own "duplicate-logic inventory" table already tracks (D1/D2, the preset-map/resolver split itself) — a second, parallel definition of what `yesterday`/`last_30` mean, now living outside `reporting.ts` instead of inside it, which does not survive a sixth caller being added later without the same vigilance C-07/C-02 have shown so far.

**Recommendation stands as stated above: (i) is both smaller and, despite requiring the Part-0 exception, the safer long-term choice** — it is the only option that gives `range` a single source of truth. (ii) is "safer" only in the narrow sense of not touching a protected file; it is riskier for the codebase's own drift trend.

---

## The two unreconciled duplicates — confirmed at HEAD

**D2 — three today-in-London helpers.** `access.ts:85-92` (`getLondonToday`) and `_helpers.ts:198-205` (`getTodayIsoDate`) are **still byte-identical** (read directly; identical `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", ... })` bodies, differing only in function name). The third, canonical implementation is `getBusinessDate()` at `src/lib/time/london.ts:63`. **No fourth has appeared** — `git log 822441d..HEAD` shows the only `src/` changes since the groundwork commit are in `BookingsChrome.tsx`/`bookings/page.tsx` (C-07 B4's saved-views fix), untouched by this helper family. Unreconciled, not worsened.

**D1 — duplicate `MISSING_COLUMN_CODES`/`hasErrorCode` shims.** `bookings/actions.ts:84-89` and `clients/actions.ts:455-460` are **still byte-identical** (same `Set(["PGRST204", "42703"])` constant, same type-guard function body). Both guard a pre-migration fallback path (`bookings/actions.ts:1005-1019`'s restore-payload retry, `clients/actions.ts:613`'s cascade retry) for columns (`bookings.cancelled_at`, and the equivalent in `clients/actions.ts`) that were added by migrations that shipped long before programme start — the in-code comments at both sites (`actions.ts:80-82`, `actions.ts:451-453`) describe exactly this transitional purpose, and confirm the guarded branch is now unreachable in ordinary operation. **Still dead, still doubly maintained.**

**Correcting the "C-14 is the last candidate owner" premise:** I read the relevant sections of `redesign/plans/C-phase/C-14-granular-working-hours-breaks-plan.md` (its migration-handling steps, §Phase C, Steps 9/12/12a). **C-14 does not need this shape.** Its migrations use an explicit **atomic co-deploy** strategy instead — Step 12a states outright that "the migration and the following code changes ship in the SAME commit/deploy" — which is the opposite design choice to the `MISSING_COLUMN_CODES` pattern (which exists specifically to tolerate a *window* where code ships ahead of its own migration). Nothing in C-14's plan text mentions `MISSING_COLUMN_CODES`, `hasErrorCode`, `PGRST204`, or a column-might-not-exist-yet fallback at all. **This means D1 is very likely to remain unclaimed even after C-14 ships**, contrary to what the prior checkpoint chain assumed — worth flagging to the Owner now rather than waiting for C-14 to pass by without resolving it, since after C-14 there is no next-named candidate on record.

---

## Summary of what changed since checkpoint #3's groundwork (`822441d` → HEAD `435472a`)

`git log --oneline 822441d..HEAD` (6 commits) touches only: C-07 B4's saved-views namespacing (`BookingsChrome.tsx`, `bookings/page.tsx`, one new test file) and documentation (`DRIFT-CHECKPOINTS.md`, `OWNER-ACTION-BACKLOG.md`, `SUBAGENT-RULES.md`, protocol files, C-07's own progress/evidence). **None of it touches the colour-literal files or the reporting/dashboard-filter files** — every measurement above is a fresh, independent re-derivation at current HEAD, not a copy of the groundwork's numbers, and the two corrections found (the 68-file figure, and the "C-14 needs D1's shape" assumption) are new findings from this pass, not re-statements.
