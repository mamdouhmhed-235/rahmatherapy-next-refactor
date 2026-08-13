# POST-BAND-C FOLLOW-UP — implementation plan

**Written:** 2026-08-10 · **Deepened:** 2026-08-11 (this revision)
**Author:** C-C orchestrator, after Band C closed at 23/23
**Base commit for all `src/` anchors:** `33f895f` · **Verified against:** `0ec700c` on `master`
**Audience:** the agent(s) executing these fixes, and the Owner reviewing them.

Every item below was raised with the Owner after the programme closed, and each one here was **explicitly chosen by the Owner for action**. Items the Owner explicitly declined are listed in §0.2 so nobody re-opens them.

This is a **post-programme plan**. The Band C execution protocol (`redesign/plans/C-phase/C-C-EXECUTION-PROTOCOL.md`) is no longer running as a programme, but its safety rules still bind — they are restated in §1 so this document stands alone.

---

## 0.0 — What this revision is, and what it changed

The 2026-08-11 pass took every sentence in this document as **a claim to test**, and tested it against the live repo and the live database. Fourteen read-only agents re-derived the counts, re-located the anchors by symbol, mapped the blast radius, and ran the gates; ten adversarial reviewers then tried to refute what the first pass found.

**Twenty-nine claims in the previous revision failed verification.** All are corrected in place, each marked *(corrected 2026-08-11)* so a reader who remembers the old text knows why it changed. The ones that would have changed an implementer's actions:

| # | The old claim | What is actually true | Where |
|---|---|---|---|
| 1 | Reuse the guard from `resendDeliveryEvent` | **No such function exists.** It is `resendEmail` (`src/app/admin/emails/actions.ts:120`) | §1.7 |
| 2 | Put the manual send "beside `ReminderResendForm`… only for `completed` bookings" | **Unbuildable as written.** That list is fed by a query filtered to `status IN ('pending','confirmed')` and `booking_date >= today`; a completed booking can never appear in it. A new query and a new tab/subsection are required | §1.7 |
| 3 | "Nothing in the codebase deletes anything" | **False as written.** 17 real `.delete()` sites exist, including a fully wired GDPR-erasure path (`deleteClient()`) driven from the admin privacy queue. The true — and still damning — claim is narrower: **nothing deletes anything *by age*.** All deletion is on-demand or same-run rollback | §2.1 |
| 4 | "the privacy page's existing tests still pass" | **No test exists for the privacy page, or for any route under `src/app/(public)/`** | §2.5 |
| 5 | Item 3 is a **prerequisite** for item 6, because "grouping is only deterministic once segments are contiguous" | **False.** `ORDER BY override_date` alone already makes same-date rows contiguous, and both `groupByDate` implementations are `Map`-keyed, so they merge correctly regardless of order. Item 3 is **sequence-neutral** for item 6's correctness. The 3→6 edge survives only as file contention | §6.7, §10.3 |
| 6 | Item 7 runs before item 8 | **Ordering defect.** Five of item 7's Phase B files cannot be finished until item 8 has added its fields to them | §10.2 |
| 7 | "All 14 self-declared ratio comments are accurate" | **The true count is 11.** The 14 comes from a **real bug in `scripts/verify-admin-token-contrast.mjs`**: `parseTokensCss()` locates `@media print` with `indexOf`, matching a prose comment at `tokens.css:317` before the real rule at `:543`, so it returns the dark block mislabelled as print. **The print block has never actually been checked** | §7.5a |
| 8 | Step 0.2 fixes `--admin-warning` by editing `tokens.css:470-471`; "Layer 2 → 0 failures" proves it | **Insufficient.** `@media print` (`:566-567`) carries its own byte-identical copy of the same failing pair, and Layer 2 cannot see it (see #7). Layer 2 reporting 0 is **not** proof D8 is fixed | §7.5b |
| 9 | Step 0.1's 11 frozen aliases | The table named only 10 real slots and counted "the user-menu variant" as an 11th — it is a second *consumption site*, not a token. **`--admin-shell` is the genuine 11th** and was missing | §7.5b |
| 10 | Run the sweep with `--env-file=.env.e2e` and `node_modules/playwright/cli.js` | **Both wrong.** Neither path exists. Correct: `--env-file=.env` and `./node_modules/@playwright/test/cli.js` | §7.9 |
| 11 | The sweep covers 6 roles and "all 31 `page.tsx` routes" | It runs **4** roles (`THERAPIST_B` and `REPORTING` have no credentials; there is no Reporting role) over **29** route templates. 32 `page.tsx` files exist | §7.9 |
| 12 | "677 literals across 99 files" · "94 distinct" · "top ten ≈ 71%" | Three scope errors in one paragraph. 677/99 is **admin-only**; with the three shared primitives it is **717/102**. "94 distinct" mixes admin-only (84) with combined (94). The 71% divided a combined numerator by an admin-only denominator — the real figures are ~67% combined, ~68.5% admin-only | §7.2 |
| 13 | "six availability files that already carry 23 `oklch()` literals" | Two of the six carry **zero**. The real surface is four files, and 23 is a *line* count — by occurrence it is **26** | §7.7a |
| 14 | "141 uses of `AdminStatusBadge`" | **99** call sites. 141 counted import lines and the definition itself | §7.7a |
| 15 | "the C-17 guard makes exactly this disclosure" | Read in full, C-17's guard **contains no such sentence.** The new guard must make the disclosure itself rather than cite a precedent that does not exist | §7.8 |
| 16 | D3 is `input.tsx:116,143` | A **third** bare literal of the same value sits at `input.tsx:40` (the Input's own error-state border) and was untracked | §7.7 |
| 17 | `allowed_cities` has "~8 consumers" | **12 files** by direct grep — the previous list named 6 by path and missed 4 test fixtures, `updateBusinessSettings.test.ts`, and `ManualBookingForm.tsx` | §8.4 |
| 18 | Item 8 needs "4 migrations" | **6** (Phase 1: 2, Phase 2: 1, Phase 3: 1, Phase 4: 2, Phase 5: 0). Phase 4 needs the `CREATE OR REPLACE FUNCTION` as well as the column | §8.12 |
| 19 | `status` appears in ×12 chip predicates | **6** distinct `bookings.status` predicate sites. One occurrence in the old count targets `booking_assignments.status` — a **different table**, which cannot justify the proposed index | §4.2 |
| 20 | Item 4 is "the only Zone-2 item, unless item 6 takes Option B" | Item 8 is Zone-2 **unconditionally** — §0.1's own table already said so | §4 |
| 21 | The bundle script can "keep the ability to pass an explicit route filter" | **No filter exists.** `process.argv` is never read anywhere in that script. It must be *added* | §5.3 |
| 22 | The existing `.next/` covers "every route the outstanding ceilings care about" | Only `/admin/bookings/new` carries a directly cited ceiling in C-20 or C-23. Plain `/admin/bookings` carries none | §5.1 |

The remaining seven are anchor-precision corrections (`validateServiceArea` ends at `:161` not `:164`, and `:164` is an uncredited first wire point; `(public)/layout.tsx` props are on `:42-43`; `recurring_booking_templates` has 26 columns; "nine earlier plans" is really nine to eleven; and so on), each fixed in place.

**Everything else that was checkable was confirmed** — the three-gate contradiction and its live SQL, the D1 root cause in both halves, the 15 read sites of `total_price`, the live index state and row count, the permission model, the `/booking/manage` import list, and all three verification layers' current readings (456 · 1 · 2,615).

**One live defect was found in shipped tooling, not in the plan:** the `@media print` mis-parse in `scripts/verify-admin-token-contrast.mjs` (#7). It means the print block has never been verified by anything, and it is why #8 matters. Fixing it is folded into Step 0.5.

**Nine hazards that were entirely absent** are now specified: the lint-baseline identity key (§11.3), the migration-filename allocation rule (§11.5), the contrast scripts' exit-code behaviour (§11.4), the `.next/` collision with the Owner's dev server (§5.4), the `ManualBookingForm.tsx` copy that becomes false under item 8 (ITEM 8), the four `lib/booking` test files that reference `allowed_cities` (ITEM 8), the `/booking/manage` cancellation and reschedule email paths (ITEM 8), the Phase-2 gate-removal sub-order (ITEM 8), and the fact that dropping `bookings.travel_fee` after real use does **not** un-fold the money (ITEM 8).

**Section numbering:** items keep their `N.x` subsection numbering (`§1.6` is inside ITEM 1, `§7.9` inside ITEM 7). The trailing cross-item sections are numbered **§10–§13** so they can never be confused with an item.

### 0.0a Owner decisions, 2026-08-11 — all five closed

The deepening pass surfaced five genuinely open decisions. **All five were answered on 2026-08-11 and are folded into the sections below. Nothing in this plan is now blocked on a decision.**

| # | Decision | Answer | Folded into |
|---|---|---|---|
| 1 | Privacy section 6 — rewrite, or delete and renumber? | **Rewrite it, keep it general, and promise nothing the website does not actually do.** The deletion path is closed | §2.2, §2.3 |
| 2 | The analytics-retention sentence in section 6 | **Keep it, unedited** — consistent, and forces no changes elsewhere | §2.2, §2.7 |
| 3 | Do quiet hours apply to the new manual review-request send? | **No — exempt by design**, matching the existing manual resend path. Accepted consequence: a permitted staff member can cause a customer email at 2am, exactly as the existing resend path already allows | §1.5 |
| 4 | Does the HTML form field `name="allowed_cities"` get renamed with the column? | **Yes — rename it**, for consistency with the rest of the system. Contained to three files already in Phase 1's edit list | §8.4 |
| 5 | The two ordering changes | **Sanctioned.** Item 7's Phase B splits so its five item-8-shared files land after item 8; item 5 moves to last | §10.2, §10.3 |

*Decision 4 was answered as "as you suggest" against a question where no explicit recommendation had been given. It is recorded here as **rename**, on the Owner's stated rationale of consistency with the rest of the system, and because the change is contained to files Phase 1 already edits. It is a three-line revert if that reading was wrong.*

### 0.0b Owner decisions, 2026-08-11 (implementation session) — three more

| # | Decision | Answer | Folded into |
|---|---|---|---|
| 6 | Item 1 Step 1e — vary review-request copy by client class? | **Yes — vary it.** *(Overrides the implementer's recommendation to keep one version; recorded as the Owner's explicit call.)* The class is already computed and written to the audit trail by the shipped Batch A, so this is purely a template change | §1.6 |
| 7 | Where the manual review-send control lives | **A new tab on `/admin/emails`**, not a subsection of Reminders. Review requests target `completed` bookings; the Reminders tab lists only upcoming `pending`/`confirmed` ones, which is why the original "beside `ReminderResendForm`" instruction was unbuildable | §1.7 |
| 8 | What runs next | **Item 8**, ahead of item 1's Batch B and item 7. The live 3-way service-area contradiction is costing bookings now; item 1's remaining half is an addition, not a fix | §10.3 |

**⚠️ Ordering consequence of decision 8, which SIMPLIFIES §10.2.** The Phase B / Phase B-tail split exists *only* because item 7 was scheduled before item 8. With item 8 landing first, item 7 can tokenize all its files in one pass — including `SettingsForm.tsx`, `BookingManagementForm.tsx`, `bookings/[bookingId]/page.tsx`, `ManualBookingForm.tsx` and `SeriesActions.tsx` — because item 8's new UI will already exist to be tokenized. **Do not carve out the five-file tail if item 8 has already shipped.** The Phase C ratchet then flips once, at the end of item 7, as originally intended.

**Ordering consequence for item 1.** §1.10's `1 → 8` edge on `notifications.ts` now runs the other way: item 8 lands first, so **item 1's Batch B must re-grep before editing that file**. In practice Batch B barely touches it — it adds a new action in `src/app/admin/emails/actions.ts` that *calls* `sendReviewRequestEmail`; the cooldown guard itself shipped in Batch A (`0863573`).

### 0.0c ⛔ Decision 9 — the `allowed_cities` rename is EXPAND-CONTRACT, not a rename *(Owner decision, 2026-08-11)*

**§8.4's `alter table … rename column allowed_cities to free_travel_cities` MUST NOT be executed.** Verification found two independent breakages, one of which no migration can fix:

1. **`create_booking_request` reads `v_settings.allowed_cities` by field name.** Postgres does not rewrite PL/pgSQL bodies on a rename, so the `ALTER` succeeds silently and then *every* booking call — public and admin — fails at execution time, surfacing raw Postgres error text to the customer as a 400. It is reached unconditionally, before every `INSERT` in the function, so no partial rows are written and a rename-back fully restores it. Confirmed independently by two passes; `create_booking_request` is the **only** database object of any kind referencing the column (functions, views, policies, triggers, indexes, constraints, defaults all swept).
2. **`src/lib/booking/availability.ts:433` selects the column in a raw PostgREST string.** That is *application* code on a separate deploy cadence. Renaming the column makes `loadSettings()` return null and the booking calendar shows **zero availability for every visitor**. A perfectly atomic migration does not help — and **the live site runs older code**, so the migration would break the deployed app the moment it landed.

**The decided shape — additive first, destructive last:**

| Step | What | Risk |
|---|---|---|
| **Phase 1a** | `ADD COLUMN free_travel_cities` (backfilled from `allowed_cities`) + `ADD COLUMN mileage_origin`. Both columns coexist | **Purely additive. Nothing can break** — old deployed code keeps reading `allowed_cities`, which keeps its value |
| **Phase 1b** | Insert the `manage_travel_origin` permission and grant it to Owner | Purely additive |
| Phase 1 app code | Read `free_travel_cities`; **write BOTH columns** in `settings/actions.ts`'s upsert | See the sync note below |
| Phase 2 | `CREATE OR REPLACE create_booking_request` removing the city gate — this removes the **last database reference** to `allowed_cities` | Unchanged from the plan |
| **Step Z — DEFERRED TO THE VERY END** | `ALTER TABLE public.business_settings DROP COLUMN allowed_cities;` and delete the dual-write | Safe by then: no DB object and no shipped code reads it |

**Why the dual write is not optional while it lasts.** Until Phase 2 replaces `create_booking_request`, the SQL gate still reads `allowed_cities`. If the admin UI wrote only `free_travel_cities`, the Owner could edit the free-travel list and the live booking gate would silently keep enforcing the stale one. Write both in the single upsert that owns this row, and delete that line as part of Step Z.

**✅ DEFERRED, Owner decision: the deploy and Step Z both happen at the very end of this plan.** The local branch is the current truth; the live site is to be replaced wholesale once every item here has landed. Until then the old column simply stays, costing nothing. **Do not schedule Step Z earlier as a tidy-up** — its whole safety argument is that it runs after the deploy.

**Consequence for §8.12's migration count:** item 8 now mints **7**, not 6 — Phase 1's two are unchanged in number, and Step Z adds one at the end.

---

## 0.1 In scope (8 items)

| # | Item | Type | Zone-2? |
|---|---|---|---|
| 1 | Review-request emails: cap at once per client per 6 months, add a manual admin send, and distinguish repeat from one-off clients | Behaviour | No |
| 2 | Privacy policy: stop promising a retention schedule the code does not enforce | Content | No |
| 3 | Override lists: add the missing secondary sort | Correctness | No |
| 4 | `bookings` table: add the indexes it will need before real volume | Migration | **YES** — 1 migration |
| 5 | Bundle measurement: make the existing script able to answer the question | Tooling | No *(but needs the one sanctioned `pnpm build`)* |
| 6 | Adjustment lists: count and cap by **date**, not by segment row | Correctness | No *(on the recommended option)* |
| 7 | **Admin theming: colour, contrast and readability fixed at the root** — admin backend only | UI correctness | No |
| 8 | **Travel-charge model** — free-travel areas + manually-set mileage fee; also fixes the live 3-way service-area contradiction | Feature + defect fix | **YES** — 6 migrations *(corrected — was "4")* |

## 0.2 Explicitly OUT of scope — do not touch

The Owner declined these. Leave them exactly as they are.

- **The Google Maps cookie label.** It stays `purpose: "essential"` in `src/lib/consent/cookie-registry.ts`. Confirmed by the Owner twice. Do not "correct" it to `functional` — that would make the Functional group's blanket promise false, which is precisely why it is filed as it is.
- ~~**SEO:** no `sitemap.ts` / `robots.ts`, and 5 of 6 public pages emit no canonical tag.~~
  ⛔ **REVERSED BY THE OWNER, 2026-08-13.** This entry is no longer in force. The Owner
  explicitly re-opened all three — sitemap, robots and the missing canonicals — as part of an
  SEO/AEO/GEO workstream. See `redesign/plans/SEO-AEO-GEO-2026-08-13-plan.md`. The earlier
  deferrals this entry rested on (`BAND-C-REFINEMENT-2026-07-26.md` §6.3 "Owner: will handle
  later personally"; `C-21-canonical-domain-fix-progress.md` §73 "defer to a follow-up") are
  superseded by that decision. **Do not treat SEO as declined.**
- **Non-atomic global override save**, and the **staff duplicate-date TOCTOU**. Both verified low-severity and disclosed.
- **The `area == city` duplication** on unitary-authority addresses, and the `autoComplete` choice on the booking address field.
- **Automatic data deletion / retention enforcement.** The Owner will handle retention manually — which is exactly why item 2 exists.
- **`create_recurring_booking_series`'s missing city check.** Its absence is deliberate and documented. Do not "fix" it.
- **The four pre-existing lint errors** in `src/features/booking/BookingExperience.tsx` and `BookingExperienceLoader.tsx`. Item 8 edits both files and will be tempted to tidy them. Doing so changes the very baseline the gate checks — see §8.3.
- **`.env.example`'s stale E2E instructions.** They carry the same two errors this revision corrects in §7.9 (`.env.e2e`, `node_modules/playwright/cli.js`). Worth a separate one-line follow-up; not part of any item here.

---

## 1 — Binding rules for the executing agent

1. **⛔ Zone-2 actions are Owner-approved, orchestrator-performed, and NEVER done by a subagent.** In this plan that means **item 4's migration and item 8's migrations only**. Do not call `mcp__supabase__apply_migration`. Do not run any `INSERT` / `UPDATE` / `DELETE` / DDL. `mcp__supabase__execute_sql` is **SELECT-only**, for verification, against project `twzutkfgqclqurvkmvqz`.
2. **⛔ Never send a real email.** Item 1 touches the email system; item 8 touches the templates every booking email renders through. No live sends, no triggering any cron against production, no admin-UI send. Every test mocks the mailer at `@/lib/email/client` (§11.6 gives the exact idiom). Any recipient outside `*.example.test` is an absolute stop. **This is the highest-risk rule in this plan.**
3. **⛔ No agent may ever enter a credential**, in a browser, a file or a log. This does not lift when offered. The Playwright harness authenticates: `getCredentials(prefix)` reads `E2E_<PREFIX>_EMAIL`/`_PASSWORD` from the environment and `loginAs()` performs the sign-in. Agents reference the **prefix** only. A spec that would print a credential on failure is a defect.
4. **Never touch `src/lib/maintenance.ts`.** Working copy is `false`, `HEAD` is `true`, deliberately. Never stage it. For deployed behaviour read `git show HEAD:<path>`.
5. **Git:** never push. Never `git add .` or `-A`. Never stash/checkout/restore/reset to "clean" the tree — it is intentionally dirty (untracked evidence screenshots and design folders from earlier plans). Stage explicitly by path.
6. **RECON untouchables:** `sendManualBookingReminder` and the `ReminderResendForm` hidden-input contract. **Mirror them; do not edit them.**
7. **Anchors: re-locate by symbol, then report drift.** Every line number in this document is "at `33f895f`". `src/` is byte-identical between `33f895f` and `0ec700c` (verified — the 21 commits since touched only `scripts/`, `e2e/` and docs), so these numbers *should* hold today. That is exactly why the habit matters: **grep for the symbol, and if it is not at the stated line, stop and report the drift rather than adjusting silently.** A plan that trains implementers to trust line numbers is itself a defect.
8. **No `pnpm build`** except item 5, which requires exactly one — and that build writes to the same `.next/` the Owner's live dev server serves from (§5.4). Coordinate it; do not treat it as a footnote.
9. **Baselines are BY IDENTITY, not by count** — see §11, which now also defines *what identity is keyed on* for each gate. A matching total with a different failure swapped in is a FAIL.
10. **Dev server is Owner-run** at `http://localhost:3000`. Never spawn, restart or kill it. Use `localhost`, not `127.0.0.1`. Reading from it is fine.
11. **Tooling traps that have already cost real time:**
    - **Git Bash rewrites bare leading-slash arguments** into Windows paths (`/admin/dashboard` → `C:/Program Files/Git/admin/dashboard`). **Quoting does not fix it** — that was tested and disproved. `MSYS_NO_PATHCONV=1` does. **Prefer PowerShell**, which has no equivalent behaviour. Only `CONTRAST_ROUTES` self-heals (via `resolveRouteFilter`, commit `2903108`); nothing else does.
    - **Bracket paths miscount under raw shell glob.** `src/app/admin/staff/[staffId]/…` returned 26 where ripgrep returned 23. Count with the `Grep` tool / ripgrep, never with shell bracket expansion.
    - **Both contrast scripts exit `0` regardless of failures** unless `--max-failures=N` is passed. A bare run can never gate anything.
12. **If reality contradicts this plan, stop and report** — do not improvise around it. Seven claims in the previous revision were wrong; assume there is an eighth.
---

## 2 — Pre-flight

Run this once, before touching anything, and record the output. Every number here was re-derived live on 2026-08-11; if any of them differs on your run, **that is the first finding of your session** — report it before starting work.

**PowerShell (preferred — see §1.11 for why):**

```powershell
git branch --show-current                    # master
git log --oneline -1                         # 0ec700c or a descendant
git status --porcelain -- src/ supabase/     # exactly:  M src/lib/maintenance.ts

npx tsc --noEmit                             # silent, exit 0            (~5s)
npx vitest run                               # 5 failed / 2236 passed (2241)  (~90s)
pnpm lint                                    # 59 errors / 7 warnings, 6 files (~25s)
```

**Toolchain, confirmed on this machine:** Node `v24.16.0` · pnpm `10.17.1` · Next `16.2.4` · TypeScript `5.9.3` · vitest `4.1.5` · `@playwright/test` `1.59.1`.

**Two things the gates leave behind, so they are not mistaken for stray output:**
- `npx tsc --noEmit` writes `tsconfig.tsbuildinfo` at the repo root on every run. It is gitignored (`.gitignore:47`) and must never be staged.
- Nothing else in the pre-flight set writes anything. `git status --porcelain -- src/ supabase/` was confirmed unchanged before and after every gate command.

**If `npx vitest run` reports 6 failures rather than 5**, do not report a regression until you have run the isolation procedure in §11.2. The sixth is a documented flake and it appears roughly half the time.

**Item-specific pre-flight**, run only for the item you are about to start:

| Item | Command | Record |
|---|---|---|
| 1 | `SELECT count(*), max(created_at), now() FROM public.email_delivery_events;` | Baseline was **43 rows**, latest `2026-07-29 09:56:19+00`. Capture `now()` — it is the run-window start for the "zero real emails" proof (§11.7) |
| 4 | `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='bookings' ORDER BY indexname;` and `SELECT count(*) FROM public.bookings;` | Baseline was exactly **3 indexes**, **15 rows** |
| 5 | `node scripts/measure-admin-bundles.mjs` against the existing `.next/` | Note the `BUILD_ID`; the current `.next/` was built at `aca7c18` on 2026-08-09 and is stale |
| 7 | `node scripts/measure-admin-contrast.mjs .` and `node scripts/verify-admin-token-contrast.mjs` | Baselines were **456** (377 dark / 79 light, 239 unresolved) and **1** |
| 8 | `SELECT id, allowed_cities FROM public.business_settings;` | Baseline is `{"id": 1, "allowed_cities": ["Luton","Dunstable"]}`. **This is the §8.9.G snapshot the plan requires for reversibility — it is recorded here so it cannot be lost** |

---

## ITEM 1 — Review-request email frequency, manual override, and client type

### 1.1 The problem, precisely

`src/app/api/cron/review-emails/route.ts` selects candidates as:

```
status = 'completed'  AND  review_email_sent_at IS NULL
AND completed_at BETWEEN (now - 7 days) AND (now - 2 hours)
```

There is **no per-client frequency rule anywhere on this path**. The sentinel `review_email_sent_at` lives on the **booking**, not the client and not the series template. A client on a weekly standing series therefore generates one review request per completed visit, **indefinitely**.

Verified: `bookings` has `client_id`, `recurring_template_id`, `review_email_sent_at`, `completed_at`. `clients` has **no** review-tracking column.

### 1.2 Design decision — derive the cap, do not add a column

**Do NOT add a `last_review_email_at` column to `clients`.** That would be a migration (Zone-2), and it would create a second source of truth that can drift from the delivery log.

The data already exists. `email_delivery_events` records `booking_id`, `event_type`, `delivery_status`, `created_at`, and every review send writes one via `sendTrackedEmail` with `event_type = 'review_request_client'`. Joining through `bookings.client_id` answers "when did we last actually ask this client?" exactly.

**Why the delivery log and not `bookings.review_email_sent_at`:** that column is *also* written as a "handled" sentinel when a booking has no email address (`sendReviewRequestEmail`'s `no_email` branch writes the timestamp without sending). Deriving the cap from it would mean a client who had no email on file in March is wrongly suppressed in June once they add one. The delivery log has no such false positive.

### 1.3 Success statuses — derive from the schema, not from `format.ts`

**Do not treat `src/app/admin/emails/format.ts`'s `DELIVERY_STATUSES` constant (currently `format.ts:31-39`) as a source of truth for this filter.** It lists `accepted, delivered, opened, clicked, bounced, failed, complained` — none of `delivered/opened/clicked/bounced/complained` is ever written anywhere in this repo (there is no Resend webhook handler), and the list is missing 4 of the 7 values the database actually permits. It sits next to a comment claiming lineage from `notifications.ts`, which makes it look authoritative for delivery status; it isn't.

The authoritative set is the live `email_delivery_events_delivery_status_check` CHECK constraint: `accepted, failed, skipped, queued, sent, cancelled_by_restore, cancelled_manual` (7 values). Of those, `sendTrackedEmail` itself (symbol `sendTrackedEmail`, currently `notifications.ts:473-584` — RELOCATE BY SYMBOL) only ever writes 4: `skipped` (no recipient), `queued` (delayed send), `accepted` (immediate success), `failed` (immediate failure). The other 3 are written by unrelated callers — a scheduled-emails cron flips `queued` → `sent`, and booking-restore/cancel sweeps write `cancelled_by_restore` / `cancelled_manual` — and are structurally unreachable from the review-request path.

Narrower still: `sendReviewRequestEmail`'s call to `sendTrackedEmail` never passes `delaySeconds`, so `queued`/`sent`/`cancelled_*` cannot occur for `event_type = 'review_request_client'` at all, and `sendReviewRequestEmail` already short-circuits on `no_email` *before* ever calling `sendTrackedEmail`, so `skipped` should also be structurally unreachable for this event type (defence-in-depth only — don't rely on that without confirming it against the actual code at implementation time). **The cooldown filter should treat only `delivery_status = 'accepted'` as "asked."** Live data corroborates this: every row in `email_delivery_events` today (43/43) is `accepted`, and exactly 1 of those is `event_type = 'review_request_client'`.

### 1.4 Where the guard lives

Put the guard in **`sendReviewRequestEmail`** (symbol `sendReviewRequestEmail`, currently `src/lib/email/notifications.ts:1356-1444` — RELOCATE BY SYMBOL), not only in the cron. Reason: it then protects *every* caller, including §1.7's new manual path and anything added later. A guard that lives only in the cron is one new caller away from being bypassed.

Add:

- An exported constant, e.g. `REVIEW_REQUEST_CLIENT_COOLDOWN_MONTHS = 6`, so tests and callers reference one value.
- A reusable helper, e.g. `getClientsAskedForReviewSince(clientIds: string[], since: string, supabase): Promise<Set<string>>`. `email_delivery_events.booking_id → bookings.id` is a real FK, so this can be a single PostgREST embedded-filter query — e.g. `.from("email_delivery_events").select("bookings!inner(client_id)").eq("event_type","review_request_client").eq("delivery_status","accepted").gte("created_at", since).in("bookings.client_id", clientIds)` — not an N-query-per-client loop.
- A new early-return reason on `sendReviewRequestEmail`: `"client_recently_asked"`, alongside the existing `no_email` / `already_sent` / `send_failed`.
- An options parameter, `{ ignoreClientCooldown?: boolean }`, defaulting to **false**. Only the manual admin action passes `true`.

**Do NOT write the `review_email_sent_at` sentinel when suppressing for cooldown.** The booking has not been handled — it has been *skipped for now*. Writing the sentinel would permanently retire a booking that a later manual send might legitimately want. This is the single easiest mistake to make in this item.

### 1.5 Performance — batch in the cron, guard per-booking

The cron takes up to 50 candidates per tick. Do **not** issue two extra queries per candidate.

In `route.ts` (POST handler, currently `route.ts:67-`; candidate query currently `:107-114`), after fetching candidates (widen the `.select("id")` to include `client_id` and `recurring_template_id`):

1. Collect the distinct `client_id`s.
2. Call the cooldown batch helper **once** to get the set of recently-asked clients.
3. Call the classification batch query (§1.6) **once**, alongside it — not per candidate.
4. Filter cooldown-suppressed candidates out, counting them into a new summary field `skipped_client_cooldown`.
5. Call `sendReviewRequestEmail` only for survivors — where its own per-booking guard is a cheap re-check, not a duplicate cost.

**This one-query-per-tick rule binds both the cooldown lookup and §1.6's classification count equally.** They are two different questions answered from the same shape of data (a per-client aggregate over `completed` bookings / delivery events), and an implementer who batches the cooldown correctly but then reaches for a per-candidate `count()` call for classification has reintroduced the exact N+1 this section forbids, just in the sibling feature.

Add `skipped_client_cooldown` to `ReviewEmailSummary` (currently `route.ts:30-37`) and `emptySummary()` (currently `route.ts:39-48`). The summary is the operator's only window into this cron; a silent skip is the failure mode this codebase keeps producing.

### 1.6 Repeat vs one-off clients

Classify each candidate with a small, pure, unit-testable helper:

| Class | Test |
|---|---|
| `series` | the booking has `recurring_template_id IS NOT NULL` |
| `returning` | not a series booking, and the client has ≥2 completed bookings |
| `first_time` | not a series booking, and the client has exactly 1 completed booking |

**Boundary rule, made explicit (this was unspecified in the prior draft and is easy to get off by one):** the completed-booking count used for `returning` vs `first_time` is **inclusive of the candidate booking itself**. By the time the cron reads a candidate, that booking's own `status` is already `completed` — it is one of the rows any `count(*) WHERE client_id = ? AND status = 'completed'` would return. So a client having their very first completed visit gets count `1` → `first_time`; a client having their second gets count `2` → `returning`. Do not subtract the candidate before comparing, and do not write two different counting conventions in the classifier vs. the batching query — one convention, applied consistently.

Compute this count in the **same batched query** as §1.5's cooldown lookup (one `GROUP BY client_id` count query per tick, not one per candidate) — see §1.5's amended rule.

**Note that the 6-month cap already solves the "every week forever" problem on its own** — the `series` class does not need a second, stricter rule. Its value is (a) making the behaviour visible and (b) enabling copy variation.

Record the class in the audit metadata the cron already writes (`after_state`, alongside `automated: true`, currently `route.ts:131-140`), so the audit trail answers "why did/didn't this client get asked?" without re-deriving it.

**Step 1e — OPTIONAL, Owner's call, implement only if the Owner says yes.** Vary the email copy by class — a standing client should not read the same "we hope you enjoyed your first visit" line as a newcomer. The natural seam already exists: `pickReviewMessages({ groupCategory, city, overrides })` inside `sendReviewRequestEmail`. **Do not change customer-facing copy without explicit approval** — the template also has admin-editable overrides (`resolveTemplateOverrides`) whose interaction must be preserved.

### 1.7 The manual admin send

**None exists today.** `dispatchResend` in `src/app/admin/emails/actions.ts` has no `review_request_client` case, so even the existing resend feature cannot send one.

Mirror the established pattern exactly:

- **Server action:** a new sibling of `sendManualBookingReminder` in `src/app/admin/emails/actions.ts`. **Do not modify `sendManualBookingReminder` itself — it is RECON-untouchable.** Copy its idiom: `getStaffProfile()` first, then `createSupabaseAdminClient()`.
- **Permission:** `canResendBookingEmails(profile)` (`src/lib/auth/rbac.ts:221`, permission `resend_booking_emails`). Live DB confirms this permission is held by exactly `{Owner, Admin, Booking Coordinator, Therapist}`.
- **⚠️ Scope check — do not skip this. Corrected: the function to mirror is `resendEmail`, not `resendDeliveryEvent` — the latter does not exist anywhere in this codebase.** `resendEmail` is exported from `src/app/admin/emails/actions.ts:120`; its H11 middle-path scope check runs at roughly `:159-201` (RELOCATE BY SYMBOL, don't trust these numbers past today). The permission is flat and has no concept of *which* booking, so: if the actor lacks `canViewAllBookings`/`canManageAllBookings`, confirm they hold a `booking_assignments` row for that booking, and on failure record a `failed_resend_attempt` operational event exactly as `resendEmail` does (event type, severity `"warning"`, `bookingId`, `staffId`, a `safeContext` object). **Without this, a Therapist could trigger customer email for any booking in the clinic.**
- **Rate limit:** reuse the same `RESEND_RATE_LIMIT_SECONDS` (currently `actions.ts:101`, value `60`) recent-send check already in that file.
- **✅ DECIDED — quiet hours do NOT apply to the manual send** *(Owner decision, 2026-08-11)*. The cron's quiet-hours guard (`isQuietHourLondon`, currently `route.ts:55-65`, window 21:00–08:00 Europe/London) lives only in the cron route, before any DB work; `sendReviewRequestEmail` itself has no quiet-hours logic. **The manual send is therefore not subject to quiet hours, by design:** a human actively choosing to send right now is overriding an automated night-suppression heuristic, exactly as `resendEmail`'s existing manual resend path already does. This keeps the two manual paths consistent with each other and introduces no new gate anywhere.
  **Write the reason into the action's own comment**, or a future reader will "fix" it as a bug — and add the regression test named in §1.12 so the behaviour is asserted rather than assumed. The accepted consequence, stated plainly: a staff member with `resend_booking_emails` can cause a customer email at 2am. That is the same exposure the existing resend path already carries.
- **Semantics:** the manual send bypasses the **6-month client cooldown** (`ignoreClientCooldown: true`) but still respects the **per-booking `review_email_sent_at` sentinel** — one review request per booking. If the Owner later wants a true duplicate for the same booking, the coherent route is adding a `review_request_client` case to `dispatchResend`, which is a few lines in an existing switch. Note it; do not build it unasked.
- **UI — corrected placement.** The plan previously said "place it beside `ReminderResendForm` on `/admin/emails` (`page.tsx:925`)... Only offer it for `completed` bookings." That is not literally buildable: the row `ReminderResendForm` renders inside is fed by `remindersPromise` (`src/app/admin/emails/emails-data.ts`, currently `:175-197`), which queries `.in("status", ["pending","confirmed"]).gte("booking_date", businessDate)` — upcoming, not-yet-happened bookings only. A `completed` booking can never appear there. **Corrected instruction:** add a new export to `emails-data.ts`, sibling to `getEmailsPageData`/`remindersPromise`, for completed bookings with a recipient address and no `review_email_sent_at`, using the same `unstable_cache` + `createSupabaseAdminClient()` pattern already established at `emails-data.ts:142-197`. Surface it either as a new subsection within the existing Reminders tab or as a new tab — if a new tab, wire `TabKey` (currently `page.tsx:78`) and `resolveTab` (currently `:80-88`) and the tabs array (currently roughly `:263-291`). Only render the control for rows the new query returns (which is already the `completed` + recipient-present filter — don't re-derive eligibility in the component).
- **Audit:** write an audit row with `automated: false`, distinguishing it from the cron's `automated: true`. The `review_email_sent` action type already exists and is labelled on the client detail page's local map (`src/app/admin/clients/[clientId]/page.tsx:222`) — reuse it, don't invent a new one. See §1.8 for the separate, previously-unaddressed question of whether it's also registered in the *global* audit timeline.

### 1.8 Files

| File | Change |
|---|---|
| `src/lib/email/notifications.ts` | cooldown constant, batch helper, classifier, guard + `ignoreClientCooldown` option, new reason. Symbol `sendReviewRequestEmail` is the edit anchor. |
| `src/app/api/cron/review-emails/route.ts` | batched pre-filter (cooldown + classification, one query each), widened select, `skipped_client_cooldown` in the summary, class in audit metadata |
| `src/app/admin/emails/actions.ts` | **new sibling action** (do not edit `sendManualBookingReminder`); mirror `resendEmail`'s scope-check pattern, not edit it |
| `src/app/admin/emails/emails-data.ts` | **new export** — completed, recipient-present, not-yet-cooled-down bookings for the manual-send UI. Not in the original plan's file list; required by the UI correction in §1.7. |
| `src/app/admin/emails/page.tsx` | new tab entry or new subsection wiring, plus the manual-send form's placement |
| a new form component, sibling to `ReminderResendForm.tsx` | the manual control |
| `src/app/admin/audit/format.ts` | **register `review_email_sent`** in the `ACTIONS` map (currently `:22-98`), mirroring the existing `manual_booking_reminder_sent: { phrase: "sent a booking reminder", family: "operations_and_email", chip: "pending" }` entry's shape. Decided here because item 1 doubles the write sites for this action type (cron + manual) and item 8 raises the identical open question independently for its own action types — resolve it once, here, rather than twice, inconsistently. |
| tests alongside each | see §1.11 |

### 1.9 Blast radius

**Callers / consumers of everything touched:**

- `sendReviewRequestEmail` — one production caller today (`route.ts:125`). Item 1 adds a second (the new manual action). No other file calls it.
- `sendTrackedEmail` — used by roughly 18 call sites across `notifications.ts`. Item 1 does not change its signature or behaviour, only adds a caller-side guard *before* it's reached, for the review-email path specifically. Every other caller is unaffected.
- `dispatchResend` / `resendEmail` — untouched by item 1 (per §1.7's explicit decision not to add a `review_request_client` case unasked). No edit to either is required for item 1 to work.
- `canResendBookingEmails` — already consumed by `sendManualBookingReminder`, `resendEmail`, `emails-data.ts`'s reminders gate, and `page.tsx`'s own `canResend` gate. The new manual action reuses it; nothing else needs registering.
- `ACTIONS` map in `src/app/admin/audit/format.ts` — see §1.8; the client-detail page's own `AUDIT_PHRASING` map is unaffected and stays correct either way.

**Proven NOT affected — what was checked, and the command used:**

```
grep -rn "sendReviewRequestEmail|review_email|ReminderResendForm|sendManualBookingReminder|resendEmail|dispatchResend|RESEND_RATE_LIMIT_SECONDS|canResendBookingEmails" src/app/booking/manage
grep -rn "sendReviewRequestEmail|dispatchResend|resendEmail\(|ReminderResendForm|REVIEW_REQUEST_CLIENT_COOLDOWN" "src/app/(public)"
```
Both return **zero matches**. `src/app/booking/manage/` — the route that sits outside both `(public)` and `admin`, easy to forget — renders none of item 1's touched symbols. No public or customer-facing surface is affected.

- `sendTrackedEmail`'s other ~17 callers in `notifications.ts` — none call `sendReviewRequestEmail` or the new cooldown helper (confirmed by reading the full file); every other exported `send*` function is a self-contained notifier sharing only the generic `sendTrackedEmail` plumbing, which item 1 does not modify.
- `email_delivery_events` RLS — both the existing cron path and the new manual path go through `createSupabaseAdminClient()` (service role), so the tightened RLS policy referenced at `actions.ts:164` cannot block either.
- Baseline test health before any edit: `npx vitest run src/app/api/cron/__tests__/review-emails.test.ts src/lib/email/__tests__/sendReviewRequestEmail.test.ts` → 2 files, 18 tests (12 + 6, independently counted), all passing. `npx vitest run src/app/admin/emails/__tests__/resendEmail.test.ts src/app/admin/emails/__tests__/sendManualBookingReminder.test.ts src/app/admin/emails/__tests__/emails-data.test.ts src/lib/email/__tests__/pickReviewMessages.test.ts` → 4 files, 64 tests, all passing. Neither set overlaps the repo's known baseline failures (`admin-access.test.ts` ×2, `ManualBookingForm.test.tsx` ×3), so none of this is masked flake.

**Snapshots:** none. This codebase's tests are behavioural (mocked Supabase chains + assertions), not snapshot-based, for every file item 1 touches.

### 1.10 Ordering / prerequisites relative to the other items

- **Item 7** (admin theming) touches `src/app/admin/emails/page.tsx` for its raw `oklch(...)` literals — 17 lines / **29 occurrences** (standardised on occurrences per the handoff's counting note). Item 1 also edits this file (new tab/section + form). **Item 1 should land first** (it adds structure/markup) and item 7 second (it only retints existing literals in place) — landing item 7 first, then adding new markup for item 1, risks that new markup shipping with fresh raw `oklch()` literals item 7 never revisits. If item 7 must land first for scheduling reasons, item 1's new form/section must use item 7's `var(--admin-*)` token discipline from the start, not new literals.
- **Item 8** also edits `src/lib/email/notifications.ts` (`BOOKING_EMAIL_SELECT`, `getBookingTemplateInput`, `sendBookingCreatedEmails`), in a different region of the file from item 1's edits (`sendReviewRequestEmail` and new top-of-file exports). No logical dependency either direction, but do not run both items' `notifications.ts` edits in the same uncommitted working tree without diffing carefully — land one, verify, commit (or at minimum fully diff-review) before starting the other's edits to this file.
- **Item 8** also touches `src/app/admin/audit/format.ts:22-35`'s new-action-type registration question. §1.8 resolves this for `review_email_sent` — register it. Item 8 should follow the same precedent for its own new action types rather than making an independent call on the same file.
- No dependency on items 2, 3, 4, 5, 6 — none touch any file item 1 touches.
- Item 1 has **no Zone-2 component** — no migration, no schema change. It can execute independently of the Owner-gated items (4, 8) with no sequencing constraint from that direction; the only sequencing constraints are the file collisions above.

### 1.11 Verification — exact commands, per batch

**Batch A — `notifications.ts` + `route.ts` (cooldown, classification, guard):**
```
npx vitest run src/lib/email/__tests__/sendReviewRequestEmail.test.ts src/app/api/cron/__tests__/review-emails.test.ts
```
Before: 2 files / 18 tests passing (12 + 6). **MUST move:** total passing count rises to 2 files / 27 tests (12 + 5 new in `sendReviewRequestEmail.test.ts`, 6 + 4 new in `review-emails.test.ts`, per §1.12), all passing. **MUST NOT move:** 0 failures in either file.
```
npx tsc --noEmit
```
**MUST NOT move:** exit 0, silent, ~5s — same identity as baseline.

**Batch B — `actions.ts` + `emails-data.ts` + `page.tsx` + new form:**
```
npx vitest run src/app/admin/emails/__tests__/resendEmail.test.ts src/app/admin/emails/__tests__/sendManualBookingReminder.test.ts src/app/admin/emails/__tests__/emails-data.test.ts src/lib/email/__tests__/pickReviewMessages.test.ts src/app/admin/emails/__tests__/sendManualReviewRequest.test.ts
```
Before: 4 files / 64 tests. **MUST move:** file count to 5 (new `sendManualReviewRequest.test.ts` added), and `emails-data.test.ts`'s count rises by however many tests §1.12 adds there. **MUST NOT move:** `resendEmail.test.ts`, `sendManualBookingReminder.test.ts`, and `pickReviewMessages.test.ts` individual pass counts — item 1 does not edit `sendManualBookingReminder` (RECON-untouchable) or `pickReviewMessages`, and only reads `resendEmail`'s pattern without editing it, so these three files' test counts and pass status must be byte-identical to baseline.

**Full-suite gate (run once, at the end of item 1):**
```
npx vitest run
```
**MUST move:** total passed count increases by exactly the number of new tests added in §1.12 (no more, no fewer — a smaller increase means a test silently didn't get added or is failing/skipped; a larger increase means something unrelated changed). **MUST NOT move:** the 5 documented baseline failures (`admin-access.test.ts` ×2 named tests, `ManualBookingForm.test.tsx` ×3 named tests) stay exactly those 5 (or 6 under full-suite load, the documented flake) — no new failures anywhere, and none of the existing 5/6 should disappear either (a baseline failure vanishing without item 1 having touched that file is itself suspicious and should be reported, not silently accepted as a bonus).
```
pnpm lint
```
**MUST NOT move:** the six-file lint identity (multiset of `{file, ruleId}` — not `file:line:column`, per the standing counting rule). None of item 1's touched or new files (`notifications.ts`, `route.ts`, `actions.ts`, `emails-data.ts`, `page.tsx`, the new form component, the new test files) is in that six-file set today, and none should appear in it afterward. A new lint error in a previously-clean file is a regression item 1 introduced, not baseline noise — stop and fix it, don't fold it into the identity.
```
git status --porcelain -- src/ supabase/
```
Before: exactly `" M src/lib/maintenance.ts"`. After item 1's edits (uncommitted): that line unchanged, plus `M` on the five touched files above and untracked/added entries for the new form component and new test files. **`maintenance.ts`'s line must be present, unchanged, and touched by nothing item 1 does.**
```sql
SELECT count(*) FROM email_delivery_events WHERE event_type = 'review_request_client';
```
Before any verification work: **1**. **MUST NOT move at any point during this item's implementation or test runs.** This is the one number in this whole item that must never change by accident — a change means a real email went out.

### 1.12 Tests to add

All follow this repo's established mailer-mock discipline (§1.13) — mock at `@/lib/email/client` for tests exercising `notifications.ts` directly, and mock `@/lib/email/notifications`'s exports for tests exercising callers one layer up.

**`src/lib/email/__tests__/sendReviewRequestEmail.test.ts`** (existing file, 12 tests today — extend):
- `it("suppresses a send inside the 6-month cooldown window and returns reason: client_recently_asked")`
- `it("permits a send once the cooldown window has elapsed")`
- `it("does not write review_email_sent_at when suppressed for cooldown")` — explicit regression guard for the named "easiest mistake" in §1.4; mirror the existing `already_sent` test's assertion style.
- `it("ignoreClientCooldown bypasses the cooldown but still honours the per-booking sentinel")` — two sub-cases: bypass sends when no prior sentinel exists; bypass still returns `already_sent` when the sentinel is already set.
- `it("classifies as series when recurring_template_id is set, regardless of completed-booking count")`
- `it("classifies as first_time when the client's completed-booking count, including this booking, is 1")`
- `it("classifies as returning when the client's completed-booking count, including this booking, is 2 or more")`

**`src/app/api/cron/__tests__/review-emails.test.ts`** (existing file, 6 tests today — extend):
- `it("counts a cooldown-suppressed candidate into skipped_client_cooldown, not sent")` — mirror the existing `already_sent` test, with `sendReviewRequestEmail` mocked to return `{ sent: false, reason: "client_recently_asked" }`.
- `it("calls the cooldown batch helper once per tick regardless of candidate count")` — 3+ candidates sharing overlapping `client_id`s; assert the batch call is invoked exactly once.
- `it("computes the classification count in the same batched query as the cooldown lookup, not once per candidate")` — direct test of §1.5's amended batching rule.
- `it("widens the candidate select to include client_id and recurring_template_id")` — extend the existing filter-chain assertion to check the select projection too.
- `it("records the client class in the audit row's after_state alongside automated: true")` — extend the existing audit-row assertion.

**New file: `src/app/admin/emails/__tests__/sendManualReviewRequest.test.ts`** (model the mocking shape on `sendManualBookingReminder.test.ts`, not on `resendEmail.test.ts`'s scope-check tests — see the correction below):
- `it("refuses without resend_booking_emails permission")`
- `it("refuses an unassigned Therapist-class actor and records a failed_resend_attempt operational event with the booking id and staff id")` — assert both the refusal **and** the actual `recordOperationalEvent` call arguments (event type, severity, `bookingId`, `staffId`). **Corrected note:** the prior draft claimed no precedent test asserts the operational-event write at all; that's wrong — `resendEmail.test.ts`'s Therapist-no-assignment test (around `:243-256`) does assert `stub.inserts.some(i => i.table === "operational_events")` is `true`. What's actually missing from that precedent is an assertion on the event's *content* (type/severity/ids), not its existence — this new test is what fills that specific gap, not a from-scratch gap.
- `it("allows an assigned Therapist-class actor")`
- `it("bypasses the 6-month client cooldown (ignoreClientCooldown: true) but still respects the per-booking review_email_sent_at sentinel")`
- `it("respects RESEND_RATE_LIMIT_SECONDS")`
- `it("writes an audit row with automated: false")`
- `it("is not subject to the cron's quiet-hours guard")` — regression guard for the §1.7 decision; assert a send proceeds regardless of mocked "now" time.

**`src/app/admin/emails/__tests__/emails-data.test.ts`** (existing file — extend):
- `it("returns completed bookings with a recipient and no review_email_sent_at, for the manual review-send list")` — mirror the existing `remindersPromise` tests' structure; name the new export consistently and use that exact name here, in `page.tsx`, and in the new form component.

**`src/app/admin/audit/__tests__/format.test.ts`** (existing file — extend):
- `it("labels review_email_sent instead of falling back to the generic operations_and_email phrase")` — regression guard for §1.8's registration decision.

### 1.13 THE HIGHEST RISK — how tests mock the mailer, and what must never run

Two established, layered mocking points; a new test must use one of them correctly and never fall through to a real network call:

1. **At the transport layer** (`src/lib/email/client.ts`), for tests exercising `notifications.ts`'s own logic:
   ```ts
   vi.mock("@/lib/email/client", () => ({
     sendEmail: vi.fn(),
     getFromEmail: vi.fn(() => "Rahma Therapy <no-reply@rahmatherapy.example.test>"),
     extractEmailAddress: vi.fn((value: string) => value),
   }));
   // beforeEach: vi.mocked(sendEmail).mockResolvedValue({ id: "resend-stub-id" } as never);
   ```
   `sendEmail` in `client.ts` is a thin, unconditional wrapper over the real Resend SDK — **no environment guard, no test-mode short-circuit, no domain allowlist in the source.** If `RESEND_API_KEY` is set (it is, in this environment), an unmocked call sends a real email through the Owner's real Resend account.

2. **At the `notifications.ts` module boundary**, for tests exercising callers one layer up (cron route, server actions):
   ```ts
   vi.mock("@/lib/email/notifications", () => ({
     sendReviewRequestEmail: vi.fn(),
     // every other notifications.ts export the file under test imports
   }));
   ```
   **The new manual-send action's test must add `sendReviewRequestEmail` to this mock list.** `sendManualBookingReminder.test.ts`'s existing mock object does not include it (it doesn't need to today) — copy-pasting that mock without adding this import is the most likely way this item accidentally lets a real send through in CI.

**What must never run, in this environment, for this item:**
- Any manual HTTP call to `POST /api/cron/review-emails` against the Owner's dev server — real handler, real `RESEND_API_KEY`.
- Clicking the new manual-send button in the actual admin UI at `localhost:3000` during development or verification.
- Any e2e/Playwright test exercising this flow without an equivalent mailer mock — none is proposed here, and none should be added, per the binding rule "every test mocks the mailer."
- Any recipient address outside `*.example.test` in a fixture.

**Post-hoc check:** the `email_delivery_events` SELECT-only count in §1.11 (before/after, filtered to `event_type = 'review_request_client'`) is sufficient given the live table's current single row of that type — a second row appearing during a "test" session is unambiguous.

### 1.14 Stop conditions

1. If `getClientsAskedForReviewSince` returns a materially different result than a quick manual spot-check expects (e.g. a client who should be inside the cooldown window comes back as eligible) — stop and re-derive the query; do not loosen the filter to make a test pass.
2. If the new manual-send eligibility query returns more than a handful of rows against the live database (15 bookings total today) — a query returning dozens of "completed, no review sent, eligible" rows signals a logic error (unbounded date range, missing recipient filter), not real data volume. Stop and re-check the query.
3. If any test needs to remove or weaken an existing `vi.mock("@/lib/email/client", ...)` or `vi.mock("@/lib/email/notifications", ...)` block to pass — stop immediately. That mock is the only thing standing between the suite and a real send.
4. If `sendManualBookingReminder` (`actions.ts`) or the `ReminderResendForm.tsx` hidden `booking_id` input contract need to change to accommodate the new sibling action or the new UI — stop; both are RECON-untouchable. Mirror the pattern in new code instead.
5. If building the manual-send UI as a genuinely new tab (rather than a subsection of Reminders) turns out to require more than wiring `TabKey`/`resolveTab`/the tabs array — e.g. it would require restructuring how `searchParams` flow through the page — stop and report; that is scope beyond what this item authorizes.
6. If registering `review_email_sent` in `audit/format.ts`'s `ACTIONS` map conflicts with a choice item 8 has already made for the same file in a concurrently-running session — stop and reconcile rather than let the two edits fight.

### 1.15 Rollback

No migrations, no schema changes — item 1 is pure application code (route handler, library function, server action, new React components) plus tests. Rollback is `git revert` of the relevant commit(s); nothing to unwind at the data layer.

The only state item 1 writes that outlives a single request is `bookings.review_email_sent_at` (existing column, unchanged write shape) and new `audit_logs` rows (`action_type: "review_email_sent"`, `after_state.automated: false` for manual sends) — both purely additive audit trail, nothing to roll back destructively. An incorrect manual send's only real-world consequence is one outbound email — which is exactly why §1.13's mailer-mock discipline, not a DB rollback plan, is the real safeguard here.

- A cooldown bug that over-suppresses (drops a legitimate review request): fix forward, no rollback needed — no customer harm, and it mirrors current (worse) behaviour of never suppressing at all, just in the opposite direction.
- A cooldown bug that under-suppresses (a client asked twice within 6 months): the guard is a soft business-logic check, not a uniqueness constraint — no corrupted state, only one extra courteous email. Fix forward.

---

## ITEM 2 — Privacy policy: stop promising what the code doesn't do

### 2.1 The problem

`src/app/(public)/privacy/page.tsx`, section **"6. How long we keep it"** — symbol: the `<section id="how-long-we-keep-it">` block, currently at lines 165-173 (opening tag 165, closing tag 173, body `<p>` at 167-172) — RE-LOCATE BY SYMBOL and report drift rather than trusting these numbers. It states booking and treatment records are kept **7 years**, enquiries **around 12 months**, and (a third sentence, easy to overlook) that analytics data is "kept according to Google's own retention settings."

**Corrected claim** (the plan previously said "Nothing in the codebase deletes anything" — that sentence is not literally true and should not be reused): nothing in the codebase enforces the 7-year/12-month schedule this section describes. No scheduled job, cron route, or database trigger deletes a booking, client, or enquiry because of its age. Deletion does exist elsewhere in the codebase, but none of it is age-triggered:

- `deleteClient()` (`src/app/admin/clients/actions.ts:504-704`) — an on-demand, permission-gated GDPR-erasure path. Hard-deletes sensitive client notes (the code's own comment cites Article 17), cascade-cancels open bookings, soft-deletes the client, is idempotent, and is invoked from `updatePrivacyRequestStatus()` (`src/app/admin/privacy/actions.ts:26-127`) when a `deletion_review` request is marked "Completed."
- `rollbackOccurrence()` (`src/app/api/cron/extend-recurring-horizons/route.ts:564-574`) — a same-run, best-effort rollback of a half-written occurrence when a later step in the same series-extension fails. Not retention pruning.
- The remaining `.delete()` call sites (17 total in `src/`, re-confirmed by grep) are ordinary admin CRUD on availability overrides, staff, email templates, services, and roles — none touch bookings, clients, or enquiries, none are age-triggered.

Enquiries specifically are never deleted by any code path — `Grep "\.delete\(\)"` scoped to `src/app/admin/enquiries/` returns zero matches. The 12-month figure is thus even less backed than the 7-year figure, which at least has an admin-triggered (not automatic) erasure path behind it.

### 2.2 ✅ DECIDED — rewrite generically, do not delete the section

**Owner decision, 2026-08-11: rewrite it, keep it general, and promise nothing the website does not actually do.** The delete-and-renumber path (§2.3) is **not taken**.

The reason the recommendation stood: UK GDPR Article 13(2)(a) expects a privacy notice to state either a retention period **or the criteria used to determine it**. Deleting the section outright removes a disclosure the page is expected to carry, trading an over-promise for an omission. A criteria-based statement satisfies both the Owner's instruction ("generic, not so specific in promising anything") and the requirement.

**The binding constraint on the new wording:** it must describe *criteria*, never a duration, and it must not commit the site to any behaviour the code does not perform. Since nothing deletes anything **by age** (§2.1), the rewrite must not imply scheduled or automatic deletion — only that records are kept no longer than necessary and that a person can ask for theirs. If a candidate sentence would be falsified by "the code does not do that", it fails.

**Rewrite the section's `<p>` body** to say, in the page's existing plain-English voice and without naming any duration:
- records are kept only as long as necessary for the care provided and for legal, insurance and accounting obligations;
- how long that is depends on the type of record and the obligation that applies;
- anyone can ask what is held about them, or ask for it to be deleted, using the contact details in section 1 — which points at rights the page already describes and which are genuinely operable via `/admin/privacy` (see 2.4).

**✅ DECIDED — the third sentence (analytics retention via Google's own settings) is KEPT, unedited**, appended after the rewritten criteria-based sentences. *(Owner decision, 2026-08-11: keep it — it stays consistent and avoids forcing changes elsewhere.)*

This mattered because it names no banned duration string, so a verification pass that only greps for `7 year`/`12 month` would pass whether the sentence survived or was silently dropped. It describes a real, separate consent-gated mechanism (Google's own retention settings) rather than a promise this codebase would have to enforce, so it does not carry the over-promise problem the first two sentences do. **The new test in §2.7 is what actually guards it** — no grep can catch the silent deletion of untouched-looking text.

Keep the heading text ordinal ("6."), the `id="how-long-we-keep-it"` anchor, and the section number.

### 2.3 ❌ NOT TAKEN — the deletion path, retained for the record

Then the sections **must be renumbered**. The heading ordinals are hardcoded literal text inside each `<h3>` — `"7. Your rights"` (line 176 today), `"8. Concerns and complaints"` (line 196), `"9. No automated decision-making"` (line 211) — there is no shared numbering array or generated TOC component anywhere in the file, so each must be retyped by hand to "6.", "7.", "8." respectively. Removing section 6 without renumbering leaves the page jumping "...5. Where your data goes" straight to "...7. Your rights."

Verified: **no table of contents or internal link anywhere in the repo references `#how-long-we-keep-it`** (repo-wide case-insensitive grep, 7 matches total, all either the anchor's own definition or planning/evidence markdown — none a live `href`). The anchor can be removed safely if this path is chosen; only the visible numbering matters for correctness.

**This path is closed.** The Owner chose the §2.2 rewrite on 2026-08-11. The renumbering detail above is retained only so that a future reader who reopens the question knows what it would cost — **do not renumber anything as part of this item.** Section 6 keeps its heading ordinal and its `id="how-long-we-keep-it"` anchor.

### 2.4 Nothing else on the page over-promises — checked, not assumed

- **§2 "What we collect"** (lines 71-101): out of scope, do not touch. One drift note for whoever next audits this section: the file's own top-of-file comment (lines 10-14) cites `src/features/booking/schemas/booking-schema.ts` as a source of truth, but that file's actual exports are `bookingParticipantSchema`, `bookingLocationSchema`, `bookingDetailsSchema`, `bookingVisitSchema`, `bookingAcknowledgementSchema` — there is no `bookingRequestSchema` export (the plan previously named one that doesn't exist). This is a pre-existing comment drift, not something item 2's edit touches or fixes.
- **§5 "Where your data goes"** (lines 155-163): a static factual statement about which of two transfer mechanisms applies to third-party processors. No retention or deletion language. Confirmed unaffected.
- **§7 "Your rights"** (lines 175-193): read in full — lists six rights (access, correction, erasure, restriction/objection, portability, withdraw consent) and points readers at the contact details in section 1. No response-time commitment appears anywhere ("within X days," "1 month," etc.) — confirmed by reading every line.
- **§9 "No automated decision-making"** (lines 210-216): "We do not use automated decision-making or profiling... every booking is reviewed and handled by a member of our team." Consistent with bookings being created `pending` and requiring staff to claim/assign them through permission-gated admin actions — checked by reading `src/app/admin/bookings/actions.ts` and the admin/bookings test files that assert on the `pending` status. This was checked by absence-of-evidence across the files read, not an exhaustive trace of every status transition — reasonable confidence, not a formal proof.

**Change section 6 only.**

### 2.5 Full blast radius

**Files to edit:** exactly one — `src/app/(public)/privacy/page.tsx`. Rewrite path (§2.2): only the `<p>` inside the `how-long-we-keep-it` section. Deletion path (§2.3): that whole `<section>...</section>` block removed, plus the three ordinal literals in the `<h3>` tags immediately below it (currently reading "7.", "8.", "9.").

**Callers / consumers in code: none.** This is a standalone Next.js route (`export default function PrivacyPolicyPage()`), resolved purely by file convention at `/privacy/`. No component imports or renders any part of it.

**Shared with the public/customer site:** the page **is** public-site content, but nothing else in the public site currently links to it — `src/content/site/footer.ts:26` reads `legalLinks: []`, and `SiteFooter.tsx` renders that array via `.map()`, so the live footer today contains **zero legal links, including to this page**. No other public page, layout, or component links to `/privacy/` (confirmed: `Grep "/privacy"` over `src/` returns only this page's own `canonical` metadata value and unrelated `/admin/privacy` matches). This means the page is reachable only by direct navigation or search-engine crawl of the URL, not by any in-site link — an implementer should not go looking for a nav/footer element to update; there isn't one.

**`src/app/booking/manage/` — the known cross-cutting trap, checked by name:** `Grep "privacy|retention|7 year|12 month"` (case-insensitive) scoped to `src/app/booking/manage/` returns **zero matches**. Confirmed clean — item 2 has no blast radius there.

**No other page repeats the figures being edited:** `Grep "7 year|seven year|12 month|twelve month"` (case-insensitive) over `src/` returns matches **only** at `src/app/(public)/privacy/page.tsx:168,170` — the two lines item 2 edits. `src/app/(public)/cookies/page.tsx` discusses per-cookie storage duration, a different and unrelated disclosure, with no "7 year"/"12 month" language. There is no "terms and conditions" page anywhere in the repo to cross-check (site has privacy + cookies only). No design-handoff prototype file references retention duration either.

**Tests affected: none exist today.** `Glob "src/app/(public)/**/__tests__/**"` returns 0 results — the entire `(public)` route group has zero unit/component tests. `Glob "e2e/**/*.spec.ts"` returns exactly 4 files (`admin-roles.spec.ts`, `booking-claiming.spec.ts`, `booking-public.spec.ts`, `admin-contrast.spec.ts`), none of which assert on this page's text (confirmed by grepping those specs for retention/privacy strings). This means the plan's old verification line "the privacy page's existing tests still pass" was **false** — there was nothing to run. §2.7 below adds the page's first test.

**Snapshots affected: none.** No `.snap` file in the repo matches "privacy"; there is no snapshot-testing infrastructure targeting this component.

**No sitemap file exists that would need a URL-list update** — `Glob "src/app/**/sitemap*.ts"` and `Glob "public/sitemap*.xml"` both return 0 results.

**Proven NOT affected, with the exact commands used:**
- No TOC/internal link references the anchor: `Grep "how-long-we-keep-it"` (case-insensitive, whole repo) — 7 matches, all either the anchor's own definition in `page.tsx` or planning/evidence markdown, zero live `href`s. Also checked `Grep "privacy#"` repo-wide — zero matches.
- No other shipped page repeats the retention figures: `Grep "7 year|seven year|12 month|twelve month"` over `src/` — 2 matches, both inside the section being edited.
- `booking/manage/` has zero references: `Grep "privacy|retention|7 year|12 month"` scoped to `src/app/booking/manage/` — zero matches.
- No e2e spec asserts on this page's text: `Grep` over `e2e/` for retention/heading strings — zero hits in spec files.
- Sections 2, 5, 7, 9 need no companion edit — read in full, evidence in §2.4.
- No sitemap file exists — `Glob` checks above, both empty.
- No footer/nav link needs updating — `src/content/site/footer.ts:26` is `legalLinks: []`; `Grep "/privacy"` over `src/` finds no other referencing component.

### 2.6 Ordering relative to the other items

Item 2 is fully independent. `src/app/(public)/privacy/page.tsx` appears in no other item's file-touch list in this plan (items 1, 3, 4, 5, 6, 7, 8 concern email cooldowns, override-list sorting, DB indexes, bundle tooling, adjustment-list counting, admin contrast, and the travel-charge model respectively). No prerequisite, no conflict — can run in any order or in parallel with any other item.

### 2.7 Tests to add, named, with exact file paths

No test currently exists for this page. Add one new file, following this repo's page-test convention (page/data/action modules get `__tests__/<name>.test.ts` beside them — here, a page component test, matching the sibling-test convention used for components elsewhere):

**New file:** `src/app/(public)/privacy/page.test.tsx`

- `it("does not promise a specific retention duration in section 6")` — render `<PrivacyPolicyPage />`, assert the rendered text does not match `/7 years?/i` or `/12 months?/i` within the `#how-long-we-keep-it` section (rewrite path), or that the section is absent entirely (deletion path).
- `it("keeps the analytics retention sentence in section 6")` — rewrite path only; asserts the rendered section text still contains the Google-analytics-retention sentence, so a future edit cannot silently drop it the way nothing currently guards against.
- `it("keeps section headings numbered contiguously with no gap")` — render the page, collect all `<h3>` text matching `/^\d+\./`, assert the extracted leading integers form an unbroken sequence starting at 1. This guards directly against the "5 → 7" gap the deletion path risks, and is valuable regardless of which path (§2.2 or §2.3) is chosen.
- `it("keeps the how-long-we-keep-it anchor")` — rewrite path only; asserts `document.getElementById("how-long-we-keep-it")` (or equivalent query) still resolves.
- `it("describes retention by criteria, not a fixed date")` — rewrite path only; asserts the section text contains obligations-based wording (e.g. matches `/as long as necessary/i` or similar) rather than a bare duration, to lock in the Article 13(2)(a) criteria-based disclosure.

This file lives under `src/**`, so `vitest.config.ts`'s `include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"]` picks it up automatically — no config change needed.

No e2e test is proposed. The 4 existing specs are narrowly scoped (admin roles, booking claiming, booking public flow, admin contrast) and none touch static legal-page copy; adding Playwright coverage for a wording fix would be disproportionate. The new Vitest test above is the right level.

### 2.8 Per-batch verification — exact commands, what must move, what must not

Run from the repo root. Prefer PowerShell for the parenthesized path segment.

1. **Typecheck — must stay at 0.**
   ```
   npx tsc --noEmit
   ```
   A pure-JSX text edit inside an already-typed component should not move this at all. Any change is a stop condition.

2. **No duration string survives — rewrite path only** (not applicable under the deletion path, since the whole section is gone either way).
   ```powershell
   Select-String -Path "src\app\(public)\privacy\page.tsx" -Pattern "7 year", "12 month" -SimpleMatch
   ```
   MUST return zero matches after the edit (currently returns 2, at lines 168 and 170 — this is the "before" baseline). This check alone does **not** confirm the analytics sentence survived — that is checked separately by the new test in §2.7, since no banned-string grep can catch a silent deletion of untouched-looking text.

3. **Section numbering stays contiguous** (both paths — rewrite keeps 1-9, deletion renumbers to 1-8).
   ```powershell
   Select-String -Path "src\app\(public)\privacy\page.tsx" -Pattern '<h3.*>\d\.'
   ```
   MUST show an unbroken 1,2,3,4,5,6,7,8,9 sequence (rewrite path) or 1,2,3,4,5,6,7,8 with the original "7/8/9" ordinals now reading "6/7/8" (deletion path). MUST NOT show any repeated or skipped ordinal.

4. **The anchor `id="how-long-we-keep-it"`** — kept (rewrite) or removed (deletion, since §2.3 confirmed nothing links to it).
   ```powershell
   Select-String -Path "src\app\(public)\privacy\page.tsx" -Pattern 'id="how-long-we-keep-it"' -SimpleMatch
   ```
   Rewrite path: MUST still show 1 match. Deletion path: MUST show 0 matches.

5. **Vitest — baseline must not move (identity, not just count).**
   ```
   npx vitest run
   ```
   Baseline is 5 failed / 2236 passed (2241): `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3, both pre-existing and unrelated to this page. MUST stay exactly those 5 named failures. After adding the new test file from §2.7 (5 test cases on the rewrite path, or fewer if the deletion path drops the analytics/anchor/criteria-wording cases), the passed count MUST increase by exactly the number of new cases added, with 0 new failures. A 6th failure may appear intermittently — that is the documented flake in `ManualBookingForm.test.tsx`'s "malformed email" case; confirm it by re-running that file alone (`npx vitest run src/app/admin/bookings/new/ManualBookingForm.test.tsx` → must show exactly 3 failed / 33 passed) before treating any extra failure as real.

6. **Lint — must not move.**
   ```
   pnpm lint
   ```
   Baseline: 59 errors / 7 warnings across exactly six files (see the handoff's lint identity list). `src/app/(public)/privacy/page.tsx` and the new `page.test.tsx` are not in that list today and MUST NOT appear in it after the edit.

### 2.9 Stop conditions

*(Stop conditions 1 and 2 in the previous revision were the rewrite-vs-delete question and the analytics sentence. **Both were answered by the Owner on 2026-08-11** — §2.2 rewrite, analytics sentence kept — and are removed from this list rather than left standing as false blockers.)*

1. **The rewritten wording would commit the site to behaviour the code does not perform** — anything implying scheduled, automatic or age-triggered deletion. Nothing deletes by age (§2.1). This is the Owner's explicit constraint: keep it general, promise nothing the website does not do.
2. **Any new duration or schedule language creeps back in during drafting** — e.g., "we typically keep records for a few years" still names an implicit figure. The Article 13(2)(a) criteria-based approach means describing the *basis* (legal/insurance/accounting obligation, care needs), not a number, however soft.
3. **`npx tsc --noEmit` moves off 0, or `npx vitest run`'s failing set changes identity** (different 5 tests, or a different count) beyond the expected new-test additions. This is a pure-copy-plus-one-new-test-file change; any other ripple is unexpected and must be investigated before proceeding.
4. **A footer/nav link to `/privacy/` is discovered that this audit missed** — re-run `Grep "/privacy"` over `src/` before starting, since `footer.ts`'s `legalLinks: []` could change between this draft and implementation. If a link now exists, check the new copy still reads correctly in that link's context.
5. **The implementer is tempted to also fix section 2's field-mapping drift (the `bookingRequestSchema` comment, §2.4) or section 7's missing response-time commitment.** Both are out of scope — "Change section 6 only." Flag them as separate follow-ups.

### 2.10 Rollback

Nothing here is irreversible. This is a pure content edit to one tracked file (`src/app/(public)/privacy/page.tsx`) plus one new test file, no migration, no data write, no cache/tag invalidation (the page is plain server-rendered content with no `revalidatePath`/`updateTag` call). Rollback is `git diff` / `git checkout -- src/app/(public)/privacy/page.tsx` targeting only that file and the new test file — never a bare `git checkout .` or any command touching the rest of the intentionally-dirty tree.

### 2.11 One more content-integrity note

`LAST_UPDATED` (`src/app/(public)/privacy/page.tsx:29`, rendered at line 45, currently `"9 August 2026"`) is not wired to anything automatic — it's a hardcoded string. Editing the substantive legal text of section 6 without bumping this date is a real content-integrity gap for a privacy policy (the page would claim to be current as of a date before the actual change). Update `LAST_UPDATED` to the date the edit ships, as part of this item's diff, regardless of which path (§2.2 or §2.3) is chosen.

---

## ITEM 3 — The missing secondary sort on override lists

### 3.1 The problem

C-14 Phase C dropped the unique constraints on `availability_overrides(override_date)`
and `staff_availability_overrides(staff_id, override_date)` — confirmed live via
`pg_constraint`: each table now carries only its primary key (plus a `CHECK` and,
on the staff table, its `staff_id` foreign key); no `UNIQUE` constraint remains on
either, and the old unique indexes are gone with it. One date can now legitimately
hold several segment rows. Five list queries order by `override_date` **only**,
which was a total ordering when one row per date was guaranteed and is not any
more.

### 3.2 Exact sites (re-locate by symbol, do not trust the line numbers)

Both files are inside `src/`, which is byte-identical to the plan's base commit
`33f895f`, so these line numbers currently land correctly — but re-locate by
symbol and report drift if they don't, per the standing convention.

`src/app/admin/availability/page.tsx`, symbol `AvailabilityPage` (the default
export, the async Server Component), inside its opening `Promise.all([...])`:
- Week window (`.gte("override_date", weekStartIso).lte(..., weekEndIso)`) —
  `.order("override_date", { ascending: true })`, currently at `:274`. Feeds
  `weekAdjustments`.
- Upcoming (`.gte("override_date", today)`, `.limit(AVAILABILITY_UPCOMING_DEFENSIVE_CAP)`)
  — `.order("override_date", { ascending: true })`, currently at `:279`.
- Past (`.lt("override_date", today)`, `.limit(...)`) — `.order("override_date",
  { ascending: false })`, currently at `:291`. **Descending.**

`src/app/admin/staff/[staffId]/availability/page.tsx`, same shape, one fewer
bucket (no week window on the per-staff page):
- Upcoming — `.order("override_date", { ascending: true })`, currently at `:154`.
- Past — `.order("override_date", { ascending: false })`, currently at `:168`.
  **Descending.**

The `count: "exact", head: true` queries adjacent to each of the above (two per
file) carry no `.order()` today and need none — leave them.

Confirmed exhaustively that no sixth site exists anywhere in the repo: a
whole-`src/` grep for `order\(.override_date` returns exactly these 5 hits; a
grep for every `availability_overrides` / `staff_availability_overrides`
reference (39 lines, 15 files) shows every other hit is either a mutation
(delete-then-insert save actions, no `.order()`), a single-date `.eq()` lookup
consumed as a set (`assignment-eligibility.ts:212,227`; the live slot-engine's
`loadDayRecords()` in `src/lib/booking/availability.ts:595,606`, whose caller
`working-hours-segments.ts:toSpans` already does its own unconditional
`.sort((a,b) => a.start - b.start || a.end - b.end)`), or a test/type comment;
and a case-insensitive `order by` sweep of `supabase/**` finds no `ORDER BY
override_date` in any RPC or migration (the one adjacent hit,
`20260809120000_c14_save_availability_day.sql`'s `ORDER BY rule.start_time,
rule.end_time` inside a `jsonb_agg`, is the **rules** table, already carries a
`start_time` secondary key, and is out of item 3's scope).

### 3.3 The change

Add `.order("start_time", { ascending: true })` as a **second** `.order()` call
on each of the five chains above (PostgREST/`postgrest-js` concatenates
successive `.order()` calls into one comma-separated `order=` parameter, so call
order is what determines primary/secondary — confirmed by reading
`PostgrestTransformBuilder.ts`).

On the two descending queries, **the date stays descending and `start_time`
stays ascending** — the list reads newest date first, but within a date the
segments must read 08:00 before 15:00.

No `NULLS`-handling logic is needed: `start_time` is `NOT NULL` on both tables
(confirmed via `information_schema.columns`), so there is no null tie-break case
to reason about.

### 3.4 Current risk, precisely

Do not oversell this fix as closing a live display bug — it isn't one today.
All three human-visible rendering paths that consume these rows already
re-sort a date's segments by `start_time` client-side, independent of query
order:

- `src/app/admin/availability/page.tsx` — `formatSegments()` (currently
  `:144`) calls `sortByStartTime()` (currently `:132`,
  `[...segments].sort((a,b) => a.start_time.localeCompare(b.start_time))`)
  before rendering the week grid. Locked in by
  `src/app/admin/availability/__tests__/page.test.ts`'s existing test *"joins
  multiple segments with ' · ', sorted by start time regardless of input
  order"*.
- `src/app/admin/availability/AvailabilityOverridesManager.tsx` — `groupByDate()`
  buckets rows into a `Map` (order-independent) and then, with the comment
  *"Date order comes from the query; segment order does not."*, sorts each
  date's segments by `start_time.localeCompare`. `OverrideRow` renders the
  already-sorted `day.segments` directly.
- `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx`
  — identical shape: `groupByDate()` (currently `:66`), the same comment
  (currently `:85`), the same sort (currently `:87`), `OverrideRow` (currently
  `:508`) rendering `day.segments` directly.

So the reversed-order failure mode this fix targets is already prevented,
client-side, everywhere a human sees these rows. Adding the secondary sort
server-side is still the right thing to do — it makes the **query** itself
deterministic, which matters for anything that reads these rows without going
through one of the three helpers above (raw SQL, the Supabase dashboard, a
future direct consumer) — but frame it as **query-level determinism /
defense-in-depth**, not as a fix for a reachable rendering bug. Don't go
looking for a display bug that doesn't exist, and don't claim in the commit
message that this fix corrects something users could currently see.

*(Corrected: an earlier draft of this section warned that skipping the fix
"would display a day's hours in reverse — an easy and invisible mistake." That
description is true only of the raw query in isolation; it is false as a
description of current live risk, because all three renderers above already
guard against it and are already tested for it.)*

### 3.5 What this does and does not fix

Adding the sort makes the ordering **total and deterministic**, so a date's
segments are contiguous and would render in the right order even for a
hypothetical consumer that skipped client-side sorting. **It does not stop a
`.limit()` boundary falling mid-date** — a capped list can still show a date
with only some of its segments. That is the caps/date-counting problem, out of
scope here (§0.2) and requiring a view or RPC (item 6). Do not attempt it here,
and do not claim this fix closes it.

### 3.6 Blast radius

**Files edited by item 3 itself:**
- `src/app/admin/availability/page.tsx` — three `.order()` chains gain a second
  `.order("start_time", { ascending: true })` call.
- `src/app/admin/staff/[staffId]/availability/page.tsx` — two `.order()` chains,
  same change.

No other file needs a code change for item 3 in isolation.

**Callers / consumers (proven affected, output unchanged, determinism gained):**
- `weekAdjustments` → `groupOverridesByDate()` → the week-grid JSX (via
  `formatSegments`). Already resorts client-side; output is identical
  before/after, input is now deterministic.
- `overridesUpcoming` / `overridesPast` → `<AvailabilityOverridesManager
  upcoming=... past=... />` → its internal `groupByDate()`. Same: output
  unchanged, input now deterministic.
- The per-staff page's equivalent props → `<StaffAvailabilityOverridesManager>`
  → its own `groupByDate()`. Same.
- The four `count: "exact", head: true` sibling queries (two per file) —
  confirmed to carry no `.order()` today; untouched.

**Proven NOT affected (checked explicitly, commands given):**
- `src/app/booking/manage/{ManageBookingForms.tsx,actions.ts,page.tsx}` —
  `Grep "override|\.order\("` over these three files returns zero matches.
  This tree never queries an override table. The named collision trap does
  not apply to item 3.
- `src/app/(public)/**` — no file under the public tree references
  `override_date`, `availability_overrides`, or `staff_availability_overrides`
  at all (confirmed by the repo-wide `availability_overrides|staff_availability_overrides`
  grep in §3.2; every non-admin hit is in `src/lib/booking/availability.ts` or
  `assignment-eligibility.ts`, both handled next).
- `src/lib/booking/availability.ts` (`loadDayRecords()`, used by the live
  customer-facing slot-availability engine) — reads override rows with no
  `.order()` at all; its only consumer, `working-hours-segments.ts:toSpans`,
  does its own unconditional `.sort()`. Not one of the five sites; already
  order-independent by construction; untouched by item 3.
- `src/app/admin/bookings/assignment-eligibility.ts` — single-date `.eq()`
  lookups (`:212`, `:229`), no `.order()`, consumes rows for one date as an
  unordered set for eligibility scoring. Not affected.
- SQL/RPCs in `supabase/migrations/**` — no `ORDER BY override_date` anywhere
  in migration history (case-insensitive `order by` grep across `supabase/`);
  the atomic-booking-snapshot RPCs do single-date `WHERE override_date =
  p_booking_date` lookups, not ordered lists. Not affected.
- Both override tables hold **0 rows** live (confirmed via `SELECT count(*)`
  on both), so there is no live data whose display order could currently be
  wrong — there is nothing to observe live either before or after this change.

### 3.7 Shared with the public/customer site

Nothing. Both edited files are under `src/app/admin/`; their two consumer
components are admin-only. `/booking/manage` — the one place a leak could
plausibly hide — is confirmed clean by direct grep (§3.6). No further public
surface exists for this item.

### 3.8 Ordering and prerequisites vs other items

- **Item 6 depends on item 3 — ship 3 first, then 6 — but on a narrower
  mechanism than the plan currently states.** The plan's §6.7 says item 3 is
  required because "grouping is only deterministic once segments of a date are
  contiguous and in time order." The contiguity half of that does not actually
  require item 3: `ORDER BY override_date` alone already clusters every row
  sharing a date value together in the result set, and both `groupByDate()`
  implementations are `Map`-based, which buckets by key regardless of input
  order — they never needed contiguous input. The time-order half is true, but
  (per §3.4) it's already independently guaranteed by each renderer's own
  client-side `.sort()`. The **practical conclusion still holds** — do item 3
  before item 6, because they edit the same two `page.tsx` files and item 6's
  own verification language is written assuming item 3 has landed — but the
  stated *mechanism* in §6.7 should be corrected to something like: "item 3
  is sequenced first because it touches the same query chains item 6 also
  touches, and because item 3's disclosed limitation (a `.limit()` boundary
  can still split a date) is exactly what item 6 removes — not because
  grouping would otherwise be non-deterministic."
- **Item 7 (admin colour/contrast) touches the same six files for an unrelated
  reason** — literal `oklch(...)` substitution. Sequence item 3 (and item 6)
  fully before item 7 starts on these files, and re-anchor by symbol
  afterward, per the plan's existing "Suggested order and commits" table.
  *(Corrected: the plan's line 1222 states this collision as "23 `oklch()`
  literals" across the six files. That figure is a **line count**
  (`grep -c`, i.e. lines containing at least one match), not an occurrence
  count. Re-run independently with an occurrence count (`grep -o`, counting
  every literal, since a line can carry more than one) on the same six files:
  `page.tsx`=8, staff `page.tsx`=0, `availability-data.ts`=0, staff `lib.ts`=9,
  `AvailabilityOverridesManager.tsx`=7, `StaffAvailabilityOverridesManager.tsx`=2
  — sums to **26**, not 23. This session's established convention is to
  standardise on occurrence counts for any ratchet guard item 7 builds, so
  whoever edits item 7's section should update line 1222's figure from 23 to
  26. This does not change item 3's own scope or sequencing — it is noted here
  only because item 3 is what first collides with item 7 on these files.)*
- No overlap found between item 3 and items 1, 2, 4, 5, or 8 — none of those
  touch `availability_overrides`, `staff_availability_overrides`, or either
  availability `page.tsx`.

### 3.9 Verification

Per-batch, run after editing each file (or both together — they're independent
edits):

```
npx tsc --noEmit
```
Must exit 0, silently, as it does on the current baseline. The `.order()`
overload requires a valid column name and options shape, so a typo here is a
compile error, not a runtime one.

```
npx vitest run "src/app/admin/availability" "src/app/admin/staff/[staffId]/availability"
```
Baseline today: **9 test files, 89 tests, all passing.** After adding the two
new ordering-regression cases (§3.10), this **must become 9 files / 91 tests**
if extending the existing file plus the new file both land — track the exact
number for whichever subset you've added at the time you run this. Nothing in
this range should newly fail.

```
npx vitest run
```
Full-suite baseline: **5 failed / 2236 passed (2241)**, Test Files 2 failed |
220 passed (222). This total **must not move** except for the count increase
from the new tests in §3.10 (passing). Do not let a change here fix or newly
break either of the two pre-existing failing files
(`src/lib/auth/admin-access.test.ts`, `ManualBookingForm.test.tsx`) — if either
count changes, stop and investigate before attributing it to item 3.

No live-data check is possible or meaningful: both override tables hold 0 rows
today. Say so in the commit rather than claiming a live check that can't
happen.

### 3.10 Tests to add

This repo has no precedent for unit-testing a Server Component's Supabase
query-builder chain directly (no `page.tsx` in this tree exposes its query
apart from the component body, and the only place a Supabase chain is mocked
at all — `actions.test.ts` — covers mutations, which never call `.order()`).
Building that scaffold for a two-line, non-branching change would itself be
speculative. Verify the query edit via `npx tsc --noEmit` plus a direct read
confirming exactly five `.order("start_time", { ascending: true })` calls
landed as the **second** `.order()` on each pre-existing chain (§3.9).

What genuinely deserves a test is the thing currently undertested: the
client-side sort that is the real guarantee of correct display, reinforced
(not replaced) by item 3's DB-level change.

1. **Extend** `src/app/admin/availability/AvailabilityOverridesManager.test.tsx`
   — add a case named:
   `it("renders a date's segments in start-time order even when the input rows arrive out of order", ...)`
   Feed `upcoming` with the existing two-segment fixture shape but with the PM
   row (`15:00:00`–`20:00:00`) listed **before** the AM row
   (`08:00:00`–`12:30:00`) — mirroring what an unordered or DB-tie-broken
   result could look like — and assert the rendered entry's text still reads
   `"08:00–12:30 · 15:00–20:00"` (the existing joined-segment assertion
   pattern already used at this file's line 88, just with reversed input).
   This is the regression test that actually protects users; it has no
   equivalent today.
2. **New file**
   `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.test.tsx`
   — this component has **zero test coverage of any kind** today, not just of
   ordering. Creating a file with only the ordering case risks looking like
   adequate coverage was added when it wasn't — so this new file's minimum
   scope must be more than the one ordering case. At minimum, mirror the shape
   of the sibling `AvailabilityOverridesManager.test.tsx` (mock `./actions`,
   `next/navigation`, and `sonner` the same way) and cover:
   - `it("renders a date's segments in start-time order even when the input rows arrive out of order", ...)`
     — the same regression case as above, using
     `StaffAvailabilityOverridesManager`'s props (`staffId`, `upcoming`,
     `upcomingTotal`, `past`, `pastTotal`, `pastViewAll`, `pastAllHref`,
     `pastRecentHref`, `weeklyRules`).
   - `it("groups two segment rows on the same date into a single override entry", ...)`
     — the grouping equivalent of the collision this whole area exists to
     guard (mirrors the collision reasoning already documented at the top of
     the sibling test file for `AvailabilityOverridesManager`).
   - `it("renders the empty state when there are no upcoming overrides", ...)`
     — covers `EmptyOverridesState`, currently unexercised.
   Do not treat this new file as in scope only because item 3 needs one
   ordering case in it — since it starts from zero coverage, ship it with this
   minimum baseline or flag explicitly in the commit that it is deliberately
   partial and why.

### 3.11 Stop conditions

Halt and ask rather than proceeding if any of the following happen:

1. Re-locating the five sites by symbol turns up a different count than 5, or
   any site's shape (which bucket, ascending vs descending) doesn't match
   §3.2 — this means the anchor has drifted for a reason not accounted for
   here (e.g. item 6 or item 7 already landed on these files out of the
   stated order).
2. Either override table has non-zero rows at the time of implementation —
   this whole section's "nothing to observe live" reasoning no longer holds,
   and the change should be checked against real data before shipping, not
   assumed safe by analogy to the empty-table case.
3. `npx vitest run "src/app/admin/availability" "src/app/admin/staff/[staffId]/availability"`
   does not land at exactly 9 files / 91 tests after both test additions (or
   the intermediate count doesn't match after adding only one file's worth).
4. The full-suite baseline moves by anything other than the exact net new
   passing tests added here — in particular, if either of the two documented
   pre-existing failing files' pass/fail counts change.
5. `npx tsc --noEmit` produces any output at all (baseline is silent, exit 0).
6. Implementing the fix reveals a genuine live rendering discrepancy in one of
   the three consumers named in §3.4 (i.e. the "already defended
   client-side" claim turns out false on closer reading) — that would be a
   separate, more serious finding worth surfacing loudly, not silently folded
   into this item.

### 3.12 Rollback

Nothing here is irreversible. This item is a pure code diff — five added
`.order()` calls across two files, plus one extended and one new test file.
No migration, no data write, no schema change. `git revert` of the commit (or
of the two file edits plus the two test file changes) fully undoes it with no
residual state anywhere, live or otherwise.

---

## ITEM 4 — `bookings` indexes ⛔

*One of two Zone-2 items; the other is item 8 (6 migrations). Item 6 takes Option A, which needs no migration — so item 4's is the only migration until item 8 starts.*

> **Corrected:** the previous header read "⛔ (the only Zone-2 item, unless item 6 takes Option B)". That contradicted this plan's own scope table (§0.1), which lists item 8 as Zone-2 unconditionally. An implementer skimming only this header would wrongly conclude item 8 doesn't need the same Owner-approval-then-orchestrator-applies protocol. It does. The two items are independent Zone-2 actions — see §4.7 for how they relate.

### 4.1 The problem

`getBookingViewCounts` fans out **11 `count: "exact", head: true` queries per clinic-wide page render** (`visibleBookingViews(true)` returns `["attention","today","upcoming","claimable","assigned","unassigned","partially_assigned","completed","cancelled","all","series"]`, one count query per entry, run in parallel — verified by reading the array literal and the `Promise.all` fan-out). The list query orders by `booking_date DESC, start_time DESC, id DESC` with `.range()` pagination.

Live index state on `bookings` — verified, not assumed:

| Index | Definition |
|---|---|
| `bookings_pkey` | `(id)` |
| `bookings_client_status_completed_idx` | `(client_id, status) WHERE status = 'completed'` |
| `idx_bookings_recurring_template` | `(recurring_template_id) WHERE recurring_template_id IS NOT NULL` |

**Nothing on `booking_date`, `start_time`, unqualified `status`, `assignment_status`, `reschedule_status`, `customer_cancelled_at` or `payment_status`.**

**15 rows today; the brief projects 10–15k.** At 15 rows every plan is a sequential scan and the planner will ignore any index added — which is exactly why adding them now is free, and why *verifying* them by query plan now is meaningless. `booking_date`, `start_time`, `id` (the ORDER BY columns) are all `NOT NULL`, and the `booking_status_type` enum has 5 values (`pending, confirmed, completed, cancelled, no_show`) — genuinely low-cardinality.

### 4.2 Column usage — symbol, anchors, and a corrected count

Symbol: `buildBookingPredicatePlan` in `src/app/admin/bookings/bookings-list-data.ts`, currently at **lines 273–401** — **RE-LOCATE BY SYMBOL and report drift rather than trusting these numbers.**

Verified column-usage counts within the function body:

| Column | Count | Sites |
|---|---|---|
| `booking_date` | 5 | L332, L338, L341, L366, L367 |
| `assignment_status` | 4 | L313, L345, L348, L364 |
| `recurring_template_id` | 2 | L357, L358 (mutually exclusive branches) |
| `reschedule_status`, `payment_status`, `customer_cancelled_at`, `client_id` | 1 each | L314, L365, L315, L395 |
| `status` (targeting `bookings.status`) | **6** | L294 (`notInert()` def, reached from L303 and L331), L312, L342, L351, L354, L363 |

> **Corrected:** the previous text said `status` ×12. No defensible counting method reaches 12 — the ceiling under a raw-token count (`\bstatus\b`, word-boundary, lines 273–401) is 11, and that figure includes two pure-JS branch reads that never reach a query. The methodologically-consistent count — "distinct source sites that emit a `bookings.status` predicate," the same method that correctly produced 5/4/2/1/1/1/1 above — is **6**. A 7th occurrence exists (line 333, `eq(\`${embed("fv")}.status\`, "unassigned")` in the `claimable` view) but it filters **`booking_assignments.status`**, not `bookings.status` — `fv` resolves to `booking_assignments` via `BOOKING_FILTER_EMBEDS` (~line 195), reached through PostgREST's `!inner` embed. `bookings_status_date_idx` on `public.bookings` cannot serve that predicate at all; do not cite it as justification.

### 4.3 Proposed indexes

```sql
-- Serves the list's ORDER BY booking_date DESC, start_time DESC, id DESC
-- plus .range() pagination. All three columns are NOT NULL, so nulls-ordering
-- is moot. btree scans backwards, so an ascending definition serves the
-- descending order too (Postgres "Index Scan Backward").
CREATE INDEX IF NOT EXISTS bookings_date_time_id_idx
  ON public.bookings (booking_date, start_time, id);

-- status targets bookings.status directly in 6 predicate branches (notInert's
-- exclusion — reached from two call sites, attention, upcoming, completed,
-- cancelled, and the post-filter), almost always alongside a booking_date
-- bound. (A 7th occurrence, in the claimable view, filters
-- booking_assignments.status via the fv embed and is irrelevant to this
-- index — see §4.2.) Leading with the equality column and trailing the range
-- column is the standard composite shape, though note one of the 6 (the
-- `upcoming` view's `neq("status","completed")`) is a negation on the
-- leading column, which this index helps less than the other 5 equality/IN
-- usages — Postgres will likely enter via booking_date for that one instead.
CREATE INDEX IF NOT EXISTS bookings_status_date_idx
  ON public.bookings (status, booking_date);

-- assignment_status drives the claimable/assigned chips: attention's
-- neq.fully_assigned, unassigned's eq, partially_assigned's eq, and the
-- post-filter's eq — all 4 are genuine equality/inequality-on-leading-column
-- shapes. No existing index touches this column.
CREATE INDEX IF NOT EXISTS bookings_assignment_status_date_idx
  ON public.bookings (assignment_status, booking_date);

-- The client detail page lists a client's bookings; the existing composite
-- (bookings_client_status_completed_idx) is partial on status='completed'
-- and Postgres can only use a partial index when the query provably implies
-- that predicate, so it cannot serve the unfiltered history. Every live
-- row-returning client_id-scoped read of bookings (getClientDetailData,
-- both the full-access and therapist-scoped branches) also does
-- .order("booking_date", desc).order("start_time", desc) — 4 of the file's
-- 6 client_id-scoped bookings queries do this; the other 2 are head-count-only
-- with no ORDER BY. A bare (client_id) index would serve the filter but leave
-- sorting as a separate step, so this is widened to a composite that serves
-- both, at only marginal size cost over the bare version, and serves the
-- count-only queries exactly as well.
CREATE INDEX IF NOT EXISTS bookings_client_id_date_idx
  ON public.bookings (client_id, booking_date, start_time);
```

> **Corrected:** the previous list proposed a bare `bookings_client_id_idx (client_id)`. Widened to `(client_id, booking_date, start_time)` because every row-returning `client_id`-scoped read in `client-detail-data.ts` sorts by those two columns immediately after filtering — see the SQL comment above and §4.5's blast-radius trace. This is not a correctness fix (the bare version was not wrong), it is closer alignment with the plan's own "for volume, not today" rationale.

**Deliberately NOT indexed:** `reschedule_status`, `payment_status`, `customer_cancelled_at` — one predicate each (verified), and all low-cardinality. Indexing them would add write cost for no realistic read benefit. If profiling later says otherwise, add them then.

### 4.4 Execution notes

- **Do NOT use `CREATE INDEX CONCURRENTLY`.** It cannot run inside a transaction block — this part is a hard Postgres rule (`25001: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`), not something to verify. Whether `apply_migration` itself wraps statements in a transaction is **plausible but unverified from outside the tool** (no prior migration in this repo's 58-file history uses `CONCURRENTLY`, including two earlier index-adding migrations of comparable or larger table size — circumstantial, not proof). Either way there is nothing to gain: at 15 rows a plain `CREATE INDEX` is instantaneous, and `CONCURRENTLY` buys nothing even if it would technically run.
- `IF NOT EXISTS` on every statement, so re-running is safe.
- **This is Zone-2.** The executing agent writes the migration file and stops. The Owner approves the exact SQL in chat; the orchestrator applies it via `mcp__supabase__apply_migration`. No subagent calls that tool.
- Filename: a 14-digit timestamp later than the current newest migration (`20260809160000_c14_override_breaks.sql`), snake_case description. Recommended: `supabase/migrations/20260811130000_add_bookings_indexes.sql` — any later, unique, correctly-formatted timestamp is equally valid. Note: the timestamp Supabase records in `supabase_migrations.schema_migrations` at apply time is not guaranteed to equal the filename's timestamp (observed mismatch on `c14_override_breaks`: filename `20260809160000`, recorded version `20260809205045`) — harmless here since nothing depends on the two matching, but don't go looking for the file's own timestamp in the tracking table and treat its absence as an error.

### 4.5 Blast radius

**Files to edit:** one new file only — `supabase/migrations/<timestamp>_add_bookings_indexes.sql` (§4.4). No existing file is edited by this item; it is additive DDL.

**Callers / consumers checked (all traced by reading the source, not assumed):**
- `buildBookingPredicatePlan`, `countBookings`, `getBookingsListData`, `getBookingViewCounts` — all in `bookings-list-data.ts`. No code change required; indexes are a query-planner concern only, invisible to PostgREST/application code.
- `getScopedBookingIds` (`bookings-list-data.ts`, ~lines 515–548) — queries `booking_assignments`, with one embedded filter `bookings!inner(status, booking_date)` (~line 531) that reads `bookings.status`/`bookings.booking_date` through a join. `bookings_status_date_idx` and `bookings_date_time_id_idx` can only help this, never hurt or break it.
- `getClientDetailData`, `countClientBookings` (`src/app/admin/clients/[clientId]/client-detail-data.ts`) — traced in full in §4.3's index comment. No code change required.

**`/booking/manage` — checked by name, the known cross-cutting surface:**
`Grep "\.eq\(\"client_id\"|\.from\(\"bookings\"\)" src/app/booking/manage/actions.ts` → 3 matches (lines 83, 141, 216). Read all three (lines 70–229): every one is `.from("bookings").update({...}).eq("id", booking.id)...` — filtered **only by primary key**, never by `status`, `booking_date`, `assignment_status`, `client_id`, or `recurring_template_id`. All three are served by the existing `bookings_pkey` regardless of this item. **`/booking/manage` is unaffected.**

**Shared with the public/customer site:** nothing under `src/app/(public)/` reads or writes `bookings` directly by any of the four newly-indexed columns — public pages create bookings through `create_booking_request`, a DB function, not through the admin data-layer files this item touches. Combined with the `/booking/manage` check above: **no public-facing behavior is touched by this item under any outcome** — indexes cannot change query results, only planner choices.

**Proven NOT affected (checked, not assumed):**
- **New index-name collisions:** `Grep "bookings_date_time_id_idx|bookings_status_date_idx|bookings_assignment_status_date_idx|bookings_client_id_date_idx"` across the whole repo → no matches anywhere in code, migrations, or tests today. No collision risk.
- **No index-existence tests anywhere:** `Grep "pg_indexes|indexdef|CREATE INDEX"` across `src/` and `scripts/` → zero matches. Nothing in the vitest suite asserts on `pg_indexes` output.
- **Generated TypeScript types:** `Glob **/database.types.ts`, `Glob **/*.types.ts` (under `src/`), `Grep "Database\["` across repo, `Grep "gen.types|types:generate|supabase gen"` in `package.json` → all empty. No generated-types file exists in this repo at all; every Supabase query result is manually cast to hand-written interfaces (`bookings-list-data.ts`'s own header comment confirms this). An index-only migration has zero TypeScript impact, and would have none even if generated types existed — `generate_typescript_types` output never encodes index metadata.
- **`buildBookingPredicatePlan`'s existing tests** (`__tests__/view-predicates-parity.test.ts`, `__tests__/booking-view-counts.test.ts`) run against an in-memory recording stand-in query builder, not a live Postgres connection — they cannot observe index usage and will not change behavior with or without this migration.

### 4.6 Ordering relative to the other items

**No file overlap with any of items 1, 2, 3, 5, 6, 7.** Item 6 ("adjustment lists") concerns `availability_overrides`/`staff_availability_overrides`, a different table entirely. **Item 8 also writes migrations (4 of them, against `business_settings.allowed_cities` and related tables)** — no shared file, no shared table, so there is no sequencing dependency between the two Zone-2 items' SQL. But both are Zone-2: each needs its **own** Owner approval of its exact SQL text in chat, applied by the orchestrator, never batched or waved through together on one approval.

Item 4 has no prerequisite among items 1–3 or 5–8, and is not a prerequisite for any of them. It can be sequenced anywhere in the execution order.

### 4.7 Per-batch verification

**Before writing the migration file**, re-confirm the premise hasn't drifted:
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='bookings' ORDER BY indexname;
-- MUST show exactly the 3 rows in §4.1's table. If not, stop (§4.8.1).

SELECT count(*) FROM public.bookings;   -- MUST be close to 15 (§4.8.2).
```

**After the Owner applies the migration** (orchestrator-run, not subagent):
```sql
-- 1. Confirm all 4 new names exist alongside the 3 originals (7 total)
SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND tablename='bookings' ORDER BY indexname;
-- MUST now include: bookings_assignment_status_date_idx, bookings_client_id_date_idx,
--   bookings_client_status_completed_idx, bookings_date_time_id_idx, bookings_pkey,
--   bookings_status_date_idx, idx_bookings_recurring_template

-- 2. Confirm row count is unchanged (CREATE INDEX never touches data)
SELECT count(*) FROM public.bookings;   -- MUST still be 15 (or whatever §4.8.1 step showed) — MUST NOT change.
```

**What MUST move:** the index list (3 → 7 rows). **What MUST NOT move:** `bookings` row count, any application-visible query result (chip counts, list ordering, client-detail history) — indexes change planner behavior only, never output. Do not attempt to measure a performance improvement; at 15 rows there will be none to measure. The correct claim after this item ships is: *the indexes the projected query shapes will need are in place before the data arrives* — nothing more.

### 4.8 Tests to add

**None.** Consistent with existing precedent, not a gap: neither prior index-adding migration in this repo (`20260522121000_add_band_b_indexes.sql`, `20260803053525_c03_enquiries_converted_booking_index.sql`) added or required a test file, and no test anywhere in the suite asserts on `pg_indexes` or query plans (§4.5). The correct verification is the manual SQL in §4.7, run by the Owner/orchestrator immediately after `apply_migration`.

### 4.9 Stop conditions

1. **If `pg_indexes` at execution time shows anything other than the exact 3 indexes in §4.1's table**, stop — the premise has changed since this was written, and the migration's `IF NOT EXISTS` guards, while safe, may be masking schema drift worth understanding first.
2. **If `bookings` row count is not close to 15** (real volume has already landed), re-read §4.3's "honest expectation" framing before proceeding — the "no measured improvement" claim and the low urgency both depend on the table still being tiny.
3. **If asked to also index `reschedule_status`, `payment_status`, or `customer_cancelled_at`**, don't — §4.3's "deliberately NOT indexed" reasoning still holds; that needs new profiling evidence, not this item.
4. **If `CREATE INDEX CONCURRENTLY` is attempted and does NOT fail**, stop and report rather than assuming the transaction-wrapping model was wrong — it could mean the statement ran outside any transaction, which has implications for how any future multi-statement Zone-2 migration in this repo should be structured.
5. **Before applying, get the exact SQL text re-approved in chat per the Zone-2 protocol** (§1 rule 1) — this item is Zone-2 regardless of what item 8 does, per the corrected header at the top of this section.
6. **`buildBookingPredicatePlan` has moved from lines 273–401**, or any of the line numbers cited in §4.2 have drifted — re-locate by symbol, note the drift, and re-verify the column-usage counts before trusting this section's numbers.

### 4.10 Rollback

Nothing in this item is irreversible. Adding an index changes no data. None of the four proposed indexes back a constraint (all are plain `CREATE INDEX`, not `UNIQUE`/PK), so there is no "cannot drop index because a constraint requires it" hazard.

```sql
DROP INDEX IF EXISTS public.bookings_date_time_id_idx;
DROP INDEX IF EXISTS public.bookings_status_date_idx;
DROP INDEX IF EXISTS public.bookings_assignment_status_date_idx;
DROP INDEX IF EXISTS public.bookings_client_id_date_idx;
```

If the migration file itself needs to be reverted (not just the indexes undone live), it is a pure addition with no dependent application code — deleting it is safe with no co-dependency, unlike `c14_override_breaks.sql` which is deliberately co-shipped with application code changes.

---

---

## ITEM 5 — Make the bundle measurement actually work

### 5.1 Correcting the record first

The backlog says this needs a bundle analyzer, i.e. a package install. **That is wrong, and this plan corrects it.** `scripts/measure-admin-bundles.mjs` **already** solves the hard part: Next 16 Turbopack omits per-route First Load JS from the CLI table, and the script reconstructs it from `.next/build-manifest.json` (`rootMainFiles` + `polyfillFiles`) unioned with each route's `entryJSFiles` from `.next/server/app/<route>/page_client-reference-manifest.js`, then gzips to get real numbers. Only Node built-ins (`node:fs`, `node:path`, `node:zlib`) are imported — confirmed by reading the script's imports. **No package install is needed. This item is not Zone-2.**

Verified against the build currently sitting in the tree (dated 2026-08-09, source commit `aca7c18`): **46 per-route client-reference manifests exist**, including `admin/bookings/new`, `admin/bookings`, `(public)/services`, `(public)/home` and `booking/manage`.

**One correction to the previous wording:** describing these four/five as "every route the outstanding ceilings care about" overclaims. Only `/admin/bookings/new` has a directly-cited ceiling (§5.6 below); no plan cites plain `/admin/bookings` (the list page) by name. State the ceiling-relevant routes precisely rather than by a bundled list — see §5.6.

### 5.2 The two real gaps

1. **`ROUTES` is a hardcoded array of six entries** — symbol `ROUTES`, currently at `scripts/measure-admin-bundles.mjs:31-44` (RE-LOCATE BY SYMBOL and report drift rather than trusting these line numbers): `admin/dashboard`, `admin/reports`, `admin/clients/[clientId]`, `admin/staff/[staffId]`, `admin/me`, `admin/staff/[staffId]/performance`. It contains **no `/admin/bookings*` route and no public route**, which is why C-20's `+3 kB` and C-23's `+6 kB` ceilings were never measurable, along with an estimated nine to eleven earlier plans' ceilings (the precise count depends on how partially-covered plans are counted — see §5.6; do not assert an exact figure without footnoting the plan list).
2. **The only baseline is `redesign/baselines/bundle-pre-B1.json`, captured 2026-05-24 at `d2e6512`, before Band B.** Every delta it reports is cumulative across Band B *and* Band C, so it can never attribute a change to the plan under test. Confirmed empirically: an unmodified read-only run of the script against the current build reports `/admin/dashboard` delta_vs_pre_B1_kb = +23.73 kB — real drift, but blended across two bands, not attributable to any single plan.

### 5.3 The change

**a. Auto-discover routes instead of hardcoding them.** Walk `.next/server/app/**/page_client-reference-manifest.js`, deriving each route's `manifestRoute` from its directory path exactly as today (no change needed to `chunksForRoute()`'s entry-key construction — verified: the manifest's internal entry key is `[project]/src/app/${manifestRoute}/page` **including parentheses** for route groups, confirmed by grepping the raw manifest files for both `(public)/home` and `booking/manage`). Add a **new, separate, pure function** `manifestRouteToUrl(manifestRoute: string): string` that strips only literally-parenthesised path segments to build the display/report `url` field — e.g. `(public)/services` → `/services`, bare `(public)` → `/`. Dynamic segments (`[slug]`, `[clientId]`, etc.) pass through unchanged into both `manifestRoute` and `url` — no new logic needed there, this already matches the existing hardcoded entries' style.

Exclude the two Next-internal boundary manifests, `_global-error` and `_not-found`, from the discovered route set — they have no corresponding `page.tsx` and do not represent navigable URLs. (Correction: these come from Next's built-in `error.tsx`/`global-error.tsx` conventions and, for `_not-found`, Next's *default* 404 boundary — there is no `not-found.tsx` file anywhere in `src/app`, so do not describe `_not-found` as coming from a project-authored `not-found.tsx`.) After exclusion, the discovered route count must equal the on-disk `page.tsx` count — confirmed today as 46 manifests − 2 excluded = 44, matching `find src/app -name page.tsx | wc -l` → 44 exactly. Assert this equality at runtime (see §5.7's stop condition); do not hardcode "44" — recount `page.tsx` at build time since new pages may land before this item ships.

No parallel routes (`@folder`) or intercepted routes (`(.)folder`/`(..)folder`) exist anywhere under `src/app` today (confirmed: zero matches walking `src/app` for those patterns) — the auto-discovery logic does not need to handle them; do not add speculative generality for a shape that doesn't exist.

Walk `.next/server/app/**` (post-build output), not `src/app` (source) — this is a deliberate choice, not an oversight to "fix": walking source would require manually excluding non-page directories that have a `route.ts` handler but no `page.tsx` (`admin/email-templates/preview/[id]`, `admin/signout`) plus a same-named-but-unrelated legacy directory (`admin/email-templates`, distinct from the real `admin/emails/templates/[templateId]`). Walking the build output sidesteps all of that for free, since only real pages produce a `page_client-reference-manifest.js`.

**b. Add a CLI route filter.** The script currently has **no argv parsing at all** (`process.argv` is never read) — this is new functionality, not preserved behavior; do not describe it as "keeping" an existing filter. Design:
- Bare positional args are matched as exact-URL or path-prefix substrings against the *discovered* `url` (not the raw manifest path) — e.g. `node scripts/measure-admin-bundles.mjs /admin/bookings/new` or `.../measure-admin-bundles.mjs /admin/bookings` (prefix match, catches both the list and `/new`).
- No args → full discovered set (today's only behavior, preserved).
- A filter that matches zero routes → non-zero exit code + stderr message. Fail loud; never silently emit `"routes": []`.

**c. Re-baseline at a known SHA.** Write `redesign/baselines/bundle-post-band-c.json` recording the commit it was captured at, and have the script prefer it when present while keeping the `bundle-pre-B1.json` comparison available. **Do not delete or overwrite `bundle-pre-B1.json`** — it is the historical record for Band B.

The script's own `result` object (symbol `result`, currently at `scripts/measure-admin-bundles.mjs:144-159`) does **not** emit a `git_sha` field today — only `captured_at`, `next_version`, `measurement_method`, `shared_baseline`, `routes`, `baseline_used`. `bundle-pre-B1.json`'s `git_sha`/`branch`/`node_version`/`pnpm_version`/`sentry_nextjs` fields were added **by hand** after generation, not emitted by the script. Pick one explicitly rather than leaving it implicit:
- **Recommended:** extend the script to shell out to `git rev-parse --short HEAD` (and optionally `git branch --show-current`) and embed `git_sha`/`branch` in `result` directly, so every future capture is self-describing without a manual editing step.
- If that is skipped, the implementer must add `git_sha`/`captured_at`-adjacent metadata to `bundle-post-band-c.json` by hand, exactly as was done for `bundle-pre-B1.json`, and say so in the commit.

**d. Document the one-command workflow** (build, run, diff) at the top of the script's header comment, alongside the existing usage lines.

### 5.4 The build

This item needs **one `pnpm build`** to populate `.next/` before the final capture. That is expected and permitted **for this item only**. Everything else in this plan must not build.

**A production build that faithfully reflects the current `src/` tree already exists in the working tree**: `.next/BUILD_ID` and `.next/build-manifest.json` are dated 2026-08-09, tracing to commit `aca7c18`, and `git diff --quiet aca7c18 HEAD -- src/` exits 0 — `src/` is byte-identical to that build's source except the one standing exception, `src/lib/maintenance.ts` (a runtime flag, not expected to move bundle bytes). **Use this existing build to develop and dry-run the auto-discovery/filter/refactor logic without spending the one permitted build early.** Do exactly one confirming `pnpm build` at the end, immediately before capturing `bundle-post-band-c.json`, per §5.7's command sequence. Note as an expected outcome, not a surprise: if the build is fully deterministic and `maintenance.ts` is inert to bundling, the final build's byte counts may come out identical to what a run against the existing `.next/` would already show — that is not evidence of a broken build, it is the expected consequence of `src/` being unchanged.

### 5.5 Blast radius

**Files to edit:**
- `scripts/measure-admin-bundles.mjs` — add route auto-discovery, the `manifestRouteToUrl` function, the CLI filter, and (recommended) `git_sha` emission.
- `redesign/baselines/bundle-post-band-c.json` — **new file**, written by capturing the script's stdout once, per §5.7.
- `scripts/measure-admin-bundles.test.ts` — **new file**, see §5.8.

**Callers/consumers, confirmed by `grep -rn "measure-admin-bundles|bundle-pre-B1|bundle-post-band-c"` excluding `redesign/`:** none. No `package.json` `scripts` entry wraps this file, no reference in `next.config.ts`, no `.github/` workflow, no `.husky/` hook. The script is invoked only by hand today. This means the blast radius of changing it is contained entirely to the script file and the two baseline JSON files.

**Tests affected:** none exist for this script today (`scripts/**/*.test.*` currently contains only `measure-admin-contrast.test.ts` and `verify-admin-token-contrast.test.ts`, both item 7's contrast tooling) — no existing test can break from this change.

**Shared with public/customer site:** none as an editing concern. This item edits only `scripts/` and `redesign/baselines/` — nothing under `src/` changes as a result of this item. `/booking/manage`, checked by name: it is one of the routes the *auto-discovered* script will now measure (previously invisible to it), because it renders under the root layout with no route-group segment to strip and needs no special-casing beyond the generic "no parens → URL is the manifest path verbatim" rule. The auto-discovery logic must not assume "everything outside `admin/` is under `(public)/`" — it must strip parens only where they are literally present, wherever they occur, or `/booking/manage` would be mis-derived.

**Proven NOT affected (what was checked, and how):**
- No other script or config references this script or either baseline JSON — `grep -rn "measure-admin-bundles|bundle-pre-B1|bundle-post-band-c"` outside `redesign/`, zero hits beyond the script itself.
- `package.json` `scripts` block, read in full — no entry wraps this file.
- `.github/` and `.husky/` — `grep -rn "measure-admin-bundles"`, zero matches in both.
- `vitest.config.ts`'s `include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"]` already picks up any new `scripts/**/*.test.{ts,tsx}` file automatically — no config change needed for the new test file.
- No file under `src/` imports from `scripts/` — scripts in this repo are standalone Node CLIs, not imported by app code (same consumer grep as above, zero hits under `src/`).
- No parallel (`@folder`) or intercepted (`(.)folder`/`(..)folder`) routes exist under `src/app` — `find src/app -type d`, zero matches — so the auto-discovery logic needs no extra handling for them.

### 5.6 The outstanding bundle ceilings this item makes measurable, named precisely

- **C-23's `+6 kB` ceiling** (`C-23-admin-availability-calendar-plan.md:170`) applies to exactly one route: **`/admin/bookings/new`**. Confirmed not yet measured — `redesign/evidence/C-23/closeout-adversarial.md:148` states the bundle-ceiling check was banned for agents that session and not run by anyone.
- **C-20's `+3 kB` ceiling** (`C-20-address-autocomplete-plan.md:183,188`) covers **two distinct surfaces**:
  1. Admin: `ManualBookingForm.tsx`, wired only at `/admin/bookings/new` — the same route as C-23's ceiling.
  2. Customer: `AboutYouStep.tsx`, which is **not** behind any single dedicated route — it is reached through `BookingExperience`, mounted in `src/app/(public)/layout.tsx`, the shared layout for every `(public)` route. This ceiling is a property of the shared `(public)` bundle. **Any** `(public)` route is an equally valid sample for a before/after diff — `/services` and `/home` are not privileged targets, just convenient examples. Phrase this as "any two representative public routes," not as naming those two specifically.
- No plan cites plain `/admin/bookings` (the list page, no further path segment) by name in either C-20 or C-23 — grepped both for `admin/bookings[^/]`, zero matches. It is still useful that auto-discovery picks it up (nothing wrong with measuring more than the minimum), just not because of these two ceilings.
- Roughly nine to eleven earlier plans have a ceiling target the hardcoded six never covered (C-01, C-02, C-03, C-04a, C-05 partially, C-06, C-13, C-15, C-16, C-17 self-acknowledging the gap at its own line 118, C-18) — the exact count is sensitive to how partially-covered plans (e.g. C-05, which spans both an unmeasurable `/admin/bookings/*` ceiling and a measurable `/admin/clients/*` one) are counted. Do not assert a bare number; if a count is wanted, footnote the plan list above.

### 5.7 Verification — exact command sequence, what must move, what must not

```bash
# 1. Build (the ONE permitted build for this item)
pnpm build

# 2. Run the auto-discovering script, capture the new baseline
pnpm exec node scripts/measure-admin-bundles.mjs > redesign/baselines/bundle-post-band-c.json

# 3. Re-run immediately against the SAME .next/ output — must be identical except captured_at
#    (and git_sha, if the run spans a commit boundary, which it should not mid-capture)
pnpm exec node scripts/measure-admin-bundles.mjs > <scratchpad>/rerun.json
diff <(jq 'del(.captured_at)' redesign/baselines/bundle-post-band-c.json) \
     <(jq 'del(.captured_at)' <scratchpad>/rerun.json)
#    -> must be EMPTY

# 4. Confirm nothing unexpected moved in the tree
git status --porcelain
#    MUST show only: the new redesign/baselines/bundle-post-band-c.json (as "??" until staged),
#    plus the pre-existing standing-dirty paths already on the tree, plus " M src/lib/maintenance.ts".
#    MUST NOT show any change to redesign/baselines/bundle-pre-B1.json or anything under src/.
```

**What MUST move:**
- Every route in `bundle-post-band-c.json`'s `routes[]` gets a non-null `first_load_js_gzip_bytes` — no `error` field, no `missing_chunks`, for any of the 44 real routes.
- The discovered route count equals the on-disk `page.tsx` count at build time (44 today; re-verify, do not hardcode).
- `/admin/bookings/new`, `/admin/bookings`, every `(public)/*` route, and `/booking/manage` are present by name in the output.

**What MUST NOT move:**
- `redesign/baselines/bundle-pre-B1.json` — verify via `git status --porcelain -- redesign/baselines/bundle-pre-B1.json` → empty.
- `src/**` — verify via `git status --porcelain -- src/` → only the pre-existing ` M src/lib/maintenance.ts` line.
- Anything outside `scripts/measure-admin-bundles.mjs`, `scripts/measure-admin-bundles.test.ts`, and the two baseline JSON files.

**Sanity anchor** (uncompressed, whole-build magnitude check only — not comparable to the script's per-route gzip figures): the `aca7c18` build had 102 client JS chunk files totaling 4,800,796 bytes (4.58 MiB), and 326,313 bytes (318.7 KiB) of CSS.

If a discovered route's manifest is malformed or has zero `entryJSFiles` (e.g. a pure server component page), `chunksForRoute()` already returns `null` and the route is reported with only an `{ url, error }` shape (existing behavior, unchanged by this item). Auto-discovery may surface more such edge routes than the six hand-picked ones ever hit. **Treat any `error`-shaped route as a discovered route for count purposes** (it still corresponds to a real `page.tsx`), but it fails the "every route gets a non-null `first_load_js_gzip_bytes`" check above — surface it as a named failure in the capture, not a silently-passing count.

### 5.8 Tests to add

New file: `scripts/measure-admin-bundles.test.ts` (mirrors the existing `scripts/measure-admin-contrast.test.ts` pattern; auto-picked-up by `vitest.config.ts`'s `scripts/**/*.test.{ts,tsx}` include — no config change needed).

Requires first extracting the URL-mapping step into a small, pure, exported function — `export function manifestRouteToUrl(manifestRoute: string): string` — rather than leaving it inlined, so it is testable without a real `.next/` build.

1. `it("strips a leading route-group segment", ...)` — asserts `manifestRouteToUrl("(public)/services") === "/services"` and `manifestRouteToUrl("(public)") === "/"`.
2. `it("preserves dynamic segments verbatim", ...)` — asserts `manifestRouteToUrl("admin/clients/[clientId]") === "/admin/clients/[clientId]"`.
3. `it("passes through routes with no route group unchanged", ...)` — asserts `manifestRouteToUrl("booking/manage") === "/booking/manage"` (regression guard for the `/booking/manage` trap named in §5.5).
4. `it("excludes Next-internal boundary manifests from route discovery", ...)` — given a fixture list of manifest paths including `_global-error` and `_not-found`, asserts neither appears in the discovered route set.
5. `it("discovers exactly as many routes as there are page.tsx files on disk", ...)` — integration-style; run only when `.next/` exists in the working tree (skip/guard otherwise, since CI/other sessions may not have a build present); asserts `discoverRoutes().length === <count of page.tsx files under src/app>`, computed at test time, not hardcoded to 44.

### 5.9 Ordering relative to the other items

No other item's file list touches `scripts/measure-admin-bundles.mjs` or either baseline JSON — confirmed by grepping every other item's stated file list for `measure-admin-bundles` and `baselines/`, zero hits. No direct file conflict with any other item.

**Sequencing matters even without a file conflict.** The `.next/` build in the tree right now is at `aca7c18` — Band C complete, none of this follow-up plan's items applied. That is exactly the boundary `bundle-post-band-c.json` should capture. **Run item 5 first**, before items 1, 3, 6, 7, or 8 land (all of which touch `src/`; item 2 is copy-only and item 4 is a migration with no client code, so neither would move bundle bytes). If item 5 runs after other items have already changed `src/`, the resulting "baseline" would blend "post Band C" with "partway through this follow-up plan" — the exact defect this item exists to fix in `bundle-pre-B1.json`.

Items 7 (site-wide CSS cascade-layer/contrast fix) and 8 (travel-charge model — new settings UI, mileage-origin field, series-level controls) will both change bundle bytes once they land, and neither currently carries a stated bundle ceiling of its own. Once item 5's tooling exists, it is the correct tool to set ceilings for items 7/8 — and when those items land, `bundle-post-band-c.json` should be superseded by a new, separately-dated file (never overwritten — the same "never delete a historical baseline" rule this item applies to `bundle-pre-B1.json`).

### 5.10 Stop conditions

1. `pnpm build` (§5.7 step 1) fails, or exits with errors not already accounted for in the standing baselines (handoff: `npx tsc --noEmit` → 0; the build was clean at `aca7c18`). Halt — do not fix forward inside item 5's scope; a build failure here means something upstream broke, which is not this item's job to diagnose.
2. Step 3's self-diff (rerun against the identical `.next/` output) is non-empty. Halt — the script is non-deterministic (e.g. `Set` iteration order, or a timestamp leaking into a field other than `captured_at`); do not ship a baseline captured by a non-deterministic tool.
3. The discovered route count does not equal the on-disk `page.tsx` count. Halt and diagnose — either a real page is being silently skipped (reintroducing the exact failure mode this item exists to fix) or a non-page manifest is being miscounted as a page.
4. `git status --porcelain -- redesign/baselines/bundle-pre-B1.json` shows any change. Halt immediately — this file must never be modified.
5. Any change appears under `src/` after this item's work. Halt — item 5 has no reason to touch `src/`; if a diff appears there, revert it before proceeding rather than folding it into this item's commit.

### 5.11 Rollback

Nothing in this item is irreversible.
- `.next/` is gitignored build output — regenerating or deleting it has no git-visible effect and touches no tracked data.
- `scripts/measure-admin-bundles.mjs`'s edits are an ordinary tracked-file change, revertible like any other.
- `redesign/baselines/bundle-post-band-c.json` is net-new — if its shape or numbers are wrong, delete it and re-run §5.7 step 2; there is no migration, data mutation, or Zone-2 action anywhere in this item to undo.
- `redesign/baselines/bundle-pre-B1.json` is never touched by this item (enforced by stop condition 4), so there is nothing to roll back there by construction.

No Zone-2 action of any kind is required for this item — no migration, data write, deploy, package install, or real email. The single `pnpm build` is the only ordinarily-restricted action this item performs, and it is pre-authorized for this item alone.

---

## ITEM 6 — Adjustment lists must count and cap by DATE, not by segment row

*(Added 2026-08-10 at the Owner's confirmation — this replaces the mistaken "Maps cookie label" line in their list. In scope, Option A, per the Owner decision log. §11 records the resolution.)*

### 6.1 The problem

Before C-14, a unique constraint guaranteed **one row per override date**, so "rows" and "dates" were the same number and every cap, count and badge could use rows interchangeably. **C-14 Phase C dropped those uniques.** A date with a break is now 2+ rows. Every row-based number on these surfaces silently became wrong:

- `AVAILABILITY_PAST_CAP = 25` now means "25 **segment rows**", so "25 past adjustments" can be as few as ~8 actual dates.
- The `count: "exact", head: true` totals count rows, so the "view all N" figure overstates how many dates exist.
- `.limit()` is row-based, so a cap boundary can fall **mid-date** and render a date with only some of its hours.

Both override tables hold **0 rows** today (re-confirmed live this pass, along with `blocked_dates`/`staff_blocked_dates`, all four at 0). This is a latent correctness bug, not a live one — there is nothing to observe in production, and verification must say so rather than claim a live check.

### 6.2 What is already correct — do not re-fix it

- The week-capacity chip on `/admin/availability` was fixed in `0bc2a02` (`weekAdjustments={weekAdjustmentsByDate.size}` at `page.tsx:488`, re-verified live). **Leave it.**
- `resolveAvailabilityBannerState` (`availability-data.ts:63-79`) and `resolveStaffAvailabilityBannerState` (`lib.ts`, same shape) are **pure and unit-agnostic** — they take `pastTotal` / `pastShown` / `viewAll` and only compare numbers; they never inspect what the numbers count. Feed them date counts and they behave correctly **with no change to the functions themselves**. Do not touch their logic; in particular do not reorder the `cappedOut`-before-`hidden` check (re-verified in place: `cappedOut` at line 69, `hidden` at line 72), which is deliberate and has already regressed twice historically (privacy's notes rail, then password-requests — both guarded today by the existing `"SABOTAGE TARGET"` test).
- Both managers already compute `groupByDate(...)` into `upcomingDays` / `pastDays` (`AvailabilityOverridesManager.tsx:146-147`, `StaffAvailabilityOverridesManager.tsx:149-150`, both via `useMemo`). **The date-grouped structure exists** — it is simply not the thing being counted: the badge/`pastShown`/"N of M" text at every cited site below still reads `past.length` / `upcoming.length` (row counts), never `pastDays.length` / `upcomingDays.length`.
- **`BlockedDatesManager.tsx` and `StaffBlockedDatesManager.tsx` import the same shared constants and resolvers** — `AVAILABILITY_PAST_CAP`, `AVAILABILITY_PAST_VIEW_ALL_CAP`, `resolveAvailabilityBannerState` (`BlockedDatesManager.tsx:19-21`, used at `:91,392,398,416`) and the `STAFF_*` equivalents (`StaffBlockedDatesManager.tsx`, same shape). **`blocked_dates` / `staff_blocked_dates` were not touched by the C-14 migration that dropped the override tables' unique constraints** and remain one row per date (confirmed: no `groupByDate`/segments concept anywhere in either blocked-dates manager). For blocked dates, rows and dates are and stay identical, so:
  - The `.limit()` calls feeding `BlockedDatesManager`/`StaffBlockedDatesManager` are **already correct**. Option A does not touch them.
  - The two resolver functions are unchanged (this section doesn't touch their logic at all), so the blocked-dates managers calling them with already-correct row(=date) counts continue to behave identically.
  - **Do not edit `BlockedDatesManager.tsx` or `StaffBlockedDatesManager.tsx` as part of this item.** The only realistic way this item leaks into them is an implementer "helpfully" updating the blocked-dates call sites to match the *comment* change on `AVAILABILITY_PAST_CAP`/`AVAILABILITY_PAST_VIEW_ALL_CAP` (see 6.4) — the comment change applies to the overrides consumers only; the shared constants keep the same values and the same meaning for the blocked-dates consumers.

### 6.3 Two options — recommendation first

**➤ OPTION A (RECOMMENDED, Owner-selected) — group in code under a defensive row ceiling, with saturation disclosure. No migration, no Zone-2.**

Fetch override rows under a defensive **row** ceiling, group them by date in the page, slice to N **dates**, and pass the flattened rows plus honest date totals to the manager.

Why this is the right call here, rather than a bigger fix:

1. **Proportionate to the real data.** `availability-data.ts`'s own header projects **~25–100 overrides over 5 years**. Even at 3 segments each that is a few hundred rows. This is not `bookings`.
2. **It is the idiom this very file already established.** The header defines the upcoming bucket as *"a defensive ceiling, not a truly unbounded read"*, citing the `SCOPED_BRANCH_ROW_CAP` (`bookings-list-data.ts:660`, value `200`) / `PRIVACY_NOTES_VIEW_ALL_CAP` (`privacy-data.ts:63`, value `500`) precedent — both re-verified live, exact names and values. **One caveat carried forward, not previously stated:** `SCOPED_BRANCH_ROW_CAP` is a pure defensive ceiling with **no** saturation-disclosure UI — it silently truncates with no "N+" indicator anywhere in the codebase. It is a valid precedent for the row-fetch-ceiling half of this design (6.4), but **there is no existing precedent anywhere in this codebase for the lower-bound disclosure UI** this item also requires (6.5). Treat 6.5 as new ground, not an application of an existing pattern.
3. **It matches how the codebase already resolved the identical trade-off.** C-16 accepted a capped-not-paginated `getClientCandidates` precisely because the exact fix required Zone-2. Same reasoning, same conclusion.
4. **It cannot silently lie** — see 6.5.

**OPTION B (escalation, not being built) — a grouped view per table.**

```sql
CREATE VIEW public.availability_override_dates
  WITH (security_invoker = true) AS
  SELECT override_date, count(*) AS segment_count
  FROM public.availability_overrides GROUP BY override_date;
```
…and a `(staff_id, override_date)` equivalent, each with `GRANT SELECT … TO service_role`. PostgREST would then `.limit()` and `count: "exact", head: true` over **dates** natively, exactly, forever. `security_invoker = true` is not optional — it matches the deliberate `SECURITY INVOKER` choice made for the C-14 RPCs.

**Costs:** a Zone-2 migration, two new database objects, and a second query per bucket. **PostgREST aggregates are confirmed disabled on this project** — re-verified live this pass via a direct REST probe (`select=override_date.count()` against `availability_overrides`, anon key, a public client-facing credential, read-only GET): `HTTP 400 PGRST123 "Use of aggregate functions is not allowed"`. A follow-up probe without the aggregate returned a *different* error (`401`/`42501`, a permissions error), which fired only because the request first passed PostgREST's validation layer — proving the `PGRST123` block is a project-wide config setting, not a permissions artifact that would clear once grants are fixed. This is why a view is the mechanism, and why Option B cannot be simplified further.

**Option A is the item being built.** Option B is documented for completeness only; do not build it without a separate, explicit Owner request.

### 6.4 Option A — exact changes

**Anchors below are re-verified against the live tree this pass (byte-identical to `33f895f`) — RE-LOCATE BY SYMBOL and report drift rather than trusting these numbers if the file has moved since.**

**Constants** — `src/app/admin/availability/availability-data.ts` (`AVAILABILITY_PAST_CAP` at line 44, `AVAILABILITY_PAST_VIEW_ALL_CAP` at line 45, `AVAILABILITY_UPCOMING_DEFENSIVE_CAP` at line 47) and, duplicated, `src/app/admin/staff/[staffId]/availability/lib.ts` (`STAFF_AVAILABILITY_PAST_CAP`, `STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP`, `STAFF_AVAILABILITY_UPCOMING_DEFENSIVE_CAP`, same shape):

- Keep `*_PAST_CAP = 25` and `*_PAST_VIEW_ALL_CAP = 200` at the same values, but **their unit changes from rows to dates**. Update the surrounding comments to say so explicitly for the overrides consumers — a constant whose meaning silently changed is exactly the trap this fix exists to remove. Do **not** word the comment in a way that reads as applying to `BlockedDatesManager.tsx`/`StaffBlockedDatesManager.tsx` too (6.2) — those consumers are unaffected and must stay untouched.
- Add a row-fetch ceiling, e.g. `AVAILABILITY_PAST_ROW_FETCH_CEILING = 800`, with its reasoning in a comment: it must comfortably cover `PAST_VIEW_ALL_CAP` (200 dates) × a realistic worst-case segments-per-date (~4).
- Add a new, exported, pure helper — **do not confuse this with either of the two `groupByDate` functions that already exist** (see the "three groupByDate-shaped things" note below). Suggested signature:
  ```ts
  function groupAndCapPastByDate(
    rows: AvailabilityOverride[],
    opts: { dateCap: number; rowTotal: number }
  ): { flattenedRows: AvailabilityOverride[]; dateTotal: DateTotal };

  type DateTotal = { kind: "exact"; value: number } | { kind: "atLeast"; value: number };
  ```
  It groups the fetched rows by `override_date`, slices to the first `dateCap` distinct dates, flattens back to rows (not `OverrideDay[]` — see below), and computes `dateTotal` per 6.5. `page.tsx` calls it once per bucket, after the row-ceiling fetch, passing `rows.length` and the existing exact `count` as `rowTotal`.
- **This is a third, distinct implementation from what already exists**, and the plan must say so or two implementers can produce incompatible shapes:
  1. The manager's own private `groupByDate` (`AvailabilityOverridesManager.tsx:75-100`, `StaffAvailabilityOverridesManager.tsx:66-91`) — unexported, builds `OverrideDay[]` purely for render grouping of whatever rows it was handed. **Leave this alone**; the manager keeps calling it exactly as today, on whatever `flattenedRows` the page now hands it.
  2. The page's existing `groupOverridesByDate` (week-chip only, feeds the `CapacityPreview` grid) — wrong job, no slicing/capping/saturation logic. **Leave this alone.**
  3. This new helper — page-level, decides *which rows* the manager receives (date-capped, not row-capped) and computes the honest date total / saturation flag. It must **not** try to reuse either of the above.
  Its output (`flattenedRows`) is what gets passed as the `past`/`upcoming` prop to the Manager — **do not** change the Manager's prop contract to accept `OverrideDay[]` directly; that would touch every call site in `AvailabilityOverridesManager.test.tsx` for no benefit, since the manager already groups internally.

**⚠️ Duplicate, do not share.** `availability-data.ts`'s header (lines 1-42) states the shape is *"duplicated (not shared)"* in the staff tree (line 38), and `lib.ts`'s header says the same in the other direction. **Do not introduce a shared module** for the new helper either — write it twice, once per tree, consistent with the codebase's existing, explicit choice.

**Queries** — `src/app/admin/availability/page.tsx` and `src/app/admin/staff/[staffId]/availability/page.tsx` (re-verified live, exact lines given, re-locate by symbol):

- Past bucket (admin `:287-292`, staff `:163-169`): replace `.limit(pastViewAll ? PAST_VIEW_ALL_CAP : PAST_CAP)` with `.limit(PAST_ROW_FETCH_CEILING)`, then call the new helper to group and slice to the date cap.
- Keep the existing `count: "exact", head: true` row-count queries for the past bucket (admin `:293-296`, staff `:170-174`). **Their role changes**: no longer the displayed total, they are the **saturation detector** (6.5).
- **Upcoming bucket also needs the helper, not just a relabeled display.** The upcoming query (admin `:275-280`, staff `:149-155`) already fetches under `AVAILABILITY_UPCOMING_DEFENSIVE_CAP = 500` rows, and there is already a matching exact-count query (admin `:283-286`, staff `:156-162`, both marked "Fix round (verify-FAIL Check 2, non-blocking)"). At current volume this bucket cannot saturate — but the same row/date unit mismatch exists here as in the past bucket: `upcomingTotal` must become a date count derived from the same grouping, and the badge condition at `AvailabilityOverridesManager.tsx:261-264` (`upcomingTotal > upcoming.length`) must compare **like units** once `upcoming.length` becomes `upcomingDays.length` — comparing a date-count total against a row-length would silently be wrong the moment it could disagree. Run the upcoming bucket's fetched rows through the same `groupAndCapPastByDate`-shaped helper (or an equivalent unconditional grouping call with no cap applied, since upcoming has no view-all step) so `upcomingTotal` and `upcomingDays.length` are both dates, and treat its saturation flag identically to the past bucket's, even though it is not expected to ever be reached. Do not special-case "upcoming can't saturate" into skipping the check — that was the exact assumption already disproven by "0 rows in production is what masked the row/date bug" (6.1 header).
- Ordering: both trees currently order the four override queries by `override_date` only (verified live, no secondary key anywhere). See 6.7 for the corrected relationship to item 3 — item 3's secondary sort is **not** a correctness prerequisite for this item, contrary to what an earlier draft of this section (and of item 3's own §3.4) implied.

**Managers** — `AvailabilityOverridesManager.tsx` and `StaffAvailabilityOverridesManager.tsx` (identical shape; sites re-verified live at `33f895f`, re-locate by symbol):

| Site | Now | Becomes |
|---|---|---|
| `AvailabilityOverridesManager.tsx:155` | `pastShown: past.length` | `pastShown: pastDays.length` |
| `AvailabilityOverridesManager.tsx:261-264` | `upcoming.length` / `upcomingTotal` in the badge | `upcomingDays.length` vs date-based `upcomingTotal` |
| `AvailabilityOverridesManager.tsx:264` | `` `· ${pastTotal} past` `` | same template, `pastTotal` now a date count |
| `AvailabilityOverridesManager.tsx:421` | `` `${past.length} of ${pastTotal}` `` | `` `${pastDays.length} of ${pastTotal}` `` |
| `AvailabilityOverridesManager.tsx:418` | `past.length > 0` (gates whether the `<details>` disclosure renders at all) | `pastDays.length > 0` — **add this row; a prior draft of this table omitted it while listing the staff-tree sibling below.** Truth-equivalent today (0 rows ⇔ 0 dates) but leaving one gate row-based and its sibling date-based is an inconsistency an implementer would otherwise reproduce verbatim. |
| `StaffAvailabilityOverridesManager.tsx:158` | `pastShown: past.length` | `pastShown: pastDays.length` |
| `StaffAvailabilityOverridesManager.tsx:272-275` | `upcoming.length` / `upcomingTotal` | `upcomingDays.length` vs date-based `upcomingTotal` |
| `StaffAvailabilityOverridesManager.tsx:275` | `` `· ${pastTotal} past` `` | same, date count |
| `StaffAvailabilityOverridesManager.tsx:458` | `` `${past.length} of ${pastTotal}` `` | `` `${pastDays.length} of ${pastTotal}` `` |
| `StaffAvailabilityOverridesManager.tsx:455` | `past.length > 0` | `pastDays.length > 0` |

`pastTotal` and `upcomingTotal` must arrive from the page already expressed in **dates** (per the `DateTotal` shape in 6.5, or the number extracted from it).

### 6.5 The saturation disclosure — exact plumbing

A previous attempt at this fix was **correctly halted** because shipping the totals half alone could make the "view all N" link **silently fail to appear** when older dates genuinely exist beyond the cap — trading a visible overcount for an invisible undercount. Option A must prevent this structurally, not just claim to:

- The date total is derived from rows actually fetched, so it is exact **whenever the fetch was complete**.
- Completeness is not assumed — it is **measured**: the existing exact row-count query gives the true row total; if `rowTotal > rowsFetched`, the fetch was truncated and the date total is a **lower bound**, not an exact figure.
- In that case the UI must render it as a lower bound (e.g. `200+`) and never as an exact figure. **A silent truncation here is a plan failure, not an acceptable simplification.**
- At the projected volume the saturated branch is unreachable on both the past and upcoming buckets — but it must still be implemented and unit-tested on both, because "unreachable" is exactly what was said about one-row-per-date before C-14.

**No existing precedent for a "lower bound" render exists anywhere in this codebase.** The one candidate — privacy's `cappedOut` banner (`src/app/admin/privacy/page.tsx`) — renders `{PRIVACY_NOTES_VIEW_ALL_CAP} of {notesTotal}` as an **exact** number, because its `notesTotal` comes from a true `count: "exact", head: true` query with no row-ceiling truncation risk. This item's case is different in kind: the row total is exact, but the **date total derived from a possibly-truncated row fetch** is not. Build this new, do not look for something to copy.

**Concrete spec:**

1. **Computed in:** the new helper (6.4), fed the row-ceiling-limited fetch result plus the exact `rowTotal`. Return type is the discriminated `DateTotal` shown in 6.4 — not a bare `number` — because when `saturated` is true, `days.length` (dates found *among the rows that were fetched*) is itself only a lower bound: there could be more distinct dates among the un-fetched rows.
2. **Carried in:** a prop change on both Manager components. Given `AvailabilityOverridesManager.test.tsx` already passes `pastTotal: 0` as a bare number at six existing call sites, prefer the **lower-diff option**: keep `pastTotal: number` and add a sibling `pastTotalIsLowerBound: boolean` (same for `upcomingTotal`/`upcomingTotalIsLowerBound` per 6.4's upcoming-bucket requirement), rather than replacing the prop with a `DateTotal` union. This is a genuine design choice with no forcing precedent — if an implementer strongly prefers the union type instead, that is fine, but do not improvise a third shape; pick one before touching the prop types (see Stop Conditions, 6.9).
3. **Rendered in:** `resolveAvailabilityBannerState`/`resolveStaffAvailabilityBannerState` must **not** learn about saturation — the lower-bound rendering is a **display-only** concern layered on top of the existing `cappedOut`/`hidden`/`viewingAll` banner text, inside the Manager's JSX wherever it currently interpolates `{bannerState.total}`. Render `` `${bannerState.total}+` `` instead of `` `${bannerState.total}` `` when the corresponding `*IsLowerBound` flag is true. This keeps the pure resolvers untouched.
4. **Logged:** there is no existing read-path logging sink in either `page.tsx`, and this codebase's audit-log usage is for admin *mutations*, not read-path anomalies. Default to a `console.warn` in the server component when `saturated` is true (cheap, visible in server logs, matches the "unreachable at current volume" framing) rather than adding a new logging sink or table. Do not spend effort building alerting for a branch that is unreachable at today's volume; the unit test in 6.6 is the permanent guard.

### 6.6 Blast radius

**Files to edit:**
- `src/app/admin/availability/availability-data.ts` (new constant, new helper, comment update)
- `src/app/admin/staff/[staffId]/availability/lib.ts` (same, duplicated)
- `src/app/admin/availability/page.tsx` (call the new helper for both the upcoming and past overrides buckets; leave the `blocked_dates` queries and week-window query untouched)
- `src/app/admin/staff/[staffId]/availability/page.tsx` (same)
- `src/app/admin/availability/AvailabilityOverridesManager.tsx` (6 sites: the 5 tabled in a prior draft plus `:418`, per 6.4)
- `src/app/admin/staff/[staffId]/availability/StaffAvailabilityOverridesManager.tsx` (5 sites, all previously tabled)

**Callers/consumers of every changed symbol** (checked via `Grep` for each exported symbol across `src/`):
- `AVAILABILITY_PAST_CAP`, `AVAILABILITY_PAST_VIEW_ALL_CAP`, `resolveAvailabilityBannerState` are imported by **three** files, not two: `admin/availability/page.tsx` (edited above), `AvailabilityOverridesManager.tsx` (edited above), and **`BlockedDatesManager.tsx`** (`:19-21,91,392,398,416`, re-verified live) — **not edited, per 6.2**.
- `STAFF_AVAILABILITY_PAST_CAP`, `STAFF_AVAILABILITY_PAST_VIEW_ALL_CAP`, `resolveStaffAvailabilityBannerState` are likewise imported by `staff/[staffId]/availability/page.tsx`, `StaffAvailabilityOverridesManager.tsx`, and **`StaffBlockedDatesManager.tsx`** — **not edited, per 6.2**.

**Proven NOT affected** (checked, found clean, command given):
- `src/app/booking/manage/` (the known trap for this plan) — `Grep` for `availability|AvailabilityOverrides|groupByDate|resolveAvailabilityBannerState|AVAILABILITY_PAST` (case-insensitive) across `actions.ts`, `ManageBookingForms.tsx`, `page.tsx` → **zero matches**. This route has no dependency on any item-6 symbol.
- `src/app/(public)/`, `src/features/`, `src/components/` — `grep -rln` for `AvailabilityOverridesManager|StaffAvailabilityOverridesManager|availability-data|resolveAvailabilityBannerState|resolveStaffAvailabilityBannerState` → **zero matches**. Nothing customer-facing consumes any item-6 symbol.
- `src/app/admin/calendar/page.tsx` — has an unrelated, same-named **local** `groupByDate(bookings: ReportBooking[])` at line 2093, unexported, different signature, no import relationship to either availability tree. A homonym, not a collision.
- `src/app/admin/availability/actions.ts` and `src/app/admin/staff/[staffId]/availability/actions.ts` (save/delete override mutations) — `grep -n "override_date\|\.limit(\|\.order("` shows only `.eq("override_date", date)` whole-date deletes; no ordering or capping logic present. Unaffected.
- `src/app/admin/availability/__tests__/actions.test.ts` and the staff-tree equivalent — test cache-tag invalidation on mutation only, no dependency on cap/count logic. Unaffected.
- `AvailabilityOverridesManager.test.tsx`'s six existing tests all pass `pastTotal: 0` and never assert a numeric relationship between `past.length` and `pastTotal` that only holds under row-counting — they should pass unmodified as a regression check, not require rewriting.

**Snapshots affected:** none. No `.snap` files exist anywhere in the repository (repo-wide fact, not scoped to this item); neither of the two component test files in these trees uses `toMatchSnapshot`.

**Shared with the public/customer site:** none — see "Proven NOT affected" above, `/booking/manage` included by name as required.

### 6.7 Relationship to item 3 — corrected

**A prior draft of this section stated that item 3's secondary sort is a correctness prerequisite for item 6 (that grouping is "only deterministic once segments of a date are contiguous and in time order"). That is wrong, and item 3's own §3.4 already says as much in different words ("does not stop a `.limit()` boundary falling mid-date... needs a view or RPC" — i.e. item 3 was never claimed to fix the capping problem even before item 6 existed). Correcting it here:**

- SQL's `ORDER BY` on a single column (`override_date` alone, which is what all four queries use today, re-verified live) mathematically guarantees that all rows sharing an `override_date` value are **contiguous** in the result set — a secondary sort key cannot affect this; it only orders rows *within* an already-contiguous same-date block. Contiguity was never at risk, with or without item 3.
- The manager's own `groupByDate` (both `.tsx` files) is `Map`-keyed on `override_date` (`byDate.get`/`byDate.set`, re-verified line by line in `AvailabilityOverridesManager.tsx:75-100`) — it merges same-date rows correctly by hash lookup regardless of their position in the array, and it separately re-sorts `day.segments` by `start_time` at the end (`:95-97`) before returning. It has never needed ordering from the database to group or display correctly.
- The row-fetch-ceiling truncation detector this item introduces (`rowTotal > rowsFetched`, an exact-count comparison) is likewise completely order-independent.
- **Net effect: item 3 provides no correctness benefit to item 6.** Neither the grouping, nor the truncation detection, nor the manager's own rendering depends on the database returning a deterministic secondary order. What item 3 actually buys — a deterministic `start_time` order for same-date rows *as returned by Postgres* — is redundant with the manager's own client-side segment sort, which already runs regardless.
- This item does **not** depend on item 3 shipping first. If the top-level plan table still sequences item 3 before item 6, that sequencing is harmless (item 3 is cheap and orthogonal) but should not be described as a hard dependency in item 3's or item 6's text, and an implementer should not block item 6 waiting on item 3 for correctness reasons. Item 3's own §3.4 caveat ("does not stop a `.limit()` boundary falling mid-date") is resolved by item 6 regardless of whether item 3 has landed, since item 6 replaces row-based `.limit()` with date-based slicing entirely on its own.

### 6.8 Ordering and prerequisites vs. other items

- **Item 3:** not a correctness prerequisite (6.7, corrected). Sequence-neutral; doing it first or not at all before item 6 makes no difference to item 6's correctness.
- **Item 4:** its own header states it is "the only Zone-2 item, unless item 6 takes Option B." Option A (this section) introduces no migration, so item 4's Zone-2 status is unaffected. No ordering interaction.
- **Item 7 (admin theming):** genuine file collision. Item 7 must recolor `oklch()` literals in the same six files item 3 and this item edit: `AvailabilityOverridesManager.tsx`, `StaffAvailabilityOverridesManager.tsx`, `availability-data.ts`, `lib.ts`, `admin/availability/page.tsx`, `staff/[staffId]/availability/page.tsx`. **Sequence items 3 and 6 fully before item 7 touches those six files** — re-grep for `oklch(` on all six immediately before item 7 starts them, do not trust a stale count. The oklch literal count for these six files is **23 by unique source line** (the plan's stated figure) but **26 by raw occurrence** (two lines carry two literals each). State explicitly which counting method any item-7 ratchet guard uses, and seed its baseline from that method's actual output on the post-item-6 tree, not from either number quoted here — item 6's edits to these files (new helper calls, prop renames) will not add or remove `oklch()` literals themselves, but the guard must be re-run after item 6 lands, not assumed unchanged.
- **`BlockedDatesManager.tsx` / `StaffBlockedDatesManager.tsx`:** deliberately excluded from this item (6.2, 6.6). If item 7 recolors these files too (they are not among the six above, but do carry their own literals as admin-tree files), that is independent of this item and carries no interaction.

### 6.9 Verification

**Type check and full suite — must move / must NOT move:**
```bash
npx tsc --noEmit
# must stay 0, silent, exit 0 (current baseline)

npx vitest run src/app/admin/availability/__tests__/availability-data.test.ts
npx vitest run src/app/admin/staff/[staffId]/availability/__tests__/lib.test.ts
npx vitest run src/app/admin/availability/AvailabilityOverridesManager.test.tsx
# regression check only for the third — no new assertions required there

npx vitest run
# full suite MUST stay at the documented baseline identity: 5 failed / 2236 passed (2241),
# the SAME five named failures (admin-access.test.ts x2, ManualBookingForm.test.tsx x3).
# A different count, or the same count with a different test swapped in, is a FAIL.

pnpm lint
# must stay at 59 errors / 7 warnings in exactly the six files already named in the
# session baseline. This item touches none of those six files, so this should be
# unaffected — confirm with an actual run, do not assume.
```
**Must move:** the two `__tests__/*.test.ts` files' `it(...)` counts increase by the number of new tests added (6.10). Record the exact before/after count when implementing.
**Must NOT move:** `npx tsc --noEmit` stays at 0; the full-suite totals stay at exactly 5 failed / 2236 passed / 2241 total with the same five named failures; `pnpm lint`'s 59/7 in the same six files.

**No live E2E check is possible.** Both override tables hold 0 rows (re-confirmed live this pass), so there is nothing to observe in production. State this in the verification writeup rather than claiming a live check, and do not fabricate rows to exercise it — that would be a Zone-2 write this item is not scoped to make.

### 6.10 Tests to add

All six are pure-function tests (no React, no DB), added as new `it(...)` blocks inside the existing `describe(...)` for each file — do not create new test files for these:

| Test name (as it would read in `it(...)`) | File |
|---|---|
| `groups three same-date segment rows into one date` | `src/app/admin/availability/__tests__/availability-data.test.ts` |
| `groups three same-date segment rows into one date` | `src/app/admin/staff/[staffId]/availability/__tests__/lib.test.ts` |
| `slices to exactly PAST_CAP dates when more exist` | both files above |
| `slices to PAST_VIEW_ALL_CAP dates when viewAll is true` | both files above |
| `flags saturation and returns a lower-bound total when the row ceiling truncates mid-fetch` | both files above — the one genuinely new, unprecedented case (6.5) |
| `never splits one date's segments across the N-th/N+1-th date boundary` | both files above |

The existing `"SABOTAGE TARGET — is 'cappedOut', not 'hidden'..."` test (`availability-data.test.ts:37-52`, `lib.test.ts` equivalent) already covers the `cappedOut`-beyond-view-all-cap branch and needs no new test, provided the new helper's date-count output is what gets fed into the unchanged banner resolver — only the helper's own `dateTotal` output needs its own correctness test (covered by the rows above).

**Optional, not required by this item:** `lib.test.ts` (staff) has 4 `it(...)` blocks; `availability-data.test.ts` (admin) has a 5th, `"cappedOut takes priority even when hidden's condition also holds"` (`:54-64`), proving branch order independently of the sabotage test. The staff file has no equivalent — a pre-existing asymmetry, not introduced by this item. Mirroring it costs one test and closes a real gap, but is optional here since it is not part of this item's scope.

**Not required:** a new `StaffAvailabilityOverridesManager.test.tsx` file. None exists today; creating one would be scope creep onto a pre-existing, unrelated gap this item did not create.

### 6.11 Stop conditions

Halt and ask the Owner rather than proceed, if:

1. The saturation-disclosure prop shape (sibling boolean, recommended in 6.5, vs. a `DateTotal` union prop) has not been settled before editing the Manager components' prop types — this is a breaking prop-shape change either way and should not be improvised mid-implementation. Default to the sibling-boolean recommendation in 6.5 unless there is a concrete reason to prefer the union.
2. Any edit to `availability-data.ts` or `lib.ts` turns out to require touching `BlockedDatesManager.tsx` or `StaffBlockedDatesManager.tsx` — per 6.2/6.6, it should not. If it does, the shared-constant assumption in this section was wrong and the Owner needs to know before proceeding.
3. `pnpm lint`'s baseline (59 errors / 7 warnings, in the six files already identified elsewhere in this plan) changes at all after this item's edits — none of those six files are edited by this item, so any change means something leaked.
4. Item 7 begins touching any of the six shared files (6.8) before items 3 and 6 are both fully shipped and re-grepped for `oklch(`.
5. The upcoming bucket's row-fetch ceiling (500, unchanged) is ever found to be insufficient at real production volume — this item assumes it stays defensive-only and unreachable-saturated; if real data approaches it, that is a signal the assumption in 6.1's projected volume (~25-100 overrides over 5 years) no longer holds and the caps need Owner re-evaluation, not a silent bump.

### 6.12 Rollback

Option A introduces no migration and no data mutation — every change is to pure TypeScript (constants, a new helper function, prop plumbing) and JSX text. Rollback is `git revert` of the implementing commit(s); there is no irreversible step, no Zone-2 action, and no schema change to unwind anywhere in this item.

(Option B, if the Owner later chooses it instead of Option A, would introduce a Zone-2 migration — `CREATE VIEW ... WITH (security_invoker = true)`, whose rollback would be a matching `DROP VIEW`, orchestrator-performed only, never by an implementing agent. Option B is not being built by this item; this note exists only so a future switch to it isn't planned as if it were as reversible as Option A.)

---

## ITEM 7 — Admin theming: colour, contrast and readability, fixed at the root

*(Added 2026-08-10 at the Owner's request. **Admin backend only** — the public customer site is explicitly out of scope for Workstream 2, but Phase 0 below has one deliberate exception: D12/Step 0.3 reaches the public site by construction.)*

### 7.1 What was reported

Colours and contrast across the admin pages are poor and in places **outright unreadable** — persistently, in **both** dark and light mode, and down to button labels being unclear. The Owner wants it fixed everywhere, once, properly.

### 7.2 Root cause — measured, not guessed

**677 hardcoded `oklch(…)` colour literals across 99 files in `src/app/admin/`, plus 3 shared primitives in `src/components/ui/`. Zero in the public site** — which is exactly why the complaint is admin-only.

**Correction for the record:** the "677 across 99 files" headline is the **admin-only** subset (confirmed by `grep -oE "oklch\("` scoped to `src/app/admin` alone). The shared primitives add a further **40 occurrences across exactly 3 files** (`button.tsx`, `input.tsx`, `input.tsx`/`badge.tsx`) — **combined admin+ui total is 717 occurrences.** This doesn't change any conclusion in this document (Phase 0 fixes zero literals either way — see the table below), but state it explicitly so nobody later re-derives 717 and thinks it contradicts the 677 headline.

The admin design system is **not** the problem. `src/styles/tokens.css` defines **92 `--admin-*` tokens** across four blocks — `:root`, `[data-theme="dark"]`, `[data-theme="light"]`, and an `@media print` block — and several carry their measured contrast ratio in a comment (e.g. `--admin-danger-text-strong: … /* 9.21:1 vs danger-bg-strong */`). The system was designed correctly. **677 places bypass it.**

Theme is applied via `data-theme` on a `[data-admin-theme-root]` wrapper (`ThemeProvider.tsx:105`), so a literal simply cannot respond to it. **Dark is the effective default for staff accounts**, which is why the dark-mode failures dominate.

**The problem is far more tractable than 677 suggests:** those occurrences are only **94 distinct colour values**, and the **top ten account for ~483 of them — roughly 71% of the entire problem is ten colours.**

| Occurrences | Literal | Note |
|---|---|---|
| **171** | `oklch(26% 0.14 25)` | byte-identical to `--admin-status-cancelled-text`'s **light** value |
| 74 | `oklch(95.5% 0.028 20)` | byte-identical to `--admin-status-cancelled-bg`'s **light** value |
| 58 | `oklch(26% 0.13 55)` | |
| 40 | `oklch(95% 0.05 65)` | |
| 33 | `oklch(22% 0.085 155)` | |
| 30 | `oklch(93.5% 0.038 155)` | |
| 24 | `oklch(30% 0.02 280)` | |
| 21 | `oklch(94% 0.008 280)` | |
| 16 | `oklch(88% 0.045 20)` · `oklch(28% 0.12 55)` · `oklch(12% 0.01 165)` | |

**The critical property, verified directly:** the highest-frequency literals are **byte-identical to the light-mode value of an existing token**. `--admin-status-cancelled-text` is `oklch(26% 0.14 25)` in light (`tokens.css:155`) and `oklch(88% 0.058 25)` in dark (`:393`). So replacing the literal with `var(--admin-status-cancelled-text)` renders **pixel-identically in light mode** and **correctly in dark**. For the bulk of this work, *"no visual change in light mode"* is a provable fact, not a hope.

### 7.2a Measured live, before any code was written — `redesign/evidence/admin-contrast/baseline-owner-2026-08-10.md`

The static analysis above predicted the failures; the live DOM was then audited on the Owner's own session, both themes, and **confirmed them**. This is the baseline the fix must beat.

| Page | Nodes | **Dark** fails | **Light** fails | Worst |
|---|---|---|---|---|
| `/admin/dashboard` | 89 | **8** | **15** | **1.01:1** |
| `/admin/bookings` | 147 | **8** | **8** | 1.88:1 |
| `/admin/staff` | 177 | **41** | 1 | **1.05:1** |
| `/admin/emails` | 72 | **13** | 2 | 1.88:1 |
| `/admin/settings` | 56 | **9** | 1 | **1.15:1** |
| `/admin/bookings/new` | 28 | **7** | 1 | **1.15:1** |
| **Total** | **569** | **86** | **28** | |

**1.0:1 is identical colour.** These are not low-contrast, they are invisible.

- **`/admin/staff` fails on 23% of its text in dark mode.**
- **The dashboard's KPI figures (`0`, `£0.00`, `—`) are invisible in dark mode** at 1.05:1 — the most-read content on the most-visited page.
- **Light mode is worse than dark on the dashboard** (15 vs 8), worst 1.01:1, on a surface that is still *dark* while in light mode. Literals fail in **both** directions.
- **The failing selector names its own cause:** `1.15:1 "*" span.ml-0.5.text-[oklch(26%_0.14_25)]` — `input.tsx:116` verbatim, on every form.
- **`"New booking"` — a primary CTA — fails in both themes** (1.88:1 dark, 2.51:1 light).
- The header notification badge is 3.65:1 **on every page, in both themes.**

*Method and its one disclosed limitation (clipped `.sr-only` nodes are counted and must be excluded by the production auditor) are in the evidence file. Theme was switched via the `data-theme` attribute, so no `theme_preference` write reached the database.*

### 7.2b FULL SWEEP COMPLETE — every route, every role, both themes *(2026-08-10)*

`e2e/admin-contrast.spec.ts` ran end to end: **6 tests, 3.8 minutes, all four contrast roles plus the unauthenticated surfaces.** This supersedes §7.2a's six-page baseline.

| Role | Theme | Routes audited | Denied inline | Unreachable | **Failures** |
|---|---|---|---|---|---|
| OWNER | dark / light | 24 | 0 | 5 | **595 / 467** |
| ADMIN | dark / light | 22 | 1 | 6 | **577 / 441** |
| COORDINATOR | dark / light | 15 | 8 | 6 | **202 / 216** |
| THERAPIST_A | dark / light | 8 | 12 | 9 | **59 / 56** |
| UNAUTHENTICATED | dark / light | 2 | 0 | 0 | 2 / 0 |
| | | | | **TOTAL** | **2,615** |

**82 findings sit at exactly 1.01:1 — identical foreground and background.** Not low contrast: invisible.

**The single biggest offender is the navigation.** Ranked by frequency across every role and both themes, the most-failing text is: **"Clients" ×23, "Bookings" ×15, "Enquiries" ×7, "Dashboard" ×6, "Team" ×5, "Staff" ×3, "My bookings" ×3** — the *active* nav item, at 1.01:1, `rgb(49,55,49)` on `rgb(34,56,75)`. It is on every admin page, for every role, in both themes. Whichever section a user is currently in, its label is the one they cannot read.

**Every role is affected, proportionally.** Therapist shows 59 dark failures across only 8 reachable routes — the same density as Owner's 595 across 24. **This is not an Owner-only or a dark-mode-only problem.** Coordinator is in fact *worse in light* (216) than dark (202).

**The sweep doubles as an RBAC coverage map** — Owner reaches 24 routes, Admin 22 (1 denied inline), Coordinator 15 (8 denied), Therapist 8 (12 denied); 5–9 dynamic routes per role are unreachable for lack of data, recorded as such rather than counted as passes. That is the per-role variant coverage the Owner asked for, captured as data.

**Evidence:** `redesign/evidence/admin-contrast/<ROLE>-<theme>.md` (8 files) + `summary.md`, each with a per-route table, the worst findings with full CSS selector paths, and explicit unreachable/denied lists.

**This is the number the fix must move: 2,615 → 0.**

### 7.3 The four failure classes — this is what "unreadable" actually is

Every complaint reduces to one of four mechanical patterns. Naming them matters, because each has a different fix and only two of them are true readability failures.

**Class 1 — themed foreground + hardcoded light background → text disappears in dark mode.** The worst class, and it is in the shared button primitive, so it is on every admin page simultaneously:

```
// src/components/ui/button.tsx — outline and ghost variants
"... text-[var(--admin-body)] hover:bg-[oklch(95.5%_0.012_155)] ..."
```

`--admin-body` flips to a light colour in dark mode; the hover background stays near-white at 95.5% lightness. **Hovering an outline or ghost button in dark mode paints light text on a near-white fill.** This is precisely the reported "even buttons have unclear text in them".

**Class 2 — hardcoded dark foreground on a themed dark surface → text disappears in dark mode.**

```
// src/components/ui/input.tsx
:116  className="ml-1 text-[oklch(26%_0.14_25)]"                     // required asterisk
:143  className="... text-xs text-[oklch(26%_0.14_25)]"              // field error message
```

A 26%-lightness red on the dark admin panel. Independently rated **"functionally invisible, not merely low-contrast"** during drift checkpoint #3. This is a shared primitive: **it is every admin form's error text**. A user can be blocked by a validation error they cannot see.

**Class 3 — hardcoded light background + hardcoded dark foreground → legible, but a glaring light island in dark mode.** All 11 badge variants (`src/components/ui/badge.tsx`) pair a ~95% background with a ~26% foreground. Internally high-contrast, so not unreadable — but theme-blind, and the main source of "looks wrong / inconsistent". C-14 logged the same shape in `AvailabilityRulesManager.tsx` ("a **light** day-row background pair in a dark-default admin theme").

**Class 4 — `var(--token, <light literal>)` fallbacks.** e.g. `input.tsx:27-38`. Harmless while the token exists, but it hides the real dependency and inflates the literal count. Cleanup, not a defect.

**Classes 1 and 2 are the readability bugs. Class 3 is the ugliness. Class 4 is noise.** Fix 1 and 2 first — they are the ones that make the product unusable.

### 7.4 On roles — what the measurement shows, and what it means for the sweep

The Owner asked for every role to be signed into and checked top to bottom. Two facts change the shape of that:

**(a) The role-variant surfaces are already clean.** `BusinessDashboard.tsx`, `CoordinatorDashboard.tsx`, `TherapistDashboard.tsx`, `PractitionerTodaySection.tsx` and `dashboard-variant-shared.tsx` contain **zero** `oklch` literals between them. The whole `dashboard/` directory holds only 10, all in shared support files. The debt is concentrated in **role-independent** surfaces:

| Literals | File |
|---|---|
| 57 | `bookings/new/ManualBookingForm.tsx` |
| 22 | `settings/SettingsForm.tsx` |
| 19 | `staff/page.tsx` |
| 17 | `emails/page.tsx` |
| 15 | `clients/[clientId]/page.tsx` |
| 13 | `components/AdminTopNav.tsx` · `calendar/page.tsx` · `bookings/[bookingId]/page.tsx` |

**(b) Once the literals are gone, contrast becomes a property of the 92 token pairs, not of any page or role.** Every compliant component draws its colours from the same tokens, so proving the token pairs meet WCAG AA in both themes proves it **for every page and every role at once** — exhaustively, and without a single login.

**Therefore the role sweep is a *coverage confirmation*, not the discovery mechanism.** Its job is to catch role-exclusive UI that still holds a literal, and to sanity-check the result with human eyes. That is a far cheaper and more reliable use of it than hunting for the bug by looking.

**(c) The role sweep is automated, and no agent ever handles a password.** An agent may not type credentials — that limit does not lift on request. It does not need to: **the repo already has the mechanism**, and using it is both permitted and better than manual sweeps.

`e2e/helpers.ts` provides `getCredentials(prefix)`, which reads `E2E_<PREFIX>_EMAIL` / `E2E_<PREFIX>_PASSWORD` **from the environment**, and `loginAs(page, credentials)`, which performs a real Supabase `signInWithPassword` and injects the resulting auth cookies into the Playwright context. `e2e/admin-roles.spec.ts` already drives all of this. The **Owner** puts real values in an untracked env file; the **harness** authenticates; the agent writes only `getCredentials("THERAPIST_A")` and never sees a secret.

Prefixes already supported: **`OWNER`, `ADMIN`, `COORDINATOR`, `THERAPIST_A`, `THERAPIST_B`, `REPORTING`, `INACTIVE`, `NON_STAFF`.**

This is strictly better than a human clicking through:
- **repeatable** — re-run after the fix to prove the baseline moved from 86 failures to 0;
- **exhaustive** — every route × every role × both themes, with no attention fatigue;
- **self-documenting** — evidence files are a build artefact, not a chore;
- **permanent** — it can gate CI, so contrast cannot silently regress the way the literals did.

### 7.4a Verification tooling — BUILT, before any fix *(2026-08-10)*

All three verification layers exist and run **before** a single colour is changed, so the fix has a baseline to be measured against rather than an opinion to be judged by.

| Layer | Artefact | State |
|---|---|---|
| 1 — static source analyser | `scripts/measure-admin-contrast.mjs` + `.test.ts` (10 tests) | ✅ `d2efdfb` |
| 2 — token-pair proof | `scripts/verify-admin-token-contrast.mjs` + `.test.ts` | ✅ `b97e707` |
| 3 — live per-role sweep | `e2e/admin-contrast.spec.ts` | in progress |
| Layer 3 setup | `.env.example` documents the per-role variables | ✅ `6800fce` |

**Layer 1 current reading: 456 failures (377 dark / 79 light), 76 explicit-pair, 380 assumed-surface, and 239 `unresolvedElements`.** That last metric is the honest one — class strings it cannot resolve statically are counted and reported rather than silently skipped.

**Undisclosed tooling caveat, worth recording here because Phase 0 leans on Layer 1/2's numbers:** both `measure-admin-contrast.mjs` and `verify-admin-token-contrast.mjs` locate the `@media print` block with `css.indexOf("@media print")`, and the literal substring `"@media print"` also appears **inside a prose comment at `tokens.css:317`**, before the real rule at `:543`. In `verify-admin-token-contrast.mjs` this is load-bearing and wrong — see §7.5a and Step 0.2 below. In `measure-admin-contrast.mjs` the same mis-indexed position is *not* load-bearing today: `printStart` there only bounds the end of the light-value harvest, and because that script's `harvest()` keeps the **first** value written per token per theme, the real light block (harvested before the mis-bounded slice) is never overwritten. **456/377/79 is not affected by this bug — do not let that reassurance be assumed to extend to Layer 2, where it does not.**

AST pairing (TypeScript compiler API, no new dependency) both **removed** false positives and **found true positives line-based pairing could not reach** — notably `admin-ui-interactions.tsx:342`, a destructive confirm button at **1.47:1 / 1.91:1 dark**, missed previously only because the formatter had split the foreground and its ternary-branch background across physical lines. Ternary branches are treated as distinct rendering states and never paired with each other.

**Role coverage is complete, and this was verified against the database rather than assumed.** Only five roles exist — Owner, Admin, Booking Coordinator, Therapist, Inactive — and all five have credentials. **There is no Reporting role in this system**, so `E2E_REPORTING_*` can never resolve and the corresponding e2e test has always been skipping; that is not a coverage gap. `THERAPIST_B` serves two-therapist claim scenarios only, and `NON_STAFF`/`INACTIVE` are negative-path accounts with no admin UI to audit.

### 7.4b THE CONFIRMED DEFECT REGISTER — what the three layers actually found

Every item below is **measured, not inferred**. This is the work list; §7.6–7.8 (Workstream 2, out of this section's scope) is how the literal-substitution defects get done; §7.5b (below) is how Workstream 1's defects — D1, D7, D8, D9, D12 — get done.

| # | Defect | Worst | Reach | Class | Fix type |
|---|---|---|---|---|---|
| **D1** | **Active nav item — frozen alias token + inert colour class** | **1.01:1** | **Every admin page, every role, both themes** | Theme resolution | ✅ Root-caused — **de-alias**, not substitution |
| **D12** | **⚠️ Cascade-layer inversion: unlayered `a { color: inherit }` defeats every Tailwind text-colour utility on any `<a>`** | — | **SITE-WIDE — admin *and* public.** Reach now measured: see Step 0.3. | Architecture | Layer fix |
| **D2** | Shared `button.tsx` outline/ghost `active:` — themed fg on hardcoded light bg | 1.07:1 dark | Every admin page | 1 | Substitution (Workstream 2) |
| **D3** | Shared `input.tsx:116,143` — required asterisk + **field error text**, hardcoded dark red on dark panel | 1.15:1 dark | Every admin form | 2 | Substitution (Workstream 2) |
| **D4** | `admin-ui-interactions.tsx:342` — destructive confirm button | 1.47 / 1.91:1 dark | Destructive dialogs | 1 | Substitution (Workstream 2) |
| **D5** | `ManualBookingForm.tsx:1486` — `hover:` pairing | 1.02:1 dark | Booking form | 1 | Substitution (Workstream 2) |
| **D6** | `operations/event-row.tsx:171-173` + `calendar/page.tsx:650,660` — status tokens on hardcoded light bgs | 1.01–1.14:1 dark | Operations, calendar | 1 | Substitution (Workstream 2) |
| **D7** | Header notification badge — white on amber | 3.65:1 both themes | Every admin page | 3 | Same alias-freeze mechanism as D1 — de-alias |
| **D8** | **`--admin-warning` on `--admin-warning-bg`** | **3.41:1 light** | Wherever warnings render — **including `@media print`, see §7.5a** | **Token value** | ⚠️ Design decision |
| **D9** | Dashboard KPI figures (`0`, `£0.00`, `—`) — **`--admin-text` frozen alias**, not a literal | 1.05:1 dark | Dashboard | Theme resolution | **De-alias** |
| **D10** | `/admin/staff` onboarding badges | 1.05:1 dark | Staff list | 3 | Substitution (Workstream 2) |
| **D11** | 16 prose contrast claims in `tokens.css` unverified | — | Documentation integrity | — | Extend verifier (Step 0.5) |

#### ✅ D1 ROOT-CAUSED — and it is **two** independent bugs, neither fixable by substitution

*(Investigated live in the browser, 2026-08-10; full computed-style evidence in `redesign/evidence/admin-contrast/root-cause-D1.md`. Independently re-verified by the orchestrator, and re-verified a third time for this deepening pass by direct reads of `tokens.css`, `ThemeProvider.tsx`, `layout.tsx`, `globals.css` and `site-parity.css` — no drift found.)*

**Cause 1 — `:root`-only alias tokens are frozen in light mode, permanently.**

`--admin-nav-text: var(--admin-body)` (`tokens.css:129`) and `--admin-nav-active-text: var(--admin-primary)` (`:132`) are declared **only** in the `:root` block. But **`:root` (`<html>`) never carries `data-theme`** — `layout.tsx`'s `<html>` element carries only font-variable classes, and `data-theme` lives on a `<div data-admin-theme-root>` further down (`ThemeProvider.tsx:105`, confirmed verbatim: `<div data-admin-theme-root="" data-theme={effectiveTheme}>`).

A custom-property alias is substituted **at the element where it is declared**. So `--admin-nav-text` resolves once, on `:root`, against `:root`'s `--admin-body` — the **light** value `#313731` — and every descendant inherits that already-resolved colour. It can never track the theme. `#313731` **is** the measured `rgb(49,55,49)`.

**The design comment in `tokens.css` asserts these aliases "track the theme automatically". That claim is false**, and it is why the bug survived review.

**Cause 2 — a cascade-layer inversion makes the nav's own colour class inert, site-wide.**

`globals.css:1` declares `@layer theme, base, components, utilities;` and imports Tailwind's utilities into `layer(utilities)` (`:6`). But `src/styles/site-parity.css` is imported **unlayered** (`layout.tsx:4`), and it contains:

```css
a { color: inherit; text-decoration: none; }   /* site-parity.css:39-42, confirmed verbatim */
```

Under CSS Cascade Layers, **unlayered styles beat layered styles regardless of specificity**. So that rule defeats *every* Tailwind text-colour utility applied to an `<a>` — including the nav's own `text-[var(--admin-nav-active-text)]`, which is therefore **dead code**. The link falls back to inheriting from `<nav>`, which is itself frozen by Cause 1.

**This second bug is NOT admin-only. It affects every `<a>`/`<Link>` on the site, public pages included, and its reach is now measured — see Step 0.3.**

#### Consequences for the register — three entries were mis-classified

| Was | Now |
|---|---|
| **D9** dashboard KPI figures — "Substitution" | ❌ Wrong. Same alias-freeze bug, via `--admin-text` (`PersonalContributionStripe.tsx:90`). **Not a literal.** |
| **D7** notification badge 3.65:1 | Explained: `--notif-badge-warning-bg`, another frozen alias — white on `#b77900`, computed 3.65:1 exactly |
| **D8** `--admin-warning` 3.41:1 light | Proposed fix: `#b77900` → **`#986400`**, preserving hue/saturation, **3.41:1 → 4.72:1**. Full consumer list re-verified this pass — see §7.5a/Step 0.2 |

**There are exactly 11 `:root`-only alias tokens sharing the freeze mechanism** (declared only in `:root` as a bare `var(--other-token)` value, never redeclared in the dark, light, or print blocks) — re-derived directly from `tokens.css` for this pass and confirmed against `root-cause-D1.md`'s own independent enumeration, byte-for-byte:

`--admin-shell` (`:67`) · `--admin-surface` (`:70`) · `--admin-surface-muted` (`:71`) · `--admin-text` (`:75`) · `--admin-nav-text` (`:129`) · `--admin-nav-text-muted` (`:130`) · `--admin-nav-active-text` (`:132`) · `--admin-cormorant-color` (`:136`) · `--notif-badge-critical-bg` (`:174`) · `--notif-badge-warning-bg` (`:176`) · `--notif-badge-info-bg` (`:178`).

**Correction for the record: earlier drafts of this section listed "5 unmeasured aliases" that included a phantom 5th slot ("the user-menu-button variant of `--admin-nav-active-text`") and simultaneously dropped `--admin-shell` from the count entirely.** The user-menu-button reference (`AdminTopNav.tsx:498`) is not a distinct token — it is a **second consumption site** of the same `--admin-nav-active-text` alias, and it needs its own live-contrast check post-fix precisely because it's a separate DOM location, but it is not one of the 11 names. `--admin-shell` **is** one of the 11 names, has **zero** live consumers anywhere in `src/` (confirmed by `grep -r "var(--admin-shell)"` → only the token declaration itself matches; the similarly-named `.admin-shell` CSS class in `globals.css:23-38` is an unrelated structural class that consumes `--admin-shell-ambient`, a different token, for its `::before` gradient), and `tokens.css`'s own "8 aliases" comment (lines 319-321) **does** name it — the plan's table was the only place it went missing. See the corrected Step 0.1 table below.

#### The fix shape — de-alias, then un-invert

1. **De-alias the frozen tokens.** Give each a real per-theme value in the `:root` / `[data-theme="dark"]` / `[data-theme="light"]` blocks instead of `var(--other-token)`. This is the correct fix and it is **independent of the 677-literal substitution** — do it as its own commit, before or after, never mixed in.
2. **Correct the layer inversion** — wrap the offending rule (or the whole import) so it stops beating layered utilities. **Highest-risk change in this plan**: it re-enables utilities that have been silently inert, potentially altering links across the whole site. Requires its own before/after evidence on admin **and** public.
3. **D8's token value change**, as above — and, per §7.5a below, **in both the light block and the print block**.

**Explicitly still unknown, and must not be assumed away:** live contrast for the six aliases with a known consumer but no measured live rendering (`--admin-surface`, `--admin-surface-muted`, `--admin-nav-text-muted`, `--admin-cormorant-color`, `--notif-badge-critical-bg`, `--notif-badge-info-bg`); and whether `--admin-shell`, having zero consumers, should be de-aliased anyway for consistency or explicitly deferred as dead code (either is acceptable — silently dropping it from the table is not, see Step 0.1).

### 7.5 The solution — TWO workstreams, not one

**This section was rewritten after D1 was root-caused.** The plan originally assumed one problem — hardcoded literals — and one remedy: substitution. The measurement proved otherwise. There are **two independent defect classes**, with different causes, different fixes, and different risk profiles. **Conflating them is the main way this work goes wrong.**

| | **Workstream 1 — theme resolution** | **Workstream 2 — hardcoded literals** |
|---|---|---|
| Defects | **D1, D7, D9, D8, D12** | D2, D3, D4, D5, D6, D10 |
| Cause | `:root`-only aliases frozen in light; a cascade-layer inversion; one bad token value | 677 (admin) / 717 (admin+ui) literals bypassing the token system |
| Fix | **De-alias tokens; correct the layer; change one token value** | Mechanical substitution |
| Size | 11 tokens, 1 CSS selector, 1 value (2 locations) | 677–717 occurrences / 99–102 files |
| Risk | **Low volume, HIGH blast radius** (one is site-wide) | High volume, low blast radius per edit |
| Phase | **Phase 0 (§7.5b)** | Phases A–B (§7.6–7.7, out of this section's scope) |
| Files touched | `src/styles/tokens.css`, `src/styles/site-parity.css` and/or `src/app/layout.tsx`, optionally `scripts/verify-admin-token-contrast.mjs` (+its test) | `src/components/ui/*.tsx` + ~99 `src/app/admin/**` files |

**Substitution cannot fix Workstream 1** — those colours are already correctly-themed tokens. An implementer who treats the register as one undifferentiated list will edit literals that were never the problem and leave the highest-reach defect in place. Symmetrically: **if you find yourself editing an `oklch(` value while doing Phase 0 work, stop — that is Workstream 2's job, not this one's.** (`redesign/evidence/admin-contrast/surgical-review.md` states the mirror-image rule for Workstream 2 — "if an implementer reaches D1 during the sweep and is tempted to fix the nav highlight, they must stop and report, not touch `AdminTopNav.tsx`'s nav-active classes." Both workstreams' implementers should read both boundary statements.)

**Recommended sequence: Workstream 1 first.** It is far smaller, it clears the defect with the widest reach (D1 — every admin page, every role, both themes), and it is independent of the substitution work. Doing it first also means the Layer 3 baseline drops sharply and cleanly, making the remaining substitution progress easier to read. *(The plan does not mandate this order — but if the substitution runs first, expect 2,615 to barely move, because the nav defect alone recurs on every route.)*

**And for both workstreams: eliminate, prove, prevent.** A durable fix needs all three. Substitution alone would be undone within weeks: **11 brand-new files created during Band C carried this debt from their first commit**, each citing the match-the-surrounding-style rule. There is currently **no guard of any kind** against adding another literal, nor against reintroducing a frozen alias (that gap is Step 0.4).

#### Ordering against the rest of the plan

**Phase 0 has zero file overlap with any other item in this plan.** The collision table elsewhere in this document (SettingsForm.tsx, BookingManagementForm.tsx, bookings/[bookingId]/page.tsx, SeriesActions.tsx, ManualBookingForm.tsx — shared between items 7 and 8) is entirely **Workstream 2** territory: those files carry hardcoded literals, not frozen aliases or the layer-inversion rule. None of them is touched by any Phase 0 step. `tokens.css`, `site-parity.css`, `layout.tsx`, and `verify-admin-token-contrast.mjs` do not appear anywhere in the item-1/item-7/item-8 collision list.

**Consequence: Phase 0 can run at any point relative to item 8**, independent of the ordering defect the plan documents elsewhere (item 7's Workstream 2 must trail item 8's new UI in the four shared files). Phase 0 is not part of that constraint and does not need to wait.

**Phase 0 must, however, run before or independently of Workstream 2's own Phase A/B**, per §7.5's "Workstream 1 first" recommendation above — that is an internal item-7 sequencing choice, not a cross-item one.

### 7.5a Layer 2 built and run — one token pair genuinely fails AA, and the tool has a coverage gap of its own *(2026-08-10, `b97e707`; tool coverage gap found and confirmed this deepening pass)*

`scripts/verify-admin-token-contrast.mjs` now proves the token layer. 92 tokens resolved in both themes; **83 unique pairs × 2 themes = 166 checks**, derived by naming convention, by documented pairings, and by every foreground-ish token against the four real surfaces.

**Two results that change Phase A/Phase 0:**

1. **All self-declared ratio comments physically present in the file are accurate** (max delta ±0.03). The design system's claims about itself hold — good news, and it means those comments can be trusted as intent when choosing substitutions. **Correction for the record: this and earlier drafts stated "14 self-declared ratio comments, all match." That count is inflated by a real bug in the verifier itself (below); the true count of distinct inline ratio comments in the file is 11 (root 2 + dark 5 + light 2 + print 2). The "14, all match" claim should be read as "the 11 real ones plus 3 duplicated instances of the dark block's comments mislabelled as print's, all of which happen to still be individually accurate" — not as 14 independently-checked facts.**

2. **⚠️ One real AA failure in the tokens themselves: `--admin-warning` on `--admin-warning-bg` = 3.41:1 in the light theme** (needs 4.5:1). **This means Phase 0 is not purely mechanical.** Substitution alone would faithfully reproduce a genuinely non-compliant pair. Fixing it is a **token value change** — design work, not find-and-replace — and per §7.5b Step 0.2 it must be its own reviewed change with the before/after ratio quoted, applied in **both places the pair is declared**, not one.

#### ⚠️ Verifier bug found this pass: the `@media print` block is never actually checked

`parseTokensCss()` locates the print block with `css.indexOf("@media print")` (`verify-admin-token-contrast.mjs:197`). The literal substring `"@media print"` occurs **twice** in `tokens.css`: once inside a prose comment at **line 317** ("these blocks MUST stay after `:root`, and `@media print` MUST stay last"), and once in the real rule at **line 543**. `indexOf` returns the first match — the comment — and `extractBraceBlock` then walks forward from there to the *next* `{`, which belongs to the `[data-theme="dark"]` selector (line 331), and captures that block's body (through line 447) as if it were print's.

**Confirmed by re-implementing `extractBraceBlock` in isolation and printing what it actually returns**: the "print" scope opens with the dark block's own surfaces comment and closes with the dark block's own ratio comments — unambiguously the dark block, mislabelled. Consequence: **the script has never actually parsed or checked the real `@media print` block's token values, including its own copy of the failing `--admin-warning`/`--admin-warning-bg` pair** (`tokens.css:566-567`, byte-identical to the light block's pre-fix values by design — the print block always renders the light palette, per its own header comment at `:535-542`). `checkPairs()` (the 1c derived-pairs pass) never iterates a "print" scope at all — only `["dark", darkScope]` and `["light", lightScope]` — so this gap exists in both of the script's passes, not just the ratio-comment one.

**This is a real, previously-undocumented tooling gap, not a Phase 0 defect** — `tokens.css` itself is not wrong; the print block's design (render the light palette) is sound and its literal values already match the light block's pre-fix values exactly. The gap only becomes load-bearing at the moment Step 0.2 edits the light block and needs the print block edited identically — see Step 0.2 below for the required action.

**Fix for the tool, one line, in scope for Step 0.4/0.5's tooling-hygiene work (recommended, does not block Phase 0's own exit criteria but does undermine one of Phase 0's own verify steps if left unfixed — see the Step 0.2 STOP condition):** locate the print block by searching for the literal `@media print {` (requiring the following brace) rather than the bare substring, or search forward from where the light block's own closing brace is found. Add a regression test asserting `parseTokensCss(css).scopes.print["--admin-warning"]` resolves to the print block's own declared value (not the dark block's), and that exactly 2 ratio comments are attributed to `print`.

**Known coverage gap, separate from the bug above, logged not closed:** the verifier checks the **inline** `/* N:1 vs X */` comments. `tokens.css` contains a further **16 contrast claims written in prose** that nothing verifies — several load-bearing, e.g. *"fails WCAG text contrast at 1.42:1 on canvas; **never use as body text**"*, *"danger 5.39:1, warning 4.71:1, info 7.18:1"*, *"all six sit 5.55–9.75:1 against `--admin-panel`"*. A prose safety warning that silently stops being true is exactly the defect class this programme keeps finding. This is Step 0.5.

*(Correction for the record, carried from an earlier pass: this plan previously said "18 such comments" for the prose claims. That was a loose line-count and was wrong; the number is 16 prose claims plus the inline comments discussed above.)*

### 7.5b PHASE 0 — the theme-resolution fixes *(Workstream 1: D1, D7, D9, D8, D12)*

**Five steps, strictly in this order.** Each is independently revertable. **None of them touches a single hardcoded literal** — if you find yourself editing an `oklch(` value in Phase 0, stop: you are in the wrong workstream.

Full evidence: `redesign/evidence/admin-contrast/root-cause-D1.md`, cross-checked this pass in `redesign/evidence/plan-deepening/item-07a-phase0-theme.md`.

---

#### Step 0.1 — De-alias the frozen tokens *(fixes D1's Cause 1, D9, D7)*

**The bug:** a token declared in the `:root` block as `var(--other-token)` is substituted **at `:root`**, and `:root` (`<html>`) **never carries `data-theme`** — that attribute lives on `<div data-admin-theme-root>`, currently at `ThemeProvider.tsx:105` — **RE-LOCATE BY THE `data-admin-theme-root` ATTRIBUTE and report drift if the line number has moved.** So the alias resolves once against `:root`'s light value and every descendant inherits that frozen colour. It can never track the theme.

**The fix:** replace each alias with a **real value in each theme block** — `:root`, `[data-theme="dark"]`, `[data-theme="light"]`, and `@media print`.

**All 11 affected tokens must be assessed — this is the corrected, complete list (§7.4b above has the full derivation). `tokens.css`'s own "aliases" comment currently at lines 319-321 — RE-LOCATE BY ITS TEXT ("Aliases (--admin-shell, ...) are deliberately NOT repeated") — already names all 11 correctly; it is only this plan's own table that previously dropped one. Do not repeat that omission.**

| Token | Declared at (`:root`) — RE-LOCATE BY NAME, not line | Status |
|---|---|---|
| `--admin-shell` | currently `:67`, value `var(--admin-sidebar)` | ⚠️ **Zero live consumers** (confirmed: `grep -r "var(--admin-shell)"` matches only the declaration itself). Must be explicitly assessed: either de-alias anyway for consistency, or defer with the reason "dead code, no visible defect" recorded in the commit message. Do not silently drop it from the table the way earlier drafts did. |
| `--admin-surface` | currently `:70`, value `var(--admin-panel)` | ✅ confirmed consumed (`src/app/admin/clients/page.tsx:644`), live contrast **not yet measured** |
| `--admin-surface-muted` | currently `:71`, value `var(--admin-panel-muted)` | ✅ confirmed consumed (`attention-group-client.tsx:249`), live contrast **not yet measured** |
| `--admin-text` | currently `:75`, value `var(--admin-heading)` | ✅ confirmed broken + consumed (**D9** — `PersonalContributionStripe.tsx:90`, plus `ClientLtvRibbon.tsx`, `MetricRow.tsx`, `TrendTile.tsx`) |
| `--admin-nav-text` | currently `:129`, value `var(--admin-body)` | ✅ confirmed broken + consumed (**D1**) |
| `--admin-nav-text-muted` | currently `:130`, value `var(--admin-text-muted)` | ✅ confirmed consumed (`AdminTopNav.tsx` multiple sites, `ThemeToggle.tsx`), live contrast **not yet measured** |
| `--admin-nav-active-text` | currently `:132`, value `var(--admin-primary)` | ✅ confirmed broken + consumed (**D1**). **Two separate consumption sites** — the nav link itself and, separately, the user-menu button (`AdminTopNav.tsx`, currently ~line 498) — both must be re-checked live after the fix; they are the same token but different DOM locations. |
| `--admin-cormorant-color` | currently `:136`, value `var(--admin-accent)` | ✅ confirmed consumed (`admin-ui.tsx`, decorative Cormorant numerals only, per its own "Exception rule" comment), live contrast **not yet measured** |
| `--notif-badge-critical-bg` | currently `:174`, value `var(--admin-danger)` | ✅ confirmed consumed (`notification-bell.tsx`); currently clear AA on white (≈5.6:1 by computation) — broken by mechanism, not yet by measured contrast; de-alias anyway |
| `--notif-badge-warning-bg` | currently `:176`, value `var(--admin-warning)` | ✅ confirmed broken + consumed (**D7**, computed 3.65:1) |
| `--notif-badge-info-bg` | currently `:178`, value `var(--admin-info)` | ✅ confirmed consumed (`notification-bell.tsx`); currently clear AA (≈6.97:1) — broken by mechanism, not yet by measured contrast; de-alias anyway |

**Do not assume the unmeasured aliases are benign, and do not fix them blind.** Measure each first; a token that happens to be consumed only on a light surface may be correct today and still worth de-aliasing for consistency — but that is a judgement to record, not to skip.

**Also correct the false comment in `tokens.css`** (currently lines 319-325, opening "Aliases (--admin-shell, ...) are deliberately NOT repeated... tracks the theme automatically") — it is wrong, and it is why the bug survived review. A stale comment that misleads the next reader is a defect in its own right.

**Sequencing note, corrected this pass:** if Step 0.1 and Step 0.2 both touch `--notif-badge-warning-bg`'s effective light value, do **Step 0.2 first** (per this plan's own order) so Step 0.1's de-aliased light value for `--notif-badge-warning-bg` is written as the corrected `#986400`, not the soon-to-be-stale `#b77900`.

**Blast radius — full consumer enumeration, by token, is in §7.4b above.** No consumer of any of the 11 aliases sits in `src/components/ui/*.tsx`, `src/app/booking/**`, or `src/app/(public)/**` — checked directly by reading `input.tsx` and `badge.tsx` in full (their token references are `--admin-surface-input`, `--admin-border-form`, `--admin-body`, `--admin-text-muted`, `--admin-focus`, `--admin-heading`, `--admin-radius-control`, `--admin-panel-muted`, `--admin-border`, `--admin-primary`, `--admin-status-*` — none of the 11 aliases) and by grepping `src/app/(public)/**` and `src/app/booking/**` for every one of the 11 alias names (zero matches in either tree). **Step 0.1 has zero reach into `/booking/manage` or the public site — proven, not assumed.**

**Verify:**
```bash
node scripts/verify-admin-token-contrast.mjs
# Layer 2 must still report its single known failure (D8) and no new one.
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
# MUST move: OWNER-dark's 1.01:1 nav findings and PersonalContributionStripe's 1.05:1
# dashboard KPI findings absent from a fresh run.
# MUST NOT move: light-theme totals should not worsen (Step 0.1 only changes tokens
# that resolve identically in light before/after, by construction — every alias's
# :root value is unchanged, only the dark/light/print blocks gain their own explicit copy).
```

**Tests to add** — `scripts/verify-admin-token-contrast.test.ts`:
- `it("resolves --admin-nav-text, --admin-nav-active-text, --admin-text and all three --notif-badge-*-bg tokens to a real per-theme value, not a bare var() alias, in every theme block")`

---

#### Step 0.2 — Fix the `--admin-warning` token value *(D8)*

`--admin-warning` on `--admin-warning-bg` = **3.41:1 in light**, below AA. Proposed: `#b77900` → **`#986400`**, preserving hue and saturation, computed **3.41:1 → 4.72:1** (independently recomputed by hand this pass using the WCAG 2.1 relative-luminance formula against both the current and proposed values — confirmed).

**⚠️ Must be applied in BOTH of the following locations — this is a correction to the plan, not new scope:**
- `[data-theme="light"]` block, currently `tokens.css:470-471` (`--admin-warning: #b77900;` / `--admin-warning-bg: #fff7df;`)
- `@media print` block, currently `tokens.css:566-567` — **identical values, separately declared, not inherited.** The print block's own header comment (currently `:535-542`) states its whole design is "print always renders the light palette", so its copy of the pair must change identically or it silently remains a 3.41:1 failure that nothing currently catches (see the Layer 2 tooling gap in §7.5a — `checkPairs()` never checks a "print" scope at all).

**Full consumer list, re-derived directly against the live source this pass (supersedes any earlier partial list) — `grep -rn "var(--admin-warning)\|var(--admin-warning-bg)" src --include=*.tsx`:**

- `WorkingHoursDayEditor.tsx:221-222` — border + bg + text, the direct D8 pair itself; darkening the text only improves it.
- `dashboard-filters-client.tsx:409,565,575` — bg/border tint pairs (not paired with `--admin-warning` as text); `:417,581` — `--admin-warning` used as a **solid fill** under `--admin-on-primary` text (darkening the fill only increases contrast against that near-white text in light theme).
- `dashboard-cards.tsx:144,720,733,892,972,1109,1441,1450,1457,1594,1603,1614,1634,1651` — mix of text-on-tint pairs (improve), a solid-fill-under-`--admin-on-primary` pair at `:1603` (improve), and purely decorative dot/progress-fill/border usages with no contrast implication.
- `TherapistDashboard.tsx:627` — border colour only, not text.
- `admin-ui.tsx:92`, `notification-card.tsx:177,189`, `notification-bell.tsx:739`, `ReportsCharts.tsx:101` — decorative fill/stroke/dot, no contrast implication.
- **Alias consumer:** `--notif-badge-warning-bg` (D7) resolves through `--admin-warning` too — darkening it improves D7's frozen 3.65:1 badge incidentally (≈3.65:1 → ≈5.05:1 by the same math), though this does not fix D7's actual defect (the freeze itself, fixed by Step 0.1).

**No consumer found where darkening `--admin-warning` (light theme only) would reduce contrast.** Re-verify this yourself before applying — the list above is exhaustive as of this pass but re-run the grep, don't trust it as a permanent snapshot.

**Also confirmed, unaffected by this change:** `--admin-warning-bg-strong` / `--admin-warning-text-strong` are a **separate, already-passing pair** (10.71:1 dark, matches its own inline comment) declared independently in all four blocks, not aliased to `--admin-warning` — no shared consumer where changing `--admin-warning` alone would also silently need the `-strong` variant touched.

This is a **genuine appearance change**, the only one sanctioned anywhere in Phase 0. It must be its own commit with before/after ratios quoted for **both** the light and print copies, and it is the **one place where "light mode is unchanged" does not apply** — say so explicitly in the commit message so it is not mistaken for a mis-mapping.

**Verify:**
```bash
node scripts/verify-admin-token-contrast.mjs
# Must report 0 failures.
# ⚠️ Per §7.5a, this alone is NOT sufficient proof the print block was fixed — the
# script cannot currently see the print block's real content. Manually diff
# tokens.css:566-567 against :470-471 after editing to confirm both changed identically.
```

**Tests to add** — `scripts/verify-admin-token-contrast.test.ts`:
- `it("fails when the light-theme --admin-warning / --admin-warning-bg pair is below 4.5:1")` (regression guard pinning the fixed 4.72:1, so a future edit can't silently reintroduce 3.41:1)
- If the Step 0.5 tooling fix lands first or alongside: `it("checks the @media print block's own --admin-warning / --admin-warning-bg pair, not the dark block's")`

**Shared with public / `/booking/manage`:** zero reach. Neither `input.tsx` nor `badge.tsx` nor any `Button` variant consumed by `/booking/manage` references `--admin-warning` or `--admin-warning-bg` (confirmed by reading both files in full plus a targeted grep, no matches).

---

#### Step 0.3 — ⚠️ Correct the cascade-layer inversion *(D1's Cause 2 / D12) — HIGHEST-RISK CHANGE IN THIS PLAN*

`src/styles/site-parity.css` is imported **unlayered**, currently `layout.tsx:4` — **RE-LOCATE BY THE IMPORT STATEMENT `import "@/styles/site-parity.css";`, not the line number.** Confirmed this pass: `layout.tsx`'s import order is `react-day-picker/style.css` (line 3, also unlayered — see below), then `@/styles/site-parity.css` (line 4), then `./globals.css` (line 5). Tailwind utilities sit in `layer(utilities)` (`globals.css:1,6`). Unlayered CSS beats layered regardless of specificity, so `site-parity.css`'s `a { color: inherit; text-decoration: none; }` — confirmed verbatim at `site-parity.css:39-42` — **defeats every Tailwind text-colour utility on every `<a>` — site-wide, admin and public.**

**Undisclosed-until-this-pass fact worth stating explicitly: `tokens.css` is *also* imported unlayered** (`globals.css:4`, no `layer(...)` wrapper — confirmed by direct read), exactly like `site-parity.css`. This is **not currently a bug** (custom-property declarations don't compete the way `a { color: inherit }` does — nothing in the `theme`/`utilities` layers redeclares the same custom properties at a competing specificity), but it means the pattern is "two of the things imported into `globals.css` before the layer system finishes populating are unlayered," not "one file is the odd one out." Worth knowing when deciding how narrowly to scope the Step 0.3 fix.

**Also checked and cleared: `react-day-picker/style.css`** (`layout.tsx:3`, also unlayered) contains no bare element/colour selectors that could compete with a Tailwind utility the way `site-parity.css`'s `a` rule does — every rule in it is scoped to a `.rdp-*` class. **Not part of the D12 blast radius. No action needed there.**

**Precondition 1 — why was it imported unlayered — now investigated, not just hedged:**
```bash
git log --follow --oneline -- src/styles/site-parity.css   # oldest: 11067ed "Initial refactor website commit"
git blame -L 39,42 -- src/styles/site-parity.css            # all 4 lines: 11067ed, 2026-04-26
git blame -L 1,6 -- src/app/globals.css                     # all 6 lines, incl. @layer decl AND both imports: 11067ed
git log -1 --format=%B 11067ed                               # "Initial refactor website commit", no body
```
**The `a { color: inherit }` rule and the `@layer theme, base, components, utilities;` declaration it now conflicts with were authored in the *same commit, same day*.** No later commit, code comment, or design-handoff note discusses the interaction. `site-parity.css`'s own header comment and filename point at a Webflow-export migration purpose, and the `@layer theme/utilities` wrapper lines are exactly Tailwind v4's own standard boilerplate — not a bespoke choice. **Conclusion: no evidence this was a considered decision about layer interaction.** This reads as an artefact of the parity file never being made layer-aware when the Tailwind v4 layer scaffold was set up, not a deliberate choice to let it beat utilities. **Precondition 1 is satisfied: investigated, no evidence of deliberateness found — proceed on that basis, but the option list below still prefers the narrowest fix regardless, because "no evidence of intent" is not the same as "proven accidental."**

**Precondition 2 — measure the reach first — now measured, not hedged:**

Method: `Grep` (`multiline:true`) for `<a\s[^>]*?text-[a-zA-Z-]` and `<Link\s[^>]*?text-[a-zA-Z-]`, per directory. Known undercount (disclosed): a class string built via `cn()`/template literals with a *variable* fragment won't match; these counts are a floor, not a ceiling.

| Area | `<a>` matches | `<Link>` matches | Files |
|---|---|---|---|
| `src/app/admin/**` | 13 | 148 | 11 + 56 |
| `src/app/(public)/**` | 2 | 0 | 2 |
| `src/app/booking/**` | 0 | 1 | 1 (`booking/manage/page.tsx`) |
| `src/features/**` | 0 | 0 | 0 |
| `src/components/**` (renders into public routes) | 6 | 54 | 4 + 35 |

**Admin ≈161. Public-reaching (public app dir + booking + components) ≈63. Grand total ≈224.** This falsifies any assumption the layer bug is admin-only in occurrence, not just in definition.

**Two concrete, verified-live public/customer hits on `/booking/manage`, confirmed by direct read this pass (exact anchors — RE-LOCATE BY THE `<Link>` TAG AND `href` IF THESE DRIFT):**
```tsx
// src/app/booking/manage/page.tsx:194-197
<Link
  href="/cookies/"
  className="font-medium text-[var(--rahma-charcoal)] underline underline-offset-4"
>

// src/app/booking/manage/page.tsx:333-336
<Link
  href="/"
  className="mt-5 inline-flex rounded-lg bg-[var(--rahma-green)] px-5 py-3 text-sm font-semibold text-white"
>
```
Both are real `<a>` elements at runtime (`next/link` always renders one), both carry a Tailwind text-colour utility directly on the tag, both are structurally defeated by the unlayered `a { color: inherit }` rule **today**. These are the required before/after evidence pair for `/booking/manage`.

`src/components/layout/SiteHeader.tsx` (the public nav, present on every `(public)` route) has 3 `<Link>` matches carrying `text-` on the same line — checked: its primary nav-link colour comes from a **classed** rule (`.navbar31_desktop-link`, from `site-parity.css` itself), not a raw Tailwind utility, so it is **not** currently broken by this bug the way the admin nav is. Still include its 3 `text-` matches in the before/after diff for completeness, since they sit on other elements in the same file.

**Also worth one sentence for scoping the fix:** `site-parity.css` (2887 lines, read in full this pass) contains **exactly one** rule that sets `color` on a bare, unqualified element selector — the `a` rule. Every other colour-bearing rule in the file (~30 of them: `.navbar31_link`, `.footer_link`, `.button`, etc.) is qualified by a class selector, so they don't currently compete with a same-element Tailwind utility the way the bare `a` rule does — but they *would*, under the identical mechanism, if any future JSX paired one of those classes with a conflicting Tailwind utility on the same tag. That risk is currently dormant, not zero, and is a reason to prefer **narrowing the fix to the `a` rule specifically** rather than layering the whole file (which would also reprioritise those ~30 classed rules against utilities, an unmeasured and unrequested change).

**⛔ Both preconditions above are now satisfied — this section no longer requires a STOP-AND-ASK on those two points. The third precondition is process, not investigation, and still applies:**

3. **Capture before/after evidence on the public site**, not just admin — specifically the two `/booking/manage` links above, `SiteHeader.tsx`'s three matches, and a spot-check of the admin nav. ITEM 7 is otherwise admin-only; **this step is the single exception, and it is why it cannot ride along with anything else.**

**Options, in preference order (narrowest first, per the finding above):**
1. Scope the `a` rule itself, e.g. by moving only that one declaration into an existing layer, or narrowing its selector so it stops competing with utilities on elements that carry one.
2. Wrap just the `a { color: inherit; text-decoration: none; }` rule in `@layer base` (or a new, narrowly-scoped layer) rather than the whole file.
3. Wrap the entire `site-parity.css` import in `@layer base` — **only if 1 and 2 are shown to be insufficient**, and only with the ~30-classed-rules caveat above explicitly accepted and evidenced, since it repriorities all of them, not just the `a` rule.

**✅ IMPLEMENTED 2026-08-11 (`ad0db14`). Result: dark −46, light −194, total −240.**

**⚠️ CORRECTED — Steps 0.1 and 0.3 are NOT independent.** The previous text said "Do NOT bundle this with Step 0.1", on the theory that 0.1 fixes the inherited colour and 0.3 restores the element's own, separably. **Measurement disproved that.** Shipping 0.1 alone made light-mode contrast measurably *worse* (+184 against a same-day control), because the de-alias made backgrounds theme-correct while anchor text colour stayed frozen by D12 — so pairs that had been uniformly frozen-light, and therefore accidentally consistent, became mismatched. Step 0.3 removed the mismatch (−194) and returned light to neutral.

**They must ship together.** Landing 0.1 without 0.3 leaves the product worse in light mode than not starting. Keep them as separate commits for reviewability and revertability, but never as separate releases. Full working: `redesign/evidence/admin-contrast/ab-phase0-2026-08-11.md`.

**Verify:**
```bash
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
# MUST move: the nav-active text class should now be live (not just inherited-correct via 0.1).
```
Public-site before/after has no existing automated tool in this repo (Layer 1/2/3 are admin-scoped by design). Do it as a manual computed-style check in the browser against the two named `/booking/manage` `<Link>`s and `SiteHeader.tsx`'s three matches, both before and after, and attach the evidence to the commit — same standard as `root-cause-D1.md`'s existing method.

**Tests to add:**
- `src/styles/__tests__/site-parity-anchor-scope.test.ts` (new file, following the source-text anti-drift guard idiom already used by `src/content/site/__tests__/canonical-domain.test.ts`): `it("keeps the site-parity 'a { color: inherit }' rule scoped so an unlayered import can't defeat Tailwind text-colour utilities site-wide")` — read the raw source of `site-parity.css` and assert the bare `a { color: inherit` selector is no longer present unqualified (i.e. the fix actually landed, not just that the file still parses).

**Stop condition specific to this step:** if the fix is drafted as "wrap all of `site-parity.css` in `@layer base`" without first trying options 1–2, stop and reconsider — the ~30-classed-rule caveat above means that is not the narrowest available fix.

---

#### Step 0.4 — Regression guard for the alias class

Add a check that fails if any `--admin-*` or `--notif-*` token is declared **only** in `:root` with a `var(--…)` value. This is the exact shape that froze D1/D7/D9, and nothing currently prevents a new one.

Belongs with the Layer 2 verifier (`scripts/verify-admin-token-contrast.test.ts`). **Disclose its limit**, per C-17's precedent: it is a source-level check and will not catch an alias introduced through a different mechanism.

**Test-design note, corrected this pass:** a test that only asserts "zero frozen aliases found" against the *post-Step-0.1* `tokens.css` would trivially pass whether or not the guard's own detection logic works — Step 0.1 will have removed all 11 real instances, so a broken checker and a working one produce the same "zero" result. **The guard needs its own synthetic fixture** — a small inline CSS string declaring a token only in `:root` as `var(--other)` — asserted to be caught, in addition to the real-file "zero found" assertion.

**Tests to add** — `scripts/verify-admin-token-contrast.test.ts`:
- `it("flags a token declared only in :root as a bare var() alias")` (synthetic fixture, proves the guard's detection logic actually works)
- `it("finds zero frozen :root-only alias tokens in the real tokens.css")` (real-file assertion, only meaningful once Step 0.1 has landed and paired with the synthetic test above)

---

#### Step 0.5 — Extend the Layer 2 verifier to the prose ratio claims *(D11)*, and fix the print-block mis-parse *(§7.5a)*

The verifier checks the inline `/* N:1 vs X */` comments. `tokens.css` carries **16** contrast claims written in prose that nothing verifies — several load-bearing, e.g. *"fails WCAG text contrast at 1.42:1 on canvas; **never use as body text**"*, *"danger 5.39:1, warning 4.71:1, info 7.18:1"*, *"all six sit 5.55–9.75:1 against `--admin-panel`"*.

**This belongs in Phase 0 specifically because Steps 0.1 and 0.2 change token values** — so any prose claim about those tokens is at risk of becoming false *as a result of this very work*. Extend the parser, re-verify all claims (11 real inline + 16 prose = 27; **not** "14 + 16 = 30" as an earlier draft stated, since 14 was itself the inflated figure — see §7.5a), and **correct any that Phase 0 invalidates**.

**Also fix the print-block indexOf bug found in §7.5a as part of this step's tooling hygiene** — one-line change: locate `@media print` by its selector-with-brace form, or search forward from the end of the light block, so `parseTokensCss` stops returning the dark block's body under the "print" label. Add the regression test named in §7.5a.

A prose safety warning that silently stops being true is precisely the defect class this programme keeps finding. **Where a claim cannot be machine-parsed, say so in the tool's output** rather than quietly checking only the easy ones.

**Tests to add** — `scripts/verify-admin-token-contrast.test.ts`:
- `it("parses the @media print block from its own selector, not from the word 'print' inside an earlier comment")`
- `it("reports exactly 2 ratio comments attributed to the print block, not 5")`
- `it("verifies all 16 prose contrast claims in tokens.css, flagging any it cannot machine-parse rather than skipping it silently")`

---

**Phase 0 exit criteria:** D1, D7, D9 findings absent from a Layer 3 re-run; Layer 2 at **0** failures, with the print block's own copy of the D8 pair manually confirmed changed (not just Layer 2's aggregate number, per §7.5a); all 27 ratio claims (11 real inline + 16 prose) verified or corrected; the alias guard passing with its synthetic fixture proven to catch a real regression; `--admin-shell` explicitly assessed or deferred-with-reason, not silently dropped; `/booking/manage` and the public site unchanged **except** where Step 0.3 deliberately changed them, with evidence for both named `/booking/manage` links and `SiteHeader.tsx`'s three matches; and every other alias with a known-but-unmeasured consumer (`--admin-surface`, `--admin-surface-muted`, `--admin-nav-text-muted`, `--admin-cormorant-color`, `--notif-badge-critical-bg`, `--notif-badge-info-bg`, plus the user-menu-button consumption site of `--admin-nav-active-text`) individually re-checked live post-fix, not silently assumed fine.

**Gates by identity, unrelated to this item but must not move from Phase 0's edits:**
```bash
npx tsc --noEmit      # must stay 0, silent, exit 0
pnpm lint              # must stay 59 errors / 7 warnings, exactly the same six files —
                       # Phase 0 touches none of them (tokens.css/site-parity.css/layout.tsx
                       # are not among the six, and neither script is linted for the same
                       # rules the six-file baseline tracks)
npx vitest run         # must stay 5 failed / 2236 passed, same five named tests
                       # (Phase 0 adds new passing tests; it must not change this baseline's
                       # identity — new tests are additive, not replacements)
```

### Stop conditions — Phase 0, consolidated

1. If Phase 0 touches a single `oklch(` literal, stop — that is Workstream 2's job.
2. If Step 0.1's per-token table is executed as though it has 10 rows, stop — `--admin-shell` is the 11th and must be explicitly assessed or deferred-with-reason, not silently omitted.
3. If Step 0.2 edits only `tokens.css:470-471` and treats "Layer 2 → 0" as proof of completion, stop — the print block's copy at `:566-567` must be edited too, and Layer 2 cannot currently see it (§7.5a).
4. If Step 0.3's fix is drafted as "wrap all of `site-parity.css` in `@layer base`," stop and reconsider — that repriorities ~30 other classed rules, not just the `a` reset; try the narrower options first.
5. If Step 0.3 proceeds without capturing before/after evidence on `/booking/manage`'s two named `<Link>`s and `SiteHeader.tsx`, stop — this is the one step in ITEM 7 that is not admin-only, and it is the one place the "admin-only, public site untouched" guarantee does not hold by design.
6. If Step 0.4's regression test only asserts "zero frozen aliases in the real file" without a synthetic fixture proving the detector actually works, stop — that test would pass even if the detection logic were broken.
7. If any of the six aliases with a known consumer but no measured live contrast (see exit criteria) ships without a live re-check, stop and report which ones were skipped and why, rather than letting the gap go unrecorded.

### Rollback — Phase 0

All Phase 0 changes are CSS-only, additive-or-value-only edits to `tokens.css`, plus a CSS-selector-scoping change to `site-parity.css` and/or `layout.tsx`, plus an optional one-line parser fix in `scripts/verify-admin-token-contrast.mjs`. Every step is its own commit and is independently revertable with `git revert` — no step depends on generated code, a migration, or a data write. **Nothing in Phase 0's scope is irreversible.** The only step with reach beyond admin (Step 0.3) is exactly as revertable as the others; its risk is in *scope of visible effect while live*, not in difficulty of rollback.

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

---

## ITEM 8 — Travel-charge model: free-travel areas + manually-set mileage fee

*(Added 2026-08-11. Owner-decided design. Research: three parallel code reviews + a feasibility study that rejected full automation — see §8.11. Deepened 2026-08-11: every file:line below was re-read directly and cross-checked live against Supabase project `twzutkfgqclqurvkmvqz`. **Locate by symbol first; if the line differs, that is the anchor drifting, not a reason to distrust the symbol.**)*

### 8.1 What the Owner decided

1. **`allowed_cities` inverts its meaning.** It stops being a *gate* ("who may book") and becomes the **free-travel zone** ("where we travel at no charge"). Addresses outside it remain **bookable**.
2. **The fee is set by hand, per booking, by an admin** — no distance API, no automated calculation.
3. **A new setting names where mileage is measured from** — an origin **chosen freely by the Owner**, not constrained to the free-travel towns.
4. **No hard outer boundary in code.** A far-away request simply arrives as `pending`; the admin declines it. **Admin discretion is the boundary.**
5. **The one-click confirm chip must be hidden** when an address is outside the free-travel zone and no fee is set.
6. **Recurring series repeat the same charge** — the fee from the first booking applies to every occurrence, not just one.
7. Consistency is the point: **change the towns in admin, and the booking page, admin alert and emails all follow.**
8. **Only the Owner role may edit the mileage origin.** Other settings stay Admin-editable.
9. **The free-travel list must keep its minimum of one entry.** An empty list is not a valid state.
10. **The fee may not be edited once a booking is `completed` or fully paid.**
11. **Series-level travel charge is in scope** — set on the series, applying to every occurrence.

### 8.2 The contradiction this also fixes

The town list exists in **three places that disagree**, which is why a Harpenden customer gets a green "covered" tick and then an empty calendar:

| # | Enforcement point | Allows | Behaviour |
|---|---|---|---|
| 1 | `src/features/booking/schemas/booking-schema.ts:5-11` (`BOOKING_ALLOWED_CITIES`) | **5 towns**, hardcoded | `validateServiceArea` (`:139-164`, wired at `:174`) raises a zod issue; `BookingExperience.tsx:429` `goToTime` then **refuses to advance past step 2** |
| 2 | `src/lib/booking/availability.ts:454` `isCityAllowed()` | **2 towns**, from `business_settings` | Returns **no slots** — the empty calendar |
| 3 | `create_booking_request` — `supabase/migrations/20260727120000_c06_client_crud_hardening.sql:399-410` | **2 towns** | `raise exception 'Location is outside the service area'` |

**Re-verified live, 2026-08-11:** `create_booking_request` is still the **only** DB function referencing `allowed_cities` (`SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` → one row), and **no RLS policy** references it (`pg_policies` → empty). `business_settings.allowed_cities` is `jsonb` and currently holds exactly `["Luton","Dunstable"]` — **this is the §8.9.G reversibility snapshot; it is recorded here so it cannot be lost.** Match is exact-or-contains (`lower(city) like '%luton%'`), so *"Houghton Regis"* fails. Gate 3 sits **after** `end if; -- end IF NOT p_override_availability`, so **admins cannot bypass it either** — there is currently no way to create an out-of-area booking anywhere in the product.

**A fourth place speaks the old meaning to a user**, and the previous revision missed it: `src/app/admin/bookings/new/ManualBookingForm.tsx` consumes an `allowedCities` prop, derives `isCityKnown`, and renders *"…is outside our current service area. We deliver to: …"*. It is **advisory only** — `isCityKnown` is read exactly once, for display, and blocks nothing — so item 8 needs no behavioural change there. But the **copy becomes false** the moment this item ships, and that line also carries item 7's #1 literal. See §8.8 and §10.1.

`create_recurring_booking_series` (`20260802122636_c02_recurring_bookings.sql:187`) deliberately never checked the city. **Leave it alone** — and note it, so nobody "fixes" it by adding a check that then has to be removed.

### 8.3 The model in one line

> **Two settings → one source of truth → three surfaces.**
> Free-travel areas + mileage origin, read by the booking page, the admin booking view, and the emails.

---

### 8.4 Phase 1 — Settings

**Rename the column** `allowed_cities` → `free_travel_cities` via `alter table business_settings rename column allowed_cities to free_travel_cities`. **Do not edit the historical migrations** — `20260502052540_phase2_group6_settings_and_audit.sql` (original column), `20260502160000_phase6_seed_business_settings_and_global_availability.sql` (seed), and the two now-superseded `create_booking_request` bodies (`20260503150000_phase2_booking_atomic_snapshots.sql:178`, `20260513120100_update_create_booking_request_per_participant_services.sql:310`) all stay untouched by design; only the live `create_booking_request` definition in `20260727120000_c06_client_crud_hardening.sql` needs a `create or replace`.

**Consumers of the column — 12 files, not ~8.** *(Corrected: the earlier count named 6 by path and estimated "~8"; the real number, confirmed by grep with no glob restriction, is 12. The six it missed are exactly: `ManualBookingForm.tsx` and five test files — see below.)*

| File | Symbol / line | Change |
|---|---|---|
| `src/lib/booking/availability.ts` | `BusinessSettingsRecord` interface field, line 58; select-string literal, `loadSettings` line 433; gate read, `loadContextRest` line 454 | rename + repurpose (§8.5) |
| `src/app/admin/settings/settings-data.ts` | `BusinessSettingsRow.allowed_cities`, line 47 | rename |
| `src/app/admin/settings/page.tsx` | `fallbackSettings.allowed_cities`, line 19 | rename |
| `src/app/admin/settings/actions.ts` | form-data parse line 49 (`String(formData.get("allowed_cities") ...)`); `fieldErrors.allowed_cities` line 68; upsert payload key line 92 | rename; reword message (below) |
| `src/app/admin/settings/SettingsForm.tsx` | interface field line 27; `useState` init line 59; dirty-check baseline line 76; error prop line 388; **hidden `<input name="allowed_cities">`** line 395 | rename **all five, including the `name=` attribute** — ✅ decided 2026-08-11, see below |
| `src/app/admin/bookings/new/page.tsx` | `.select("allowed_cities")` line 75; destructure `settingsResult.data?.allowed_cities` line 84 | rename |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | doc comment line 547 (`business_settings.allowed_cities`); `allowedCities` prop, default `= []` at line 529, typed at line 550 | **was entirely absent from the file list — add it.** The prop name (`allowedCities`, camelCase) does not itself need to change, only the doc comment and the copy it feeds (§8.5) |
| `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts` | `data.set("allowed_cities", ...)` line 83 | **rename — required**, not optional (§8.4 decision 4) |
| `src/lib/booking/__tests__/availability-options.test.ts` | fake-DB mock key, line 49 | rename — **silent if missed, see below** |
| `src/lib/booking/__tests__/working-hours-segments.test.ts` | fake-DB mock key, line 288 | rename — silent if missed |
| `src/lib/booking/__tests__/override-windows.test.ts` | fake-DB mock key, lines 84 and 379 | rename — silent if missed |
| `src/lib/booking/__tests__/staff-recurring-windows.test.ts` | fake-DB mock key, line 70 | rename — silent if missed |

**"Silent if missed" is load-bearing, not decoration.** `src/lib/cache/__tests__/fake-supabase-admin.ts:21` types `FakeQueryResult.data` as `unknown`. A mock literal like `{ allowed_cities: ["Luton"], ... }` compiles fine forever, regardless of what `availability.ts` actually selects — `tsc --noEmit` will not catch a stale key here. None of the four fixtures assert on the city gate itself today (they use `"Luton"` purely as a safe pass-through for staff-window/override/segment assertions unrelated to city), so a missed rename does not fail a test — it just makes `settings.free_travel_cities` `undefined` at runtime in those specs, silently. Rename all four in the same commit as the migration; do not treat them as optional cleanup.

**Add the origin setting** — `business_settings.mileage_origin text`, nullable, no default. Confirmed no naming collision (current `business_settings` columns: `id, company_name, contact_email, contact_phone, booking_window_days, buffer_time_mins, minimum_notice_hours, allowed_cities, booking_status_enabled, customer_cancellation_cutoff_hours`). It is free-form and descriptive only — nothing computes from it.

**✅ DECIDED — the mileage origin is Owner-only** (handoff §4 item 13). Implement it through a **new permission**, not a role-name check — this codebase has exactly one other Owner-exclusive gate (`manage_role_templates`) and it is permission-based, confirmed live:

```sql
SELECT r.name, p.name FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
WHERE p.name IN ('manage_settings','manage_role_templates');
-- manage_role_templates | Owner
-- manage_settings        | Admin
-- manage_settings        | Owner
```

`settings/actions.ts:24` (`requireSettingsManager`) gates the whole form with `PERMISSIONS.MANAGE_SETTINGS`. Add `manage_travel_origin`, granted to Owner only, and check it **specifically for the origin field** inside the existing action — the form keeps its single `MANAGE_SETTINGS` gate for everything else.

- **Server-side enforcement is the real gate.** Hiding the field in the UI is presentation only; an Admin who crafts the request must be rejected by the action, with a field-level error, not a 500.
- **Partial-save must succeed.** Compare the submitted `mileage_origin` against the stored value and only enforce the permission when it actually changed, or Admins cannot save any other setting either:
  ```ts
  // settings/actions.ts, inside updateBusinessSettings, after requireSettingsManager()
  const mileageOriginChanged = mileageOrigin !== (beforeState?.mileage_origin ?? "");
  if (mileageOriginChanged && !actor.permissions.has(PERMISSIONS.MANAGE_TRAVEL_ORIGIN)) {
    fieldErrors.mileage_origin = "Only the practice owner can change the mileage origin.";
  }
  ```
  `requirePermission`/`hasPermission` are at `src/lib/auth/rbac.ts:401-423` and `:428-433`; `requireSettingsManager()` already returns a full `StaffProfile` with `.permissions: Set<string>`, so this needs no extra fetch.
- ⛔ **Needs a migration** (insert into `permissions`, insert into `role_permissions`) — Zone-2, Owner-approved. Exact SQL:
  ```sql
  insert into permissions (name, description, category, scope, risk_level, is_system, active)
  values ('manage_travel_origin', 'Edit the mileage-charge origin point on business settings.',
          'settings', 'operational', 'high', true, true);

  insert into role_permissions (role_id, permission_id)
  select r.id, p.id from roles r, permissions p
  where r.name = 'Owner' and p.name = 'manage_travel_origin';
  ```
  Rollback: `delete from role_permissions where permission_id = (select id from permissions where name = 'manage_travel_origin'); delete from permissions where name = 'manage_travel_origin';` — both pure additions, no other table references the new permission yet, so this is a clean, instant, no-data-loss rollback.
- Roles table for the migration (live, confirmed): `Admin 9f746458-a342-49ae-8b24-ff1a9068f422`, `Owner 2d5295c3-5d45-4c96-ab49-d5f87e0464b5` (full 5-row set also confirmed live if needed).

**✅ DECIDED — the free-travel list keeps its minimum of one entry.** `actions.ts:67-68`'s existing check stays:
```ts
if (allowedCities.length === 0) {
  fieldErrors.allowed_cities = "Enter at least one allowed service area.";
}
```
Rename the key (`fieldErrors.free_travel_cities` if the form field is also renamed — see below) and reword the message, e.g. *"Enter at least one free-travel area."*

**Rewrite the settings copy.** `SettingsForm.tsx`'s `ServiceAreaField` (component starts ~line 674) has three strings that become actively false once out-of-zone addresses are bookable — confirmed byte-for-byte:
- Line 378: *"Cities and towns where the team will travel. Customers booking outside these areas see a helpful message instead of a closed door."*
- Lines 708–711: *"No service areas yet. The booking form will currently turn every customer away. Add at least one city below."*
- Line 718: *"Service area. Customers within this area can book."*

All three describe a gate that Phase 2 removes. Replace with free-travel framing (e.g. "areas we travel to at no charge"; addresses outside are still bookable, at a manually-set fee).

**✅ DECIDED — the HTML form field name IS renamed too** *(Owner decision, 2026-08-11: be consistent with the rest of the system).* `SettingsForm.tsx:395` posts a hidden input `name="allowed_cities"` and `actions.ts:49` reads `formData.get("allowed_cities")`. This is a same-origin server action, not a public API, so **nothing external depends on the literal string** — the rename is fully contained.

Rename all three in the same commit as the column rename:

| File | Symbol / site | Change |
|---|---|---|
| `src/app/admin/settings/SettingsForm.tsx` | hidden `<input name="allowed_cities">`, currently `:395` | `name="free_travel_cities"` |
| `src/app/admin/settings/actions.ts` | `formData.get("allowed_cities")`, currently `:49`; `fieldErrors.allowed_cities`, currently `:68` | both keys renamed |
| `src/app/admin/settings/__tests__/updateBusinessSettings.test.ts` | `data.set("allowed_cities", ...)`, currently `:83` | **must** change with them |

**The test edit is not optional.** If the form field is renamed and `updateBusinessSettings.test.ts:83` is not, the "at least one free-travel area" validation never sees a value and the test fails — which looks like a broken validator rather than a stale fixture. All three files are already in Phase 1's edit list, so this adds no new file to the blast radius.

*Leaving the field as `allowed_cities` was the alternative; it was rejected because a field named "allowed" that carries free-travel towns is the same stale-name defect the column rename exists to remove (§8.2).*

### 8.5 Phase 2 — Remove the three gates, create one source of truth

**Prerequisite: Phase 1's column rename must be applied first.** Phase 2's SQL and TS both read `free_travel_cities`, which does not exist until Migration A runs.

| Gate | Change |
|---|---|
| SQL `c06…sql:399-410` | **Stop raising.** Keep the city-**required** check at `:399-401` (`if v_clean_city = '' then raise exception 'City is required'; end if;`). Replace the `not exists (...) raise exception 'Location is outside the service area'` block (`:403-409`) with, at most, a boolean computed for reporting — never a raise. Rename every `v_settings.allowed_cities` reference to `v_settings.free_travel_cities` in the same `create or replace`, to match Migration A. Postgres has no partial-function-body ALTER — this must be a full `create or replace function`, sourced from the live definition (confirmed the only live function referencing the column via `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` → exactly one row, `create_booking_request`; **re-run this probe immediately before writing the migration** — if it now returns more than one row, stop, the blast radius has grown) |
| `availability.ts:454-456` | **Delete the block.** Confirmed nothing else in `loadContextRest` (lines 449-559) reads `input.city` after this — only `serviceIds` and `participantGenders` follow. `getAllowedCities`/`isCityAllowed` (`:243-257`) may be retained, renamed, and repurposed to compute a non-blocking `isFreeTravelZone` flag returned alongside the slots |
| `booking-schema.ts` | **Stop failing submission on city.** See the exact wire points below — there are two, not one |

**Correction: `validateServiceArea` is wired twice, not once.** The function body is `booking-schema.ts:139-161` (not `:139-164` as previously stated — line 161 is the closing brace). It is then wired at **two** separate call sites:
```ts
// :163-164 — wire point #1
export const bookingLocationSchema =
  bookingLocationFieldsSchema.superRefine(validateServiceArea);

// :174 — wire point #2, on bookingDetailsSchema
  .superRefine(validateServiceArea)
```
Both must be removed (or the function deleted and both `.superRefine` calls dropped) — removing only line 174 leaves `bookingLocationSchema` (line 164's export) still rejecting out-of-zone cities whenever it is called directly. **This matters concretely: `booking-schema.test.ts:39-47`'s existing test calls `bookingLocationSchema.safeParse(...)`, i.e. wire point #1, not #2** — so an implementer who reads only "wired at :174" and fixes only that site will watch this specific test keep failing for a reason that looks unrelated.

**Feed the real list to the public form.** Delete `BOOKING_ALLOWED_CITIES` (`booking-schema.ts:5-11`). Copy the existing proven pattern: `src/lib/booking/booking-window-settings.ts`'s `getPublicBookingWindow` (lines 34-59) already reads `business_settings` through `unstable_cache`, key `["public-booking-window"]`, `revalidate: 60`, tag `TAGS.SETTINGS` (`src/lib/cache/tag-taxonomy.ts:20`) — the exact tag `settings/actions.ts:112` already invalidates on save, so cache correctness is free. It uses the admin client (no `cookies()`, so `unstable_cache` stays legal) and fails safe to `null`.

**Prop path — traced hop by hop, confirmed mechanical but with one correction.**
1. `src/app/(public)/layout.tsx:21` — `const bookingWindow = MAINTENANCE_MODE ? null : await getPublicBookingWindow();`
2. `src/app/(public)/layout.tsx:42-43` — props on `<BookingExperienceLoader bookingWindowDays={...} minimumNoticeHours={...} />` (the closing `/>` is line 44 — trivial, not worth tracking separately).
3. `src/features/booking/BookingExperienceLoader.tsx:23-26` destructures both; lines 89-93 pass them straight into `<BookingExperience>`.
4. `src/features/booking/BookingExperience.tsx` interface `BookingExperienceProps` (`:81-82`), destructure (`:86-88`), passed to `<AboutYouStep ... bookingWindowDays={...} minimumNoticeHours={...} />` (`:704-705`).

**Correction: this chain does not currently reach `AboutYouStep`.** `AboutYouStepProps` (`AboutYouStep.tsx:26-30`) is `{ form, prefilled, onClearPrefill }` only — `bookingWindowDays`/`minimumNoticeHours` pass through `BookingExperience` to the date-picker step, not to `AboutYouStep`. A new `freeTravelCities` (or similarly-named) prop is therefore the **first** prop `AboutYouStep` receives via this chain, not a continuation of an existing one for that specific component — mechanically identical to add, but don't go looking for existing `AboutYouStep` prop-plumbing; there isn't any yet.

⚠️ **The zod schema is a pure module and cannot fetch.** Once out-of-zone stops being rejected, the town list is needed only for *display* (in `AboutYouStep`), so it arrives as a prop there, and the schema's refine is deleted outright rather than parameterized.

**`AboutYouStep.tsx` — confirmed present in this plan (§8.8), but its Phase 2 vs Phase 5 split needs to be explicit, not implicit.** *(Corrected: an earlier audit pass called this file "completely absent from the plan." It is not — §8.8 names it and quotes its exact lines. The real, narrower gap is a sequencing one: §8.8's copy rewrite is written as Phase 5 content, but the prop-threading and the blocking behaviour it displays are Phase 2 content, and nothing said what `AboutYouStep` should show in between.)* Resolve it like this — Phase 2 does both of the following in the same commit as the gate removal, so there is no window where the UI still says something false:
- Remove the `BOOKING_ALLOWED_CITIES` import; derive `COVERED_TOWNS` (`:56-58`) from the new prop instead of the constant; `isCovered`/`isOutsideCoverage` (`:123-131`) read the prop the same way.
- The `isOutsideCoverage` block (`:520-528`) currently renders `styles.noticeError` (red) with *"Outside current home visit area: We currently cover Luton, Dunstable, Houghton Regis, Harpenden and St Albans. Use a covered town before choosing a time."* The **instruction to change the answer must go in Phase 2** — it is false the moment the gate is removed, regardless of whether the fee/origin copy is ready. Switch the notice to the same neutral treatment as the covered case (`:510-518`) with interim wording that does not depend on Phase 3/5 concepts, e.g. *"This address is outside our usual free-travel areas — it can still be booked."* **Phase 5 (§8.8) then finalizes the wording** to mention the travel charge and the mileage origin once those exist and the Owner has confirmed exact copy (see Stop conditions). Do not invent the final fee-mentioning copy in Phase 2.

**`ManualBookingForm.tsx` — add to Phase 2's file list; it independently reimplements the same check.** *(Confirmed genuinely absent from the plan until now — zero references to `isCityKnown` or `allowedCities` anywhere in the plan text before this draft.)* `isCityKnown` (`:1687-1693`) mirrors `create_booking_request`'s own predicate by design (see the file's own comment at `:1680-1684`), and renders a `role="alert"` red-text notice (`:1725-1729`): *"is outside our current service area. We deliver to: {allowedCities.join(", ")}."* Confirmed **non-blocking today** — `isCityKnown` has no `disabled` wiring anywhere in the file, only this JSX consumer. Required for Phase 2: reword the copy away from "outside our current service area" framing (it is no longer a rejection) and rename the doc comment at `:547-549`. The prop itself (`allowedCities`, `:529,550`) does not need renaming for Phase 2 — only its doc comment references the DB column name. **Do not wire a `disabled` gate here** — that is Owner decision #5 ("hide the confirm chip when a fee is needed"), which is Phase 3+ territory once `travel_fee` exists.

**`booking-schema.test.ts:39-47`** — *"rejects unsupported service areas before time selection"*, using `bookingLocationSchema` (wire point #1, confirmed by direct read). Invert it to assert success for the Manchester case; **this is the canonical proof the client gate is gone.**

---

### 8.5a Full blast radius — Phases 1–2

**Proven affected** (every reader of the town list, or of money fields the rename could silently break, that this phase must touch):
- The 12-file `allowed_cities` consumer list above (§8.4 table).
- `booking-schema.ts` (both wire points), `booking-schema.test.ts`.
- `AboutYouStep.tsx` + `AboutYouStep.test.tsx` (below).
- `ManualBookingForm.tsx` (copy only, this phase).
- `availability.ts`, `(public)/layout.tsx`, `BookingExperienceLoader.tsx`, `BookingExperience.tsx` (prop threading).
- `booking-window-settings.ts` or a sibling module built on its exact pattern, for the new cached fetch.

**Proven NOT affected** (checked explicitly, command shown, do not re-check by hand unless one of these commands' output changes):
- **`src/app/booking/manage/`** — the known shared-surface trap. `grep -rin "city|booking-schema|BOOKING_ALLOWED_CITIES|allowed_cities|travel_fee|mileage" src/app/booking/manage` → **zero matches** across `actions.ts`, `ManageBookingForms.tsx`, `page.tsx`. This directory does not import `booking-schema.ts` and has no city-gating logic. It becomes relevant only for Phase 3's travel-fee display, out of this phase's scope.
- **No generated Supabase types file exists in this repo.** `find . -iname "*database.types*" -o -iname "*supabase.types*"` (excluding `node_modules`) → zero results. Nothing to regenerate.
- **RPC callers of `create_booking_request` / `create_recurring_booking_series` are unaffected by the rename.** 11 files reference either function by name; of the 9 not already in the tables above (`recurring-actions.ts`, `admin/clients/[clientId]/page.tsx`, `cron/extend-recurring-horizons/route.ts`, plus 6 test files), `grep -l "allowed_cities"` across all 9 → zero matches, exit code 1. They call the RPC with named parameters (`p_city`, etc.), never by column name, so an internal column rename inside the function body cannot reach them.
- **e2e**: `grep -rn "allowed_cities|BOOKING_ALLOWED_CITIES|outside our current|Manchester|service area|isCityAllowed|isCityKnown" e2e` → one hit, `e2e/booking-public.spec.ts:7`, whose test body never enters a city or asserts on coverage copy (it only checks the step-2 heading renders). Its **name** becomes slightly misleading after this phase (no more "unsupported service area feedback" to show) — cosmetic, not a breakage, fix opportunistically or leave for a docs pass.
- **Item 7 (admin colour/contrast)**: no file-level collision with any file in this phase, confirmed by grep — except `SettingsForm.tsx`, which Item 7's per-area literal sweep may independently touch for unrelated `className` literals. Coordinate on that one file if both are in flight at once; it is a merge-adjacency risk, not a semantic conflict.
- **Items 1–6**: none reference `business_settings`, `booking-schema.ts`, `availability.ts`, `AboutYouStep.tsx`, `SettingsForm.tsx`, `settings/actions.ts`, or `ManualBookingForm.tsx`.

---

### 8.5b Ordering and prerequisites vs. the other items — Phases 1–2

- Within Item 8: **Phase 1 before Phase 2**, always — Phase 2 reads `free_travel_cities`, which Migration A creates.
- Within Migration A/B: rename column before the SQL-gate `create or replace`, since the gate rewrite references `v_settings.free_travel_cities`.
- Relative to the rest of the plan: Items 1–6 have zero file overlap with Phase 1–2. Item 7 shares only `SettingsForm.tsx`, and only incidentally (unrelated literal colours) — no ordering dependency, just a merge-adjacency note.
- Relative to Item 8's own later phases: Phase 3 (the fee itself, `bookings.travel_fee`) and Phase 5 (final customer/admin copy, emails) both build on Phase 2's prop and gate removal — they cannot start before Phase 2 lands. The plan's top-level table currently runs Item 7 before Item 8; that ordering defect is tracked at the plan's cross-cutting-facts level and does not change anything inside Phase 1–2 itself.

---

### 8.5c Tests to add — Phases 1–2

All in existing files/directories, following this repo's established conventions (component → sibling `.test.tsx`; schema/lib module → co-located or `__tests__/`).

1. **`src/features/booking/schemas/booking-schema.test.ts`** — invert the existing Manchester case: rename or rewrite the `it()` currently titled `"rejects unsupported service areas before time selection"` to `"accepts an out-of-zone city and lets the customer continue to time selection"`, asserting `bookingLocationSchema.safeParse(...)` now returns `success: true` for Manchester. Confirmed this test currently calls `bookingLocationSchema` (wire point #1), so the assertion must exercise that same export, not `bookingDetailsSchema`.
2. **`src/features/booking/schemas/booking-schema.test.ts`** — new: `it("no longer exports BOOKING_ALLOWED_CITIES or a service-area refine")`, or equivalent — a lightweight anti-drift guard (same idiom as `src/content/site/__tests__/canonical-domain.test.ts`) so a future edit can't silently reintroduce the gate.
3. **`src/features/booking/components/AboutYouStep.test.tsx`** — update the harness (`renderStep`, lines 99-119) to pass the new prop (e.g. `freeTravelCities`) with a sensible default so `COVERED_TOWNS` doesn't render empty for every existing assertion.
4. **`src/features/booking/components/AboutYouStep.test.tsx`** — rewrite the assertion in `"fills address, city, area and postcode from one confirmed selection, and the covered-area notice follows"` (currently asserts `screen.getByText("Covered area:")`, line 201) only if the covered-case label text changes; otherwise leave it — confirm against the final copy.
5. **`src/features/booking/components/AboutYouStep.test.tsx`** — rename and rewrite `"surfaces the outside-coverage notice when the selected address is out of area"` (lines 263-280) to something like `"surfaces an informational (not blocking) notice when the selected address is out of area"`, asserting the new neutral copy renders and that the old red-alert framing ("Use a covered town before choosing a time") does **not**.
6. **`src/features/booking/components/AboutYouStep.test.tsx`** — refresh the two stale inline comments (lines 192-193, 275-276) that describe "the About → Time hard gate" as still-blocking; they become factually wrong once Phase 2 lands.
7. **`src/lib/booking/availability.test.ts`** (co-locate next to `availability.ts`, following the module's existing test file if one exists, else new file per convention) — `it("returns slots for a city outside the free-travel list instead of an empty result")`, replacing whatever test currently exercises the old rejecting behaviour of `loadContextRest`'s city check, if one exists (check first — none was found by symbol search at the time of this audit, so this may be a net-new test rather than a rewrite).
8. **`src/lib/booking/__tests__/availability-options.test.ts`, `working-hours-segments.test.ts`, `override-windows.test.ts`, `staff-recurring-windows.test.ts`** — rename the mock fixture key from `allowed_cities` to `free_travel_cities` in all four (lines 49, 288, 84+379, 70 respectively). No new assertions required — these are pass-through fixtures — but confirm each file's existing tests still pass after the rename, since a missed rename fails silently (see §8.4).
9. **`src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`** — update line 83's `data.set(...)` key to `free_travel_cities`. **Required**, because the Owner decided on 2026-08-11 to rename the HTML form field (§8.4). If this is missed, the "at least one free-travel area" validation never sees a value and the test fails in a way that looks like a broken validator.
10. **`src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`** — new: `it("rejects a mileage-origin change from an Admin, but still saves the Admin's other edits")` and `it("allows an Admin to resubmit the form with the mileage origin unchanged")` — the two partial-save edge cases the plan calls out explicitly.
11. **`src/app/admin/settings/__tests__/updateBusinessSettings.test.ts`** — new: `it("allows the Owner to change the mileage origin")`.

---

### 8.5d Per-batch verification — Phases 1–2

**After Phase 1 (settings + permission, before touching any gate):**
```
npx tsc --noEmit
npx vitest run src/app/admin/settings
```
MUST stay at: `tsc` → 0. `pnpm lint` baseline (59 errors / 7 warnings, same six files) must not move — no Phase-1 file is one of the six.

**Live re-check, immediately before writing Migration B (re-run, don't trust the numbers already in this document):**
```sql
SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%';   -- must still be exactly 1 row: create_booking_request
SELECT * FROM pg_policies WHERE qual ILIKE '%allowed_cities%' OR with_check ILIKE '%allowed_cities%';  -- must still be 0 rows
```
If either has changed, stop — the migration's blast radius has grown since this document was written.

**After Phase 2 (gate removal + prop threading + UI rewrite):**
```
npx tsc --noEmit
npx vitest run src/features/booking src/lib/booking src/app/admin/bookings/new
npx eslint src/features/booking/BookingExperience.tsx src/features/booking/BookingExperienceLoader.tsx src/features/booking/utils/returning-customer.ts
```
- `tsc` MUST stay at 0.
- The Manchester assertion in `booking-schema.test.ts` MUST flip from failing-to-parse to `success: true`.
- The 4 `src/lib/booking/__tests__/*.test.ts` fixtures MUST still pass using the renamed key.
- `AboutYouStep.test.tsx`'s coverage-copy assertions MUST match the new copy, not the old one.
- The `eslint` spot-check MUST still report exactly 4 errors / 1 warning, at the same five locations (lines 201, 253/386, 340 in `BookingExperience.tsx`; 34 in `BookingExperienceLoader.tsx`; 61 in `returning-customer.ts`) — any different location means prop-threading touched more than intended. This is a real risk worth naming precisely: `BookingExperience.tsx`/`BookingExperienceLoader.tsx` are two of the six files carrying the plan's whole-repo lint baseline, and Item 8's own edits to `SettingsForm.tsx`/`BookingManagementForm.tsx` elsewhere in the plan already shift line numbers for other files' baseline errors — compare this spot-check by the **{file, ruleId} multiset**, not by line number, consistent with the plan's stated lint-identity rule.
- `pnpm lint` full-repo baseline (59/7) must not move.
- `node scripts/measure-admin-contrast.mjs .` — unrelated to this phase; run once to confirm a no-op diff, not as a required gate (the script exits 0 regardless of failure count unless `--max-failures` is passed).

---

### 8.5e Stop conditions — Phases 1–2

1. `pg_proc` shows a second function referencing `allowed_cities` when re-probed before Migration B — the SQL migration's shape has changed since this document was written.
2. `tsc --noEmit` is non-zero after any Phase-1 or Phase-2 edit — the rename touched a consumer not in the 12-file list above.
3. `pnpm lint` moves off 59/7, or the targeted eslint spot-check reports a violation at a line other than the five named above — something touched a lint-baseline file beyond pure prop-threading.
4. Before writing `AboutYouStep.tsx`'s Phase 5 final copy (the version that names the travel charge and the mileage origin): confirm exact wording with the Owner. This is customer-facing text the plan has never specified verbatim — do not invent it unilaterally. (Phase 2's interim neutral copy is not subject to this — it only needs to stop being false, not be final.)
5. The live `business_settings` row's `allowed_cities` value has changed from `["Luton","Dunstable"]` since this document was written — not itself a stop condition, but re-snapshot before Migration A so the rollback record stays accurate.

---

### 8.5f Rollback — Phases 1–2

Nothing in Phase 1–2 is irreversible.

- **Migration A** (column rename + `mileage_origin` add): metadata-only, instant, no data loss. Rollback: `alter table business_settings drop column mileage_origin; alter table business_settings rename column free_travel_cities to allowed_cities;`
- **Migration B, permission half**: two pure-addition rows. Rollback: `delete from role_permissions where permission_id = (select id from permissions where name = 'manage_travel_origin'); delete from permissions where name = 'manage_travel_origin';`
- **Migration B, SQL-gate half**: `create or replace function` back to the current (pre-Item-8) `create_booking_request` body, preserved verbatim in the live `20260727120000_c06_client_crud_hardening.sql`. Never edit the applied historical file — reapply its body as a new migration if rollback is needed.
- **Rollback ordering, if both migrations must be undone**: Migration B first (drop the permission, restore the raising function — the restored body references `free_travel_cities`, which must still exist at that point), **then** Migration A. Reversing that order leaves the restored `create_booking_request` referencing a column that no longer exists.
- **TS/TSX edits**: standard `git revert` of the Phase 1/2 commits. Nothing here reads or writes production data.

*§8.6–§8.14 were re-verified against the live schema and current source on 2026-08-11; anchors are stated as file:line **as of that date** — re-locate every symbol before editing, don't trust the number.*

### 8.6 Phase 3 — The fee on a single booking

**Schema.** `bookings.total_price` is `numeric(10,2)`; `amount_due` and `amount_paid` are bare `numeric`
with **no scale constraint** — nothing stops either column from silently accumulating more than 2 decimal
places once application code starts computing them, which Phase 3 is the first thing to do. `amount_paid`
is `not null default 0`; the other two are nullable. No rounding helper exists anywhere in this codebase —
`amount()` (`reporting.ts:735`), `toAmount()` (`customer-manage.ts:150`), `toNumber()`
(`client-metrics.ts:109`) are all a bare `Number(value ?? 0)`. Phase 3 must introduce its own rounding
discipline (below); do not assume float subtraction is safe.

**Storage.** `bookings.travel_fee numeric(10,2) not null default 0` — new column, new migration, matching
`total_price`'s existing precision rather than `amount_due`'s unscaled convention (that convention is a
pre-existing gap, not a pattern worth propagating).

```sql
-- supabase/migrations/<timestamp>_item8_bookings_travel_fee.sql
alter table public.bookings add column travel_fee numeric(10,2) not null default 0;
```

Rollback: `alter table public.bookings drop column travel_fee;` — additive, `not null default 0`, no
rewrite of existing rows, zero effect on any existing `total_price`/`amount_due` value. Nothing about this
migration is irreversible.

**The fee is written as a delta, in integer pence, in application code — not in floating-point pounds:**

```ts
const toPence = (v: number | string | null) => Math.round(Number(v ?? 0) * 100);
const newTotalPence = toPence(beforeState.total_price) - toPence(beforeState.travel_fee) + toPence(newFeeInput);
const newTotal = newTotalPence / 100;
// identical arithmetic, same oldFee/newFee pair, for amount_due
```

Plain float subtraction (`45.30 - 14.30 + 20.10`) can yield `51.099999999999994` in JS; `total_price` would
survive because Postgres rounds `numeric(10,2)` on write, but `amount_due` (unscaled) would not, and the
two columns could silently diverge by a fraction of a penny. Factor this pence-delta helper out as a
standalone function — Phase 4's series action and the cron both need the identical arithmetic; do not
duplicate it.

**Why folding into `total_price`/`amount_due` (rather than storing the fee separately and summing at read
time) is the decisive design call — extend the fee column ONLY as a delta, never leave it to be summed by
a reader.** `travel_fee` is retained on the row solely so the UI and emails can print a labelled line; it
is not itself the number any balance/revenue calculation reads.

**Symbols to edit** — every anchor below is "currently at", re-locate by symbol before touching it:

| Symbol | Currently at | Change |
|---|---|---|
| `updateBookingManagement` | `src/app/admin/bookings/actions.ts:284` (function open) | add `travel_fee` parsing; add the completed/fully-paid lock (new logic — no existing precedent in this function does a payment-field guard; the closest analogue to copy the *shape* of, not the content, is `isCompletedReversal` at `_helpers.ts:148`, which gates a status transition, not a field edit) |
| `payload` object | `actions.ts:417–455` | extend with delta-computed `total_price`/`amount_due` via the pence-rounding helper above |
| `canManageAllBookings` gate | `actions.ts:290`, permission defined `rbac.ts:86–88` (`MANAGE_BOOKINGS_ALL`) | unchanged — already this action's gate, reuse it, don't add a second one |
| audit row insert | `actions.ts:500–526`, `action_type: "booking_management_updated"` | unchanged — already registered in `src/app/admin/audit/format.ts:24`; no new registration needed for the single-booking fee write |
| `getBookingDetailData` | `src/app/admin/bookings/[bookingId]/booking-detail-data.ts:330` | **currently fetches no `business_settings` / town list at all** (grep-confirmed, zero hits outside the function declaration) — add the free-travel town-list read here, or the alert in the next row has nothing to render against |
| `StatusAndPaymentSection` | `src/app/admin/bookings/BookingManagementForm.tsx:689–938` | add the travel-fee input and the outside-zone alert |
| `AmountPaidInput` | `BookingManagementForm.tsx:443–515` | pattern to mirror exactly for the new travel-fee input: £ prefix, live state, and the `total > 0` preview idiom at line 491 (`{total > 0 ? (` — "Match total · £X" quick-fill) |
| `QUICK_ACTIONS` (`confirm` entry) | `BookingManagementForm.tsx:336` (array opens 336, runs to 372 across 4 actions; the `confirm` entry is the first) | consumed at `:784`; gating logic lands here for the bypass close, below |
| `total` variable | `BookingManagementForm.tsx:696`, `const total = Number(booking.total_price ?? 0);` | read by the new input's preview |
| `quickUpdateBooking` | `actions.ts:732` (function open, body runs to ~909) | **not edited for the fee** — see bypass note below |
| confirm branch | `actions.ts:777–778`, `action === "confirm" ? { status: "confirmed" as BookingStatus }` | payload has no `travel_fee` field and none is added — this is why the chip must be hidden, not made fee-aware |

**The completed/fully-paid lock, specified precisely (Owner-decided, this is the implementation of that
decision, not a new one):**

- **Locked when** `status = 'completed'` **or** `amount_paid >= amount_due` with `amount_due > 0`.
- **Not locked when** `cancelled` — assert this explicitly in a test (§8.10) so a later reader doesn't
  "fix" it into a blanket lock.
- Reject **server-side**, in the action, not just by disabling the input. Return a field-level error
  (e.g. *"This booking is completed — the travel charge can no longer be changed."*), never a thrown 500.
- Enforce **only when** `newTravelFee !== beforeState.travel_fee` — an unchanged fee submitted alongside
  another edit (e.g. a payment note) on a completed booking must still succeed.
- Evaluate the lock against the booking's state **before this submit** — setting the fee and marking it
  paid in the same save must be allowed; the guard must not block its own natural flow.

**Close the bypass.** `QUICK_ACTIONS`'s `confirm` chip → `quickUpdateBooking`'s `confirm` branch
(`actions.ts:777–778`) confirms and sends the confirmation email with **no form fields at all** — verified
by reading the full function body, not assumed. This path cannot become fee-aware because it has no fee
input to fold in. **Hide the chip** when the booking's address is outside the free-travel zone and
`travel_fee = 0`. This is the only correct fix given the current code; making the one-click action
fee-aware would require inventing a fee prompt inside a quick-action, which does not exist anywhere else
in this UI.

**Email timing — verified, not assumed.** In `updateBookingManagement`, `.update(payload)` fires at
`actions.ts:457–462`; the confirmation email (`sendBookingConfirmedClientEmail`) fires at `:561–565`,
strictly after, in the same request, gated by `beforeState.status === "pending" && data.status ===
"confirmed"`. The email's own data comes from a **fresh** `SELECT` via `getBookingTemplateInput`, not a
reuse of `data` — so once `travel_fee` is in `payload`, the confirmation email will read the fee-inclusive
row automatically. `quickUpdateBooking`'s second confirm path (`:893–898`) has the identical guard shape —
gate that path by hiding the chip, not by adding fee logic to it.

**Blast radius — every reader of `total_price`/`amount_due`, verified by direct read, none summing:**

Command used: `grep -rn "total_price\|amount_due" src --include=*.ts --include=*.tsx | grep -v __tests__
| grep -v "\.test\.t"`, then every hit opened and classified. **17 genuine production readers**, all flat
scalar reads — folding the fee in makes every one of them correct with **zero code changes**:

| # | Site | What it does |
|---|---|---|
| 1 | `nav-notifications.ts:287` | `Number(amount_due) - Number(amount_paid)` |
| 2 | `reporting.ts` `summarizeReports` (402–480, esp. 413–450) | 6 flat accumulators |
| 3 | `reporting.ts` `getRevenueSeries` (499–518) | 3 flat accumulators |
| 4 | `actions.ts:764,783` — `quickUpdateBooking` `mark_paid` | flat read |
| 5 | `reporting.ts` `getNetCollectionRate` (1313–1323) | flat read |
| 6 | `reporting.ts` `getAvgBookingValue` (1329–1338) | flat read |
| 7 | `client-metrics.ts:73,84` | LTV, average booking value |
| 8 | `dashboard-data.ts:75,597` | select + conditional pass-through |
| 9 | `export/route.ts:70–86,104,155` | CSV export |
| 10 | `customer-manage.ts:206` | flat read (**/booking/manage** — see below) |
| 11 | `booking/manage/page.tsx:227`, `Row label="Total"` | flat read (**/booking/manage**) |
| 12 | `BookingCard.tsx:229–230,436–437` | display |
| 13 | `[bookingId]/page.tsx:1439,1458`, `BookingDetailSidebar.tsx:141` | display |
| 14 | `reporting.ts` `getNoShowRate` (1232–1254), `lostRevenue += amount(booking.total_price)` at 1245, 1248 | flat read |
| 15 | `reporting.ts` `getSourceAttribution` (1287–1307), line 1293 | flat read |
| 16 | `clients-list-data.ts:313` — `current.outstanding += Math.max(0, due - paid)` | flat read |
| 17 | `admin/clients/[clientId]/page.tsx:1674`, `{formatMoney(booking.total_price)}` | display |

*Correction: an earlier pass of this section cited "at least 15 read sites"; direct enumeration finds 17.
Rows 14–17 (two `reporting.ts` functions, the clients-list outstanding accumulator, and the client-detail
page's booking row) were previously unlisted. The design conclusion is unchanged — none of the 17 sums a
sub-component or re-derives from `booking_items` — but an implementer sweeping "every reader" (§8.9B) must
check against this list of 17, not the old count of ~15.*

**Proven NOT affected — `booking_items` / `service_price_snapshot` readers.** Command: read
`reporting.ts:534–547` (`getServicePerformance`) and `:566–588` (`getStaffRevenueAttribution`) directly.
Both iterate `data.bookingItems` and accumulate `amount(item.service_price_snapshot)` — never
`total_price`/`amount_due`. `client-metrics.ts` `preferredService` (`:76–79`) is the same shape. **⛔ Never
put the fee in `booking_items`** — a fee row would have no valid `service_id` (an FK a mileage charge
cannot satisfy) and would corrupt per-service/per-therapist analytics with a fake service line.

**Proven NOT affected — the public/customer site.** `grep -rn "total_price|amount_due|travel_fee"
src/app/(public)` returns zero matches (re-run 2026-08-11). Marketing and area pages carry no money
reference of any kind; Phase 3 (and Phase 5, below) touch only `src/features/booking/**` — the booking
*flow*, which is customer-facing but not the marketing site.

**`/booking/manage`, checked by name.** `customer-manage.ts:206` and `booking/manage/page.tsx:227` (row 10
and 11 above) are flat reads — numerically correct automatically once the fee is folded in, zero edits
required for correctness. `ManageBookingForms.tsx` itself has **zero** direct `total_price`/`amount_due`
references (re-checked 2026-08-11) — it consumes the already-computed total via `customer-manage.ts`.
`badge.tsx`, this route's only styled-component import with zero admin exposure, is untouched — nothing in
Phase 3–5 imports or edits it. The only planned edit to this route is Phase 5's optional line-item-split
copy (below); it is copy-only and does not change what number is displayed.

**Ordering and collisions.**
- Phase 3 has no hard technical dependency on Phases 1–2 (the free-travel gate removal) — the `travel_fee`
  column and write path can ship independently. But shipping it before Phase 2 makes out-of-area bookings
  possible means the field exists with no real trigger case; the recommended sequence is still 1→2→3,
  not required except where §8.8 states otherwise (chip-gating must land with Phase 3, see below).
- `src/app/admin/bookings/actions.ts`, `BookingManagementForm.tsx`, `bookings/[bookingId]/page.tsx`, and
  `SeriesActions.tsx` are also touched by **item 7** (admin colour/contrast tokens). Item 7's edits are
  `className`/token substitutions only; item 8's are new fields/logic — file-level overlap, not
  logic-level. Per the plan's global ordering note, item 7 runs **after** items 3/6 land and should also
  run after item 8's Phase 3 UI ships, so item 7 tokenises against the final markup rather than needing a
  second pass.
- `src/app/admin/bookings/new/ManualBookingForm.tsx` also collides with item 7 (57 oklch lines) but is
  **not** touched by Phase 3 — Phase 3 only reaches `BookingManagementForm.tsx` (the existing-booking edit
  form), not `ManualBookingForm.tsx` (new-booking creation). Confirm this stays true: if a travel-fee field
  is ever added to manual-booking creation, it becomes a second collision with item 7 on that file too.

**Verification for this batch — exact commands:**
```
npx tsc --noEmit                                                          # must stay 0
npx vitest run src/app/admin/bookings/__tests__/updateBookingManagement-completed-guard.test.ts
                                                                            # baseline: exact file, currently exists
npx vitest run                                                             # full suite — total MUST still be
                                                                            # exactly the baseline 5 failed / 2236 passed
                                                                            # PLUS the new tests below, all passing.
                                                                            # A 6th ManualBookingForm timeout under
                                                                            # full-suite load is the documented flake —
                                                                            # re-run that file alone to confirm 3/33/36.
pnpm lint                                                                  # MUST still be exactly the six-file
                                                                            # {file, ruleId} multiset. actions.ts and
                                                                            # BookingManagementForm.tsx are NOT in that
                                                                            # baseline — if either gains a lint error,
                                                                            # that is a 7th file and a REGRESSION, stop.
git status --porcelain -- src/ supabase/                                  # shows exactly this batch's files
                                                                            # (actions.ts, booking-detail-data.ts,
                                                                            # BookingManagementForm.tsx, the new
                                                                            # migration, the new/extended test files)
                                                                            # plus the pre-existing M src/lib/maintenance.ts
                                                                            # — nothing else.
```
Numbers that **must move**: vitest total test count (new tests added), migration file count in
`supabase/migrations/`. Numbers that **must not move**: `tsc` exit code, the six-file lint identity, the
five pre-existing vitest failures (same tests, same names).

---

### 8.7 Phase 4 — Recurring series: the charge must repeat

**Verified problem.** `recurring_booking_templates` has **26 columns** and **zero money columns** —
re-confirmed live via `information_schema.columns` on 2026-08-11 (id, client_id, service_id,
bound_therapist_id, open_to_any_therapist, anchor_day_of_week, anchor_day_of_month, anchor_start_time,
total_duration_mins, participant_gender, required_therapist_gender, cadence, end_type, end_count, end_date,
service_address_line1, service_postcode, service_city, service_area, created_by, created_at, cancelled_at,
cancelled_by, cancelled_reason, horizon_through_date, notes — 26 by hand-count). *Correction: an earlier
pass of this section stated 24 columns; the live count is 26. The substantive claim — no money column of
any kind — is unaffected and re-confirmed.* The template stores the address but nothing about price.

The horizon cron rebuilds every future occurrence from scratch, `extend-recurring-horizons/route.ts:406–433`
(re-verified line-exact 2026-08-11):
```ts
total_price: service.price,   // line 419
amount_due: service.price,    // line 420
amount_paid: 0,
group_booking: false,          // line 425 — no participant multiply on this path, confirmed
```
So a fee set on occurrence #1 of a standing out-of-area series silently vanishes from every occurrence
thereafter, even though the address — and the reason for the charge — is unchanged.

**Three live writers of a `bookings` row exist, confirmed by grep across all migrations plus a multiline
grep for `.from("bookings")…insert(` across `src/`, no fourth found:**
1. `create_booking_request` (SQL, live definition `c06…sql`) — single/group bookings, multiplies by
   participant count.
2. `create_recurring_booking_series` (SQL, `20260802122636_c02_recurring_bookings.sql:784–829`) — first
   materialised batch, `group_booking: false` (~line 823), no multiply.
3. `extend-recurring-horizons/route.ts:406–433` (TS, the daily cron) — no multiply.

**Design — the template carries the standing charge:**

1. `recurring_booking_templates.travel_fee numeric(10,2) not null default 0` — new migration.
2. The cron adds it: `total_price: service.price + template.travel_fee`, same for `amount_due`
   (`route.ts:419–420`). Verify `travel_fee` is included in whatever upstream `select` populates `template`
   before editing these two lines — it currently is not, since the column doesn't exist yet.
3. `create_recurring_booking_series` must accept and apply the same fee for the first materialised batch.
   **Do not edit `20260802122636_c02_recurring_bookings.sql` in place** — this repo's own convention (three
   successive `CREATE OR REPLACE FUNCTION create_booking_request` definitions across migration history) is
   to replace a function's body via a **new** migration, never edit a historical one. This is a **second**
   migration for this phase (`CREATE OR REPLACE FUNCTION create_recurring_booking_series(..., p_travel_fee
   numeric default 0)`), adding the parameter and applying it to `v_service.price` at the two `VALUES` price
   lines (currently ~817–818).
4. **Setting the series fee must also update already-materialised future occurrences.** The cron creates a
   batch ahead (12 weekly / 6 fortnightly / 3 monthly), so those bookings already exist by the time an
   admin sets or changes the series fee. Apply the same delta to occurrences where `status IN
   ('pending','confirmed')` **and** `booking_date >= today`. Never touch past, completed, or cancelled
   occurrences — they are financial history.
5. Per-occurrence override remains possible for free: the template fee is the default for occurrences not
   yet created; a fee set on an individual booking (§8.6) is the actual for that visit.

*Correction to the effort table (§8.12): Phase 4 needs **2 migrations**, not 1 — the `travel_fee` column
plus the `CREATE OR REPLACE FUNCTION` for `create_recurring_booking_series`. This also means item 8's
total migration count across all five phases is **6** (Phase 1: 2, Phase 2: 1, Phase 3: 1, Phase 4: 2,
Phase 5: 0), not the "4 migrations" figure the previous revision quoted. §10 and §0.1 are corrected to match.*

**Series-level control — Owner-decided, on `/admin/bookings/series/[templateId]`.** This page exists
(`page.tsx`, 544 lines) and its `TEMPLATE_SELECT` (lines 48–71) selects no money column, consistent with
§8.7's schema finding. **A concrete trap:** `SeriesActions.tsx` already has an "Edit series" button
(lines 87–95) that is `disabled`, with copy directly beneath it (lines 160–164): *"Editing isn't available
yet for repeat visits. Cancel this series and create a new one if cadence, address, or therapist need to
change."* `recurring-actions.ts` has exactly two exported actions today — `createRecurringSeries` (93) and
`cancelRecurringSeries` (237) — **no edit/update action exists**. **Do not extend the disabled "Edit
series" button** — its own copy scopes it to cadence/address/therapist, not price. Build:
- a **new** server action in `recurring-actions.ts` (e.g. `setSeriesTravelFee`), mirroring
  `cancelRecurringSeries`'s shape: same auth gate (`getStaffProfile` → `actor.active &&
  canManageAllBookings(actor)`), same template-update idempotency style, same hand-built audit row (no RPC
  on this path), same revalidate/updateTag footer;
- a **new**, separate UI panel (e.g. "Travel charge", between "Schedule" and "Client", or folded into
  "Actions") backed by a **new** sibling client component (e.g. `SeriesTravelChargeForm.tsx`, alongside
  `SeriesActions.tsx`), not an extension of the disabled button.

**The fully-paid skip cannot be expressed as a single PostgREST filter — this is the part most likely to
be gotten wrong.** `cancelRecurringSeries`'s own filter (`status IN ('pending','confirmed')`) is a complete
lock for cancellation, but the fee lock also needs `amount_paid >= amount_due`, and PostgREST compares a
column to a **literal**, not to another column — there is no `.filter("amount_paid", "lt", "amount_due")`
that works column-to-column through the JS client. Use this two-step shape:
1. `SELECT id, amount_due, amount_paid, status FROM bookings WHERE recurring_template_id = $1 AND status
   IN ('pending','confirmed') AND booking_date >= $2` — fetch candidates.
2. Partition in application code: `toUpdate = candidates.filter(b => Number(b.amount_paid) <
   Number(b.amount_due))`; the rest are `skipped`.
3. `UPDATE bookings SET total_price = total_price - $oldFee + $newFee, amount_due = amount_due - $oldFee +
   $newFee WHERE id IN (toUpdate.map(b => b.id))` — using the same pence-rounding helper from §8.6.
4. Report `{ updated: toUpdate.length, skipped: candidates.length - toUpdate.length }`, matching how
   `cancelRecurringSeries` already reports `cancelledOccurrenceCount`.

**Audit registration.** `booking_management_updated` (Phase 3's action type) is already registered in
`src/app/admin/audit/format.ts:24`. `recurring_series_cancelled` — the action type `cancelRecurringSeries`
already writes today for a shipped feature — is **not** registered anywhere in `format.ts`. Its fallback
(`describeAction`, lines 100–110) renders it as a readable phrase (`actionType.replace(/_/g, " ")`, not
blank) but mis-files it into family `operations_and_email` (should be `bookings_and_assignments`) with chip
tone `"none"`. *Correction: "unlabelled" was the wrong description in an earlier pass — the fallback is
readable-but-miscategorised, not blank.* This is a pre-existing, out-of-scope defect worth a one-line
footnote; the **new** series-fee action type (e.g. `recurring_series_travel_fee_updated`) must be
registered in `format.ts` with the correct family and chip so it doesn't inherit the same miscategorisation.

**Symbols to edit** — re-locate by symbol:

| Symbol | Currently at |
|---|---|
| Cron occurrence-build block | `src/app/api/cron/extend-recurring-horizons/route.ts:406–433`, price lines `:419–420`, `group_booking: false` at `:425` |
| `create_recurring_booking_series` price snapshot | `supabase/migrations/20260802122636_c02_recurring_bookings.sql`, INSERT column list opens `:784`, price VALUES `~:817–818` — **do not edit this file; replace via new migration** |
| `SeriesActions.tsx` disabled edit button | `:87–95`, explanatory copy `:160–164` |
| `recurring-actions.ts` exports | `createRecurringSeries` at `:93`, `cancelRecurringSeries` at `:237` |
| `TEMPLATE_SELECT` | `series/[templateId]/page.tsx:48–71` |
| `format.ts` action-type map | `booking_management_updated` registered `:24`; `recurring_series_cancelled` absent; `describeAction` fallback `:100–110` |

**Blast radius.** New surface, not an existing one — the risk is *omission* (a caller that still writes
occurrences without the fee), not corruption of an existing reader. Proven exhaustive: the three-writer
grep above is the complete list; nothing else creates a `bookings` row. Proven NOT affected: none of the
17 read sites in §8.6 change behaviour for Phase 4 — they read the row's `total_price`/`amount_due`
regardless of whether those values came from a single booking or a recurring occurrence.

**Verification for this batch:**
```
npx tsc --noEmit
npx vitest run src/app/api/cron/__tests__/extend-recurring-horizons.test.ts   # existing file
npx vitest run src/app/admin/bookings/__tests__/cancelRecurringSeries.test.ts # existing file — mirror shape
npx vitest run src/app/admin/bookings/__tests__/createRecurringSeries.test.ts # existing file — p_travel_fee param
npx vitest run                                                                 # full suite, same rule as Phase 3
pnpm lint                                                                       # same six-file identity check
git status --porcelain -- src/ supabase/                                      # this batch's files only, plus maintenance.ts
```

---

### 8.8 Phase 5 — Telling everyone, consistently

**Customer, before sending the request** — `src/features/booking/components/AboutYouStep.tsx`.
`COVERED_TOWNS` (`:56–58`) and `isCovered`/`isOutsideCoverage` (`isCovered` `:125–130`, `isOutsideCoverage`
`:131`) must read the **live** free-travel list (threaded in Phase 2), not the hardcoded constant. The
outside-coverage notice (`:520–529`) currently reads, verbatim:

> **Outside current home visit area:** We currently cover Luton, Dunstable, Houghton Regis, Harpenden and
> St Albans. Use a covered town before choosing a time.

This is a **command to pick a different town**, which becomes actively wrong once out-of-zone is bookable
— it needs full replacement, not a tone change. Restyle it as informational (the same treatment as the
covered notice at `:510–518`, not `styles.noticeError`), reading roughly: *"This address is outside our
free-travel areas. A travel charge applies, measured from {origin}. We'll confirm the exact amount before
your booking is confirmed."*

**A required checkbox the earlier pass of this plan did not name** —
`src/features/booking/components/ConfirmStep.tsx:232–236`, inside the required `paymentAcknowledged`
checkbox (block `:225–243`):

> I understand payment is taken in person by cash or card and the amount due is based on the selected
> service and participant count.

Once a travel fee can apply, this is incomplete — it must become something like *"...based on the selected
service, participant count, and any travel charge for your area."* This is a **correction to existing
copy**, distinct from the "restate it plainly beside the existing payment reassurance" instruction (which
targets the `.reassurance` divs at `:266–280` and is *new* text) — both edits are needed, in the same file,
and are easy to conflate into just one.

**Admin, on the booking** — `BookingManagementForm.tsx`, `StatusAndPaymentSection` (`:689–938`). Add an
alert that the address is outside the free-travel zone (fed by `getBookingDetailData`'s new fetch, §8.6)
and a travel-fee input mirroring `AmountPaidInput` (§8.6). **This must land in the same commit/release as
Phase 3's fee field** — the bypass (`QUICK_ACTIONS` confirm chip) exists the instant the fee field ships
without the chip-gating, so Phase 5's chip-hiding cannot trail Phase 3.

**Emails — one shared renderer covers everything, once the fee is folded in.** `renderSummary`
(`templates.ts:243–259`, total at `:255–257`) is called from **13 sites** (grep-confirmed: 444, 470, 494,
517, 539, 560, 588, 612, 629, 1017, 1082, 1141, 1209). `renderBookingPlainText` (`:635–674`, total at `:668`)
is called from **9** production sites in `notifications.ts` (650, 671, 728, 750, 792, 981, 1003, 1040,
1065). **13 + 9 = 22 send sites, all numerically correct with zero email edits**, because both functions
read `input.totalPrice`, a value already inclusive of the fee once it's folded.

For a **labelled** *"Travel charge: £X"* line — recommended for transparency — the touch points are
**8, not 7**:

| # | Symbol | Currently at |
|---|---|---|
| 1 | `renderSummary` | `templates.ts:243–259` |
| 2 | `renderBookingPlainText` | `templates.ts:635–674` |
| 3 | `BookingEmailTemplateInput` interface | `templates.ts:16–30` |
| 4 | `buildVarMap` | `templates.ts:87–107` (function closes at 107; `totalPrice:` is at `:102`) |
| 5 | `BOOKING_EMAIL_SELECT` | `notifications.ts:123–138` — add `travel_fee` |
| 6 | `getBookingTemplateInput` | `notifications.ts:216–265`, total at `:255` — add `travelFee: Number(booking.travel_fee ?? 0)` |
| 7 | `SAMPLE_TEMPLATE_INPUT` | `sample-data.ts:46–67`, `totalPrice: 65` at `:53` — add a sibling `travelFee:` line |
| 8 | `BOOKING_SUMMARY_FIXED_PART` | `src/app/admin/emails/components/templates-data.ts:137–140` |

*Correction: the earlier pass of this section cited "7 spots" including `sample-data.ts:173`. Line 173 is
`renderBookingPlainText("Booking confirmation", SAMPLE_TEMPLATE_INPUT, overrides)` — a dispatch-table entry
that forwards the whole input object and needs **no edit**. The real touch point in that file is
`SAMPLE_TEMPLATE_INPUT` itself, lines 46–67 (row 7 above). Separately, `BOOKING_SUMMARY_FIXED_PART`
(row 8) was entirely missing from the earlier list: it's a shared constant reused by 13 template registry
entries (grep-confirmed lines 574, 593, 615, 647, 662, 675, 694, 713, 767, 781, 793, 812, 859 — the same 13
templates that call `renderSummary`) and reads *"Built from the booking's date, time, address and total
price."* — it drives the admin editor's "Filled automatically" panel and goes stale the moment a labelled
travel-charge line is added to the HTML it describes. Update it in the same commit.*

**⛔ Guardrail — where the labelled line must live.** `resolveTemplateOverrides` (`templates.ts:689–711`)
returns a `{field_key: value}` map consumed only by `substituteVars` against a fixed catalogue of
overridable `SafeField` kinds (`greeting_intro`, `body_intro`, etc. — see `templates-data.ts`'s header
comment, lines 22–24). **`renderSummary` and `renderBookingPlainText` are not on that list** — confirmed by
reading both bodies: they embed `formatMoney(input.totalPrice)` directly in a fixed HTML/text literal, not
through any override. **The travel-charge line must be added inside these fixed functions, never as a new
overridable `SafeField`.** If it were ever added as an overridable field instead — especially appended to
an *existing* field's default text (e.g. `greeting_intro`) — any template with a saved override on that
field would never render the new line, silently, because overrides replace the whole field's rendered
text. This risk does not materialise as long as the implementation follows this instruction; it is a stop
condition (below) if a future change proposes the alternative.

**The request-received email shows the pre-fee total — this is correct behaviour, reword don't refactor.**
`sendBookingCreatedEmails` (`notifications.ts:608–677`) sends at booking creation, before any admin action
can set `travel_fee` — verified: the fee only exists via `updateBookingManagement`'s payload, which
requires an existing row. The customer sees £45, then £59 on confirmation. This is lawful (a request, not a
contract) but reads badly — reword the request-received copy to say a travel charge will be confirmed,
rather than implying the total shown is final. No code change to the send timing.

**Customer's manage page** — `booking/manage/page.tsx:206–243`, `Row label="Total"` at `:227`, fed by
`customer-manage.ts:37,206`. Numerically correct automatically (§8.6); this phase adds the same line-item
split to explain *why*, copy-only.

**Symbols to edit, full list for this phase:**
`AboutYouStep.tsx` (`:56–58`, `:123–131`, `:520–529`) · `ConfirmStep.tsx` (`:232–236` **and** `:266–280`) ·
`booking-detail-data.ts` (`getBookingDetailData`, already listed under Phase 3) ·
`BookingManagementForm.tsx` (`StatusAndPaymentSection`, already listed under Phase 3) ·
`templates.ts` (`renderSummary`, `renderBookingPlainText`, `BookingEmailTemplateInput`, `buildVarMap`) ·
`notifications.ts` (`BOOKING_EMAIL_SELECT`, `getBookingTemplateInput`) · `sample-data.ts:46–67` ·
`templates-data.ts:137–140` · `customer-manage.ts` / `booking/manage/page.tsx:227` (copy-only).

**Blast radius — proven NOT affected.** Every `renderSummary`/`renderBookingPlainText` caller not in the
touch-point list (all 22 − the ones edited directly = the remaining call sites) needs **zero** changes,
because both functions are called with an `input` object built by the touch points above — editing the
function body and the input-builders is sufficient; the call sites themselves pass the object through
unchanged. Confirmed by reading both function signatures: neither takes a fee parameter separately from
`input`.

**Verification for this batch:**
```
npx tsc --noEmit
npx vitest run src/lib/email/__tests__/sendBookingConfirmedClientEmail.test.ts   # existing file
npx vitest run src/lib/email/__tests__/sample-data.test.ts                       # existing file, sample input shape
npx vitest run src/app/admin/bookings/BookingManagementForm.test.tsx             # existing file
npx vitest run                                                                    # full suite, same rule as Phase 3
pnpm lint
git status --porcelain -- src/ supabase/
```

---

### 8.9 Pre-implementation review — the sweep that must happen FIRST

**Do not start coding from §8.6–8.8 alone.** Their file:line references were re-verified 2026-08-11 and
this repo has repeatedly proven anchors drift. Run this review first and reconcile any difference before
the first edit.

**A.** Re-derive the enforcement map (Phases 1–2's three gates). Re-run
`SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` — if it returns anything besides
`create_booking_request`, **stop and re-plan**.

**B.** Enumerate every reader of `total_price`/`amount_due`, diff against the **17-site list in §8.6**
(not the earlier "~15" figure). Anything present in the code and absent from that list is a gap in the
plan — report it before proceeding.

**C.** Trace the money path end-to-end for one worked example: £45 service, 2 participants, £14 travel fee.
`v_total_price := 45 × 2 = 90` at creation (`create_booking_request`, one-time). The fee is then applied as
a delta on the already-multiplied stored value: `total_price = 90 − 0 + 14 = 104`. **Assert `total_price =
104`, not `(45 + 14) × 2 = 118`.** This holds only because the fee delta operates on `total_price` as
stored, never on a fresh `service_price × participant_count` recompute — no such recompute path exists
today (the only writers are the three in §8.7 plus the Phase-3/4 deltas), but if one is ever added, it must
add `travel_fee` strictly after the multiply. This example, with the pence-rounding rule from §8.6, belongs
in the test suite permanently (§8.10).

**D.** Audit every customer-facing statement about service area or travel charges, before changing
behaviour. The confirmed list: `AboutYouStep.tsx:520–529` (full replacement, not tone change),
`AboutYouStep.tsx:56–58`/`:123–131` (must read the live list), `ConfirmStep.tsx:232–236` (the payment
acknowledgement checkbox — **not the same edit** as the new restatement at `:266–280`), the
request-received email (`notifications.ts:608–677`, reword only), the manage page (copy-only).
Marketing/area pages are out of scope per the Owner — recorded so the omission is deliberate; several such
statements are already false today, independently of this work.

**E.** Confirm the email-timing guarantee still holds by reading both confirm paths at their current lines
(`actions.ts:561–565` and `:893–898`). If the send ever moves before the DB write, the design breaks
silently.

**F.** Verify the recurring cron's shape — whether it still bypasses the participant multiply
(`group_booking: false`), and whether any other writer creates occurrences (the three-writer grep in §8.7
is the check).

**G.** Record the live `business_settings` row before touching anything, so the semantic flip in Phases
1–2 can be reversed exactly. (Recorded already, 2026-08-11: `allowed_cities = ["Luton","Dunstable"]`.)

### 8.10 Tests and guards

**Guards against re-introducing the contradiction (Phases 1–2, unchanged from the existing plan):**
- A test that fails if a hardcoded town/city list appears under `src/features/booking/` or
  `src/lib/booking/`.
- A test asserting the public booking form's town list and `business_settings` agree.

**Named tests for Phases 3–5, each with its exact file:**

| Test (`it()` text) | File |
|---|---|
| `"folds the fee into total_price using (service × participants) + fee, not (service + fee) × participants"` | New: `src/app/admin/bookings/__tests__/updateBookingManagement-travelFee.test.ts` |
| `"rejects a travel-fee change on a completed booking"` | Extend `src/app/admin/bookings/__tests__/updateBookingManagement-completed-guard.test.ts` |
| `"rejects a travel-fee change on a fully-paid booking (amount_paid >= amount_due)"` | Same file |
| `"allows an unchanged travel fee submitted alongside another edit on a completed booking"` | Same file |
| `"allows setting the fee and marking the booking paid in the same save"` | Same file |
| `"does not lock the travel fee on a cancelled booking"` | Same file |
| `"tracks total_price and amount_due through set, change, and clear of a travel fee, and never moves amount_paid"` | `updateBookingManagement-travelFee.test.ts` |
| `"remains correct for outstanding balance and mark-paid after a fee is added to a part-paid booking"` | `updateBookingManagement-travelFee.test.ts` |
| `"hides the quick-confirm chip when the address is outside the free-travel zone and travel_fee is 0"` | `src/app/admin/bookings/BookingManagementForm.test.tsx` (existing file) |
| `"shows the quick-confirm chip when travel_fee is non-zero or the address is inside the zone"` | Same file |
| `"propagates the template's travel fee to newly generated occurrences"` | `src/app/api/cron/__tests__/extend-recurring-horizons.test.ts` (existing file) |
| `"applies a series travel-fee change to future pending/confirmed occurrences and skips completed or fully-paid ones, reporting both counts"` | New: `src/app/admin/bookings/__tests__/setSeriesTravelFee.test.ts`, mirroring `cancelRecurringSeries.test.ts`'s structure |
| `"never updates past, completed, or cancelled occurrences when the series fee changes"` | Same new file |
| `"applies p_travel_fee to the first materialised batch of a new series"` | Extend `src/app/admin/bookings/__tests__/createRecurringSeries.test.ts` (existing file) |
| `"sends the confirmation email with the fee-inclusive total"` (mailer mocked, no real sends) | Extend `src/lib/email/__tests__/sendBookingConfirmedClientEmail.test.ts` (existing file) |
| `"includes travelFee in the sample template input used for admin preview"` | Extend `src/lib/email/__tests__/sample-data.test.ts` (existing file) |
| `"parses and generates slots for an out-of-zone city (Manchester) instead of rejecting it"` | Rewrite the existing assertion in `booking-schema.test.ts:39–47` |

**Tests for the Owner-decided guards, each proving rather than assuming:**
- Owner-only mileage origin: Admin change rejected server-side; Owner change succeeds; Admin submitting the
  form with the origin *unchanged* still succeeds (the regression that would otherwise lock Admins out of
  settings entirely).
- Minimum one free-travel area: submitting an empty list fails with the reworded message.
- Series control: writing the series fee updates the template and future occurrences, skips
  completed/fully-paid ones without failing the batch, reports counts; a per-booking override still wins
  for that visit; the UI marks an inherited fee as coming from the series.
- Changing the free-travel list in settings changes the booking-page notice without a deploy (cache-tag
  invalidation, `TAGS.SETTINGS`, already proven to work for `getPublicBookingWindow`).

### 8.11 Non-goals and recorded decisions

Unchanged from the existing plan — no distance calculation/API/geocoding, no hard outer service boundary,
`mileage_origin` is descriptive only, marketing/area-page copy is out of scope, no travel-time-aware
availability. Nothing in this deepening pass changes any of these.

### 8.12 Effort and commit shape

| Phase | Scope | Files | Migrations |
|---|---|---|---|
| 1 | Settings: rename, origin field, Owner-only permission, copy rewrite | ~6–8 | **2** (rename + new permission) |
| 2 | Remove 3 gates, single source of truth, prop threading | ~8–10 | 1 |
| 3 | `travel_fee` on bookings, write path, lock, audit | ~4–5 | 1 |
| 4 | Recurring propagation + series-level control | ~5–7 | **2** (column + `CREATE OR REPLACE FUNCTION create_recurring_booking_series`) |
| 5 | Customer notice, admin field, chip gating, emails | ~10–12 | 0 |

*Correction: Phase 4's file count moves from "~4–6" to "~5–7" to include the new
`SeriesTravelChargeForm.tsx` component and the `format.ts` registration; its migration count moves from 1
to 2 (§8.7). Item 8's total migration count across all five phases is **6** (2 + 1 + 1 + 2 + 0), not the
"4 migrations" the previous revision quoted.*

**Realistically 2–3 days.** Phases 1–2 are worth doing on their own merits: they fix a live defect that
turns away customers in towns the site says it covers.

```
feat(settings): free-travel areas + mileage origin, replacing the allowed-cities gate
feat(booking): out-of-area addresses are bookable, with one source of truth for the town list
feat(bookings): admin-set travel charge folded into the booking total
feat(bookings): recurring series carry their travel charge to every occurrence
feat(booking): communicate the travel charge on the booking page, admin view and emails
test(booking): guards against a second hardcoded town list
```

**Ordering note:** Phase 2 must not ship before Phase 1 (the form needs the setting to read). Phase 5's
chip-gating must land with Phase 3, not after — the bypass exists in between otherwise.

### 8.13 Stop conditions (Phases 3–5)

1. `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%allowed_cities%'` returns anything besides
   `create_booking_request` when re-run at implementation time — a second consumer has appeared since this
   audit.
2. `information_schema.columns` shows `bookings.travel_fee` or `recurring_booking_templates.travel_fee`
   already exists before the corresponding migration runs — something added it out-of-band.
3. The fully-paid skip in the series action is about to be implemented as a single PostgREST
   `.update().filter("amount_paid","lt","amount_due")` call instead of the two-step
   fetch-then-partition-then-update shape in §8.7 — this cannot work as a single call.
4. A labelled travel-charge line is proposed for an *overridable* email field (a new `SafeField` kind)
   rather than inside the fixed `renderSummary`/`renderBookingPlainText` bodies — this reintroduces the
   silent-override-drops-it risk described in §8.8.
5. Any "recalculate total_price from scratch" code path is proposed anywhere in the codebase — it must add
   `travel_fee` strictly after `service_price × participant_count`, never fold it into the multiply (§8.9C).
6. `pnpm lint` gains a lint error in any file outside the current six-file baseline as a direct result of
   this work — the six-file `{file, ruleId}` identity is the gate, not a bare pass/fail.
7. The full vitest suite shows a failure in a test **not** among the five documented baseline failures (or
   the documented sixth flake) — treat as a real regression, not more flake, until proven otherwise by
   isolating the file.

### 8.14 Rollback (Phases 3–5)

Nothing in Phases 3–5 is irreversible.
- Both `travel_fee` migrations (bookings, recurring_booking_templates) are single `ADD COLUMN` /
  `DROP COLUMN` pairs — additive, `not null default 0`, no rewrite of existing rows, no data loss on
  rollback.
- `create_recurring_booking_series`'s `CREATE OR REPLACE FUNCTION` migration rolls back via a further
  `CREATE OR REPLACE FUNCTION` restoring the prior body verbatim from `c02…sql` — standard for this
  codebase's existing multi-generation function history.
- Every application-code change (write paths, UI, emails) is an ordinary reversible commit. None are
  irreversible once the `travel_fee` columns exist and default to `0` — a full revert simply stops
  writing/reading them, and every one of the 17 flat-scalar read sites in §8.6 continues to work unchanged,
  since none of them ever depended on `travel_fee` existing.
- No email is sent, no financial write occurs, and no migration is applied by drafting or reviewing this
  plan — all of the above describes what an implementer will do, not anything done in this pass.
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

### 10.2 ⛔ The ordering defect, and the fix *(corrected 2026-08-11 · ✅ Owner-sanctioned 2026-08-11)*

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

**Item 5 moved to last** *(changed 2026-08-11, ✅ Owner-sanctioned)*. It has no code dependency on anything, but its whole purpose is a re-baseline — and a baseline taken before items 7 and 8 change the admin and public bundle shape undercounts exactly what this plan adds. Its `pnpm build` also disturbs the Owner's dev server (§5.4), so doing it once, at the end, is cheapest.

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
