# Critique — Lens 5: Completeness ("what is missing")

Diff under review: `git diff 04e1b0c..c50cb6a` (eight commits, 856d1bb..c50cb6a).
All work below is read-only: two throwaway Node scripts in the system temp
scratchpad importing `scripts/verify-admin-token-contrast.mjs` by file URL,
plus `node scripts/measure-admin-contrast.mjs . --json`,
`node scripts/verify-admin-token-contrast.mjs`, and
`npx vitest run scripts/admin-oklch-ceiling.test.ts
scripts/verify-admin-token-contrast.test.ts scripts/measure-admin-contrast.test.ts`.
No file under `src/`, `scripts/`, `e2e/` or `supabase/` was written.

## Verdict

The diff's own numeric claims all independently reproduce exactly. No blocker
found. Two real gaps stand out, both about *verification*, not about the
colours themselves: (1) the "declared in all four blocks" rule the diff
repeats in every commit message is never actually checked by the shipped test
suite — I had to verify it by hand — and (2) the guard's blind spots are
larger than "only counts `oklch(`" suggests once you go looking, though what
they currently hide is small and mostly benign.

## Independent re-derivation of the literal census

`Grep` (ripgrep-backed, handles `staff/[staffId]/` bracket paths correctly —
confirmed the path filter still matched files inside bracket directories)
over `src/app/admin/**` and `src/components/ui/**`:

- `oklch(` — **15 occurrences**, exactly matching "1 static + 14 computed":
  - 1 static: `src/app/admin/clients/page.tsx:1121`,
    `hover:border-b-[oklch(60% 0.08 247)]` inside a Tailwind class string.
  - 14 dynamic (all `` `oklch(...${hue}...)` `` inside `style={{}}` objects,
    each hue derived per-identity via `hueFromId`/similar): 2 each in
    `staff/[staffId]/page.tsx`, `bookings/AssignmentManager.tsx`,
    `privacy/page.tsx`, `bookings/[bookingId]/BookingDetailSidebar.tsx`,
    `bookings/[bookingId]/page.tsx`, `clients/page.tsx` (a second, different
    site from the static one above), `dashboard/dashboard-cards.tsx`, and 1 in
    `clients/[clientId]/page.tsx`. This list is also byte-identical to
    `scripts/admin-oklch-ceiling.json`'s `dynamicAllowance.files`.
  - `src/components/ui/**`: 0 occurrences.
  - This matches the claimed post-diff state exactly. **Checked, correct.**

- `hsl(`, `lab(`, `lch(` (word-boundary, so it doesn't match the substring
  inside `oklch(`), `color(`: **0 occurrences** in either directory. This
  portion of the guard's disclosed blind spot is currently empty — not a
  finding, just measured as asked.

- `rgb(`/`rgba(`: **6 occurrences**, all in `src/app/admin` (0 in
  `src/components/ui`), all invisible to `admin-oklch-ceiling.test.ts`'s
  `/oklch\([^)]*\)/g` regex and absent from `measure-admin-contrast.mjs`'s
  census (which only recognises `oklch(...)` / `var(--admin-*)` / hex forms
  it's coded for, not raw `rgba()` inside a `shadow-[...]` utility):
  - `src/app/admin/dashboard/dashboard-filters-client.tsx:355` —
    `shadow-[0_2px_6px_var(--admin-shadow-ink-28),inset_0_1px_0_rgba(255,255,255,0.12)]`
  - `dashboard-filters-client.tsx:356` — `shadow-[0_1px_2px_rgba(0,0,0,0.02)]`
    and `hover:shadow-[0_2px_5px_rgba(0,0,0,0.04)]`
  - `src/app/admin/dashboard/attention-group-client.tsx:261` —
    `shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]`
  - `src/app/admin/components/notification-bell.tsx:259,340,647` — the same
    `shadow-[0_1px_2px_rgba(0,0,0,0.12)]` / `rgba(255,255,255,0.08)` pattern.
  All six are pure black or pure white at a fixed alpha (inset gloss
  highlights and drop shadows), the same category of thing commit 8436617
  tokenised for the *coloured* (hue 155) shadow ink — but these particular
  ones are already hue-neutral, so whether they need a token at all is a
  judgement call the diff never makes, because it never sees them. They are
  simply outside what the "1 static + 14 computed" number describes, and nobody
  measured that this second category exists.

- Bare hex literals: found inside two categories, both in files the SCAN_DIRS
  cover but the guard's `oklch(`-only regex does not see:
  - `src/app/admin/email-templates/preview/[id]/route.ts:190-202` — a
    standalone HTML document returned by a route handler and loaded into
    `LivePreview.tsx`'s iframe. Hardcoded `#fbf8f2`/`#1f2f2b`/`#e8dfd2`/etc.
    This is architecturally the same case the diff already names for
    `--admin-email-preview-bg` ("the paper the outgoing email renders on...
    deliberately does NOT invert") — a defensible non-defect, but the diff
    never says so for THIS file, and the guard has no way to know the
    exclusion is intentional versus simply missed.
  - `src/app/admin/emails/templates/components/LivePreview.tsx:49-60` — the
    `FIXED_PART_OUTLINE_CSS` annotation styles (`background:#f7f3ec`,
    `outline:...#0f5e8e`, `color:#ffffff`) injected into that same iframe to
    outline "auto" content in the email preview. Same "email paper" argument
    likely applies (it draws on top of the email's own always-light surface,
    not the admin chrome), but again never stated.
  - `src/app/admin/reports/page.tsx:424` — `border-bottom: 1px solid #ccc;`
    inside a `.print-only` rule that is itself nested under an explicit
    `color-scheme: light` override for `@media print`. Functionally inert
    with respect to admin dark mode (print is forced light on this page
    regardless), but still a literal the census never counts.
  - No hex literals at all in `src/components/ui/**`.

**Net measurement**: the guard's disclosed limit ("only counts the `oklch(`
spelling") currently hides roughly 19 literal occurrences across 4 files
(6 `rgba()`, ~13 hex) inside the very directories it claims to scan. None of
these look like the light-values-frozen-forever defect class the diff exists
to fix (they're white/black shadow inks, or content that is supposed to stay
light regardless of theme) — but that is my read after tracing each site by
hand, which is exactly the manual step the guard was built to make
unnecessary, and the diff does not disclose that this second tier of literals
exists or was considered.

## Tests/e2e referencing removed literals by text

Searched `e2e/**` and every `*.test.*` file for the string `oklch`. Matches
are only in `scripts/admin-oklch-ceiling.test.ts`,
`scripts/measure-admin-contrast.test.ts`, and
`scripts/verify-admin-token-contrast.test.ts` (the tooling's own tests, which
use synthetic CSS fixtures, not real component output) plus one prose comment
in `e2e/admin-contrast-helpers.ts` ("handles oklch/lab/oklab/color-mix
exactly"). Also extracted all 65 distinct removed literal values from the
diff (`git diff | grep '^-' | grep -oE 'oklch\([^)]*\)'`) and confirmed none
of them appear anywhere under `e2e/` or in any `*.test.*` file. **No stale
assertion found — clean.**

## Public-site impact: button/input/badge

`ManageBookingForms.tsx` (`/booking/manage`) imports `Button` and `Input`
from `@/components/ui/*`; `page.tsx` imports `Badge`.

- **badge.tsx**: 0 `oklch(` occurrences before or after — nothing for this
  diff to touch, consistent with it not appearing in the diff's file list.
- **button.tsx**: the four tokens this diff mints
  (`--admin-button-primary-active`, `--admin-button-subtle-hover`,
  `--admin-button-subtle-active`, `--admin-danger-solid-active`) are used
  exclusively inside the `admin-primary`/`admin-secondary`/`admin-destructive`/
  `admin-ghost` variant strings. `ManageBookingForms.tsx` never passes a
  `variant` prop to `Button`, so it uses the `cva` default (`"primary"`) —
  the public-site variant, built from `bg-primary`/`text-primary-foreground`
  etc., a completely different token family. **Confirmed no-op for
  `/booking/manage`.**
- **input.tsx**: seven `var(--token, oklch(...))` fallbacks were deleted. I
  checked all six underlying tokens (`--admin-surface-input`,
  `--admin-border-form`, `--admin-body`, `--admin-text-muted`,
  `--admin-focus`, `--admin-heading`) are declared in `:root` in
  `src/styles/tokens.css`, and that `src/app/layout.tsx` (the one root
  layout) unconditionally imports `./globals.css`, which unconditionally
  `@import`s `../styles/tokens.css` — so every page, including
  `/booking/manage`, always has these custom properties defined and the
  fallback was provably unreachable. Confirmed with `oklchToRgb` (reused from
  the shipped script) that two of the seven fallback values were not just
  redundant but **materially different colours** from the live token —
  `--admin-focus` resolves to `#a14820` (a burnt orange, RGB ~161,72,32)
  while its deleted fallback, `oklch(47% 0.095 230)`, resolves to RGB
  ~0,100,134 (a blue) — exactly what commit 856d1bb's message already says.
  Since the fallback was dead, removing it changes nothing in any real render
  today. Worth naming as a fragility rather than a defect: these controls now
  have *zero* fallback if `tokens.css` were ever not loaded on some future
  entry point (a Storybook story, an isolated test renderer, a second app
  shell) — before, a wrong-but-present colour would have rendered; now,
  nothing would. Not a fault of this diff (the coupling to `--admin-*` tokens
  in a "public-site and admin shared" component predates it), but the diff
  does make that specific failure mode marginally worse by deleting the
  safety net, and doesn't mention that trade-off.

Also checked whether any *other* touched file renders outside `/admin`: of
the 44 non-`tokens.css`, non-`scripts/*` files the diff touches, all 42
component/page files are under `src/app/admin/**`; only `button.tsx` and
`input.tsx` are shared. Confirmed by grepping every touched file's path.

## `var(--token, fallback)` removals more broadly

Beyond input.tsx's seven, the diff removes exactly one more fallback:
`AuditEventCard.tsx`'s `bg-[var(--admin-page,_oklch(97.8%_0.006_88))]` →
`bg-[var(--admin-surface-subtle)]`. Confirmed `--admin-page` is declared
**nowhere** in `src/styles/tokens.css` or anywhere else under `src/` — a
genuine phantom custom property, so unlike the input.tsx case this fallback
*was* live (an undefined `var()` really does fall through to its fallback).
The commit message says so and says it correctly. The diff leaves one
sibling site alone (`AuditEventCard.tsx:195`,
`bg-[var(--admin-page,_var(--admin-panel))]`) on the stated grounds that its
fallback, `--admin-panel`, is real and already theme-aware — confirmed
`--admin-panel` is declared and inverts correctly across all four blocks. Not
a defect, but `--admin-page` itself remains a dangling, undeclared name in
the source after this diff — a future reader could reasonably assume it is a
real token (it reads like every other `--admin-*` name in the file) and be
surprised it silently resolves via fallback instead.

## Rule #1 ("all four blocks") — asserted repeatedly, verified by nothing

Every one of the eight commit messages states new tokens were "minted in all
four blocks (:root, dark, light, print)." I independently confirmed, by
extracting the 58 new token names from the diff and cross-checking against
`scripts/verify-admin-token-contrast.mjs`'s own `parseTokensCss`:

- All 58 are declared **exactly 4 times** each in `tokens.css` (grep count
  per name), matching one declaration per block with no accidental dupes or
  omissions.
- All 58 have a declaration **inside** the `@media print { ... }` selector
  list (not merely inherited from `:root` through the cascade) — checked
  against the extracted print-block text directly.
- All 58 have a print value that is **byte-identical** to their light value,
  matching the file's stated intent ("Print always renders the light
  palette... Values are the light set exactly").

So the claim is true today. But nothing in the shipped test suite would have
caught it if it weren't. `verify-admin-token-contrast.test.ts`'s one
structural check (lines 105-129, "finds a structurally sane --admin-* token
set... resolved in both themes") only inspects `parsed.tokens[name].light`
and `.dark` — and `parseTokensCss`'s own JSDoc return type
(`verify-admin-token-contrast.mjs:187-191`) shows `tokens` only ever carries
`{light, dark}`; `scopes.print` exists in the parser's return value but no
test in the file iterates every token against it. The only print-specific
assertions that exist (`verify-admin-token-contrast.test.ts:165-181,
335-...`) check two hand-picked existing tokens (`--admin-canvas`,
`--admin-warning`/`--admin-warning-bg`) via synthetic fixtures, not the real
`tokens.css`, and not the 58 new ones. Commit c50cb6a's own text — "The
load-bearing assertions in the same test are untouched and still pass: every
parsed token must resolve in BOTH themes, which is the check that would
catch a token minted into one block and forgotten in another" — overstates
what that check does: it would catch a token forgotten from `:root`, `dark`,
or `light`, but it says nothing about `print`, and print is exactly the
block the same commit's own rule #1 singles out as the one that "silently
falls back to the browser default" if missed.

One more wrinkle in that framing worth flagging: the failure mode isn't
quite "falls back to the browser default." `tokens.css`'s `@media print`
rule (`:952`) re-selects `:root, [data-theme="dark"], [data-theme="light"],
[data-admin-theme-root][data-theme="dark"] ~ *,
[data-admin-theme-root][data-theme="light"] ~ *` directly — the same
selectors the non-print theme blocks use, not a wrapper around them. A
custom property declared in the `[data-theme="dark"]` block but *omitted*
from the `@media print` block's list keeps its **dark** value when a
dark-mode user prints, because the print rule and the screen rule share
specificity and the print rule simply doesn't mention that property (CSS
cascades per-property, not per-rule). So a token missing from print doesn't
go to a neutral default — it prints whatever colour was active on screen,
which for a dark-mode user is the dark value on paper. This is a more
serious version of the failure the rule is trying to prevent than "browser
default" suggests, and it is exactly why it matters that nothing currently
tests it automatically for new tokens.

## Layer 2 coverage of the 58 new tokens

Ran `scripts/verify-admin-token-contrast.mjs` directly: 190 checks, 0
failures — reproduces the commit messages' repeated "Layer 2 stays 0"
exactly. But `derivePairs` (`:533-599`) only ever constructs a pair from (a)
status-family `-text`/`-bg` naming, (b) a short hard-coded list of
`on-primary`/solid-fill pairs, (c) any token matching
`/text|body|heading|muted/i` tested against the four `REAL_SURFACES`, or (d)
a token carrying an explicit ratio comment. Rule #5, honoured throughout this
diff, deliberately puts **no** ratio comment on any of the border, hover-fill,
shadow-ink, or scrim tokens — which is most of the 58 (borders: 8, shadow
inks: 7, scrims: 3, assorted `-bg-hover`/`-hover`/`-avatar-tint` fills:
~20+). Those tokens are picked up by Layer 2 only if their *name* happens to
match `/text|body|heading|muted/i` (a handful do —
`--admin-status-attention-text-muted`,
`--admin-status-restricted-text-hover`, the chip-icon/tone-icon foregrounds).
The rest — most of what this diff actually changed — get no automated
contrast or sanity check beyond "resolves to a parseable colour in both
themes" (which the structural test does cover). So "Layer 2 stays 0" is an
accurate but narrow measurement: it mostly confirms pre-existing pairs didn't
regress, not that the ~35+ newly-tokenised, uncommented values are correct.
That is the intended, disclosed design (an unconditional ratio comment would
mis-test a 3:1 border as a 4.5:1 text pair) — but it means correctness for
most of this diff rests entirely on the prose reasoning in each commit
message, unverified by anything that runs.

## Guard bypass surface not disclosed

`admin-oklch-ceiling.test.ts`'s own docstring discloses three limits (source-
text match only; `hsl()`/`lab()`/`color()`/hex not caught; can't tell a
correct substitution from a wrong one). Not disclosed anywhere: **the two
`SCAN_DIRS` don't cover every directory a real admin page renders through.**
`src/components/address/AddressAutocompleteField.tsx` is imported by both
`src/app/admin/bookings/new/ManualBookingForm.tsx` (admin) and
`src/features/booking/components/AboutYouStep.tsx` (the public booking
flow) — confirmed by grepping the whole `src/` tree for the import. It
currently has 0 `oklch(` literals, so there is no live defect today, but it
is a real example of a file that is genuinely part of the admin surface
(and, more pointedly, genuinely part of the *public* surface too) while
sitting completely outside both `SCAN_DIRS` entries. A colour literal added
there tomorrow — for either surface — would be invisible to the ratchet
test, invisible to the `measure-admin-contrast.mjs` census, and would ship
straight to a customer-facing page rather than staying confined to `/admin`.
Confirmed via a repo-wide `oklch(` search that, as of this diff, every
occurrence in `src/` is confined to `src/app/admin/**` and `tokens.css`
itself — so the two-directory scope happens to be complete *right now*, but
that completeness is coincidental, not structural, and nothing enforces it
going forward.

## What was checked and found correct (not just assumed)

- Ran `node scripts/measure-admin-contrast.mjs . --json`: summary reports
  `total: 125, dark: 46, light: 79, unresolvedElements: 240` — exact match to
  every post-diff number claimed in the commit messages.
- Ran `node scripts/verify-admin-token-contrast.mjs`: "ratio-comment
  mismatches: 0, pair AA failures: 0, total failures: 0" across 190 checks —
  exact match.
- Ran `npx vitest run` on the three directly relevant test files
  (`admin-oklch-ceiling.test.ts`, `verify-admin-token-contrast.test.ts`,
  `measure-admin-contrast.test.ts`): 3 files, 41 tests, all passed.
- All 58 new token names extracted from the diff match `scripts/admin-oklch-
  ceiling.json`'s implicit count (census 134→15 across the eight commits,
  152 total `--admin-*` tokens after) and are declared exactly 4× each with
  print byte-identical to light, as detailed above.
