# CLEANUP AND CONTRAST — implementation plan

**Written:** 2026-08-12, immediately after the POST-BAND-C follow-up closed at 8/8
**Base commit for every anchor:** `70a5af9` on `master`
**Status:** ✅ **CLOSED 2026-08-13.** Every item is shipped, deliberately declined,
or answered by an Owner decision. **This document is now a RECORD, not a queue —
do not work from it.** Read `redesign/HANDOFF-2026-08-13-IMPLEMENTATION-6.md`
first; §6 there lists the ten claims in this plan that failed verification, four
of which prescribed fixes that would have caused regressions if followed.
**Audience:** the agent(s) executing these fixes, and the Owner reviewing them.

> ### Where each item ended up
>
> | Item | Outcome |
> |---|---|
> | **A** buttons | ✅ `7d2f787` — one CSS line, not 30 edits |
> | **B** muted metadata | ✅ `70b9589` — but NOT as prescribed: the failures are opacity washes, not the token, and 9 of 15 sites are `aria-hidden` decorative |
> | **C** avatar discs | ✅ `1d85f97` |
> | **D.1/D.2** old brand | ✅ done before this plan closed |
> | **D.3/D.4/D.5** | ⛔ no action needed (recorded in §9) |
> | **E / E.1** dead files | ✅ `fc3989e` — Owner chose to delete the shadcn scaffolding |
> | **F** unused exports | ✅ `3f531ec` + `bd3ba1c` — 27 removed; ⛔ `AdminEmptyState` is ALIVE and was NOT deleted |
> | **F.1** disclaimer gap | ⛔ **Owner handles personally. Never raise again** |
> | **G.1** react-query | ✅ `80bd350` (Zone-2, approved) |
> | **G.2** one-off scripts | ✅ `83f262a` |
> | **G.3/G.3b** phantom deletions | ✅ `9867632` |
> | **G.4** untracked leftovers | ⛔ disk hygiene only, Owner's discretion |
> | **G.5** tracked archives | ⛔ **KEEP** — Owner decision |
> | **H.1** dead OR-branch | ⛔ deferred to that function's next edit, per this plan |
> | **H.2** `payload_nonce` | ⛔ **CLOSED** — encryption not on the roadmap, column stays |
> | **H.3** `override_type` | ⛔ DO NOT DROP |
> | **H.4** `metadata` | ⛔ no action; low value either way |
> | **H.5** `allowed_cities` | ✅ **STEP Z DONE** — `b97053e` + `3d40076`, migration `20260813012046` |
> | **I.1** formatDate | ✅ `207ac74` — but NOT as prescribed; see the handoff |
> | **I.2** stale comments | ✅ `83f262a` — four sites, not the two listed |
> | **J / K.2** Recent activity | ✅ `b469b99` — server-rendered expand link, not a client island |
> | **K.1** therapist bookings | ✅ `4c955ea` |
> | **K.3** calendar | ⛔ correctly a no-op |
> | **K.4** dashboard attention | ✅ `ca859ed` |
> | **K.5** email tabs | ✅ `2c0e749` — hedged notice; an exact count breaks a test |
> | **K.5** `countStaff()` | ✅ `83f262a` |
> | **L** export exposure | ✅ `1e75adc` |
> | **M** command palette | ✅ `5a742df`; **A2 embed rewrite still tracked** |
> | **N** unscoped collections | ✅ `7cfc4ca` `19356f8` `d8cd231` `58c21a1` |
>
> Two production defects found AFTER this plan closed, neither in it:
> **every photo on five page families was a placeholder on Cloudflare**
> (`c461b85`) and **the maintenance notice collided with the fixed header**
> (`c3790b7`). Both are written up in the handoff.

This plan collects two separate bodies of work that arrived together:

1. **Three contrast defects** that item 7 measured but deliberately did not fix,
   because each changes rendered appearance and so needed an Owner decision.
2. **A full read-only audit of the codebase** — dead code, and any surviving
   trace of the old *zamtherapy* site this project was refactored from.

## How this document was produced, and how much to trust it

The audit ran as sixteen agents: eight sweeping distinct areas, and eight more
whose only job was to **refute** what the first eight found. That second pass
earned its place — it caught **6 false positives** out of 62 candidates, each of
which would have become a wrong deletion in this plan. Those six are recorded in
§9 so nobody re-flags them.

Final tally: **49 CONFIRMED-DEAD · 7 PARTIALLY-ALIVE · 6 ACTUALLY-ALIVE**.

Every finding below carries an evidence level:

- **VERIFIED** — the orchestrator re-ran the check personally at `70a5af9`. Act on it.
- **CONFIRMED** — found by one agent, independently refuted-and-survived by another.
- **REPORTED** — one agent's finding, not independently re-tested. Re-check before acting.

⛔ **Treat every claim here as a claim to test.** The predecessor plan had 54
claims fail verification across four sessions. Assume this one has some too.

---

## 0 — Binding rules (unchanged from the previous plan; restated so this stands alone)

1. **The working tree is intentionally dirty.** `git status --porcelain -- src/ supabase/`
   must show exactly ` M src/lib/maintenance.ts` (working copy `false`, HEAD `true`).
   **Never `git add .` or `-A`. Never stash/checkout/reset to "clean" it.** Stage by path.
2. **Never touch `src/lib/maintenance.ts`.**
3. **Zone-2 actions** — migrations, data-mutating SQL, deploys, package installs,
   env changes, real emails — are **Owner-approved per action, orchestrator-performed,
   never delegated to a subagent.** `mcp__supabase__execute_sql` is SELECT-only,
   project `twzutkfgqclqurvkmvqz`.
4. **Never send a real email.** `src/lib/email/client.ts` wraps the live Resend SDK
   and `RESEND_API_KEY` is populated. Mock `@/lib/email/client` or the whole of
   `@/lib/email/notifications`; there is no third option.
5. **The dev server is Owner-run** at `http://localhost:3000` (not `127.0.0.1`).
   Never spawn, restart or kill it.
6. **Do not "fix" the four pre-existing lint errors** in
   `src/features/booking/BookingExperience{,Loader}.tsx`. They are the baseline.
7. **Baselines are by IDENTITY, not by count** — see §1.
8. Commit messages: PowerShell here-strings strip double quotes. Always
   `git commit -F <scratchpad file>`.
9. **Count with ripgrep or `git grep`, never with shell bracket globbing** —
   paths like `src/app/admin/staff/[staffId]/` miscount under raw shell glob.

---

## 1 — Gate baselines at `70a5af9`

⚠️ **THE LINT BASELINE CHANGED ON 2026-08-12** and every earlier number in this
repo's documents is now stale. `design_handoff_area_pages/` was moved out of the
repo (Owner decision — it was never tracked by git, so deleting it would have
been unrecoverable). Its three `prototype/*.jsx` files held **55 of the 59 errors
and 6 of the 7 warnings**.

New baseline: **4 errors / 1 warning in 3 files** — and those are exactly the
pre-existing ones §0.6 says never to fix:
`BookingExperience.tsx` (2× `set-state-in-effect`, 1× `immutability`),
`BookingExperienceLoader.tsx` (1× `set-state-in-effect`),
`returning-customer.ts` (1× `no-unused-vars`).

```powershell
npx tsc --noEmit    # 0, silent, exit 0
npx vitest run      # 5 failed / 2394 passed (2399) — the five by name
pnpm lint           # 4 errors / 1 warning in 3 files  (was 59/7 in 6 until 2026-08-12)
node scripts/measure-admin-contrast.mjs .      # 123 failures (45 dark / 78 light), 240 unresolved
node scripts/verify-admin-token-contrast.mjs   # 0
npx vitest run scripts/                        # 42 passed
```

The five vitest failures, by name — none of them relates to any item here:
`admin-access.test.ts` ×2 ("gives Owner broad access…", "gives Admin broad
operational access…"); `ManualBookingForm.test.tsx` ×3 ("renders step 1 on first
load", "moves focus to the first invalid field…", "shows the consent error…").
A **sixth** (`ManualBookingForm > optional email > "still rejects a malformed
email…"`, 5000 ms timeout) is a documented load flake — isolate the two files
before calling it a regression.

Lint identity is the `{file, ruleId}` multiset with counts, **never** `file:line:column`.

**Layer 3** (`node --env-file=.env ./node_modules/@playwright/test/cli.js test
e2e/admin-contrast.spec.ts --project=chromium`) is now deterministic: 328
failures, and two consecutive runs produce byte-identical evidence files. It
needs real credentials, so it is **orchestrator/Owner work, never a subagent's**.

---

## ITEM A — Buttons with no background fall through to the browser's grey ⛔ BIGGEST

> **✅ DONE 2026-08-12 — `7d2f787`. Layer 3 dark 258 → 38; sweep total 328 → 127.**
>
> **The fix was ONE LINE, not thirty edits**, and this plan's framing of it was
> wrong in a way worth recording. The cause is not thirty independent mistakes:
> `globals.css` imports only Tailwind's `theme` and `utilities` layers —
> **preflight is deliberately never imported**, because `site-parity.css` depends
> on the browser's defaults surviving. The single declaration that absence costs
> is the button background reset. Restoring just that one, in `@layer base`,
> fixes every button at once and every button written from here on:
>
> ```css
> @layer base { button { background-color: transparent; } }
> ```
>
> **Both counts in §A.1 below were also wrong.** "30" came from a regex that
> stops at the first `>`, so every button whose `onClick` contains an arrow
> function was skipped — which is most of them. Re-counted with the TypeScript
> AST it was 44. Neither number was the right unit of work.
>
> Option 1 (`bg-transparent` per button) was therefore NOT taken. It would have
> been 44 edits that fixed nothing structurally. Option 2 (`color-scheme`) was
> also not taken — it restyles browser chrome far beyond buttons.
>
> Verified in the live browser rather than reasoned about: an empty `<button>`
> appended to the page computed `rgb(240, 240, 240)` before and
> `rgba(0, 0, 0, 0)` after. Specificity keeps the blast radius contained — an
> element selector in `base` loses to every class — confirmed on both surfaces:
> admin "Sign in", public "Book Now", the mobile menu button and the consent
> banner all keep their own backgrounds.
>
> **New worst remaining dark defect:** all 19 surviving failures per role are the
> client avatar discs on `/admin/clients` — initials at 1.5–1.6:1 on
> `oklch(88% 0.025 ${hue})`. Those are the runtime-computed hues the ratchet
> allowlists; no token can hold them. See ITEM C.

**Evidence: VERIFIED.**

### A.1 The problem

30 `<button>` elements across 21 files carry a `className` with **no `bg-*` class
at all**. With no background declared, the browser paints its own default
`ButtonFace`, which is `rgb(240,240,240)` in Chrome — and because **`color-scheme`
is declared nowhere in this repo**, that grey does not invert with the theme.

In dark mode the admin's light body text then lands on a permanently-light grey:

```
rgb(225,222,215) on rgb(240,240,240) = 1.18:1
```

That is the single largest remaining dark-mode defect. It accounts for **36 of
the Layer 3 dark failures** across the OWNER, ADMIN and COORDINATOR sweeps, and
it hits real primary actions: "Confirm booking", "Mark paid", "Mark complete",
"Cancel booking", "Add note", "Mark contacted", "Add break", "Edit".

**It is also wrong in LIGHT mode**, less visibly: those buttons render on a
grey `rgb(240,240,240)` instead of the panel's near-white, which was never the
design intent. Any fix therefore changes light mode too — which is precisely why
this was not folded into item 7, where light mode was the frozen control.

Worked example, `src/app/admin/availability/WorkingHoursDayEditor.tsx:175`:

```
inline-flex h-11 … rounded-[var(--admin-radius-control)]
border border-dashed border-[var(--admin-border-form)]
text-[var(--admin-body)] … hover:bg-[var(--admin-canvas)]
```

Note it declares a `hover:` background but no resting one.

### A.2 Two options — recommendation first

| | Option 1 — `bg-transparent` per button ✅ RECOMMENDED | Option 2 — `color-scheme: dark` on the theme root |
|---|---|---|
| Change | Add an explicit background class to each of the 30 buttons | One declaration in `tokens.css`'s dark block |
| Blast radius | Exactly the 30 buttons | Every UA-painted surface in the admin: scrollbars, form controls, date pickers, autofill, `<select>` popups |
| Predictability | High — you can see each site in the diff | Low — browser-defined, varies by browser and OS |
| Effort | ~30 one-word edits | One line |

**Recommendation: Option 1.** It is more edits but every one is visible in the
diff and cannot surprise anyone. Option 2 is a single line that silently
restyles browser chrome the project has never looked at, and `color-scheme` also
affects the **public** site if applied too broadly.

**Per button, decide which is intended** — most want `bg-transparent` (they are
outline/ghost affordances with a `hover:` fill already), but a few may want an
explicit panel token. Do not apply one class blindly to all 30.

### A.3 Two of the 30 are on the PUBLIC site

`src/components/layout/SiteHeader.tsx:259` and
`src/components/consent/ConsentActionButton.tsx:28`. The public site is always
light, so these are a cosmetic grey rather than a contrast failure — but they are
customer-facing, so treat them as a separate, more carefully reviewed commit.

### A.4 Verification

- Layer 1 must not regress; the light count is expected to **move** here (that is
  the point) — record the exact before/after failure SET, not just the count,
  by diffing `--json` output against a throwaway `git worktree` at the prior commit.
- Layer 3 dark should drop by roughly 36. Run it twice and confirm byte-identical
  evidence files, which is now the standard this layer holds to.
- `tsc` 0, vitest and lint identity unchanged.

### A.5 Stop condition

If a button's resting background turns out to be load-bearing in light mode
(i.e. the grey was deliberate somewhere), stop and report rather than guessing.

---

## ITEM B — Muted metadata text below AA in light mode

**Evidence: VERIFIED** (measured by the now-deterministic Layer 3).

Light mode has 24 failures for OWNER and ADMIN, 20 for COORDINATOR, 2 for
THERAPIST_A. They are not scattered — they are one design decision repeated:

| ratio | route | text |
|---|---|---|
| 3.80:1 ×6 | `/admin/clients` | "Last visit" |
| 2.14:1 ×3 | `/admin/clients` | "·" separator |
| 2.13:1 ×3 | `/admin/operations` | "0" |
| 3.09:1 ×2 | `/admin/dashboard` | "Updated", "just now" |
| 2.27:1 | `/admin/privacy` | "0" |

These are muted metadata tones on panel. They have never been contrast-checked;
until Layer 3's transition race was fixed they were buried in ~600 phantom
failures per role.

**Approach.** Do NOT chase them one element at a time. Find which token(s) they
resolve to — most will be `--admin-text-muted` or a `/NN` opacity wash of it —
and decide once whether the muted tone should be darkened, or whether these
specific elements should stop being muted. A token change fixes them all
coherently; 24 local overrides would not.

⛔ **A token change here moves light mode globally.** That is acceptable in this
plan (it is the point) but it must be measured: capture the full Layer 1 finding
set before and after and account for every entry that moves.

**Separately, and cheaply:** the `·` separators at 2.14:1 are decorative. If they
carry no meaning, `aria-hidden` plus leaving the colour alone is defensible —
WCAG does not require contrast for purely decorative text. Decide that explicitly
rather than darkening a bullet.

---

## ITEM C — ~~`/admin/audit` is the worst single page~~ → SUPERSEDED

**Evidence: VERIFIED, then invalidated by fixing ITEM A.**

This item said "70 of OWNER-dark's 113 failures are on `/admin/audit` alone" and
told the reader to re-measure before acting. **That instruction was the correct
one, and re-measuring dissolved the item**: after `7d2f787`, `/admin/audit`
contributes **zero** dark failures. All 70 were the browser-default button grey.

**The real remaining concentration is `/admin/clients`.** Every one of the 19
surviving dark failures per role is a client avatar disc — two-letter initials
rendered at **1.5–1.6:1** on `oklch(88% 0.025 ${hue})`.

That colour is one of the 14 runtime-computed hues the oklch ratchet allowlists:
`hueFromId(client.id)` gives each person their own tint, so no token can hold it
— a token is one fixed value, and the whole point of these is that the value
varies per row. The tint therefore stays light in dark mode while the initials
stay light too.

**Two ways to fix it, neither taken here:**

1. **Compute the foreground from the hue** — derive a dark-enough ink per tint at
   render time, so the pair is correct for every hue by construction. Most
   robust; the avatar helper already computes the hue, so it is the natural home.
2. **Darken the tint in dark mode** — e.g. `oklch(32% 0.05 ${hue})` under
   `[data-theme="dark"]`, keeping light untouched. Simpler, but it needs the
   theme inside a runtime style object, which is where these literals live now.

Option 1 is the more future-proof of the two: it holds no matter what the tint
becomes. Either way this is the last measurable dark-mode defect class in the
admin, and it is worth its own small item.

---

## ITEM D — Surviving `zamtherapy` legacy

The old site left **far less** behind than expected. `git grep -il zamtherapy`
over every tracked file returns **zero**. What survives is three things.

### D.1 ⛔ A live, customer-visible storage key still carries the old brand

**Evidence: VERIFIED. This is the only user-visible remnant, and it is NOT dead code.**

| File | Line |
|---|---|
| `src/features/booking/store/booking-store.ts` | `75` — the zustand `persist` key |
| `src/lib/consent/cookie-registry.ts` | `120` — the public cookie-registry entry |
| `src/lib/consent/__tests__/registry-completeness.test.ts` | `25` — the fixture pinning it |

All three read `"zam-therapy-booking-draft-v3"`. The registry entry declares
`provider: "Rahma Therapy"` on the very next line — an in-file contradiction.

**It is rendered verbatim on the public `/cookies` page**, so a visitor reading
this site's own privacy documentation sees the previous business's name.

**Recommendation — rename, do not delete.** Change the key in all three files in
one commit. Follow the file's own convention and **bump the version rather than
reusing it**: `rahma-therapy-booking-draft-v1`.

**Accepted consequence:** any visitor with an unsubmitted package selection in
`localStorage` under the old key loses that draft. It is a convenience cache, not
booking data — no booking, payment or personal record is affected.

**Do not** rewrite the ~10 files under `redesign/evidence/C-18/` that quote the
old key. They are a dated audit trail of what was true then.

### D.2 The package name

**Evidence: VERIFIED.** `package.json:2` reads `"name": "zam-therapy-next-refactor"`.
That string appears **exactly once in the entire repo** — nothing consumes it.
Every sibling identifier has already been renamed: `wrangler.jsonc:9` and `:24`
both say `rahmatherapy-next-refactor`, and so does the git remote.

**Recommendation:** rename to `rahmatherapy-next-refactor`. Internal only; never
reaches a browser or a search engine. Zero consumers, so nothing can break.

### D.3 Old service-area names in a test fixture

**Evidence: CONFIRMED — and explicitly NOT a defect.**
`src/app/admin/reports/reporting.test.ts:266-274` uses "Barnet"/"Finchley" as
sample `service_city` values. Those are North London boroughs — the old site's
area; this business serves Luton.

The test is live, passing, and exercises a real production function
(`getCityOptionsFromBookings`). **This is a naming smell, not dead code.**
Renaming the fixture cities to Luton-area names is cosmetic and optional.

### D.4 What was checked and found clean

No trace of the old brand in: metadata, canonical URLs, OG tags, sitemaps,
robots, email templates and "from" addresses, `next.config.ts` redirects or
rewrites, `middleware.ts`, CSP or allowed-origins lists, analytics IDs, Sentry
project names, storage buckets, `.env.example`, Playwright config, the e2e specs,
every `supabase/migrations/` file, or any hardcoded absolute URL in `src/`.
The hardcoded Google review link in `templates-data.ts:335,338` was followed to
its destination and resolves to **Rahma Therapy**, not the old business.

### D.5 ⚠️ `dist/` — 16 MB of the OLD site's built HTML, on your disk

**Evidence: VERIFIED.** A top-level `dist/` holds the previous site's build
output (routes like `/hijama`, `/physiotherapy`, `/sports-massage-barnet`, all
containing "zamtherapy"). It is **gitignored and untracked** — 0 files in git.

It is not part of the codebase and ships nowhere. It is safe to delete from disk
at any time, and equally safe to leave. It is listed here only so its 16 MB of
zamtherapy text stops setting off future audits.

---

## ITEM E — Dead code: whole files nothing imports

**Evidence: VERIFIED** (importer counts re-run personally at `70a5af9`).

**8 files, 457 lines, zero importers between them.**

| File | Lines | Note |
|---|---:|---|
| `src/components/ui/form.tsx` | 102 | 8 exports, none used |
| `src/app/admin/components/admin-status-chips.tsx` | 89 | all 5 exports unused; no file imports the module |
| `src/components/ui/card.tsx` | 84 | 6 exports, none used |
| `src/components/ui/section.tsx` | 55 | |
| `src/components/ui/button-link.tsx` | 43 | |
| `src/components/ui/container.tsx` | 40 | |
| `src/app/admin/bookings/CopyButton.tsx` | 25 | |
| `src/components/ui/checkbox.tsx` | 19 | |

### E.1 ⚠️ One judgement call before deleting the `ui/` six

Five of these (`card`, `form`, `checkbox`, `section`, `container`) are
**shadcn/ui scaffolding** — `components.json` is present and the README documents
shadcn as the component source. They may be deliberately kept as an
uninstalled-but-available library rather than being dead.

**Ask the Owner: is `src/components/ui/` a curated library, or only what the app
actually uses?** If the former, leave all five and record the decision. If the
latter, delete them — and note they can be regenerated with the shadcn CLI at
any time, so nothing is lost permanently.

`admin-status-chips.tsx`, `CopyButton.tsx` and `button-link.tsx` are **not**
shadcn scaffolding — they are bespoke code that lost its last caller. Those three
(157 lines) are unambiguous deletions.

### E.2 Verification

After deletion: `tsc` 0 · vitest identity unchanged · lint identity unchanged.
`tsc` is the real gate — it covers `redesign/**/*.tsx` too, so a stray evidence
file importing a deleted component would surface there.

---

## ITEM F — Dead code: unused exports inside live files

**Evidence: CONFIRMED** (27 items, one agent found, another refuted-and-failed).
**Re-check each before acting — this is the least individually-verified group.**

Highest value first:

- `dashboard-cards.tsx` — `StaffCapacityCard`, `PaymentHealthCard`,
  `DemandTrendCard`, `TodayAgendaCard`, `adminDashboardCardClasses`
- `admin-scalable-lists.tsx` — `AdminListSurface`, `SavedViewTabs`,
  `DebouncedSearchInput`, `SearchFilterBar`, `PaginationControls`,
  `LoadMoreButton`, `FilteredEmptyState`
  ⛔ **`PaginationControls` and `LoadMoreButton` are ON HOLD — see ITEM J.**
  The performance page's "Recent activity" panel needs pagination, and these two
  are already built for it. Deleting them now would mean rewriting them later.
- `admin-ui.tsx` — `AdminEntityCard`, `MetricCard`, `DetailSectionCard`,
  `AdminEmptyState`
- `content/pages/services.ts` — `serviceTrustItems`, `homeAppointmentSteps`,
  `serviceSafetyItems`, `miniFaqs`, `serviceSafetyDisclaimer`
- `content/pages/about.ts` — `safetyItems`, `safetyDisclaimer`
- `lib/utils/format.ts` — `formatCurrencyGBP`, `formatPhoneHref`
- `lib/auth/rbac.ts` — `canViewDashboard`, `isCriticalAdmin`
- `lib/booking/availability.ts:948` — `businessTimeForAvailability`
- `lib/email/notifications.ts:935` — singular `sendBookingCancellationEmail`
- `lib/cache/tag-taxonomy.ts` — `TAG_AUDIENCE`, `EXISTING_OUTPUT_TAGS`
- `content/pages/packagePages.ts` — `packageSessionSteps`, `PackagePageSlug`
- `content/site/navigation.ts:27` — `headerCta`
- Smaller: `getGenderCapacity`, `CONFIRMED_BG_SOFT`, `canAccessBooking`,
  `DEFAULT_DELIVERY_FILTERS`, singular `getInitial`, the `amount` re-export in
  `report-insights.ts:287-289`, `export { getTodayIsoDate }` in `bookings/page.tsx:47`

⚠️ **`resetConsentStoreForTests` and `unregisterReplayGateForTests` are
test-only by design.** Their names say so. Do not delete them; they are the
"exported only for tests" category, which is a milder finding, not dead code.

### F.1 ⛔ THE `content/pages/*` COPY IS NOT DUPLICATE — AND ONE PIECE OF IT MATTERS

**Evidence: VERIFIED, after an earlier claim in this document was wrong.**

An earlier revision of this plan said these blocks were "superseded duplicates"
and that "your live site already says all of it". **Both statements were false**,
and they were corrected only because the Owner pushed back and asked for proof.
Recorded here as a worked example of why that instinct was right.

**What is true.** Each of the nine symbols appears **exactly once** in all of
`src/` and `e2e/` — at its own `export const` line. Zero imports, from anywhere,
including the area pages:

```
git grep -wn "<symbol>" -- src/ e2e/     # one hit each: the definition
```

**What was wrong.** The claim of duplication does not survive comparison:

| unused (`about.ts` `safetyItems`, 8 items) | live (`home.ts` `homeSafetyItems`, 6 items) |
|---|---|
| Pre-treatment consultation | Pre-treatment consultation |
| Clean mobile treatment setup | Clean mobile setup |
| Single-use items where required | Single-use items where required |
| **Careful hygiene-led hijama process** | — |
| **Clear explanation and consent** | — |
| Aftercare guidance included | Aftercare guidance included |
| Same-gender care for female clients | Male and female therapists · Female clients treated by female therapist |
| **Medical advice recommended where treatment is not suitable** | — |

The unused list is **richer than the live one**, not a copy of it.

**⛔ And the real finding — a medical disclaimer gap.** The disclaimer

> "Rahma Therapy provides complementary wellness treatments and does not
> diagnose or replace medical care…"

⚠️ **A second correction, in the same paragraph that carried the first.** An
earlier revision claimed the disclaimer was unused in all three content files and
that `/faqs-aftercare` did not render one. **That was wrong too.** The check was
`git grep -l "does not diagnose" -- src/components`, which searches for the
literal STRING inside components — so it silently missed every component that
imports the constant instead of inlining the text.

Traced properly, through imports rather than string matches:

| page | disclaimer? | how |
|---|---|---|
| `/faqs-aftercare` | **YES** | `SafetySuitability.tsx:3,26` imports `faqsAftercareDisclaimer` |
| `/areas`, `/areas/<slug>` | **YES** | hardcoded inline, `AreaSafetyBand.tsx:42-44` |
| `/home` | **no** | — |
| `/about` | **no** | `safetyDisclaimer` existed but was never imported |
| `/services` | **no** | `serviceSafetyDisclaimer` existed but was never imported |

**Method note worth keeping:** to decide whether text is rendered, grep for the
SYMBOL, not the string. A string search answers "is this text written here",
which is a different question from "does this page show it".

So the gap is narrower than first reported but real: **the page that sells the
treatments carries no medical disclaimer.** That is a business and liability
question for the Owner, not a code cleanup.

> ## ⛔ CLOSED — Owner decision, 2026-08-13. DO NOT RAISE THIS AGAIN.
>
> The Owner is handling disclaimer wording and placement **personally**. No
> further disclaimer is to be added to `/home`, `/about` or `/services` by an
> agent, and this is not to be re-surfaced as a finding, a recommendation or an
> open question in any future audit or handoff. It is out of scope for this
> repository's engineering work.

**Status: the unused copy was removed on 2026-08-12** (`f0454bb`, 130 lines) by
Owner decision, with the wording to be revisited separately. `faqsAftercareDisclaimer`
is live and was **not** touched.

### F.2 The two exceptions — pure aliases, no content

`packageSessionSteps = sharedSessionSteps` (`packagePages.ts:108`) and
`headerCta = bookingLink` (`navigation.ts:27`) are one-line re-exports of
something that already has a name. No words, no content decision. Safe to delete
independently of everything above.

**Method:** delete in small, themed commits (one file or one module per commit),
running `tsc` after each. `tsc` catches the mistakes here immediately.

---

## ITEM G — Dead dependency, scripts and directories

### G.1 `@tanstack/react-query` is installed and never used

**Evidence: VERIFIED.** `package.json:35`. `git grep tanstack` across the tree
returns the manifest line plus two `redesign/` documents that *already record it
as unused* ("Listed in stack table; not wired").

⛔ Removing it is a **package install — Zone-2**. Owner-approved, orchestrator-run,
and it rewrites `pnpm-lock.yaml`. Do it deliberately, not as part of a code commit.

### G.2 One-off scripts that have served their purpose

**Evidence: CONFIRMED.**

- `scripts/adapt-bookings-screenshots.mjs`, `scripts/verify-bookings.mjs`
- `scripts/add-eslint-disable.py`, `scripts/fix-jsx-apostrophes.py`,
  `scripts/fix-mojibake.py`, `scripts/swap-text-white.py` — four Python one-offs
  in a repo with no other Python
- `scripts/create-phase-test-auth-users.mjs`

⛔ **DO NOT TOUCH the contrast tooling** — `measure-admin-contrast.mjs`,
`verify-admin-token-contrast.mjs`, `admin-oklch-ceiling.{json,test.ts}` and their
tests are load-bearing and gate three of this plan's items.

### G.3 ⛔ `.playwright-mcp/` — 241 tracked files that no longer exist on disk

**Evidence: VERIFIED. This is why `git status` has been noisy for weeks.**

- **241 files tracked in git but deleted from the working copy** — they are the
  large ` D .playwright-mcp/console-*.log` block in every `git status`.
- **312 *different*, untracked files currently sitting in that directory.**

**Recommendation:** commit the 241 deletions (they are already gone from disk),
add `.playwright-mcp/` to `.gitignore`, and delete the 312 local files. That
removes a permanent source of noise and makes the tree's real dirty state — the
single intentional `maintenance.ts` line — visible again.

### G.3b `design_handoff_public_pages/` — 17 tracked files, all deleted from disk

**Evidence: VERIFIED.** The same pattern, found by inspecting the tree rather
than by an agent: 17 files tracked in git, **0 present on disk**, 0 references
from `src/`. They are the second block of ` D ` lines in every `git status`.

Between this and G.3, **258 phantom deletions** are sitting in the working copy
permanently. Commit both sets together.

⚠️ Note this is the *public-pages* handoff and is **already deleted locally**,
whereas `design_handoff_area_pages/` (G.5) is *untracked and still on disk*.
Two similarly-named directories in opposite states — do not confuse them.

### G.4 Untracked development leftovers

Safe to delete from disk whenever; none is in git.

| Path | What |
|---|---|
| `dist/` | 16 MB, the OLD site's build output (see D.5) |
| `dev-server.err.log`, `dev-server.out.log` | dev-server logs |
| `photos-rahma-therapy/` | raw client-photo dump, 52 files |

### G.5 Tracked asset archives — Owner's call

These **are** in git, so deleting them is a real change:
`rahma-therapy-image-replacements/` (14 files), `brand-logo-assets/` (59 files),
`design_handoff_area_pages/` (37 files, 6.1 MB — the handoff for the /areas
redesign, which has since shipped).

None is referenced by application code. They are design source material. Keep or
remove is a business decision about where design assets live, not a code question.
**Note `design_handoff_area_pages/prototype/*.jsx` contributes 55 of the 59 lint
errors in the baseline** — removing it would change the lint baseline, so it must
be done deliberately and the baseline re-recorded.

> ## ⛔ ANSWERED AND CLOSED — Owner decision, 2026-08-13. DO NOT RE-OPEN.
>
> **`rahma-therapy-image-replacements/` and `brand-logo-assets/` are KEPT.**
> They are the business's design source material and stay in the repository.
> A future audit must not list them as deletion candidates.
>
> `design_handoff_area_pages/` is a separate matter and was already resolved
> before this document was written — moved out of the repo by an earlier Owner
> decision, which is what took the lint baseline from 59 errors to 4.

---

## ITEM H — Database leftovers

⛔ Every action here is **Zone-2**: Owner-approved, orchestrator-performed,
presented as exact SQL in chat before running. Verification queries are
SELECT-only.

### H.1 `create_booking_request` contains a dead OR-branch

**Evidence: CONFIRMED.** The therapist-eligibility loop tests
`p.name in ('claim_bookings', 'claim_assignments')` at two points
(`supabase/migrations/20260811210000_…:200,207`). The `claim_bookings`
permission was **deleted** from `permissions` and `role_permissions` by an
earlier migration, so that half can never match.

**Cosmetic only** — `claim_assignments` is the live half and the logic is
correct. **Recommendation: fold the string change into the next edit of this
function; do not mint a migration just for it.** Rewriting an 18 KB PL/pgSQL body
carries more risk than the tidy is worth.

### H.2 `account_password_requests.payload_nonce` — reserved, not abandoned

**Evidence: CONFIRMED, and reclassified by the verifier.**
No application code reads or writes it. But
`src/lib/auth/password-reset-token.ts:5-11` documents it as *"reserved for future
migration to authenticated encryption"*.

**This is a product question, not a cleanup.** Ask the Owner whether that
encryption migration is still on the roadmap. If yes, keep it. If no, drop it.
**Do not fold it into a mechanical dead-column sweep.**

> ## ⛔ ANSWERED AND CLOSED — Owner decision, 2026-08-13. DO NOT RE-OPEN.
>
> **Authenticated encryption is NOT on the roadmap**, and the column **STAYS**.
>
> Both halves of that are deliberate. The scheme in place is not a lesser
> version of encryption — for this use case it is the stronger one. The token is
> emailed once and thereafter only ever compared, so nothing needs to read it
> back; a SHA-256 hash cannot be reversed by someone holding the whole database,
> whereas encryption would require a key to store, rotate and guard. Version 1+
> would add an attack surface to buy a capability nothing here wants.
>
> The column is left in place because removing it costs a migration — Owner
> approval, DDL against production — to delete an empty nullable column that
> harms nothing. That trade is not worth making.
>
> **A future audit must not list `payload_nonce` as dead schema, and must not
> propose this migration again.** The rationale is duplicated at the top of
> `src/lib/auth/password-reset-token.ts` so it is found by whoever greps the
> code rather than the plan. Only a real product requirement to read a token
> back out should revive this.

### H.3 `staff_availability_overrides.override_type` — read-only, no writer

**Evidence: CONFIRMED. ⛔ DO NOT DROP.**
Four production readers, and the only insert site never sets it. That is a
**partially-implemented feature**, not dead schema — an admin control for
"mark this date fully blocked" was never built. Recorded as a known scope
boundary in `redesign/evidence/C-14/phase-c-verify-full.md:164`.

### H.4 `email_delivery_events.metadata`

**Evidence: REPORTED.** Written at `admin/emails/actions.ts:270` on resend;
no confirmed reader. Low value, low risk. Verify with a live SELECT before acting.

### H.5 Already scheduled — do not re-open

`business_settings.allowed_cities` is deliberately still present, superseded by
`free_travel_cities`, and is removed by **Step Z**, which runs **only after the
next production deploy**. That is the previous plan's business, not this one's.

---

## ITEM I — Code rot inside live files

**Evidence: CONFIRMED, with the verifier correcting the finder on two points.**

### I.1 Duplicated formatters

- **`formatMoney` — 6 copies.** ⚠️ The verifier proved they are **NOT
  byte-identical**: two type-incompatible variants exist (one takes
  `number | string | null`, the other a plain `number`), and
  `BookingDetailSidebar.tsx:141` depends on the wider signature. **A naive
  "delete five, import one" breaks `tsc`.** Consolidate deliberately, on the
  wider signature, or leave it.
- **`formatTime` — 7 copies** of `value.slice(0, 5)`. All live and called.
- **`formatDate('full')` — 2 copies that have already drifted**: one pins the
  rendering timezone, the other does not, which on Cloudflare Workers (UTC) means
  they can render different dates. ⚠️ The verifier found a canonical helper
  already exists — **`src/lib/time/london.ts` (`formatBusinessDate`)**, already
  imported by `admin/bookings/format.ts`. Point the consolidation at that rather
  than inventing a new one.

**Priority: the `formatDate` divergence is the only one with a correctness edge.**
The other two are tidiness.

### I.2 Comments describing behaviour the code no longer has

`src/app/admin/bookings/actions.ts:83-89` and `:1084-1087`, plus the twin
docblock in `src/app/admin/clients/actions.ts:450-455`, describe
`bookings.cancelled_at` as a column that has not arrived yet. **The migration
that adds it shipped** (`20260728073903_c04a_scheduled_emails.sql:102`) and the
column is exercised by `clients/__tests__/deleteClient.test.ts:366,386`.

This codebase has a documented history of this exact rot — item 7 found two colour
comments naming colours the tokens no longer had. **Worth a dedicated sweep.**

---

## ITEM J — "Recent activity" grows without limit on the performance page

**Raised by the Owner 2026-08-12, with a screenshot. Evidence: VERIFIED.**

### J.1 What it does today

`/admin/staff/[staffId]/performance` (and the self view) renders a "Recent
activity" panel that is **one flat, unpaginated column**:

- `PerformanceSurface.tsx:320` fetches **100** audit rows.
- `:325` passes `allEvents.slice(0, 20)` to the panel.
- `ActivityTimeline.tsx:91-97` maps **every** event it is given into an `<ol>`.
  There is no pagination, no cap, no "show more" — the slice at the call site is
  the only thing bounding it.

So the panel is always as tall as 20 rows, and the page inherits that height.
The Owner's screenshot shows it dwarfing the KPI tiles and the chart beside it.

### J.2 ⛔ The screenshot shows a second, larger problem

Roughly **fourteen consecutive rows read "You updated availability rule —
availability rules `<id>`"**, all "3 days ago". That is one bulk save writing one
audit row per rule. Pagination would hide it; it would not fix it.

**Check before building anything:** does a single availability save emit N audit
events? If so, the panel is not too long — it is repeating itself, and the same
noise is presumably in `/admin/audit` too.

### J.2a ⛔ THE DIAGNOSTIC QUESTION IN §J.2 IS ANSWERED: THERE IS NO BULK-WRITE BUG

**Evidence: VERIFIED.** `saveAvailabilityDay` (`availability/actions.ts:105-113`)
writes **exactly one** audit row per save. Its own comment says so:

> *A day is now several rows, so there is no single target row. The first
> segment is a real row at write time; before/after carry the full picture.*

So the ~14 near-identical rows in the Owner's screenshot are **14 genuine
separate saves**, each correctly logged. The audit trail is right.

**That flips the recommendation below.** Option 1 (collapse repeated events) is
now WRONG — it would hide a legitimate trail. **Option 2, pagination, is the
answer**, which is what the Owner asked for in the first place. `LoadMoreButton`
fits: this panel is a flat list with no filters or sorting layered over it, which
is exactly the case the generic component suits and exactly why it did not suit
`/admin/clients`.

### J.3 Three options

| | Approach | Effect |
|---|---|---|
| **1** | **Collapse consecutive same-action events** — "You updated 14 availability rules · 3 days ago", expandable | Fixes the cause. 20 rows becomes ~6 meaningful ones. Best reading experience |
| **2** | **Paginate / "Show more"** — what the Owner asked for | Bounds the height. The repetition survives, just spread over pages |
| **3** | Lower the slice from 20 to ~8 | One number. Least work, least value — hides recent history rather than presenting it |

**Recommendation: 1, then 2 if it is still long.** Grouping attacks the reason
the panel is "ridiculously large"; pagination only moves it. If the audit trail
genuinely needs one row per rule (it may, for accountability), then 2 is right
and 1 is wrong — which is why J.2 must be answered first.

### J.4 ⛔ DO NOT DELETE THE PAGINATION COMPONENTS THIS PLAN ALREADY WANTS GONE

**This item collides with ITEM F.** `admin-scalable-lists.tsx` already contains
**`PaginationControls` (`:127`) and `LoadMoreButton` (`:172`)** — fully built,
matching the admin's styling, and currently referenced by nothing, which is
exactly why ITEM F lists them for deletion.

Deleting them and then re-writing pagination a week later would be the worst of
both. **Resolve ITEM J before acting on those two entries in ITEM F.** If option
2 or 1-then-2 is taken, they stop being dead code and become the implementation.

---

## ITEM K — The unbounded-list register (the systemic answer to ITEM J)

**Owner's question, 2026-08-12: "what if other pages have the same issue?"**
Answered by a twelve-agent sweep of all six admin areas — six finding, six
refuting. **21 verdicts: 5 CONFIRMED-UNBOUNDED · 12 ACTUALLY-BOUNDED ·
2 BOUNDED-IN-PRACTICE · 2 OVERSTATED.**

⛔ **Why this could not be eyeballed.** Production is 15 bookings, 6 therapists,
~40 email events, one city. **Every list in the admin looks fine today.** The
question was never "how long is it now" but "what stops it growing".

### K.1 ⛔ THE ONE THAT SILENTLY HIDES DATA — Therapist "My bookings"

**Evidence: VERIFIED personally at `70a5af9`. Severity: HIGHEST here, and it is
not the Owner's view — it is the Therapist's.**

| | |
|---|---|
| Renders | `bookings/page.tsx:477-501` |
| Ids from | `bookings-list-data.ts:516-521` — `booking_assignments` by `assigned_staff_id`, **no date filter, no limit** = every assignment ever |
| Rows capped by | `SCOPED_BRANCH_ROW_CAP = 200` (`:662`), applied at `:727` and `:741` |
| Pager | **None. `pageCount: 1` is hard-coded** for this branch at `:882-885`, so `PaginationBar` renders nothing |

**The cap was designed as an anomaly backstop, and its own comment states the
assumption that no longer holds:**

> *"one practitioner's own assignments plus the open, gender-matched,
> future-dated slots they may claim is a working set of tens, not hundreds. The
> cap exists so a data anomaly degrades into a truncated list rather than an
> unbounded fetch."*

That reasoning describes a **working set**. But the id query has no date filter,
so what it actually returns is **lifetime history**. Rows come back
`booking_date DESC`, so when the cap binds it is the therapist's **oldest**
bookings that vanish — with no error, no truncation notice, and no way to reach
them.

**When it binds:** at ~4-5 bookings/week, inside year one. The verifier
re-derived it on a more conservative even-split baseline (~2.5/week) and still
got **~80 weeks — about 18 months.**

**Fix:** this branch genuinely cannot be `.range()`d (documented at `:24-29`,
`:653-661`), so the generic components do not fit. Either date-window the
assigned-ids query by default with a link-based "load older" that raises the cap
via a query param, or split into a recent view plus a paged history view.
**Whatever is chosen, the truncation must become visible** — a silent cap on a
person's own work history is the actual defect.

### K.2 Confirmed unbounded, lower urgency

| Surface | Where | Bound | Grows per |
|---|---|---|---|
| **Calendar day/week/range agenda** | `calendar/page.tsx:1420-1481` (`PerDatePanel`), `:1367-1411` (`DayAgenda`) | **none** — the `.slice()` there is copy-before-sort, not a cap | booking in the visible window; a range view over a busy period renders every card |
| **Dashboard "Needs your attention" dialog** | `dashboard/attention-group-client.tsx`, fed from `dashboard-cards.tsx:1150-1153` | **none on the query** — `dashboard-data.ts:518-577` fetches enquiries / email events / ops events unfiltered | email event ever sent (~2-4 per booking) |
| **Client detail → Privacy panel** | `clients/[clientId]/page.tsx:1394` | **none** — every other rail on that page is capped | GDPR request per client (rare; likely <50 in 3 years) |
| **Staff directory** | `staff/page.tsx:613` and `:647` | **none** — and an unused `countStaff()` already sits at `staff-list-data.ts:292-306` for exactly this | staff headcount (slow; 6 → maybe 15) |

The last two are **low** — real, but they grow slowly enough to fix whenever
those pages are next touched.

### K.3 Checked and genuinely fine — do not re-flag

12 verdicts came back ACTUALLY-BOUNDED. Worth recording so the next audit does
not re-litigate them:

- `/admin/bookings` clinic-wide branch — real SQL `.range()` with an `id`
  tiebreak (`:697-714`)
- `/admin/clients` — deliberately paged in memory; the file documents why a SQL
  pager would produce "a correct-looking page of wrong rows"
- `/admin/audit` — its own `AuditLoadMoreButton`
- Booking series page — `.limit(10)` upcoming / `.limit(5)` past, with exact
  head-counts and a "View all N visits" hand-off to the paged list
- Booking detail activity timeline — two `.limit(10)` merged, then
  `.slice(0, 20)`, with a mobile overflow count
- Per-booking participants / items / assignments — `MAX_PARTICIPANTS = 6`, a real
  domain cap
- `/admin/operations` — **zero findings across the whole area**

### K.4 Two findings the verifier knocked down — recorded so they are not re-raised

The **Emails → Reminders** and **Review requests** tabs were reported as
unbounded. They are not: Reminders is `.limit(20)`, Review requests is
`.limit(40)` then `.slice(0, 20)`. Rendered rows are **fixed at 20 forever**.

There is a smaller real issue underneath, worth one line rather than an item:
**neither tab tells you when the true backlog exceeds what is shown**, so the
badge and list can quietly under-represent reality. A "showing 20 of N" count
would close it.

### K.5 Suggested order

1. **K.1** — the only one that hides data a user is entitled to see.
2. **ITEM J** — the Owner-reported panel; smallest, uses `LoadMoreButton`.
3. **K.2 calendar and dashboard** — before the business grows, not after.
4. **K.4** — a "showing 20 of N" count on the two email tabs.
5. **K.2 privacy panel and staff directory** — whenever those pages are next open.

---

## ITEM L — ⛔⛔ A THERAPIST CAN EXPORT EVERY CLIENT'S NAME. FIX THIS FIRST.

**Evidence: VERIFIED end to end personally, at `45db023`. This is a data-exposure
defect, not a performance one.** It surfaced from the unbounded-list design pass
because it shares a root cause with ITEM N — it is not a pagination issue and
must not be scheduled as one.

### L.1 The chain, every link checked

| # | Fact | Where |
|---|---|---|
| 1 | The route's only gate is `canOpenReports(profile) && (canExportOwnReports(profile) \|\| canExportRevenueReports(profile))` | `reports/export/route.ts:27` |
| 2 | **`Therapist` is granted `view_reports_own` AND `export_reports_own`** — so it passes that gate | `supabase/migrations/20260509143000_granular_rbac_consolidation.sql:283-284` |
| 3 | The report is chosen by an unvalidated query param — `url.searchParams.get("report")` | `export/route.ts:32` |
| 4 | It calls `getReportData(adminClient, profile, filters)` directly | `export/route.ts:35` |
| 5 | `getReportData` returns `clients: clientsResult.data ?? []` — **the whole clients table, unscoped, for every profile** | `reporting.ts:390` |
| 6 | The route **never calls `filterReportDataToStaff`** — confirmed by grep; every other consumer does | `export/route.ts` (absent) |
| 7 | `report=client_summary` maps `data.clients` straight to CSV rows: `client_id, full_name, source, created_at` | `export/route.ts:89-96` |
| 8 | `revenueAllowed` masks **money columns only** (`"hidden"`). There is **no per-report permission check anywhere** | `export/route.ts:36-37, 64-155` |

**Therefore:** any Therapist — or any custom role holding `view_reports_own` +
`export_reports_own` — can request

```
/admin/reports/export?report=client_summary
```

and download a CSV containing **every client's full name in the clinic**,
including clients they have never treated and are not assigned to.

### L.2 Why nothing caught it

- The permission gate *looks* right — it checks an export permission, and passes.
- `filterReportDataToStaff` exists and is applied on **16 call sites in
  `reports/page.tsx`**. The export route is the one path that skips it.
- `calendar-data.ts:3-4` even asserts in a comment that *"getReportData applies
  its own RBAC narrowing from the profile it is given"* — which is true **only**
  for `bookings`/`assignments`/`bookingItems`, and false for `clients`, `staff`,
  `enquiries`, `emailEvents` and `operationalEvents`. That comment is itself a
  trap for the next reader.

### L.3 The fix

**Immediate, smallest correct change** — narrow inside `getRows()` before the
CSV is built, for any profile without universal report scope:

```ts
// export/route.ts, before getRows
const scoped = hasUniversalReportScope(profile)
  ? data
  : filterReportDataToStaff(data, profile.id);
```

⛔ **Then re-verify the other reports on the same route**, not just
`client_summary`. `staff_workload_report` and `staff_revenue_attribution_report`
ride on `assignments`, which *is* scoped — confirm that, do not assume it.

**Belt and braces, recommended alongside:** add an explicit per-report
permission map so a new report cannot inherit the wrong audience by default.
Today `getRows` will happily serve any string that matches one of its branches.

### L.4 Verification

- As a Therapist test account, request each `report=` value and confirm every row
  belongs to that therapist's own scope.
- Confirm an Owner's exports are byte-identical to today (this must not narrow
  anything for a universal-scope profile).
- `reports/__tests__/` — add a case asserting a non-universal profile's
  `client_summary` export contains only its own clients. There is **no test for
  the export route today**; that absence is part of the finding.

---

## ITEM M — The global command palette has the same asymmetry as ITEM K.1

**Evidence: CONFIRMED by the design pass, then re-verified by its critic.**

`searchBookings` (`src/app/admin/search-actions.ts`) powers `AdminCommandSearch`,
which `AdminTopNav` mounts on **every** `/admin/*` page for **every** shell.

- **All-rows branch** (`VIEW_BOOKINGS_ALL` / `MANAGE_BOOKINGS_ALL`): queries
  `bookings` directly with the predicate and `.limit(8)` — O(1) forever.
- **Scoped branch** (assigned-only capability): calls `getOwnBookingIds(staffId)`,
  which reads **every** `booking_assignments` row for that staff with **no
  `.limit()`**, then feeds the entire array into `.in("id", …)`.

Same shape as ITEM K.1: the privileged branch is bounded, the scoped one is not.
**A page-by-page sweep could never find this** — it lives in global nav, not a
page. That is precisely the Owner's point about variants, vindicated.

⛔ **The critic found the reference implementation has the same latent flaw.**
`SCOPED_BRANCH_ROW_CAP = 200` in `bookings-list-data.ts` bounds only the **final
row fetch**; the `assignedIds` array feeding `.in()` is built from an equally
uncapped `booking_assignments` query (`:518-521`). So ITEM K.1 and ITEM M share a
defect, and K.1's cap does not actually cover it.

**Endorsed fix:** ship **A1 now** — a documented `.limit()` on `getOwnBookingIds`,
mirroring the existing idiom — and track the embed-filter rewrite (A2) as a
fast-follow **gated on a regression test**, because the schema permits two
`booking_assignments` rows for the same therapist on one booking (a
multi-participant booking), and an `!inner` embed could fan out or dedupe
differently. There is **no `search-actions.test.ts` anywhere in the repo**; add
one.

---

## ITEM N — `getReportData` fetches five collections unscoped, for everyone

**Evidence: CONFIRMED. This is the root cause behind ITEM L.**

`getReportData` (`reporting.ts`) scopes only `bookings` (and derivatively
`assignments`, `bookingItems`) to the caller. It fetches `clients`, `staff`,
`enquiries`, `email_delivery_events` and `operational_events` as **full,
unfiltered clinic-wide tables on every call, for every shell variant** —
including a bare Therapist holding none of `VIEW_CLIENTS_ALL`, `VIEW_STAFF`,
`MANAGE_ENQUIRIES` or `VIEW_EMAIL_LOGS`.

It has **four** live callers, not the two first identified:
`reports/reports-data.ts`, `performance-data.ts` (→ `/admin/me` **and**
`/admin/staff/[staffId]/performance`), `reports/export/route.ts` (ITEM L), and
**`calendar/calendar-data.ts:40,92`** — a fourth surface the design missed and
the critic found.

**Fix:** scope the five collections for non-universal profiles, mirroring
`dashboard-data.ts`'s existing `plan.variant === "therapist"` branch, which
already does exactly this. **Do ITEM L first** — L is the reachable exposure and
needs a same-day patch; N is the structural repair underneath it.

---

## ITEM K — endorsed designs (updated after the design + critique pass)

The critics returned **1 SOUND, 5 NEEDS-CHANGES, 0 WRONG-APPROACH**. What to
build, per surface:

**K.1 Therapist bookings** — the shape is right: resolve candidates cheaply,
filter/sort/page **in memory**, hydrate only the current window. ⛔ But the
critic found a **blocker**: the candidate read must apply the request's own
from/to/status/search predicates **before** the cap, or a therapist still cannot
search their way to a truncated booking. Extend the existing
`buildBookingPredicatePlan`/`applyBookingPredicates` rather than writing a second
predicate implementation. Also re-point `getVisibleViewCounts` (`page.tsx:327-332`)
at the candidate set, or every filter chip silently under-reports once a
therapist exceeds one page.

⛔ **A test currently encodes the bug as intended behaviour:**
`booking-view-counts.test.ts:345-367` — *"leaves the therapist-scoped branch
un-paged (one page, no range)"* — asserts `pageCount: 1`. It must be rewritten,
not merely kept passing.

**K.2 Recent activity (ITEM J)** — the only **SOUND** verdict. Scoped cursor
pagination: a new server action plus a minimal client island reusing
`LoadMoreButton` and the exported `ActivityRow`. Authorises correctly for the
people who most need it — self-view and managers **without** `MANAGE_AUDIT_LOGS`,
for whom the "View full audit timeline" footer link is not reachable.

**K.3 Calendar** — ⛔ **do nothing.** Independently confirmed: the date window is
already the bound (`RANGE_SOFT_CAP_DAYS = 31`), and both `.slice()` calls are
copy-before-sort. Adding a cap would risk dropping rows from the **print** path.
The finding was real; the correct response is a no-op with the reasoning recorded.

**K.4 Dashboard attention** — push the two predicates that every consumer
**already applies in JavaScript** (`delivery_status === 'failed'`,
`status === 'open'`) into SQL. Behaviour-preserving, uses composite indexes that
already exist (`20260503220000_phase8_operational_visibility.sql:7-8,29-30`), and
correctly leaves `enquiries` alone.

**K.5 Slow growers — three different answers, deliberately:**
- Client Privacy panel: **leave uncapped**. Staff-mediated, permission-gated,
  one client's lifetime.
- Staff directory: **delete `countStaff()`** rather than invent a job for it.
- Email tabs: add "showing 20 of N" — but ⛔ the critic warns a second head-count
  query inside `getReviewRequestCandidates` breaks an existing test; reuse the
  existing split `count`/`page` helpers instead.

---

## 9 — ⛔ CHECKED AND ALIVE. Do not re-flag these.

The adversarial pass proved these are **not** dead. Recorded so the next audit
does not spend budget rediscovering them.

| Thing | Why it is alive |
|---|---|
| `zam-therapy-booking-draft-v3` | Rendered on the public `/cookies` page via `COOKIE_REGISTRY`. Rename, never delete (D.1) |
| `reporting.test.ts` "Barnet"/"Finchley" | A live, passing test of a real production function (D.3) |
| `shadcn` package | Consumed by `components.json` and documented in the README |
| `formatTime` ×7 | All seven are called |
| `formatDate` ×2 | Both called; the divergence is real but neither is dead |
| `cancelled_at` comments | Stale prose, live code |
| `resetConsentStoreForTests`, `unregisterReplayGateForTests` | Test-only by design |
| `/privacy`, `/areas` + 5 spokes | Live pages with no inbound nav link — SEO landing pages, intentional |
| `staff_availability_overrides.override_type` | Partially-implemented feature, four live readers |

---

## 10 — Suggested order

Independent of each other; this order front-loads value and defers anything
needing an Owner decision.

| # | Item | Why here | Zone-2? |
|---|---|---|---|
| 1 | **G.3 + G.3b** the 258 phantom deletions | Clears the noise hiding every other `git status` | No |
| 2 | **D.2** package name | One word, zero consumers | No |
| 3 | **D.1** the storage key rename | The only customer-visible legacy remnant | No |
| 4 | **E** the 3 unambiguous dead files (157 lines) | Pure subtraction, `tsc` gates it | No |
| 5 | **A** buttons with no background | The biggest defect; needs the most review | No |
| 6 | **B** muted metadata | A token decision; measure the whole light set | No |
| 7 | **C** re-measure `/admin/audit` | Only meaningful after A and B | No |
| 8 | **F** unused exports | Long tail; small themed commits | No |
| 9 | **I.1** the `formatDate` divergence | The one correctness edge in item I | No |
| 10 | **G.1** drop `@tanstack/react-query` | Rewrites the lockfile | ⛔ YES |
| 11 | **H** database items | Each needs its own SQL approval | ⛔ YES |

**Blocked on an Owner decision before they can start:** E.1 (is `ui/` a curated
library?), F's `content/pages/*` copy, G.5 (the tracked asset archives), H.2
(is authenticated encryption still on the roadmap?).

---

## 11 — The final report should state

- Which items shipped, with commit SHAs.
- Every anchor that had drifted, and what it drifted to. Silence here means
  "I did not check", not "nothing moved".
- For items A and B: the full Layer 1 finding **set** before and after, with every
  moved entry accounted for — not just the totals.
- Layer 3 run twice, with confirmation the evidence files are byte-identical.
- The three gates by identity, with the vitest five named and the lint
  `{file, ruleId}` multiset per file.
- The state of `src/lib/maintenance.ts` (expected: working copy `false`,
  HEAD `true`, unstaged).
- Any claim in this document that failed verification.
