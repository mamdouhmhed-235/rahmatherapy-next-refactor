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
- **SEO:** no `sitemap.ts` / `robots.ts`, and 5 of 6 public pages emit no canonical tag.
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
