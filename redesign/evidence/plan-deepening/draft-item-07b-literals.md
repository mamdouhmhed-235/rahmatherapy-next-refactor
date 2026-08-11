---

*Every count in §7.6–§7.14 was re-run fresh against the current tree; where an earlier revision printed a different number, that is noted and the earlier number is not used. All anchors are stated "at time of writing" per §1 rule 7 — re-locate by symbol before editing, and report drift.*

### 7.6 Phase A — complete the token vocabulary

**Workstream 2's true size is 717 occurrences across 102 files, not 677/99.** 677 occurrences / 99 files
is `src/app/admin/**` alone (`grep -rhEo 'oklch\(' src/app/admin --include='*.tsx' --include='*.ts' | wc -l`
→ 677; file count via `grep -rlE` → 99). Phase B's own defect list (D2 `button.tsx`, D3 `input.tsx`) adds
a further 40 occurrences / 3 files from `src/components/ui/` (badge.tsx, button.tsx, input.tsx — the
other 10 files in that directory carry zero, confirmed by direct per-file count). 677 + 40 = **717**;
99 + 3 = **102**. *(Corrected — every place this plan previously sized Workstream 2's review burden or
diff size at "677/99" — §7.5's summary table, §7.11's risk row — must use 717/102 instead; 677/99 remains
correct only when a sentence is explicitly scoped to `src/app/admin/` alone.)*

For each of the **94 distinct literal values** (confirmed: `84` distinct values within `src/app/admin/`
alone, plus `10` further distinct values that appear only inside the 3 UI primitives — 84 + 10 = 94, the
combined figure), classify:

1. **Byte-identical to an existing token's light value** → substitute directly. Provably no light-mode
   change. This covers the bulk.
2. **Near-identical to an existing token** → substitute, and record the delta explicitly in the commit.
   Example: the button hover literal `oklch(95.5% 0.012 155)` has no token; `--admin-hover-mist`'s light
   value is `oklch(95.5% 0.022 247)`. **Lightness matches (95.5%); chroma (0.012 vs 0.022) *and* hue (155
   vs 247) both differ** *(corrected — this was previously described as "same lightness, different hue,"
   which omits that chroma differs too)*.
3. **No reasonable token** → add a new token **pair**, light and dark, with a comment recording the
   measured contrast ratio against its intended background, matching the existing convention.

**Recommendation for the button-hover case specifically, unchanged:** add a dedicated token pair rather
than reuse `--admin-hover-mist`, so light-mode rendering stays byte-identical rather than merely close.

**The top-10 literal values are two different figures depending on scope — use whichever the sentence
means, and say which:**

- **Combined scope (admin + the 3 UI primitives), the number this section's own "94 distinct" and "717
  total" use:** top-10 by occurrence sum to **483**; 483 / 717 ≈ **67%**.
- **Admin-only scope (`src/app/admin/**` alone) — the scope §7.7's "top-10 literal values across
  `src/app/admin/**`" sentence actually uses:** top-10 sum to **464** (166 + 72 + 56 + 38 + 31 + 28 + 22 +
  19 + 16 + 16); 464 / 677 ≈ **68.5%**. *(Corrected — the plan's original "~71%" used the combined-scope
  sum, 483, against the admin-only denominator, 677: 483/677 = 71.3%. That mixes scopes. §7.7's own
  sentence is admin-only, so its correct figure is ~68.5%, not ~71% and not ~67% — 67% is the *combined*
  figure, and is the right number only where this section states "combined" explicitly.)*

**⚠️ Any new token must be added to every block that needs it** — `:root`, `[data-theme="dark"]`,
`[data-theme="light"]`, and `@media print` (confirmed: one ruleset, five selectors, `tokens.css:543-548` —
this claim checks out exactly, no correction needed). The print block forces light values regardless of
theme; a token missing there silently falls back to whatever the browser's print default resolves to.

### 7.7 Phase B — substitute, in risk order, in reviewable batches *(Workstream 2: D2, D3, D4, D5, D6, D10)*

**Scope check before you start:** Phase B fixes only hardcoded-literal defects — **D2** (`button.tsx`
`admin-secondary`/`admin-ghost` `active:`/`hover:`), **D3** (`input.tsx`, corrected below), **D4**
(`admin-ui-interactions.tsx`), **D5** (`ManualBookingForm.tsx` `hover:`), **D6**
(`event-row.tsx` / `calendar/page.tsx` status-on-light), **D10** (staff onboarding badges), plus the long
tail. **D1, D7, D8, D9 and D12 are NOT Phase B work** — they are Phase 0 (§7.5b), theme-resolution
faults in already-correctly-themed tokens, and substitution cannot fix them.

**D2, exact symbols — `src/components/ui/button.tsx`, currently:**
- the `"admin-secondary"` key of the `variant` map inside the `buttonVariants` cva config, currently at
  `:29` — `hover:bg-[oklch(95.5%_0.012_155)] active:bg-[oklch(92%_0.022_155)]`
- the `"admin-ghost"` key, currently at `:35` — the identical pair of literals.

RE-LOCATE BY SYMBOL (search for the `admin-secondary`/`admin-ghost` variant keys, not the line numbers).

**⚠️ D2's registered literals have zero live call sites today.** `grep -rn 'variant="admin-secondary"\|variant="admin-ghost"' src` returns nothing anywhere in the tree. Fixing them is correct hygiene, not a
visible defect fix — do not expect any visual change from that half of the edit.

**What the file also contains, live and currently unlabelled — must still be fixed in the same batch
since the whole file is edited together:**
- `"admin-primary"` (the variant every real admin button actually uses) carries its own `active:`
  literal, `oklch(15% 0.065 155)`, at `:26` — not D2, not in the top-10 (§7.6), so it will not be swept
  by any other batch. It must be classified and substituted as part of the button.tsx batch regardless of
  defect-ID bookkeeping; note in the commit message that it was folded in here.
- `"admin-destructive"` carries three further literals (`oklch(40%_0.14_25)` bg, `oklch(33%_0.14_25)`
  hover, `oklch(28%_0.14_25)` active) at `:32` — also unlabelled, also swept by this batch.
- Total for `button.tsx`: **8 occurrences on 4 lines** (1 + 2 + 3 + 2), confirmed by direct read and by
  `grep -oE 'oklch\(' src/components/ui/button.tsx | wc -l` → 8.

**D3, exact symbols — `src/components/ui/input.tsx`, currently:**
- the required-marker `<span aria-hidden="true">` inside the `AdminField` compound component, currently
  at `:116` — `text-[oklch(26%_0.14_25)]`
- the `role="alert"` error region inside `AdminField`, currently at `:143` — the same literal.
- **A third bare literal the plan's defect register has never named, found this pass:** the base `Input`
  component's own `data-[error=true]:border-[oklch(26%_0.14_25)]`, currently at `:40` — the **same
  literal value**, driving the input's own border colour when `AdminField` sets `data-error="true"` on
  it. It is not wrapped in `var(--token, …)` like the file's other 7 literals, so it is exactly as
  "genuinely bare" as :116 and :143 and belongs in D3's scope, not left as a separate untracked find. Add
  it to D3's fix.

**The other 7 occurrences in `input.tsx` (lines 27, 30, 32, 34, 36, 38, 108) are already
`var(--token, oklch(...))` fallback pairs** — the token is primary, the literal is only a fallback for a
missing custom property. These are low-priority relative to the 3 bare literals above; still worth
tokenizing for the raw-census metric, but they carry no live contrast risk today.

**D4 — `src/app/admin/components/admin-ui-interactions.tsx`, inside `ConfirmActionModal`
(`export function ConfirmActionModal`, currently starting `:258`), the destructive-confirm button,
currently `:342`** — `bg-[oklch(40%_0.14_25)] hover:bg-[oklch(33%_0.14_25)]`. RE-LOCATE BY SYMBOL
(search inside `ConfirmActionModal` for the `destructive ?` ternary).

**D5 — `src/app/admin/bookings/new/ManualBookingForm.tsx`, inside the exported `ManualBookingForm`
component (currently starting `:517` — the entire 79-literal file is effectively this one component),
the participant-removal button, currently `:1486`** — `hover:bg-[var(--admin-panel-muted)]
hover:text-[oklch(26%_0.14_25)]`. RE-LOCATE BY SYMBOL (search for `removeParticipant`).

**D6 — two files:**
- `src/app/admin/operations/event-row.tsx`, inside `export function EventRow` (currently `:96`), the
  severity-tone badge, currently `:171-173` — `hover:bg-[oklch(90%_0.05_20)]` /
  `hover:bg-[oklch(90%_0.07_65)]` / `hover:bg-[oklch(90%_0.012_280)]` across the `danger`/`warning`/
  `restricted` tones.
- `src/app/admin/calendar/page.tsx`, inside `export default async function CalendarPage` (currently
  `:171`), the therapist-filter and payment-filter "clear" chip links, currently `:650` and `:660` —
  `hover:bg-[oklch(91%_0.012_280)]` on both.

**D10 — `src/app/admin/staff/page.tsx`, inside `export default async function StaffPage` (currently
`:91`), the onboarding/role badge, currently `:537`** — `bg-[oklch(94%_0.008_280)]
text-[oklch(30%_0.02_280)]`. **The same value pair recurs three more times in this same file** (`:637`,
`:1002`, `:1016`) for related role-chip UI — verify whether all four are the same defect class or
whether only `:537` is the originally-measured one; either way all four are in this file's batch.

**Order by user impact, not by file size:**

1. **`src/components/ui/input.tsx` and `button.tsx`** — 2 files, 18 occurrences total (10 + 8, corrected
   from the plan's original "14" figure, which predates the third D3 literal and undercounted button.tsx
   by the unlabelled admin-primary/admin-destructive literals). Ship these first and alone — the biggest
   readability win in the smallest, most reviewable diff, **for `input.tsx`**; `button.tsx`'s visible win
   is close to zero (D2's variants are dead — see above), but it ships in the same low-risk batch because
   it is the other primitive shared with `/booking/manage`. **Both render on the live customer page
   `/booking/manage` — see §7.7a; capture it as a control first.** *(`badge.tsx` was originally grouped
   here; §7.7a demotes it — 0 admin call sites.)*
2. The top-10 literal values across `src/app/admin/**` — **~68.5% of the admin-only total** (§7.6;
   corrected from "~71%").
3. The long tail, batched by directory, **excluding the five files item 8 also touches — see §7.7b Batch
   6 and §7's ordering note below.**

**Rules for the executing agent, unchanged:**
- Never change a colour's appearance and its location in the same step. Substitution only.
- Light mode is the control. Any light-mode diff on a byte-identical substitution means a mis-mapping.
- Do not touch `src/app/(public)/**` or `src/features/**` — **re-confirmed this pass, zero literals in
  both** (`grep -rlE 'oklch\(' "src/app/(public)" --include='*.tsx' --include='*.ts'` → 0;
  `grep -rlE 'oklch\(' src/features --include='*.tsx' --include='*.ts'` → 0).
- `AdminTopNav.tsx` (13 literals) also carries the C-10 padding fix from item 3/6's neighbourhood —
  re-grep anchors before editing.

### 7.7a ⚠️ Blast radius — full, including what is proven clean

**Callers and consumers, every one checked:**

| File | Imported by (outside `src/app/admin/**`) | Notes |
|---|---|---|
| `badge.tsx` | `src/app/booking/manage/page.tsx` — **the only importer anywhere in the repo, admin included.** `grep -rln "from [\"']@/components/ui/badge[\"']" src` returns exactly one hit. | 22 occurrences / 11 lines. 0 admin call sites (below). Editing it is 100% customer-facing risk for 0% admin readability gain. |
| `button.tsx` | `src/app/booking/manage/ManageBookingForms.tsx:5` | 8 occurrences / 4 lines. Its live customer call site (`:176`) uses the plain `primary` variant, which carries no `admin-*` literal — proven untouched by this batch. |
| `input.tsx` | `src/app/booking/manage/ManageBookingForms.tsx:6` | 10 occurrences. Customer call sites: `ManageBookingForms.tsx:89,100`. |
| `textarea.tsx` | `src/app/booking/manage/ManageBookingForms.tsx:7` | **0 occurrences — proven clean, imported but not edited.** |

`src/app/booking/manage/` is the **entire** `src/app/booking/**` route group — no other route exists
there (`find src/app/booking -type f` → exactly `no-google-analytics.test.ts`, `ManageBookingForms.tsx`,
`actions.ts`, `page.tsx`). `actions.ts` has zero JSX and zero literals. `page.tsx` additionally imports
`Badge` at `:9`. So the full set of files Phase B can affect on the customer side is closed and small:
`ManageBookingForms.tsx` and `page.tsx`.

**Proven NOT affected — stated explicitly, with the command used, so it is not re-investigated:**

- `src/components/ui/{accordion,button-link,card,checkbox,container,dialog,form,section,switch}.tsx` —
  all **0** occurrences (`for f in accordion button-link card checkbox container dialog form section
  switch textarea; do grep -oE 'oklch\(' "src/components/ui/$f.tsx" | wc -l; done`). `accordion.tsx` is
  imported by four **public-page** FAQ components and `dialog.tsx` by `MaintenanceModal.tsx` (which can
  render site-wide, public pages included, per `src/lib/maintenance.ts`'s own convention) — both are
  proven clean despite the public exposure.
- `src/app/(public)/**` and `src/features/**` — **0** occurrences each (command above, §7.7).
- **No test file anywhere references a specific `oklch(...)` literal value** —
  `grep -rl 'oklch(' src --include='*.test.ts' --include='*.test.tsx'` → 0 files. Substitution cannot
  break an existing assertion by changing a colour's source text.
- **Zero snapshot files exist repo-wide** — `find . -name "*.snap"` (outside `node_modules`) → 0. There
  is no snapshot-drift risk from this workstream.
- `<Badge` in admin: **0 call sites** (`grep -rEo '<Badge[ >]' src/app/admin --include='*.tsx'` → 0),
  against **`AdminStatusBadge`'s 99 real JSX call sites** (`grep -rhoE '<AdminStatusBadge'
  src/app/admin` → 99, *corrected — the plan's "141" does not reproduce; that number came from a raw
  `grep -c "AdminStatusBadge"` counting every line mentioning the identifier, including ~19 import
  statements and the definition itself, not call sites*). `AdminStatusBadge` is defined only in
  `admin-ui.tsx`, which itself carries 0 `oklch(` — it is already token-clean and outside this workstream.

**Binding requirements for `/booking/manage`, unchanged:**
1. Capture `/booking/manage` in both themes **before** editing any primitive, as a control.
2. Re-check after each primitive change — a visual diff there is a **STOP**, not a note.
3. Add it to the Layer 3 sweep as an unauthenticated route if a token can be obtained without a write;
   otherwise record it unreachable and verify manually (§7.9 makes this concrete).

**`badge.tsx` priority, unchanged:** ship `input.tsx` and `button.tsx` first (they carry D3 and, for
`button.tsx`, the file's other unlabelled live literal — see §7.7). Treat `badge.tsx` as a separate,
later, low-priority commit, justified as consistency/hygiene, not as fixing a live defect — because it
is not one in admin, and its only live rendering anywhere is the customer manage page.

**`AdminTopNav.tsx` collision claim: still correctly retracted.** Items 3 and 6 never touch that file —
confirmed again this pass. The real, previously-understated collision is the **six availability files**,
below.

### 7.7b Batches — exact commands and expected literal-count movement

All batches assume Phase 0 (§7.5b) and items 3/6 have already landed. Every batch re-runs:

```bash
node scripts/measure-admin-contrast.mjs . --json > layer1-after.json     # Layer 1 — static analyser
node scripts/verify-admin-token-contrast.mjs . --json > layer2-after.json # Layer 2 — token-pair proof
npx tsc --noEmit
pnpm lint
npx vitest run
grep -rhEo 'oklch\(' src/app/admin src/components/ui --include='*.tsx' --include='*.ts' | wc -l  # raw census
```

**Batch 1 — `input.tsx` alone (D3, corrected to 3 bare literals: `:40`, `:116`, `:143`).**
- Must move: raw census −10 (717 → 707).
- Must NOT move: Layer 2 (none of button/badge/input reference an `--admin-warning*` pair — confirmed,
  `grep -n "admin-warning" src/components/ui/{button,badge,input}.tsx` → no matches); `tsc`/`lint`/vitest
  identity (§8 of the whole plan).
- New check specific to this batch: capture `/booking/manage` in both themes per §7.9's manual-control
  procedure — this is the batch touching `Input`'s two customer call sites.

**Batch 2 — `button.tsx` alone, all 8 occurrences (D2's dead-variant pair, plus admin-primary's and
admin-destructive's unlabelled literals — see §7.7).**
- Must move: raw census −8 (707 → 699).
- Expected visible change: effectively zero for `admin-secondary`/`admin-ghost` (0 live call sites); some
  visible change possible for `admin-primary`'s `active:` state (the live default, used everywhere) —
  treat that part as the batch's real payoff and say so in the commit message.
- Must NOT move: Layer 2 identity; `/booking/manage`'s `Button` call site (`primary` variant, no
  `admin-*` literal — proven untouched, §7.7a).

**Batch 3 — `badge.tsx` alone, all 22 occurrences, separate and later, labelled hygiene not readability.**
- Must move: raw census −22.
- Expected visible change: zero in admin (0 call sites); **the only observable surface is
  `/booking/manage`'s status badge**, its sole consumer repo-wide. Capture it specifically before/after.
- Commit message must say "0 admin call sites, dead-code hygiene" — do not let this read as a defect fix.

**Batch 4 — top-10 literal values across `src/app/admin/**` (§7.6; admin-only scope).**
- Files: re-derive the exact file list per value at execution time via `grep -rl`, do not use a stored
  list — the *set* of files carrying a given literal can shift if items 1/3/6/8 landed new code since
  this section was written (§7's ordering notes, below).
- Must move: raw census should drop by close to 464, concentrated in exactly those 10 values — re-run the
  top-10 table after the batch and confirm each of the 10 is at or near zero, not merely that the
  aggregate fell by roughly the right amount. An aggregate drop not concentrated in the target 10 means
  the substitution touched the wrong things.
- Must NOT move: Layer 2; `unresolvedElements` in Layer 1's output must not increase — an increase means
  a literal was replaced with a computed expression the analyser (and the future Phase C guard) can no
  longer see. Treat as a hard stop, not a note (§7.13).

**Batch 5 — long tail, by admin subdirectory (`bookings/`, `clients/`, `staff/`, `emails/`, etc.),
EXCLUDING the five files named in Batch 6.** Same per-batch checks as Batch 4, scaled down.
- `emails/page.tsx` (29 occurrences today — re-scan immediately before this batch; a prior review dated
  2026-08-10 recorded 17, genuine drift since, not tool disagreement — see §7's ordering note on item 1
  below. Do not trust any fixed number for this file.)

**Batch 6 — the five files item 8 also touches, run as its own trailing batch, only after item 8 has
landed and been re-grepped** (§7's ordering note, below): `ManualBookingForm.tsx` (79 occurrences, the
largest single-file concentration in the tree — do not fold this into a `bookings/` directory batch
given its size alone), `SettingsForm.tsx` (37), `BookingManagementForm.tsx` (13),
`bookings/[bookingId]/page.tsx` (21), `bookings/series/[templateId]/SeriesActions.tsx` (1). Same
per-batch checks as Batch 4/5.

**Batch — Phase C guard + cheap tripwire.**
- Files: new `scripts/admin-oklch-ceiling.json` (or similar) + guard test; new
  `scripts/verify-admin-substitution-log.mjs` + `.test.ts` (§7.8).
- Must move: the ceiling constant equals the raw census at the moment this batch starts (re-run fresh),
  not any number printed in this document.
- Must NOT move: nothing else — this batch touches no product code.

### 7.8 Phase C — the guard, so this is fixed once

Add a guard test matching this codebase's existing idiom for the same purpose (C-21's anti-drift domain
test; C-17's recursive GA-import guard: `readFileSync`-based source scan, an explicit vacuous-pass guard,
a "why this exists" comment). It should fail if a new `oklch(` literal appears in `src/app/admin/**` or
`src/components/ui/**`.

- Start it at the **current raw census as a ratchet** if the sweep lands in stages, so the number can
  only go down; flip to zero-tolerance on completion.
- Prefer a guard test over an ESLint rule: no config risk, runs in the existing suite, matches precedent.
- **Disclose its limit explicitly, in the guard's own comment** — *corrected: the plan previously cited
  C-17's guard as already making this disclosure; it does not. Read in full, that file's comment explains
  why the guard exists (the bearer-token exfiltration risk) and that a prior regression happened, but
  contains no sentence about source-text-match evasion. Write the disclosure directly in the new guard
  instead of deferring to a precedent that doesn't contain it:* *"This is a source-text match. A computed
  template literal, string concatenation, or a value imported from a constant/JSON file will not be
  caught, nor will the same problem reintroduced via `lab()`/`hsl()`/hex syntax."*

**The cheap tripwire, made concrete.** §7.7's "light mode is the control" rule becomes a machine check:
for every logged substitution, resolve the new token's light-mode value from `tokens.css` and assert it
equals the literal it replaced.

- **New file:** `scripts/verify-admin-substitution-log.mjs` + `scripts/verify-admin-substitution-log.test.ts`, following this repo's existing pattern of a standalone `.mjs` paired with a `.test.ts` that
  imports its exports (as `measure-admin-contrast.mjs`/`.test.ts` and
  `verify-admin-token-contrast.mjs`/`.test.ts` already do).
- **Input:** a substitution log kept during Phase B, one entry per edit — `{file, line, oldLiteral,
  newToken}`, JSON.
- **Reuse, don't reimplement:** `scripts/verify-admin-token-contrast.mjs` already exports
  `resolveColour(raw, scope, depth)` and `parseTokensCss(css)` (confirmed:
  `grep -n "^export function\|^export const" scripts/verify-admin-token-contrast.mjs` → both present at
  `:86` and `:193`). For every Class-1 (byte-identical) substitution logged, assert
  `resolveColour("var(--<newToken>)", "light")` equals the byte value of `oldLiteral`. Any mismatch is a
  hard failure with file/line printed.
- Cost: pure string/colour comparison, no server, no browser, no login — milliseconds.

### 7.9 Phase D — prove it objectively, in both themes

**(a0) Static SOURCE analyser** — unchanged from the plan's existing description; prototype result
(309 files, 92 tokens, 495 pairings below 4.5:1) stands, not re-run this pass.

**(a) Static token-pair proof** — unchanged; role-independent, no browser, covers every page/role at once.

**(b) Automated live sweep — `e2e/admin-contrast.spec.ts`, corrected on two factual points:**

1. **Roles: exactly 4, not 6.** `e2e/admin-contrast.spec.ts:48` — `const CONTRAST_ROLES = ["OWNER",
   "ADMIN", "COORDINATOR", "THERAPIST_A"] as const;` — confirmed by direct read. The file's own header
   comment (lines 27–29) states *"only Owner, Admin, Booking Coordinator, Therapist and Inactive exist.
   There is no Reporting role; THERAPIST_B and NON_STAFF credentials are unpopulated."* *(Corrected —
   the plan previously listed `THERAPIST_B` and `REPORTING` as roles to loop and to populate in
   `.env.e2e`. Neither exists in the live role model or has credentials. Drop both from the role list and
   from the `.env.e2e` template below — this is not a rounding difference, it is a role that does not
   exist.)*

   ```
   E2E_BASE_URL=http://localhost:3000
   E2E_OWNER_EMAIL=…            E2E_OWNER_PASSWORD=…
   E2E_ADMIN_EMAIL=…            E2E_ADMIN_PASSWORD=…
   E2E_COORDINATOR_EMAIL=…      E2E_COORDINATOR_PASSWORD=…
   E2E_THERAPIST_A_EMAIL=…      E2E_THERAPIST_A_PASSWORD=…
   ```

2. **Routes: 29 role-loop templates, not 31.** `ADMIN_CONTRAST_ROUTE_TEMPLATES` in
   `e2e/admin-contrast-helpers.ts:71-100` has exactly 29 entries — confirmed by directly reading and
   counting the array (its own header comment at `:64` independently states "The 29 role-loop route
   templates"). `find src/app/admin -name "page.tsx" | wc -l` → 32 total. **Do not use `grep -c
   '^\s*"/admin' e2e/admin-contrast-helpers.ts` to re-derive this number — it also matches route-path
   text reused inside `markUnreachable()` calls elsewhere in the file and returns a different, larger
   count on a fresh run.** Count the array directly. The remaining 3 `page.tsx` files: `login` and
   `password-reset` are audited once outside the role loop by the "unauthenticated admin surfaces" test;
   the bare `/admin` root (a redirect) is **not audited anywhere in the spec** — a small, low-urgency
   coverage gap, worth recording, not blocking.

3. **Theme-setting mechanism — confirmed exactly as previously described**, no correction: `setAdminTheme()`
   (`admin-contrast-helpers.ts:384-399`) sets `data-theme` directly on `[data-admin-theme-root]`, never
   through the in-app control, so no `theme_preference` write reaches the database.

**`/booking/manage` cannot join the automated sweep without a database write — confirmed, and here is the
concrete manual-control procedure.** `src/lib/booking/manage-token.ts` stores only the sha256 hash of the
manage token; the plaintext is never recoverable from it. `ensureBookingManageUrl` is the only production
path that mints a fresh plaintext token, and it is called only from booking-creation/notification paths
(3 call sites: `admin/bookings/actions.ts`, `lib/email/notifications.ts`, `api/bookings/route.ts`).
`getExistingBookingManageUrl` always returns `undefined` by design (its own doc comment explains there is
currently no schema support for retrieving an already-minted token). So there is no way to obtain a valid
`/booking/manage?token=...` URL without a database INSERT.

1. Under a single Owner-approved Zone-2 action, create one throwaway test booking via the existing admin
   manual-booking flow (or a one-off script calling `ensureBookingManageUrl` directly); capture its
   manage URL.
2. Before Batch 1 (input.tsx), screenshot `/booking/manage?token=<that token>` in both themes — the
   control required by §7.7a.
3. After Batches 1–3 each, re-screenshot and diff.
4. Delete the test booking afterward (same precedent as the C-23 cleanup), or let it expire naturally —
   `manage_token_expires_at` is end-of-day on the booking date, so a test booking dated **today or later**
   avoids `InvalidManageLink()` rendering instead of the real form; clean it up promptly regardless.
5. Record this as a manual, human-verified control, not an automated Layer-3 sweep entry. Do not claim
   Layer 3 "covers" this route.

### 7.10 Explicitly NOT in scope

Unchanged from the current plan text: no redesign; no public-site changes beyond `/booking/manage` (a
required control) and Phase 0's Step 0.3 (its own ⛔); no token value changes beyond D8; not an
accessibility programme; do not fix D1/D7/D9/D12 by editing literals; do not "tidy" `site-parity.css`
opportunistically.

### 7.11 Risks

| Risk | Mitigation |
|---|---|
| A mis-mapped token silently changes light mode | Light mode is the control; any diff = mis-map |
| **717 edits is a large diff to review** *(corrected from 677 — the true combined Workstream 2 size)* | Batch by risk (§7.7b); primitives ship alone first |
| A new token missing from the print block | Explicit checklist item, §7.6 |
| The sweep is undone by future code | Phase C guard, ratcheted |
| Tuning colours while moving them | Forbidden, §7.7 |
| Role-exclusive UI missed | Phase D role passes (4, not 6 — §7.9) plus the role-independent static proof |
| **`ManualBookingForm.tsx` and 4 sibling files are edited by both this workstream and item 8** | Carved into Batch 6, run only after item 8 lands and is re-grepped — §7.7b, §7's ordering note |
| **`emails/page.tsx` edited by both this workstream and item 1, whose "mirror exactly" instruction would copy a live literal into new code** | Re-scan immediately before this file's batch; see the ordering note below for the recommended fix at item 1's end |
| A live customer page (`/booking/manage`) regresses from a "primitive" edit | §7.7a: captured as a control before Phase B; a visual diff there is a STOP |

**Ordering note — files this workstream shares with other items, and what must happen first:**

- **Items 3 and 6 must land before Phase B touches the six availability files.** Re-counted this pass:
  **26 `oklch()` occurrences total**, not 23 (`availability/page.tsx`=8,
  `staff/[staffId]/availability/page.tsx`=0, `availability-data.ts`=0,
  `staff/[staffId]/availability/lib.ts`=9, `AvailabilityOverridesManager.tsx`=7,
  `StaffAvailabilityOverridesManager.tsx`=2). *(Corrected from the plan's "23" — but treat 26 itself as
  provisional too and re-run the grep at execution time; both counts are demonstrably drift-prone.)* The
  sequencing conclusion is unchanged regardless of the exact number: land 3 and 6, then re-grep, then
  edit.
- **Item 1 collides with `emails/page.tsx` two ways.** First, file-level: item 1 mounts a new manual-send
  form near this file's `:925` (its own §1.6), so if item 1 runs before Phase B here (as the plan's
  current top-level order has it — item 1 at position 6, item 7 at position 7), Phase A's pre-count of
  this file will already be stale by the time Batch 5 reaches it — re-scan immediately before that batch
  regardless (§7.7b). Second, copy-paste: item 1's instruction to "mirror the established pattern
  exactly" mirrors `ReminderResendForm.tsx`, which itself contains a live bare literal at `:111`
  (`oklch(93.5%_0.038_155)` / `oklch(22%_0.085_155)` / `oklch(70%_0.10_155)`, in the `sent`-state
  ternary). Followed literally, item 1's new form introduces at least one brand-new hardcoded literal in
  the same commit sequence this workstream exists to clean up. **Recommend item 1's implementer write the
  new form's colour classes with tokens only** — a small, explicit, scoped deviation from "mirror
  exactly" — as well as re-scanning per the point above. Both, not either.
- **Item 8 touches five files this workstream also touches: `ManualBookingForm.tsx`, `SettingsForm.tsx`,
  `BookingManagementForm.tsx`, `bookings/[bookingId]/page.tsx`, and
  `bookings/series/[templateId]/SeriesActions.tsx`.** The plan's top-level "Suggested order and commits"
  table currently runs item 7 (position 7) before item 8 (position 8) — but item 8 rewrites copy and adds
  new UI in several of these same files, some of it on lines this workstream's Phase A would already have
  classified as "done." Running Phase B's ordinary batches over these five files under the current
  top-level order risks either re-opening a file item 7 already finished, or item 8 shipping new,
  untokenized literals into a file this workstream just cleaned. **This section's fix, scoped to what
  Phase B controls: the five files are carved out of the normal directory batches into their own trailing
  Batch 6 (§7.7b), which must not start until item 8 has landed and the files have been re-grepped.** This
  does not resolve the plan's top-level order table (out of this section's scope) — it only ensures Phase
  B itself does not proceed on these five files under the current ordering. Flag the top-level
  contradiction to whoever owns that table.

### 7.12 Verification

Gates by identity per §8 of the whole plan, plus: the guard tests pass; the static token-pair proof
reports 0 AA failures in either theme; the live sweep reports no failure on any swept route in either
theme; light-mode rendering of the shared primitives is unchanged before/after; `/booking/manage` is
unchanged except where explicitly expected (§7.9).

**Suggested commits, expanded to match §7.7b's batches:**

```
fix(admin-ui): token-drive colour in input.tsx (D3 — three bare literals, not two)
fix(admin-ui): token-drive colour in button.tsx (D2's dead variants + the live admin-primary/destructive literals)
fix(admin-ui): token-drive colour in badge.tsx — low priority, 0 admin call sites, hygiene only
fix(admin): replace the ten highest-frequency colour literals with tokens (admin-only top-10, ~68.5%)
fix(admin): token-drive remaining colour literals in <area>      (repeated per directory, Batch 5)
fix(admin): token-drive colour literals shared with item 8's changes    (Batch 6 — after item 8 lands)
test(admin): guard against new hardcoded oklch literals (ratcheted; discloses source-text-match limit)
test(admin): substitution light-mode tripwire (verify-admin-substitution-log)
docs(redesign): admin contrast evidence — both themes, all roles
```

**Tests to add — named, with exact file/path:**

| Test | File | Asserts |
|---|---|---|
| `it("does not contain a hardcoded oklch() colour literal")` — one block each for `button.tsx`, `badge.tsx`, `input.tsx`, plus `it("scans more than zero files")` as the vacuous-pass guard | `src/components/ui/__tests__/no-hardcoded-colour.test.ts` (new) | Source text of the three primitives contains no `oklch(`; should land with the primitives batches, not wait for Phase C |
| `it("resolves every logged byte-identical substitution's new token to the same light-mode value as the literal it replaced")`, `it("fails when a logged substitution's token does not match its recorded literal")` | `scripts/verify-admin-substitution-log.test.ts` (new, pairs with `scripts/verify-admin-substitution-log.mjs`) | Per §7.8, using `parseTokensCss`/`resolveColour` already exported from `verify-admin-token-contrast.mjs` |
| `it("does not exceed the checked-in ceiling of raw oklch() occurrences under src/app/admin/** and src/components/ui/**")` | extend `scripts/measure-admin-contrast.test.ts` (existing, already has a `--max-failures`-style CLI-gate test), or new `src/app/admin/__tests__/no-new-admin-oklch.test.ts` modeled on `no-google-analytics.test.ts`'s idiom | Ratchet/guard; **must include the disclosure comment drafted in §7.8** |
| `it("resolves --admin-warning against --admin-warning-bg at ≥4.5:1 in light theme")` | extend `scripts/verify-admin-token-contrast.test.ts`'s existing `describe("verifyRatioComments...")` block | Phase 0 territory (D8), cross-referenced here since it shares the file with this workstream's guard |
| `/booking/manage` primitive regression — manual, not CI-automatic given §7.9's finding that no token is obtainable without a write | document as a manual verification step in the commit description for Batches 1–3; optionally a Playwright spec (`e2e/booking-manage-primitive-contrast.spec.ts`) gated behind a manually-supplied `E2E_TEST_MANAGE_TOKEN` env var, if the Owner later wants it scriptable | Foreground/background colours on the two `<Input>` fields and the `Badge` are byte-unchanged before/after each of Batches 1–3 |

**Expected trajectory:** Phase 0 (already covered in §7.5b) should move the live sweep sharply while
barely denting the raw census — it removes no literals. Phases A–B invert that. If a batch's raw census
does not move by close to its stated expectation (§7.7b), stop and re-derive before continuing rather
than assuming drift explains it.

### 7.13 Stop conditions

1. **Any change in Layer 2's failure count during Phases A/B**, other than the sanctioned D8 change
   (Phase 0 territory) — stop, re-check which token pair moved and why.
2. **Any increase in Layer 1's `unresolvedElements`** — a literal was replaced with a computed expression
   the analyser (and the Phase C guard) cannot see. Hard stop, not a note.
3. **A visual diff on `/booking/manage`** after any of Batches 1–3 — per §7.7a's binding requirement,
   this is a STOP.
4. **Items 3/6 have not yet landed** and an implementer is about to edit one of the six availability
   files — stop, land 3/6 first, re-grep (§7.11's ordering note).
5. **A prose contrast claim in `tokens.css` looks wrong** while touching a nearby literal — log it (D11,
   Phase 0 territory), do not edit the comment inline as part of this workstream.
6. **One of the five item-8-collision files (§7.7b Batch 6) is about to be edited by this workstream
   before item 8 has landed** — stop, confirm which lands first, re-grep after (§7.11's ordering note).
7. **`CONTRAST_ROLES`/`.env.e2e` is about to be populated with `THERAPIST_B` or `REPORTING`** — stop;
   per §7.9 these roles do not exist / have no credentials; use the 4 roles the spec actually runs.
8. **A literal's nearest token requires a *value* change, not just a substitution, to reach AA** — stop;
   only D8 is sanctioned for a value change, and that is Phase 0 territory, not Phase B.
9. **A batch's literal-count movement does not match §7.7b's stated expectation**, in magnitude or
   concentration — stop and re-derive before continuing.

### 7.14 Rollback

- **Every Phase A/B commit is a pure text substitution** (literal → `var(--token)`), reviewable and
  revertable with a single `git revert` per commit. No data, no migration, no irreversible action
  anywhere in Phases A, B or C.
- **The Phase C guard and the substitution-log tripwire are additive test files** — revertable by
  deleting them; they assert on source text only, no runtime state.
- **The one irreversible action anywhere in this section is the `/booking/manage` manual-control test
  booking (§7.9)** — a database INSERT, Zone-2, requiring its own Owner approval separate from anything
  else in this workstream. Rollback: delete the test booking (same precedent as the C-23 cleanup already
  performed this programme), or let its token expire naturally. Nothing else in §7.6–7.14 is irreversible.
