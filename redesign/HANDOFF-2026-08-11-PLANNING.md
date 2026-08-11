# HANDOFF — 2026-08-11 — post-Band-C planning session

**Read this first, then `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` end to end.**
Nothing is mid-flight. No agent is running. The tree is clean apart from the two standing dirty paths (§6).

| | |
|---|---|
| **HEAD** | `0ec700c` + the plan-deepening commit |
| **Branch** | `master` |
| **Band C programme** | ✅ **COMPLETE — 23 of 23 rows** |
| **Post-Band-C follow-up plan** | `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` — **8 items, 3,537 lines, ZERO implemented** |
| **Deploy** | Still deferred. Live site runs OLDER code |
| **Next action** | **Implement.** The plan was deepened on 2026-08-11 and all five open decisions are closed — nothing is blocked. Start with item 7 Phase 0 or item 3 (§10.3 gives the order) |

### Update — 2026-08-11, plan deepening complete

The plan was rewritten from 1,265 → 3,537 lines by a 34-agent verification pass (14 auditors, 10 adversaries, 10 drafters). **29 of the plan's own claims failed verification and were corrected in place.** Every item now carries exact symbols with drift instructions, full blast radius *plus* a "proven NOT affected" list, `/booking/manage` checked by name, ordering and shared-file callouts, exact per-batch verification commands, named tests with real file paths, numbered stop conditions, and rollback.

Per-item audits, adversarial verdicts and section drafts: `redesign/evidence/plan-deepening/` (14 reports + 10 drafts).

**The seven corrections most likely to have caused an incident:**
1. `resendDeliveryEvent` does not exist — the function to mirror is `resendEmail`.
2. The manual review-send cannot go "beside `ReminderResendForm`" — that list is filtered to `pending`/`confirmed`, so a completed booking can never appear in it.
3. "Nothing in the codebase deletes anything" is false — 17 delete sites exist including a wired GDPR-erasure path. The true claim is that nothing deletes **by age**.
4. **Item 3 is NOT a correctness prerequisite for item 6** — `ORDER BY override_date` already gives contiguity and both `groupByDate`s are Map-keyed. The 3→6 edge survives only as file contention.
5. **Ordering defect:** item 7 was scheduled before item 8, but five of item 7's Phase B files cannot be finished until item 8 lands. Phase B is now split, with those five as a trailing batch.
6. **A real bug in shipped tooling:** `scripts/verify-admin-token-contrast.mjs` finds `@media print` with `indexOf` and matches a prose comment at `tokens.css:317` before the real rule at `:543`. **The print block has never been verified.** This also means "Layer 2 → 0 failures" is *not* sufficient proof that D8 is fixed, because `@media print` holds its own copy of the failing pair.
7. `--env-file=.env.e2e` and `node_modules/playwright/cli.js` are both wrong; `.env.example` carries the same two stale errors.

**Five Owner decisions closed 2026-08-11** (all folded into the plan at §0.0a): privacy section 6 is **rewritten, kept general, promising nothing the site does not do**; the analytics-retention sentence is **kept**; the manual review send is **exempt from quiet hours**; the HTML form field `name="allowed_cities"` **is renamed** with the column; and both ordering changes are **sanctioned**.

---

## 1 — What happened in this session, in order

### 1a. Band C was finished (23/23)

Six Owner decisions were outstanding at the start; all were answered and discharged.

| Plan | Outcome |
|---|---|
| **C-20** | Step 9's Maps cookie-registry entry + `CONSENT_BANNER_VERSION` bump `2026-07-16.1`→`2026-08-09.1` (`ded190b`) → ✅ |
| **C-14** | Phases B (`233a61e`) and C (`9f41430`) + 3 follow-ups; **2 migrations applied** → ✅ |
| **C-10** | 25 admin surfaces swept at 375px; one shared padding fix (`51942b0`) → ✅ |

**Zone-2 actions performed (each under its own Owner approval):**
1. Migration `c14_save_availability_day` (pre-session) and **`c14_override_breaks`** — two `ALTER TABLE … DROP CONSTRAINT`. Both override tables were empty; zero data change.
2. Deleted 3 C-23 test bookings + 3 clients (10 rows cascaded). Badar's `9d55ce2a` untouched.
3. **Live rota round-trip ×2** — a real Monday break added, verified customer-side, and reverted both times. 0 emails sent.

**The single end-of-programme build was spent:** compiled clean, TypeScript clean, **56/56 static pages, 0 failures**, and every public route still prerendered — clearing C-14 Phase D's named risk (`PublicLayout` going `async` did not force dynamic rendering).

### 1b. Then a follow-up plan was written and progressively deepened

`POST-BAND-C-FOLLOWUP-plan.md` — **8 items. None implemented.** Items 1–6 are small; items 7 and 8 are substantial.

---

## 2 — The plan's 8 items, in one line each

| # | Item | State |
|---|---|---|
| 1 | Review-request email: once per client per 6 months + manual admin send + repeat/one-off classification | Specified |
| 2 | Privacy policy: stop promising a retention schedule nothing enforces | Specified |
| 3 | Override lists: missing secondary `start_time` sort | Specified — **prerequisite for item 6** |
| 4 | `bookings` indexes ⛔ | Specified, migration only |
| 5 | Bundle measurement tooling | Specified |
| 6 | Adjustment lists count segment ROWS, not DATES | Specified |
| 7 | **Admin colour/contrast fixed at the root** | Specified + **3 verification layers BUILT** |
| 8 | **Travel-charge model** (free-travel areas + manual mileage fee) | Specified, all decisions closed |

---

## 3 — Item 7: the tooling is real and already committed

**Three verification layers exist and run TODAY.** Do not rebuild them.

| Layer | Artefact | Baseline |
|---|---|---|
| 1 — static source | `scripts/measure-admin-contrast.mjs` + `.test.ts` | **456** failures (377 dark / 79 light) + **239 unresolved** |
| 2 — token pairs | `scripts/verify-admin-token-contrast.mjs` + `.test.ts` | **1** failure — `--admin-warning` 3.41:1 light |
| 3 — live sweep | `e2e/admin-contrast.spec.ts` + `admin-contrast-helpers.ts` | **2,615** across all roles/themes |

Run them:
```bash
node scripts/measure-admin-contrast.mjs .
node scripts/verify-admin-token-contrast.mjs
node --env-file=.env ./node_modules/@playwright/test/cli.js test e2e/admin-contrast.spec.ts --project=chromium
```

**Item 7's headline defect (D1) is root-caused and is NOT a colour literal.** Two independent bugs:
1. **`:root`-only alias tokens are frozen in light mode.** `<html>` never carries `data-theme` (it is on a wrapper div), so `--admin-nav-text: var(--admin-body)` resolves once against `:root`'s light value and inherits frozen. **11 such aliases exist; `tokens.css`'s own comment names only 8.**
2. **A cascade-layer inversion.** `site-parity.css` is imported **unlayered** while Tailwind utilities sit in `layer(utilities)`; unlayered beats layered, so its `a { color: inherit }` defeats every text-colour utility on every `<a>` — **site-wide, public pages included.** Reach unmeasured.

⛔ **Substitution cannot fix D1, D7, D9 or D12.** They belong to Phase 0 (§7.5b). An implementer who edits literals to chase them will corrupt working code.

---

## 4 — Every Owner decision made this session

**Band C closeout (2026-08-09):**
1. Maps consent → **functional-on-interaction**. *(Shipped as `purpose:"essential"` — see §5 gotcha 9.)*
2. C-14 Phase A live round-trip → **option B, the full break test** (overrode the safe-variant recommendation).
3. Phase C migration → **approved**, then **re-approved as corrected SQL** (see §5 gotcha 8).
4. C-23's two unrunnable gates → **accept the code-level proof**. C-23 now 10/10 gates.
5. Delete the 3 C-23 test bookings → **yes**.
6. Recurring-series email defect → **fix it** (`72670e1`).

**Follow-up planning:**
7. Maps cookie label → **leave as is** (this overrode a contradictory line in the same message — see §5 gotcha 9).
8. Item 6 (`adjustment lists count dates`) → **in scope**.
9. `page.tsx` added to C-14's files list (rule 6(b)) → **approved**.
10. C-10 padding → **shared one-line fix** in `AdminTopNav.tsx`, despite the plan listing that file UNCHANGED.
11. `/admin/me` broken page → **fix before the build**.
12. Mileage feature → **do NOT automate**; manual per-booking fee.
13. **Item 8 decisions:** `allowed_cities` inverts to a free-travel zone · fee set manually per booking · a new **Owner-only** mileage-origin setting · **no** hard outer boundary (admin discretion) · hide the quick-confirm chip when a fee is needed · **recurring series repeat the charge** · free-travel list keeps a **minimum of one entry** · fee **locked once completed or fully paid** (cancelled deliberately NOT locked) · series-level control lives on the **series page**.

---

## 5 — GOTCHAS. Read every one; each cost real time.

1. **⛔ Agents may NEVER enter credentials.** This did not lift when the Owner offered explicit permission. The working substitute: the **Playwright harness authenticates** via `getCredentials()`/`loginAs()` reading env vars; agents reference prefixes only. The Owner has populated `.env`.
2. **`playwright.config.ts` loads NO env file.** Creating `.env` alone does nothing. Use `node --env-file=.env ./node_modules/@playwright/test/cli.js …` (Node 24 has `--env-file` built in; `dotenv` is NOT installed and must not be added).
3. **The Playwright CLI path is `node_modules/@playwright/test/cli.js`** — this is a pnpm repo; `node_modules/playwright/cli.js` does not exist.
4. **The bundled Chromium is missing** (`@playwright/test@1.59.1` pins revision 1217; the machine caches 1228/1234). `e2e/admin-contrast.spec.ts` pins `test.use({ channel: "chrome" })` to use system Chrome. **Keep that pin**, or the suite cannot run.
5. **⚠️ Git Bash mangles bare leading-slash arguments.** `CONTRAST_ROUTES=/admin/dashboard` became `C:/Program Files/Git/admin/dashboard` before Node saw it — silently. This cost a full debugging cycle and produced a "silently audits nothing but passes" bug. The same mangling hit `curl` output earlier. **Suspect it whenever a path-like argument vanishes.**
6. **Dev server is Owner-run** at `localhost:3000`. Never spawn/restart/kill. Use `localhost`, not `127.0.0.1`. `/` → 308 `/home/` is normal. If down, ⏸-ask.
7. **`src/lib/maintenance.ts`: working copy `false`, HEAD `true`.** Never stage, commit or revert it. For deployed behaviour read `git show HEAD:<path>`.
8. **Approved SQL may not be executable.** The Owner approved `DROP INDEX` for a UNIQUE **constraint** that owns its index — Postgres refuses. It was re-presented as `ALTER TABLE … DROP CONSTRAINT` and **re-approved**. Verify object types before presenting SQL.
9. **A contradictory instruction is a STOP, not a guess.** The Owner's fix-list once repeated an item they had told me to leave alone two lines earlier. Flagging it was correct; they confirmed it was a mistake.
10. **Plan text is a CLAIM, not a fact.** Instructing agents to verify plan assertions caught three real errors: a "18 ratio comments" count that was 14; a claim the bundle work needed a package install when the existing script already did the job; and a "real out-of-area bookings exist" narrative built on rows created **309 ms apart** (seed data).
11. **Anchors drift constantly.** Re-locate by symbol, never by stored line number.
12. **`vitest`'s include is `src/**` AND `scripts/**/*.test.{ts,tsx}`** — tests in `scripts/` DO run. Playwright specs do not.
13. **Zone-2 = migrations, any data-mutating SQL, deploys, package installs, env changes, real emails.** Owner-approved per action, orchestrator-performed, never delegated to a subagent.
14. **Read-only agents must be told explicitly not to write.** One left five `scratch_*` files in the repo root, which polluted the lint baseline. *(`redesign/**` is excluded from lint, so evidence files are safe — anywhere else is not.)*
15. **Quoting does NOT defeat the Git Bash leading-slash mangling** — tested and disproved. `MSYS_NO_PATHCONV=1` does. PowerShell is immune and is the preferred shell. Only `CONTRAST_ROUTES` self-heals (via `resolveRouteFilter`).
16. **Bracket paths miscount under raw shell glob.** `src/app/admin/staff/[staffId]/…` returned 26 where ripgrep returned 23. Count with ripgrep, never shell bracket expansion.
17. **Both contrast scripts exit `0` regardless of failures** unless `--max-failures=N` is passed. A bare run gates nothing.
18. **Lint identity must be keyed on the `{file, ruleId}` multiset, not `file:line:column`.** Item 8's own specified edits to `BookingExperience.tsx`/`BookingExperienceLoader.tsx` are *guaranteed* to shift pre-existing errors' line numbers — a line-keyed check would report a false regression.
19. **`pnpm build` writes to the same `.next/` the Owner's dev server serves from** (no `distDir` override). Item 5's one sanctioned build may disturb it, and agents may not restart the server — coordinate it.

---

## 6 — Standing facts

- **Tree is intentionally dirty**: `design_handoff_public_pages/**` deletions, `.playwright-mcp/` deletions, untracked `design_handoff_area_pages/`, `photos-rahma-therapy/`, `test-results/`, `redesign/evidence/C-21/*.png`. **Never `git add .`/`-A`; never stash/checkout/restore to "clean" it.**
- **Baselines BY IDENTITY** (a matching total with a swapped-in failure is a FAIL):
  - `npx tsc --noEmit` → **0**
  - `npx vitest run` → **5 failed / 2236 passed (2241)** — exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3
  - `pnpm lint` → **59 errors / 7 warnings** in exactly `design_handoff_area_pages/prototype/{area-page,shared,site-chrome}.jsx` + `src/features/booking/{BookingExperience.tsx,BookingExperienceLoader.tsx,utils/returning-customer.ts}`
  - **Known flake:** under full-suite load 1–2 extra `ManualBookingForm > optional email` sub-tests time out at 5000ms. In isolation the file reproduces exactly its 3 baseline failures. Pre-existing contention, not a regression.
- **Supabase project** `twzutkfgqclqurvkmvqz`. Read-only `execute_sql` is fine; all writes are Zone-2.
- **DO-NOT-TOUCH:** booking `9d55ce2a` (real customer); `redesign/audits/**`; `C-B-DECISIONS.md`; the Owner account in email-test paths.
- **Business reality that should govern effort decisions:** **12 real bookings, all Luton** (May–July). Three non-Luton rows are seed data. 6 bookable therapists who **claim jobs voluntarily**; **no pay/rate/payout table exists anywhere**.

---

## 7 — Live defects found but NOT fixed (all in the plan)

1. **The service-area contradiction (item 8).** The town list exists in **three places that disagree** — a hardcoded 5-town JS list, `business_settings.allowed_cities` (2 towns), and the SQL gate. A Harpenden customer gets a green "covered" tick, then an empty calendar. **Costing bookings now.**
2. **Admin colour/contrast (item 7).** 2,615 measured AA failures; 82 at exactly 1.01:1 (identical colours). The **active nav label is invisible on every admin page, every role, both themes.**
3. **`--admin-warning` on `--admin-warning-bg` = 3.41:1 in light** — a token pair genuinely failing AA.
4. **The cascade-layer inversion** — site-wide, reach unmeasured.
5. **Recurring review emails** would ask a standing client weekly, forever (item 1).
6. **Privacy policy** promises 7-year retention nothing enforces (item 2).

---

## 8 — What must NOT happen next

- **Do not start implementing from an item section alone.** Read §1 (binding rules), §10 (ordering and collisions) and §11 (gate identity) first — several items edit files another item also edits, and two of them edit lint-baseline files.
- **No `git add .`**, no stashing, no "cleaning" the tree.
- **No migrations, no data writes, no deploy, no package installs** without per-action Owner approval.
- **No credential entry**, ever, by any agent.
- **Do not rebuild the three contrast verification layers** — they exist and work.
- **Do not "fix" `create_recurring_booking_series`'s missing city check** — its absence is deliberate and documented.

---

*Position files: `redesign/plans/POST-BAND-C-FOLLOWUP-plan.md` · `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md` (23/23) · `redesign/per-page-progress/OWNER-ACTION-BACKLOG.md` · `redesign/evidence/admin-contrast/` (10 files incl. `root-cause-D1.md`, `surgical-review.md`, `summary.md`).*
