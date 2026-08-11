# x2 — Cross-cutting collision matrix and corrected ordering

**Audits:** `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` (whole plan, focus on the ordering table §"Suggested order and commits", lines 1205–1224 at `33f895f`)
**Method:** every claim below was independently re-derived from the live repo (Windows, `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`) and the live Supabase project `twzutkfgqclqurvkmvqz`, read-only. Commands and raw output are inline. Nothing here was taken on the plan's word.

**Anchor note:** `src/` is byte-identical between `33f895f` and HEAD (per handoff), so file existence and line-count claims below were re-verified against the current tree and can be trusted as current, not just "true as of `33f895f`". No anchor drift was found for the files this report checked (all listed in "Anchors" below), and every symbol used was re-located, not assumed from a line number.

---

## 1. Method

For every item (1–8) I read its plan section end-to-end, extracted every file it edits (not just the files named in its own "Files" table — I also pulled files named in prose, e.g. item 8's `notifications.ts` symbol references at §8.8), then verified each file:
- **exists** (`Glob`/`Read`),
- **carries the symbol** the plan names (`Grep` for the exact function/const/component name),
- for oklch-literal claims, **carries the exact count** the plan states, using two different counting methods (see §4 — this surfaces a real defect in the plan's own arithmetic).

All `oklch(` counts below were produced with:
```bash
grep -c "oklch(" <file>            # LINE count — counts a line once even if it has 2+ literals
grep -oP "oklch\(" <file> | wc -l  # OCCURRENCE count — counts every literal
```
Both are reported wherever they diverge, because the plan itself uses both without saying so (§4 below).

---

## 2. Complete file → items matrix

**Legend:** ● = item edits this file. ° = item reads/depends on this file's *data* but does not edit it (e.g. an env var, a migration's resulting column) — included only where it affects ordering.

| File | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| `src/lib/email/notifications.ts` | ● | | | | | | | ● | **UNSTATED COLLISION — see §3.1.** Item 1 adds `REVIEW_REQUEST_CLIENT_COOLDOWN_MONTHS`, `getClientsAskedForReviewSince`, and edits `sendReviewRequestEmail` (line 1356). Item 8 edits `BOOKING_ANIL_SELECT`→`BOOKING_EMAIL_SELECT` (line 123) and `getBookingTemplateInput` (line 216) for the fee line-item. Same file, different functions, ~230 lines apart. |
| `src/app/api/cron/review-emails/route.ts` | ● | | | | | | | | Item 1 only. |
| `src/app/admin/emails/actions.ts` | ● | | | | | | | | Item 1 adds a sibling action. 0 oklch literals — not an item-7 file despite living in the same directory as `page.tsx`. |
| `src/app/admin/emails/page.tsx` | ● | | | | | | ● | | **UNSTATED COLLISION.** Item 1 adds a new manual-send form beside `ReminderResendForm` at line ~925. Item 7 Phase B token-drives this file's 17 literal-carrying lines (29 raw occurrences — see §4). Item 1 runs before item 7 in the plan's own order (position 6 vs 7), so item 7 must re-grep this file's anchors after item 1 lands, not just "before editing" in general. |
| `src/app/(public)/privacy/page.tsx` | | ● | | | | | | | Item 2 only. Grepped for `city`/`travel`/`area` — one incidental match ("town or city, area and postcode" in the data-collected list, §2 of the page), unrelated to item 8's service-area model. **No real collision with item 8**, contrary to what the assignment brief flagged as a candidate — confirmed clean. |
| `src/app/admin/availability/page.tsx` | | | ● | | | ● | ● | | 7 literal-lines / 8 occurrences. Item 3 (secondary sort) and item 6 (date-grouping) both touch this file's query blocks; item 7 must token-drive its literals afterward. |
| `src/app/admin/staff/[staffId]/availability/page.tsx` | | | ● | | | ● | | | 0 oklch literals — item 7 does not need to touch this file even though items 3+6 do. |
| `src/app/admin/availability/availability-data.ts` | | | | | | ● | | | 0 oklch literals — same, no item-7 overlap. |
| `src/app/admin/staff/[staffId]/availability/lib.ts` | | | | | | ● | ● | | 9 lines / 9 occurrences (no line here carries 2 literals). |
| `src/app/admin/availability/AvailabilityOverridesManager.tsx` | | | | | | ● | ● | | 6 lines / 7 occurrences. |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` | | | | | | ● | ● | | 1 line / 2 occurrences. |
| `src/app/admin/components/AdminTopNav.tsx` | | | | | | | ● | | 13 lines / 23 occurrences. **Confirmed clean of items 3/6** — see §3.2. Also carries the (already-shipped, `51942b0`) C-10 padding fix, unrelated to this plan. |
| `src/app/admin/settings/SettingsForm.tsx` | | | | | | | ● | ● | **UNSTATED COLLISION.** 22 lines / 37 occurrences for item 7. Item 8 rewrites `ServiceAreaField` copy (§8.4, lines ~373–397, 674–786) and adds the Owner-only origin field UI in the *same component*. |
| `src/app/admin/settings/actions.ts` | | | | | | | | ● | 0 oklch — not an item-7 file. Item 8 adds the `manage_travel_origin` permission check here. |
| `src/app/admin/settings/page.tsx` | | | | | | | | ● | 0 oklch — not an item-7 file. Item 8 touches the fallback default at line 19. |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | | | | | | | ● | | 57 lines / 79 occurrences — the single largest item-7 file. Item 8 does **not** touch this file (manual-booking admin creation form is out of item 8's edit list) — confirmed no collision, despite both being "big booking-adjacent forms." |
| `src/app/admin/bookings/new/page.tsx` | | | | | | | | ● | 0 oklch. Item 8 §8.4 lists this as a consumer of the renamed column. |
| `src/app/admin/bookings/[bookingId]/page.tsx` | | | | | | | ● | ● | **UNSTATED COLLISION.** 13 lines / 21 occurrences for item 7. Item 8 §8.8 explicitly adds a town-list fetch to `getBookingDetailData` in this same file, to power the new out-of-zone alert. |
| `src/app/admin/bookings/BookingManagementForm.tsx` | | | | | | | ● | ● | **UNSTATED COLLISION.** 9 lines / 13 occurrences for item 7. Item 8 §8.8 adds the travel-charge `£` input + "New total" preview to `StatusAndPaymentSection` (lines 689–938) in this same file, and gates the quick-confirm chip (lines 336–346). |
| `src/app/admin/bookings/actions.ts` | | | | | | | | ● | 0 oklch. Item 8 extends `updateBookingManagement` (§8.6) and the completed/paid lock. |
| `src/app/admin/bookings/series/[templateId]/page.tsx` | | | | | | | | ● | 0 oklch. Item 8's series-level travel-charge control (§8.7) lives here. |
| `src/app/admin/bookings/series/[templateId]/SeriesActions.tsx` | | | | | | | ° | ● | 1 oklch line — below item 7's stated top-13 table (it's "long tail"), but a real, unstated micro-collision if item 7's later batches reach this file after item 8 has edited it. |
| `src/app/admin/staff/page.tsx` | | | | | | | ● | | 19 lines — matches plan's table exactly. Item 8 does not touch this file. |
| `src/app/admin/clients/[clientId]/page.tsx` | | | | | | | ● | | 15 lines — matches plan's table exactly. Not an item-8 file (its "audit action type already exists" reference is read-only). |
| `src/app/admin/calendar/page.tsx` | | | | | | | ● | | 13 lines — matches plan's table exactly (D6). |
| `src/app/admin/operations/event-row.tsx` | | | | | | | ● | | 3 lines (D6 cluster). |
| `src/components/ui/button.tsx` | | | | | | | ● | | 4 lines / 8 occurrences. Shared with `/booking/manage` — see §3.3. |
| `src/components/ui/input.tsx` | | | | | | | ● | | 10 lines / 10 occurrences. Shared with `/booking/manage`. |
| `src/components/ui/badge.tsx` | | | | | | | ● | | 11 lines / 22 occurrences. Shared with `/booking/manage` (its **only** live admin usage is via `AdminStatusBadge`, a different, already-clean component — confirmed 0 `<Badge` call sites in `src/app/admin/**` via `grep -rn "<Badge" src/app/admin`). |
| `src/app/booking/manage/ManageBookingForms.tsx` | | | | | | | ° | | Imports `Button`, `Input`, **and `Textarea`** (plan names only Button/Input). `Textarea` has 0 oklch literals so it adds no new risk, but the plan's import list at §7.7a is incomplete — see §5. |
| `src/app/booking/manage/page.tsx` | | | | | | | ° | | Imports `Badge`. Confirmed outside both `(public)/` and `admin/`. |
| `src/lib/booking/availability.ts` | | | | | | | | ● | Item 8 deletes the `isCityAllowed` gate block (§8.5). |
| `src/features/booking/schemas/booking-schema.ts` | | | | | | | | ● | Item 8 removes `validateServiceArea`/`BOOKING_ALLOWED_CITIES`. |
| `src/features/booking/schemas/booking-schema.test.ts` | | | | | | | | ● | Rewritten per §8.5. |
| `src/features/booking/BookingExperienceLoader.tsx` | | | | | | | | ● | **LINT-BASELINE COLLISION — see §6.** One of the six baseline-error files. Item 8's prop-threading edit lands directly around the file's one pre-existing lint error. |
| `src/features/booking/BookingExperience.tsx` | | | | | | | | ● | **LINT-BASELINE COLLISION — see §6.** One of the six baseline-error files, holding 3 of the 59 baseline errors. |
| `src/features/booking/utils/returning-customer.ts` | | | | | | | | | **Not** touched by item 8 (verified — no reference in the plan text, confirmed by grep). This is the *one* baseline file of the three booking-feature files that stays untouched. |
| `src/features/booking/components/AboutYouStep.tsx` | | | | | | | | ● | Item 8 §8.8 rewrites the `isOutsideCoverage` notice. |
| `src/features/booking/components/ConfirmStep.tsx` | | | | | | | | ● | Item 8 §8.8 adds the travel-charge reassurance line. |
| `src/app/(public)/layout.tsx` | | | | | | | | ● | Item 8 threads the free-travel list down the same prop chain as `bookingWindowDays`. |
| `src/lib/email/templates.ts` | | | | | | | | ● | Item 8's 7-spot list for the labelled fee line. |
| `src/lib/email/sample-data.ts` | | | | | | | | ● | Same. |
| `src/app/admin/audit/format.ts` | | | | | | | | ● | Only if a new `action_type` is registered (optional per plan). |
| `src/lib/booking/customer-manage.ts` | | | | | | | | ● | Numerically correct via folding; only the line-item split is new code. |
| `src/app/api/cron/extend-recurring-horizons/route.ts` | | | | | | | | ● | Item 8 §8.7 adds `template.travel_fee` to the cron's price computation. |
| `supabase/migrations/*` (new files, item 4) | | | | ● | | | | | 1 new migration: 4 `CREATE INDEX IF NOT EXISTS` on `bookings`. |
| `supabase/migrations/*` (new files, item 8) | | | | | | | | ● | 4 new migrations: rename `allowed_cities`→`free_travel_cities` + new `mileage_origin` column + `manage_travel_origin` permission (Phase 1, could be 1 or 2 files); `bookings.travel_fee` (Phase 3); `recurring_booking_templates.travel_fee` (Phase 4); plus a `CREATE OR REPLACE FUNCTION create_recurring_booking_series` to accept the fee. **Same `bookings` table as item 4's migration** — see §3.4. |
| `scripts/measure-admin-bundles.mjs` | | | | | ● | | | | Item 5 only. |
| `redesign/baselines/bundle-post-band-c.json` (new) | | | | | ● | | | | New file, no collision. |
| `.next/**` (build output, gitignored) | | | | | ● | | | | Regenerated by item 5's mandatory `pnpm build`. **Not a file-collision in the tracked-file sense, but a real operational hazard — see §3.5.** |
| `src/styles/tokens.css` | | | | | | | ● | | Phase 0, Workstream 1. Not touched by any other item. |
| `src/styles/site-parity.css` | | | | | | | ● | | Phase 0 Step 0.3. Not touched by any other item — but its **effect** (site-wide `<a>` colour) reaches item 8's new customer-facing links; see §5. |
| `scripts/verify-admin-token-contrast.mjs` + `.test.ts` | | | | | | | ● | | Item 7 only. |
| `scripts/measure-admin-contrast.mjs` + `.test.ts` | | | | | | | ● | | Item 7 only. |
| `e2e/admin-contrast.spec.ts` | | | | | | | ● | | Item 7 only. |

**Files touched by 2+ items (summary):**

| File | Items | Kind of collision |
|---|---|---|
| `src/lib/email/notifications.ts` | 1, 8 | Same file, different functions — sequencing/anchor risk, not logically incompatible |
| `src/app/admin/emails/page.tsx` | 1, 7 | Same file — item 1 adds UI, item 7 token-drives existing literals |
| `src/app/admin/settings/SettingsForm.tsx` | 7, 8 | Same file, same component (`ServiceAreaField`) region |
| `src/app/admin/bookings/[bookingId]/page.tsx` | 7, 8 | Same file — item 8 adds a data fetch, item 7 token-drives literals |
| `src/app/admin/bookings/BookingManagementForm.tsx` | 7, 8 | Same file, same section (`StatusAndPaymentSection`) |
| `src/app/admin/bookings/series/[templateId]/SeriesActions.tsx` | 7, 8 | Minor — 1 literal, item 8 builds the series control here |
| `src/app/admin/availability/page.tsx` | 3, 6, 7 | Query blocks (3, 6) then literal substitution (7) — plan already sequences this correctly |
| `src/app/admin/staff/[staffId]/availability/lib.ts` | 6, 7 | Same |
| `src/app/admin/availability/AvailabilityOverridesManager.tsx` | 6, 7 | Same |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` | 6, 7 | Same |
| `src/components/ui/{button,input,badge}.tsx` | 7 (edits), 8 (consumes via `/booking/manage`) | Not a co-edit — a **blast-radius** dependency: item 7 edits, item 8's live customer surface renders the result |
| `src/features/booking/BookingExperience.tsx`, `BookingExperienceLoader.tsx` | 8 (edits), lint baseline (pre-existing) | See §6 |
| `bookings` table (Postgres) | 4, 8 | Different columns (indexes vs `travel_fee`), same table — no logical conflict, sequencing note only |

---

## 3. Collisions checked against the assignment's specific candidates

### 3.1 Item 1 × item 8 on `src/lib/email/**` and `src/app/admin/emails/**` — CONFIRMED, real, unstated

```bash
$ grep -n "BOOKING_EMAIL_SELECT|getBookingTemplateInput|sendReviewRequestEmail" src/lib/email/notifications.ts
123:const BOOKING_EMAIL_SELECT = `
216:async function getBookingTemplateInput(
1356:export async function sendReviewRequestEmail(
```

Item 1 (§1.3) adds its cooldown constant, batch helper, and the `"client_recently_asked"` reason **inside `sendReviewRequestEmail`** (line 1356 onward). Item 8 (§8.8) lists `BOOKING_EMAIL_SELECT` (line 123) and `getBookingTemplateInput` (line 216, total computed at what is currently `:255`) among its "7 spots" for the labelled travel-charge line. **Same 1,400+-line file, ~230–1,100 lines apart, different functions.** Not logically incompatible (nothing in one function depends on the other), but:
- both items will edit this file, and the plan's own ordering (item 1 at position 6, item 8 at position 8) means item 8 lands second — **the executing agent must re-grep `getBookingTemplateInput` and `BOOKING_EMAIL_SELECT`'s line numbers after item 1 ships**, because item 1's insert will have shifted them. The plan's general "anchors drift" rule (§1.6) covers this in principle but never calls out that these two specific items share this specific file.
- `src/app/admin/emails/**` itself is **not** shared with item 8 — checked and clean (item 8 has zero references to any file under `src/app/admin/emails/`).

### 3.2 Item 3/6 × item 7 on "six availability files, 23 literals" — CONFIRMED, with one caveat

The plan's own §7.7a states items 3+6 collide with item 7 on "six availability files that already carry 23 `oklch()` literals" and that items 3+6 **do not** touch `AdminTopNav.tsx`.

**Both verified true**, with the six files and their line-counts:

| File | Item 3/6 touches it? | oklch lines | oklch occurrences |
|---|---|---|---|
| `src/app/admin/availability/page.tsx` | 3, 6 | 7 | 8 |
| `src/app/admin/staff/[staffId]/availability/page.tsx` | 3, 6 | **0** | **0** |
| `src/app/admin/availability/availability-data.ts` | 6 | **0** | **0** |
| `src/app/admin/staff/[staffId]/availability/lib.ts` | 6 | 9 | 9 |
| `src/app/admin/availability/AvailabilityOverridesManager.tsx` | 6 | 6 | 7 |
| `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` | 6 | 1 | 2 |
| **Sum** | | **23** | **26** |

Line-count sum = 23, matching the plan's figure **exactly** — but only via line-counting, not occurrence-counting (§4 explains why this matters). **Caveat the plan should state explicitly:** 2 of the 6 named files (`staff/[staffId]/availability/page.tsx`, `availability-data.ts`) carry **zero** literals. The real collision surface is 4 files, not 6 — naming all six as "carrying literals" overstates the risk in those two and could make an implementer waste time checking files that need no item-7 edit at all.

`AdminTopNav.tsx`: confirmed 13 lines / 23 occurrences of `oklch(`, confirmed **zero** references to it anywhere in item 3 or item 6's text (`grep -c "AdminTopNav" <plan>` inside the item-3/item-6 sections returns 0). The correction the plan made in §7.7a (retracting an earlier, wrong claim that items 3/6 collide on `AdminTopNav.tsx`) is itself correct.

### 3.3 Item 8 × item 7 on `SettingsForm.tsx`, `ManualBookingForm.tsx`, `BookingManagementForm.tsx`, `bookings/[bookingId]/page.tsx`, `bookings/actions.ts` — PARTIALLY CONFIRMED

| File | Item 7 literal count (lines/occ) | Item 8 touches it? | Collision real? |
|---|---|---|---|
| `SettingsForm.tsx` | 22 / 37 | Yes (§8.4, `ServiceAreaField`) | **YES** |
| `ManualBookingForm.tsx` | 57 / 79 | **No** — not referenced anywhere in item 8's text | **NO** — checked and clean |
| `BookingManagementForm.tsx` | 9 / 13 | Yes (§8.6, §8.8 `StatusAndPaymentSection`) | **YES** |
| `bookings/[bookingId]/page.tsx` | 13 / 21 | Yes (§8.8, `getBookingDetailData`) | **YES** |
| `bookings/actions.ts` | 0 / 0 | Yes (§8.6, `updateBookingManagement`) | No literal collision (file has no oklch) — but it's the same file item 1 does **not** touch, so no triple collision either |

The assignment's candidate list assumed `ManualBookingForm.tsx` was a collision; it is not — confirmed clean, no reference to it anywhere in item 8's plan text and no natural reason for item 8 to touch the admin-created-booking form (item 8's write paths are `updateBookingManagement` for existing bookings and the public booking flow, not the admin manual-creation form).

### 3.4 Item 4 × item 8 on `supabase/migrations` — naming/ordering gap, not a schema conflict

Verified live:
```sql
-- pg_indexes on bookings, before either item:
bookings_pkey                              (id)
bookings_client_status_completed_idx       (client_id, status) WHERE status='completed'
idx_bookings_recurring_template            (recurring_template_id) WHERE recurring_template_id IS NOT NULL
```
Item 4 adds 4 new indexes on `bookings (booking_date, start_time, id | status, booking_date | assignment_status, booking_date | client_id)`. Item 8 Phase 3 adds a **column** `bookings.travel_fee`. Different DDL operations, no logical conflict, and Postgres serializes DDL on the same table with a normal lock — no data risk either way. **This is not a real technical collision.**

**What the plan does not specify, and should:** a **migration filename/timestamp allocation rule**. The existing convention is `YYYYMMDDHHMMSS_<slug>.sql` (confirmed: latest is `20260809160000_c14_override_breaks.sql`). Item 4 needs 1 new file; item 8 needs up to 4 (rename, mileage-origin+permission, `bookings.travel_fee`, `recurring_booking_templates.travel_fee`, possibly a 5th for the `create_recurring_booking_series` `CREATE OR REPLACE`). If an implementer generates several of these filenames in the same session with `date +%Y%m%d%H%M%S` run back-to-back (a very plausible authoring pattern), two files can collide on the same 14-digit timestamp within the same second, or — worse — a stale copy-paste from a template can produce a duplicate filename outright. Nothing in the plan tells the implementer to check `ls supabase/migrations | tail` (or equivalent) for the latest timestamp before minting a new one, or to space new migrations at least one minute apart. **This is a real, concrete gap — see §7 missing_from_plan.**

### 3.5 Item 5 × everything — the `.next/` regeneration hazard, UNADDRESSED by the plan

Verified:
```bash
$ cat next.config.ts | grep -i distDir      # no output — no override
$ cat package.json | grep '"dev"\|"build"'
"dev": "next dev",
"build": "next build",
```
No `distDir` override exists, so `next dev` (the Owner's long-running process at `localhost:3000`) and `next build` (item 5's mandatory step, §5.4) **write to the same `.next/` directory**. This is a well-known Next.js hazard: running a production build while a dev server is live against the same `.next/` output can corrupt the dev server's manifest/chunk state (stale or mismatched chunk hashes, HMR breakage, 404s on static assets) and typically requires the dev server to be **restarted** to recover.

The plan's rule 7 says "No `pnpm build` except where item 5 explicitly requires one" and rule about the dev server says "never spawn, restart or kill it" — but **the two rules are in tension** the moment item 5 runs while the Owner's server is up, because item 5's own build may force a restart that the executing agent is explicitly forbidden from performing itself. **This was not tested here** (rule 6 of this audit's own instructions forbids running `pnpm build`) — it is reported as a well-documented Next.js operational risk, not a measured one. UNVERIFIABLE by this agent, by design; the plan should say so too rather than treating item 5's build as a two-line footnote.

### 3.6 Item 2 × item 8 on public copy — checked, clean

```bash
$ grep -in "city\|cities\|travel\|area" "src/app/(public)/privacy/page.tsx"
79:  Your address, town or city, area and postcode, plus any access or parking
```
One incidental match, describing data collected on the booking form — unrelated to the service-area/travel-fee model. **No file or content overlap between item 2 and item 8.** The assignment's candidate is not a real collision.

---

## 4. A defect in the plan's own arithmetic: two different counting methods produce two different numbers, silently

The plan's headline claim (§7.2): **"677 hardcoded `oklch(…)` colour literals across 99 files."** Verified:
```bash
$ grep -rlP "oklch\(" src/app/admin | wc -l     # 99  (file count)
$ grep -roP "oklch\(" src/app/admin | wc -l     # 677 (occurrence count)
```
Both match exactly — the headline figure is a true **occurrence count** (`grep -o`, counting every literal even if two share a line).

But the plan's **per-file breakdown table** (§7.4) and, derivatively, the "23 literals in six files" collision claim (§7.7a, verified accurate in §3.2 above) were built with a **line count** (`grep -c`, counting a line once no matter how many literals it holds):

| File | Plan's stated count | Matches `grep -c` (lines)? | Matches `grep -oP \| wc -l` (occurrences)? |
|---|---|---|---|
| `ManualBookingForm.tsx` | 57 | ✅ 57 | ❌ 79 |
| `SettingsForm.tsx` | 22 | ✅ 22 | ❌ 37 |
| `emails/page.tsx` | 17 | ✅ 17 | ❌ 29 |
| `staff/page.tsx` | 19 | ✅ 19 | ❌ (not re-checked, expect similar gap) |
| `clients/[clientId]/page.tsx` | 15 | ✅ 15 | ❌ (not re-checked) |
| `AdminTopNav.tsx` | 13 | ✅ 13 | ❌ 23 |
| `bookings/[bookingId]/page.tsx` | 13 | ✅ 13 | ❌ 21 |
| The "23 literals, six availability files" figure | 23 | ✅ 23 (see §3.2) | ❌ 26 |

**Why this matters, concretely:** §7.9's own text documents *why* lines commonly carry two literals — a foreground and a background arbitrary-value class stacked on one Tailwind `className`, e.g. `badge.tsx:56`'s `bg-[var(--admin-primary)]/12` beside `text-[var(--admin-primary)]`. `badge.tsx` itself is 11 lines / **22 occurrences** — almost exactly double, because nearly every badge variant pairs a background and a foreground literal on one line. The plan's own "94 distinct colour values" and "top-10 account for ~483 occurrences" analysis (§7.2) is presumably built from the occurrence count (677), since that is the number the top-10 table's percentages were computed against — but the **per-file** table used for planning Phase B's batch order (§7.6–7.7) uses the *other* metric. An implementer using the per-file table to size a commit ("22 literals in `SettingsForm.tsx`, should be a small diff") will find roughly 37 individual arbitrary-value expressions to substitute — a real, if modest, underestimate of the diff size, and more importantly a real risk to **Phase C's guard test** (§7.8): "start it at the current count as a ratchet." If the ratchet is implemented as a source-text `oklch(` **occurrence** match (the natural implementation — a regex `matchAll`, not a line match) but the plan's tracked-toward-zero figures throughout the document are line counts, the ratchet's own printed number will never agree with the plan's running commentary, and a reviewer comparing "was progress made" against the wrong baseline will misjudge it.

**Recommendation for the deepened plan:** pick one method — occurrence count is the more honest one, since it is what the guard test will almost certainly implement (a literal is a literal, regardless of which line it shares) — and restate every count in §7.2, §7.4, and §7.7a using it, with a one-line note explaining the discrepancy so nobody "fixes" the table to the wrong number.

---

## 5. Collisions the plan does not state at all (beyond the assignment's candidates)

1. **`src/app/admin/bookings/series/[templateId]/SeriesActions.tsx`** — 1 oklch line, not in item 7's stated table (it's "long tail"), and it is exactly the file item 8 builds its series-level travel-charge control in (§8.7). Low severity, but if item 7's tail batches run after item 8 has landed the series control, the new UI must also be re-grepped, not just the pre-existing 6 lines.
2. **`src/app/booking/manage/ManageBookingForms.tsx` imports `Textarea` too**, not just `Button`/`Input` as §7.7a states. Confirmed `Textarea` carries 0 oklch literals, so this doesn't add risk today — but the plan's own blast-radius list for the "known trap" surface is incomplete, and if a future literal is ever added to `textarea.tsx`, the existing "two primitives" framing in §7.7a would miss it. Worth widening the stated import list to "Button, Input, Textarea" for completeness even though only two currently carry literals.
3. **Phase 0 Step 0.3 (cascade-layer fix, site-wide `<a>` colour) vs. item 8's new customer-facing links.** Item 8 adds new copy to `AboutYouStep.tsx` (§8.8, the out-of-zone notice) and `ConfirmStep.tsx` (the travel-charge reassurance line) — plausible homes for a "contact us" or similar link. Step 0.3 is explicitly allowed to "run at any point, including first" (§ ordering, last paragraph). If it runs **after** item 8 ships, item 8's brand-new links are in-scope for Step 0.3's mandatory before/after evidence sweep but the plan's evidence-gathering instructions (§7.5b Step 0.3) were written before item 8 existed and don't mention re-sweeping item 8's surfaces. **Not a blocking issue, but the deepened plan should say:** if Step 0.3 lands after item 8, its "measure the reach first" step (§7.5b precondition 2) must explicitly include any `<a>` elements item 8 added.
4. **`bookings` table shared by items 4 and 8** (different columns, no conflict — documented in §3.4 for completeness of the matrix, not because it's risky).

---

## 6. THE LINT BASELINE COLLISION — item 8 vs. the six-file, 59-error baseline

Baseline reproduced exactly:
```bash
$ pnpm lint
...
✖ 66 problems (59 errors, 7 warnings)
```
Per-file breakdown (own script, cross-checked against the raw eslint output):

| File | Errors | Warnings | Rules |
|---|---|---|---|
| `design_handoff_area_pages/prototype/area-page.jsx` | 48 | 1 | `react/jsx-no-undef` (×47), `react/no-unescaped-entities` (×1) |
| `design_handoff_area_pages/prototype/shared.jsx` | 2 | 5 | `react/jsx-no-undef` (×2 errors); `@next/next/no-img-element` (×4 warnings), `@typescript-eslint/no-unused-vars` (×1 warning) |
| `design_handoff_area_pages/prototype/site-chrome.jsx` | 5 | 0 | `react/jsx-no-undef` (×5) |
| `src/features/booking/BookingExperience.tsx` | **3** | 0 | `react-hooks/set-state-in-effect` (line 201), `react-hooks/immutability` (line 253 — `applyFormIssues` accessed before its declaration at line 386), `react-hooks/set-state-in-effect` (line 340) |
| `src/features/booking/BookingExperienceLoader.tsx` | **1** | 0 | `react-hooks/set-state-in-effect` (line 34) |
| `src/features/booking/utils/returning-customer.ts` | 0 | **1** | `@typescript-eslint/no-unused-vars` (line 61, `_savedAt`) |
| **Total** | **59** | **7** | |

Sums verified: 48+2+5+3+1 = 59 errors; 1+5+0+0+0+1 = 7 warnings. Matches the plan's stated baseline exactly, and confirms exactly six files, matching the plan's "exactly six files" claim byte for byte (`design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`).

**Item 8 touches 2 of these 3 booking-feature files — confirmed by reading both, not just grepping the plan:**

- **`BookingExperience.tsx`** — item 8 §8.5 threads the free-travel-city prop chain "`(public)/layout.tsx` → `BookingExperienceLoader.tsx` → `BookingExperience.tsx` → `AboutYouStep`", and §8.2 names `BookingExperience.tsx:429` (`goToTime`) as the function whose behaviour changes once the schema-level service-area gate is removed. Read directly: `goToTime` (lines 428–443) calls `bookingDetailsSchema.safeParse` — the exact schema item 8 is modifying — and sits **9 lines below** `applyFormIssues`'s declaration (line 386), which is itself the target of the pre-existing `react-hooks/immutability` error at line 253 (a function accessed 133 lines before its own declaration — a genuine, pre-existing hoisting-order code smell, not something item 8 introduces). Any prop-threading edit to this component's top-level signature or its `useEffect` blocks (lines 195–341, which is where 2 of this file's 3 baseline errors already live) will shift the line numbers eslint reports for lines 201, 253, and 340.
- **`BookingExperienceLoader.tsx`** — item 8's own §8.5 text names the exact edit sites: "`BookingExperienceLoader.tsx:23-26,89-93`". Read directly: lines 23–26 are the destructured-props function signature, and lines 89–93 are the JSX call passing those props to `<BookingExperience>`. The file's **one** baseline error sits at line 34 (`setShouldLoad(true)` inside a `useEffect`, `react-hooks/set-state-in-effect`) — directly **between** the two edit sites the plan names. Adding a new destructured prop at line ~25 will push line 34's error to a new line number as a direct, unavoidable consequence of the edit the plan itself specifies.
- **`utils/returning-customer.ts`** — **not** touched by item 8 (confirmed: no reference anywhere in the plan text, and no natural reason to touch it — it only handles the returning-customer localStorage prefill, unrelated to service areas or fees). This file's single warning is safe from any item-8 disturbance.

**Why "by identity" needs a sharper definition before an implementer touches these files.** §8's baseline rule says "a matching total with a different failure swapped in is a FAIL," but doesn't say what "identity" is keyed on. ESLint's own output identity is `{file, line, column, ruleId, message}`. Since item 8's edits to `BookingExperience.tsx` and `BookingExperienceLoader.tsx` are **guaranteed to shift line numbers** for pre-existing, unrelated errors (this is not a risk, it is a certainty of adding lines above an existing error), a byte-for-byte or line-keyed comparison of `pnpm lint` output **will** register a "different failure" even when nothing about the underlying defects changed. That is a false regression under a naive identity check, and a real, silent pass-through of a genuine regression under a check that ignores line numbers entirely (e.g. it would not catch `react-hooks/immutability` becoming `react-hooks/exhaustive-deps` on the same file if the count stayed at 3).

**The correct identity key for this specific situation, and the one the deepened plan should mandate:** compare the **multiset of `{file, ruleId}` pairs, per file, with counts** — i.e. "`BookingExperience.tsx` still has exactly 2× `react-hooks/set-state-in-effect` + 1× `react-hooks/immutability`, `BookingExperienceLoader.tsx` still has exactly 1× `react-hooks/set-state-in-effect`" — **not** exact line:column. This tolerates the line-shift item 8's own specified edits will cause, while still catching a genuinely new or genuinely fixed error (which would change the `{file, ruleId}` multiset). Line numbers should still be **read and sanity-checked by eye** (did the error move to a plausible new location, roughly proportional to how many lines were inserted above it, and not to a completely different function?) but must not be the automated pass/fail key.

**What an implementer must do, concretely, when item 8 touches these two files:**
1. Run `pnpm lint 2>&1 | grep -A2 "BookingExperience"` (both files) **before** editing, and record the exact `{rule, approximate line}` set (already done above, this session).
2. After editing, re-run the same filtered lint and confirm: same rule set, same counts per rule per file, line numbers shifted by a delta consistent with the number of lines inserted above each error (not by an unrelated amount, which would indicate the edit landed inside or reordered the flagged code rather than merely being adjacent to it).
3. **Do not** attempt to "fix" the 4 pre-existing errors in these two files as a drive-by while editing nearby — that would be an uninstructed change under this repo's "surgical changes" norm, and it would also change the very count/identity the baseline gate is checking, which needs its own reviewed change if ever wanted, not one bundled into item 8.
4. If an edit must land **inside** `goToTime` (lines 428–443) or the `useEffect` at lines 245–275 that references `applyFormIssues` — plausible, since `goToTime`'s schema call is exactly what item 8's Phase 2 changes the behaviour of — re-verify the `react-hooks/immutability` finding didn't change shape (e.g. if `applyFormIssues` is ever moved above its call site as part of an unrelated cleanup, that error would legitimately disappear, dropping the file to 2 errors — which would be a **real, welcome** count change that the "by identity" gate needs to be able to accept as a positive delta, not just flag as "different from baseline").

---

## 7. Corrected ordering — dependency graph

```
                         ┌─────────────────────────────────────────────┐
                         │  ITEM 2 (privacy copy)                       │  isolated — 1 file, no deps
                         └─────────────────────────────────────────────┘

                         ┌─────────────────────────────────────────────┐
                         │  ITEM 4 (bookings indexes)  ⛔ Zone-2         │  isolated in code; shares
                         │  gate: Owner approves exact SQL in chat      │  `bookings` table with item 8
                         └─────────────────────────────────────────────┘  Phase 3 (no logical conflict)

  ITEM 3 (secondary sort)
        │  prerequisite — item 6 groups by date, which is only
        │  deterministic once a date's segments are contiguous
        ▼
  ITEM 6 (date-based counting)
        │  both land in: availability/page.tsx, staff/…/availability/page.tsx,
        │  availability-data.ts, staff/…/lib.ts, AvailabilityOverridesManager.tsx,
        │  StaffAvailabilityOverridesManager.tsx
        │  reason for the edge: item 7 Phase B token-drives 4 of those same 6
        │  files (23 literal-lines) — editing colour and editing query/grouping
        │  logic in the same lines at the same time is exactly how the two
        │  efforts corrupt each other
        ▼
  ITEM 7 Phase B (substitution) — must land AFTER 3+6 on those 4 files
        (Phase 0 of item 7 is NOT on this edge — see below)

  ITEM 5 (bundle tooling)                                  isolated in code (own script + new
        │                                                  baseline file), BUT:
        │  reason for the soft edge: item 5's mandatory     — shares `.next/` with the Owner's
        │  `pnpm build` writes to the same `.next/`         live dev server (operational hazard,
        │  directory the Owner's dev server serves from     unaddressed by the plan, §3.5)
        ▼                                                  — should ideally run AFTER items 7
   (no hard code dependency — placed here only because       and 8 change the admin/public bundle
    a late build gives a more representative baseline)       shape, not right after Band C, or its
                                                              "post-band-c" baseline undercounts
                                                              what the plan's own later items add

  ITEM 1 (review-email cooldown + manual send)
        │  reason for the edge into item 8: both edit
        │  src/lib/email/notifications.ts (different
        │  functions, ~230-1100 lines apart) — item 1
        │  must land first per the plan's own order, and
        │  item 8 must re-grep BOOKING_EMAIL_SELECT /
        │  getBookingTemplateInput's line numbers after
        ▼
  ITEM 8 (travel-charge model) ⛔ 4× Zone-2 migrations
        │  internal phase order (already correctly stated
        │  in the plan, §8.12's "ordering note"):
        │  Phase 1 (settings) → Phase 2 (remove gates,
        │  needs Phase 1's setting to read) → Phase 3
        │  (fee on bookings) → Phase 5's chip-gating MUST
        │  land with Phase 3, not after → Phase 4 (recurring)
        │  can run any time after Phase 3 exists
        ▼
  ITEM 7 Phase B remainder (SettingsForm.tsx, BookingManagementForm.tsx,
  bookings/[bookingId]/page.tsx, SeriesActions.tsx) — must land AFTER item 8
  on these specific files, for the same reason as the 3+6 edge above

  ITEM 7 Phase 0 (theme resolution, D1/D7/D8/D9/D12)
        — disjoint from every other item's files (tokens.css, site-parity.css,
          layout.tsx, Layer-2 verifier). Confirmed: no other item's file list
          intersects Phase 0's file list.
        — CAN run first, in parallel with anything, EXCEPT:
        — Step 0.3 (cascade-layer fix) is the one sub-step with a real edge:
          if it runs after item 8 ships new customer-facing links (AboutYouStep,
          ConfirmStep), its mandatory before/after evidence sweep must be
          widened to cover item 8's new surfaces, which the plan's current
          Step 0.3 text (written before item 8 existed) does not mention.
```

### Items safe to run in parallel (no file/table/symbol intersection, confirmed by the matrix in §2)

- **Item 2** with anything.
- **Item 4** with anything in code (its migration is schema-isolated from item 8's migrations — different columns on `bookings`, no FK, no trigger interaction found via `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` returning only `create_booking_request`, which item 4 never touches).
- **Item 7 Phase 0** (Steps 0.1, 0.2, 0.4, 0.5) with items 1–6 and with item 8's early phases — confirmed zero file intersection with `tokens.css`, `site-parity.css`, `layout.tsx`, or the Layer-2 verifier anywhere else in the plan.
- **Item 5** with items 1–4 and 6 (no file intersection) — but see the `.next/`-sharing caveat in §3.5, which is an operational (not file) constraint and argues for running item 5 *later*, not for blocking parallelism with these items specifically.

### Items that MUST be serialized (confirmed real file-level collisions, not just "the plan says so")

1. **3 → 6** (existing, correctly stated, prerequisite relationship — grouping needs the secondary sort to be deterministic).
2. **(3, 6) → item 7 Phase B**, specifically on the 4 non-empty availability files (§3.2).
3. **item 1 → item 8**, specifically on `notifications.ts` (§3.1) — the plan's overall order already has this right (1 at position 6, 8 at position 8) but never states *why* in file terms.
4. **item 8 → item 7 Phase B**, specifically on `SettingsForm.tsx`, `BookingManagementForm.tsx`, `bookings/[bookingId]/page.tsx`, `SeriesActions.tsx` (§3.3, §5.1) — the plan's overall order already has this right (8 at position 8, but item 7 is at position 7, i.e. **before** item 8!). **This is a real ordering defect: the plan's own top-level table runs item 7 before item 8, but item 7 Phase B cannot safely finish substituting `SettingsForm.tsx` / `BookingManagementForm.tsx` / `bookings/[bookingId]/page.tsx` until item 8 has added its new fields to those same files, or item 8's new UI will ship with hardcoded literals that item 7 already considered "done."** The two are only compatible if item 7's Phase B is explicitly split: the batches that touch these 4 shared files must run **after** item 8, even though item 7 as a whole is scheduled before item 8 in the plan's table. The plan does not say this anywhere — it is a genuine gap, not a restatement of something already covered.
5. **item 8's own internal phases**, per its own §8.12 note (Phase 2 needs Phase 1; Phase 5's chip-gating must land with Phase 3) — already correctly stated in the plan, restated here only because it interacts with point 4 above (Phase 3/5's files are exactly the ones item 7 also needs).

### Zone-2 approval gates — where they sit in the corrected order

| Gate | What's approved | Sits after | Sits before |
|---|---|---|---|
| Item 4's migration | 4 `CREATE INDEX IF NOT EXISTS` on `bookings` | Items 2/3/6 can precede it or not — no dependency | Item 8 Phase 3 (both touch `bookings`, no conflict, but cleaner to apply 4's indexes before 8 adds a new column so the post-apply `pg_indexes` check in §4.3 isn't confused by an unrelated concurrent schema change) |
| Item 8 Phase 1 migration(s) | rename `allowed_cities`→`free_travel_cities`, add `mileage_origin`, add `manage_travel_origin` permission | Item 1 (shares `notifications.ts`, no schema link, but plan's own order already sequences it this way) | Item 8 Phase 2 (needs the renamed column to exist before code reads it) |
| Item 8 Phase 3 migration | `bookings.travel_fee` | Item 8 Phase 2 | Item 8 Phase 5 (chip-gating needs the column to exist) and item 7's edits to `BookingManagementForm.tsx`/`bookings/[bookingId]/page.tsx` (those files' new UI reads `travel_fee`) |
| Item 8 Phase 4 migration | `recurring_booking_templates.travel_fee` + `create_recurring_booking_series` replace | Item 8 Phase 3 | — |

**Migration-naming gate the plan should add** (§3.4): before authoring any of item 4's or item 8's migration filenames, run `ls supabase/migrations | tail -3` (or equivalent) to confirm the newest existing timestamp, and mint each new filename **at least 60 seconds apart** from the previous one and from each other, in the order they are meant to apply. This is cheap, mechanical, and entirely missing from the plan today.

---

## 8. Which items are safe to abandon midway, and which leave a broken intermediate state

| Item | Safe to abandon mid-way? | Why |
|---|---|---|
| **1** | **Mostly.** The cooldown guard (§1.3) is additive and defaults to off-impact (`ignoreClientCooldown` defaults false, the guard only ever *suppresses* sends, never adds one). If abandoned after §1.3–1.5 but before §1.6 (the manual admin action), the cron simply has a working cooldown and no UI regression exists. **Not safe to abandon mid-`sendReviewRequestEmail` edit** if the sentinel-writing change (§1.3's "do NOT write the sentinel when suppressing for cooldown") is only half-applied — that specific ordering must land atomically within the function, or a booking could be wrongly retired. |
| **2** | **Yes, fully safe at any point.** It's a copy change to one page; even a partial rewrite of §6 that stops mid-sentence is a content bug, not a broken build (though obviously undesirable — should still be finished as one commit). |
| **3** | **Yes, per-query.** Each `.order()` addition is independent of the other four; a partial rollout (2 of 5 queries fixed) just means some lists remain non-deterministically ordered — no crash, no data loss. Not a broken *state*, just an incomplete fix. |
| **4** | **N/A — Zone-2, single atomic migration.** Either the 4 `CREATE INDEX IF NOT EXISTS` statements all apply or the migration fails outright (Postgres wraps it in a transaction via `apply_migration`); there is no partial-applied state to abandon into. Rollback is `DROP INDEX` ×4 per the plan (§4.3), already correct. |
| **5** | **Yes, but leaves `.next/` in a build state** (not a src/ state) — cosmetically messy for the Owner's dev server (§3.5) but not destructive; the existing `bundle-pre-B1.json` is explicitly protected from being overwritten (§5.3b), so even a fully-abandoned item 5 cannot corrupt historical data. |
| **6** | **NOT safe to abandon between §6.4's query change and §6.4's Manager-component change.** If the page-level query is switched to fetch `PAST_ROW_FETCH_CEILING` rows and grouped/sliced to dates, but `AvailabilityOverridesManager.tsx`'s `pastShown: past.length` (etc., the table at §6.4) is not yet updated to consume the new date-grouped shape, the component will either crash on a shape mismatch or silently display the wrong number — this is exactly the "failure mode this must not reproduce" the plan itself names in §6.5. **Each of the two trees (admin, staff) should be treated as one atomic commit**, matching the plan's own suggested commit shape, not partially landed across a session boundary. |
| **7 Phase 0** | **Step 0.1 and 0.2 are each independently safe to abandon after landing** (de-aliasing a token, or correcting one token's value, are both self-contained and revertable, as the plan itself states: "each is independently revertable"). **Step 0.3 is explicitly NOT safe to start and abandon** — its own gate (§7.5b) requires 3 preconditions completed *before* any code changes, and mid-way abandonment after the CSS import is re-layered but before the before/after evidence sweep is complete would leave a site-wide, unverified visual change live with no proof it didn't break something. This is the plan's own ⛔ stop-and-ask, correctly placed. |
| **7 Phase A/B** | **Yes, safe to abandon at any commit boundary**, provided each commit is genuinely one file or one directory batch (as instructed) — the whole design of the "light mode is the control" rule (§7.7) means a half-finished substitution pass just leaves some files still on literals, which is the pre-existing bug, not a new one. **Not safe mid-single-file-edit** if a substitution is applied to a background but not yet to its paired foreground on the same line (or vice versa) — that specific pairing could visually break before the commit lands, which is exactly why the plan says never to split "Classes 1 and 2" fixes across commits smaller than a whole primitive file. |
| **8** | **NOT safe to abandon mid-phase, and only safe to abandon at a PHASE boundary, in phase order.** Concretely: abandoning after Phase 1 (settings) but before Phase 2 (removing the 3 gates) leaves the product in a **coherent** state — `allowed_cities`/`free_travel_cities` renamed, new setting exists, but the 3 enforcement gates still block out-of-zone bookings exactly as today; nothing is broken, the live defect (§8.2) simply isn't fixed yet. Abandoning **mid-Phase-2** (e.g. the SQL gate is removed but `booking-schema.ts`'s `validateServiceArea` still rejects) is **actively worse than not starting**: the DB and one client-side gate would disagree, and depending on which is removed first, either out-of-zone bookings silently start being accepted with no admin awareness (SQL gate gone, schema gate remains — actually this ordering is safe, schema still blocks) or the reverse — **schema gate removed but SQL gate still raises `'Location is outside the service area'`** — the public form would let a Manchester customer proceed past step 2 (no client-side rejection) only to hit a hard database exception on submit, a materially worse customer experience than today's silent early rejection at step 2. **The plan does not state a safe sub-order for removing the 3 gates within Phase 2** — see §9 below, this is a genuine gap. Abandoning mid-Phase-3 (fee folding) after `bookings.travel_fee` exists but before the write path in `updateBookingManagement` is wired is safe (column exists, defaults to 0, nothing reads or writes it yet — inert). Abandoning mid-Phase-5 (§8.8) after Phase 3 has landed but **before the quick-confirm chip is gated** is the plan's own named bypass risk (§8.8 "⛔ Close the bypass") — **this is the single most dangerous partial-completion state in the whole plan**: an admin could quick-confirm an out-of-zone booking with `travel_fee = 0`, sending a confirmation email with no fee, and that booking's fee would then be **locked** the moment it's marked completed or fully paid (§8.6's lock), permanently losing the charge. **This exact sequencing risk is why §8.12's existing "Phase 5's chip-gating must land with Phase 3" note is correct but insufficiently forceful — it should be a STOP CONDITION, not a parenthetical.** |

---

## 9. Missing from the plan (gaps this report found)

1. **Migration-timestamp allocation protocol** (§3.4, §7 table footnote) — items 4 and 8 together mint up to 5 new migration filenames; nothing tells the implementer to check the latest existing timestamp first or space new ones apart.
2. **Item 7 Phase B's shared-file batches must be explicitly re-ordered relative to item 8** (§7, point 4) — the plan's top-level order runs item 7 (position 7) before item 8 (position 8), but item 7's edits to `SettingsForm.tsx`, `BookingManagementForm.tsx`, `bookings/[bookingId]/page.tsx`, and `SeriesActions.tsx` cannot be "finished" until item 8 has added its new fields to those files, or item 8's new UI ships with un-tokenized literals. This needs either (a) explicitly carving those 4 files out of item 7's main run and doing them as a small trailing batch after item 8, or (b) swapping items 7 and 8's overall order. Given item 8 is described as "worth doing on its own merits" and item 7 as "largest item; runs last so it rebases over a settled tree" (§ ordering), option (a) is the smaller change: keep item 7 mostly-last, but explicitly schedule its edits to these 4 specific files as a final trailing commit after item 8, not folded into item 7's main pass.
3. **`.next/`-sharing hazard for item 5's mandatory build** (§3.5) — the plan should either instruct the implementer to ask the Owner to pause/expect a dev-server hiccup before running `pnpm build`, or note this explicitly as a known, accepted risk rather than leaving it silent.
4. **A stated, safe sub-order for removing Phase 2's three gates** (§8, item 8 abandon-safety row) — the plan lists the 3 gates (SQL, `availability.ts`, `booking-schema.ts`) as a flat table with no removal order. The safe order is: **remove the client-side schema gate LAST**, after the SQL and availability gates are already gone, so that at every intermediate point the strictest remaining gate is the one closest to the customer (client-side), never the one furthest away (DB) — this avoids the "passes client validation, fails at the database" bad UX state identified above. The deepened plan should state this explicitly as a required sub-order, not leave it to implementer judgement.
5. **Item 8 Phase 5's chip-gating dependency on Phase 3 should be a STOP CONDITION**, not a parenthetical note — see §8 above; this is the plan's own highest-severity partial-completion risk and is currently under-flagged relative to its severity.
6. **The oklch counting-method inconsistency** (§4) — the deepened plan should restate every literal count using one consistent method (recommended: occurrence count) so the Phase C ratchet guard's own printed number matches the plan's narrative.
7. **The `Textarea` import on `/booking/manage`** (§5, point 2) is missing from §7.7a's stated blast-radius list; low current risk (0 literals today) but the list should be complete for future-proofing.

---

## 10. Anchors checked (symbol re-location, not line-number trust)

| Plan says | Symbol | Actual location | Drifted? |
|---|---|---|---|
| `notifications.ts:1356` `sendReviewRequestEmail` | `sendReviewRequestEmail` | `src/lib/email/notifications.ts:1356` | No |
| `notifications.ts:123` `BOOKING_EMAIL_SELECT` | `BOOKING_EMAIL_SELECT` | `src/lib/email/notifications.ts:123` | No |
| `notifications.ts:216` `getBookingTemplateInput` | `getBookingTemplateInput` | `src/lib/email/notifications.ts:216` | No |
| `BookingExperience.tsx:429` `goToTime` | `goToTime` | Function starts `:428`; line `:429` is precisely the `bookingDetailsSchema.safeParse(form.getValues())` call the plan is describing — the citation is exact, not off-by-one | No |
| `BookingExperienceLoader.tsx:23-26,89-93` | function signature / JSX call | Confirmed exactly at those lines | No |
| `admin/emails/page.tsx:925` `ReminderResendForm` placement | — | Not independently re-verified (outside this report's scope; item-1 owner should confirm) | Unchecked |
| `AdminTopNav.tsx` 13 literals | — | `src/app/admin/components/AdminTopNav.tsx`, 13 lines / 23 occurrences | No (line-count matches) |
| `bookings/[bookingId]/page.tsx` 13 literals | `getBookingDetailData` | File exists, 13 lines / 21 occurrences confirmed; `getBookingDetailData` symbol not independently grepped in this report (outside scope — item 7/8 owners should confirm it still exists under that name) | Unchecked for the symbol name specifically |
| Six availability files, 23 literals | — | All six confirmed to exist at stated paths; literal counts confirmed exactly (§3.2) | No |
| `pg_indexes` on `bookings`, 3 existing | — | Confirmed live via SQL: `bookings_pkey`, `bookings_client_status_completed_idx`, `idx_bookings_recurring_template` — exact match | No |
| `create_booking_request` sole `allowed_cities` consumer | — | Confirmed live via `pg_proc` search — exactly one match | No |
| `business_settings.allowed_cities` is `jsonb` | — | Confirmed live via `information_schema.columns` | No |
| `manage_role_templates` is Owner-only | — | Confirmed live via `role_permissions` join — exactly one row, role=Owner | No |
| `manage_settings` held by Admin+Owner | — | Confirmed live — exactly two rows | No |
| `bookings` = 15 rows, both override tables = 0 rows | — | Confirmed live via SQL | No |

---

## Commands run (for reproducibility)

```bash
# oklch counting (both methods), per file and per directory
grep -c "oklch(" <file>
grep -oP "oklch\(" <file> | wc -l
grep -rlP "oklch\(" src/app/admin | wc -l          # 99
grep -roP "oklch\(" src/app/admin | wc -l          # 677
grep -roP "oklch\(" "src/app/(public)"             # 0
grep -roP "oklch\(" src/app/booking                # 0
grep -roP "oklch\(" src/features                   # 0
grep -rlP "oklch\(" src/components/ui              # badge.tsx, button.tsx, input.tsx only

# lint baseline
pnpm lint 2>&1 > lint-full.txt   # 66 problems (59 errors, 7 warnings), 6 files
# per-file breakdown via line-range sed + grep -E "^ +[0-9]+:[0-9]+ +(error|warning)"

# migration convention
ls supabase/migrations | tail -20    # confirms YYYYMMDDHHMMSS_<slug>.sql, latest 20260809160000

# next.config / package.json
grep -i distDir next.config.ts       # no output — no override
grep '"dev"\|"build"' package.json   # next dev / next build, same default .next/
```

```sql
-- Supabase project twzutkfgqclqurvkmvqz, read-only
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bookings' ORDER BY indexname;
SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'business_settings' ORDER BY ordinal_position;
SELECT p.name, r.name FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id JOIN roles r ON r.id=rp.role_id WHERE p.name IN ('manage_role_templates','manage_settings');
SELECT (SELECT count(*) FROM bookings) AS bookings, (SELECT count(*) FROM availability_overrides) AS ao, (SELECT count(*) FROM staff_availability_overrides) AS sao;
```

No file under `src/`, `scripts/`, `e2e/`, or `supabase/` was modified. No git write command was run. No migration was applied. All SQL above was SELECT-only. `src/lib/maintenance.ts` was not read, opened, or referenced by any command in this session.
