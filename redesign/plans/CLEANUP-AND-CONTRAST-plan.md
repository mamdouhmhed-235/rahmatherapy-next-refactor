# CLEANUP AND CONTRAST — implementation plan

**Written:** 2026-08-12, immediately after the POST-BAND-C follow-up closed at 8/8
**Base commit for every anchor:** `70a5af9` on `master`
**Status:** ⛔ NOT STARTED. Nothing in this document has been actioned.
**Audience:** the agent(s) executing these fixes, and the Owner reviewing them.

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

## ITEM C — `/admin/audit` is the worst single page

**Evidence: VERIFIED.**

**70 of OWNER-dark's 113 failures are on `/admin/audit` alone** — nearly two
thirds of the remaining dark-mode defects on one route.

This is not a separate defect so much as a concentration: fix items A and B and
re-measure this route before doing anything bespoke to it. Only then decide
whether a residue remains that needs its own attention.

**Do this item LAST, and re-measure first.** Acting on it before A and B would be
fixing symptoms whose cause is already scheduled.

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
