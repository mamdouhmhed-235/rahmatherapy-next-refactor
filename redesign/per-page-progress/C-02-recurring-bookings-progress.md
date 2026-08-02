# C-02 — Recurring / standing bookings — PROGRESS

**Plan:** `redesign/plans/C-phase/C-02-recurring-bookings-plan.md`
**Brief:** `redesign/briefs/C-02-recurring-bookings-brief.md`
**Programme:** Band C, C-C implementation — plan **#12 of 22** (§4 order).
**Predecessor closed at:** `d268659` (C-13 shipped)
**Model routing:** `opus` — §5 routes C-02 to Opus (greenfield schema + 2 RPCs + horizon cron). Mechanical phases may drop to `sonnet` with the downgrade logged.

> ## ⛔ STATUS: NOT STARTED — **BLOCKED at the Phase A HARD-STOP.** The migration cannot be presented for Owner approval as written; see §0.3 and §0.4. Raised in chat 2026-08-01.

---

## 0 — Pre-flight (2026-08-01, HEAD `d268659`) — **GO-WITH-CAVEATS, but Phase A is blocked**

| # | Check | Result |
|---|---|---|
| 1 | Branch + path-scoped tree | **PASS** — `master`; ancestor of `ea97932`; path-scoped status empty across all of C-02's paths |
| 2 | Dev server | **PASS** — `/admin/login/` → 200 |
| 3 | Baselines | plan's own "485/491, 6 failures incl. `createBookingTransaction`" is **stale** — C-06 removed that entry. Inherited: **tsc 0 · lint 59E/7W six files · vitest 5 failed / 1181 passed (1186) · build clean** |
| 4 | Schema premises | **ALL HOLD** — see §0.1 |
| 5 | Dependency gates (C-01, C-08) | **PASS** — both marker-verifiable; C-01 3 phase commits (last `5164d00`), C-08 10 (last `302f90e`), both with closeout commits |
| 6 | D1 cascade | **PASS, verified in code** — see §0.2 |
| 7/8/9 | Fixtures / DO-NOT-TOUCH / metrics | no blocker; production holds **15** bookings |
| — | ⛔/⏸ markers | **exactly 1 ⛔** (Phase A migration, plan line 211 / brief line 636 — same action). **0 ⏸** |
| — | Files-touched audit | every existing file present at its stated path; the two NEW files correctly absent. **One in-scope file is missing from the list** — see §0.5 |

### 0.1 — Schema premises verified live (SELECT-only)

`recurring_booking_templates` / `recurring_series` / `booking_series` → **0 rows** · `services.allow_recurrence` → **absent** · `bookings.recurring_template_id` → **absent** · `compute_occurrence_dates` + `create_recurring_booking_series` → **absent**. Greenfield exactly as the ledger states. 5 active services, all `is_active` — none needs an `allow_recurrence` override at launch, matching the all-on-by-default decision.

### 0.2 — D1 cascade confirmed working

C-06's `deleteClient` (`clients/actions.ts:554-575`) cancels active recurring templates **before** the client soft-delete at `:639-645` — correct order, so C-02's `ON DELETE RESTRICT` FK can never fire. Right table name, right filter (`.is("cancelled_at", null)`), and it gracefully no-ops today on `PGRST205`/`42P01` while the table doesn't exist. The subsequent open-bookings cascade also catches materialised occurrences via shared `client_id`. **The one genuine cross-plan ordering constraint in the programme, honoured eleven plans early.**

### 0.3 — ⛔ BLOCKER 1: the migration has no GRANTs, and will silently fail without them

**Protocol §3b exists because of exactly this, and the evidence says it will bite again.**

- `pg_default_acl` for schema `public`: tables created by role **`postgres`** grant `service_role` only `Dxtm` (Delete/Truncate/References/Trigger) — **no SELECT, no INSERT, no UPDATE**. Tables created by `supabase_admin` get full `arwdDxtm`.
- Ownership check: `bookings`, `services`, `audit_logs`, `email_delivery_events`, `staff_availability_overrides` are **all owned by `postgres`** — i.e. `mcp__supabase__apply_migration` creates tables in the ACL bucket that *denies* service_role read/write.
- `email_delivery_events` is the live proof: C-04a's documented incident, where `service_role` had no UPDATE, all three UPDATEs returned 42501, and the cron reported `200 {sent:0}` while no customer received an email.
- **The plan's Phase A migration draft contains zero `GRANT` statements.**

Also worth recording: `service_role` has `rolbypassrls = true`, so the draft's `rbt_service_role_all` policy is **decorative for service_role** — only the GRANT matters. The `rbt_authenticated_read` policy likewise means nothing without a matching grant to `authenticated` (whose default ACL is also `Dxtm`-only).

**Required addition to the migration body:**
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_booking_templates TO service_role;
GRANT SELECT ON public.recurring_booking_templates TO authenticated;
```
At minimum, `has_table_privilege('service_role','recurring_booking_templates','INSERT')` must be checked **immediately** after apply, before any Phase B/C work.

### 0.4 — ⛔ BLOCKER 2: `create_recurring_booking_series` cannot be "lifted verbatim" — it does not exist to lift

The plan says *"Full DDL per brief §2.4 — long; lift verbatim during impl."* **Brief §2.4's body is a sketch, not SQL.** It contains unwritten placeholders: `-- ... full validation logic per W07 §10 ...` and `-- Insert booking_participants + booking_items + booking_assignments -- (mirror create_booking_request's participant loop) -- ...`.

Worse than incomplete — **as specified it cannot be written**, because the live schema demands values the RPC has no way to obtain:

| Column | Constraint |
|---|---|
| `booking_participants.participant_gender` | **NOT NULL**, no default, enum `staff_gender_type` |
| `booking_participants.required_therapist_gender` | **NOT NULL**, no default |
| `booking_assignments.required_therapist_gender` | **NOT NULL**, no default |

`staff_gender_type` has exactly two values — `male`, `female`. **There is no "any"/"unspecified" member.** `create_booking_request` — the RPC C-02's is meant to mirror — sources these from a `p_participant_genders staff_gender_type[]` parameter that has **no equivalent** in `create_recurring_booking_series`'s signature. `clients` has no gender column to derive from. Neither `RecurringSection`'s props (Step 13) nor `createRecurringSeries`'s Zod schema (Step 6) captures a gender at all.

**This is a plan-vs-reality contradiction, not stale line numbers — raised in chat rather than improvised around.** Two candidate resolutions:
- **(a) Thread `p_participant_gender` end-to-end** — RPC parameter → `createRecurringSeries` schema → `RecurringSection` props, sourced from the gender data ManualBookingForm's earlier steps already hold. Faithful mirror of `create_booking_request`, and consistent with this clinic's gender-matching model (`services.gender_restrictions` exists and `create_booking_request` enforces it; the recurring sketch validates none of it).
- **(b) Derive from `bound_therapist_id`'s own gender** — but leaves "open to any therapist" mode with no source at all.

Two smaller gaps in the same sketch, both fixable in passing: the `bookings` INSERT omits `consent_acknowledged` and `group_booking` (both NOT NULL but `DEFAULT false` — schema-safe, though a staff member creating a series has already taken consent, so setting it explicitly is more honest); and the client lookup has no `AND c.deleted_at IS NULL` guard, unlike `create_booking_request` post-C-06.

**The additive DDL is unaffected** — the table, columns, indexes, CHECKs and `compute_occurrence_dates` are complete, verified against a greenfield target, and apply cleanly. Only the create-RPC portion is blocked.

### 0.5 — One in-scope file missing from the plan's §2 list

`src/lib/email/__tests__/registry-defaults.test.ts` carries a hardcoded `expect(TEMPLATES.length).toBe(16)`. Registering C-02's `recurring_series_created_client` makes it 17. The parity **loop** itself is safe (it iterates the fixture's keys, not `TEMPLATES`'), so a new template does not break render-parity — but that count assertion will fail. Add the file to the list rather than treating it as scope creep mid-phase.

### 0.6 — Anchor drift (re-locate by symbol; eleven plans have shipped since the plan was written)

| Symbol | Plan cites | Current |
|---|---|---|
| `createManualBooking` | `bookings/actions.ts:726-960` | **`:1443`** in a 1703-line file |
| `AUDIT_PHRASING` | `clients/[clientId]/page.tsx:127-138` | **`:141-165`** (18 entries) |
| `validateStep` step-3 gate | `ManualBookingForm.tsx:212-217` | **`:215-221`** |
| date/time picker panel | `:1416-1417` | that line is inside the **address** block; the real inputs are **`:1652-1653`** |
| submit strip | `~:1921-1930` | desktop **`:1923-1960`** — **and a second, mobile submit at `:2048-2057`** the plan never mentions; both need the conditional-action treatment |
| `SUBJECTS` map | Step 11 | **gone** — C-15 moved defaults to `TemplateMeta.subjectDefault`. The plan's own 2026-07-16 conditional note anticipated this correctly. |
| `SafeFieldKind` closed union | Step 11 shared-surface note | **false** — C-15 widened it to `string`. Resolves in C-02's favour. |
| worker cron dispatch | *"exactly ONE cron trigger and NO dispatch mechanism"* | **false** — 3 crons with a working `switch`. C-02's `0 3 * * *` is a clean append. |

### 0.7 — Cron coordination: clean

`worker-entrypoint.ts` dispatches three crons (`0 8 * * *` reminders, `* * * * *` C-04a scheduled-emails, `*/15 * * * *` C-01 review-emails) via a switch, in exact lockstep with `wrangler.jsonc`. Decision D3's order-agnostic pattern is live and working. C-02 appends a fourth with zero collision — **and joins the same still-pending Cloudflare deploy, making it a four-in-one activation.**

### 0.8 — Email template must follow the post-C-15 pattern explicitly

The plan says "per C-08 pattern", which is directionally right but doesn't name the calls. The live analogue is `sendBookingRestoredClientEmail` (`notifications.ts:759-786`):
```ts
const overrides = await resolveTemplateOverrides("recurring_series_created_client");
await sendTrackedEmail(supabase, {
  subject: resolveSubject("recurring_series_created_client", overrides, buildVarMap(input)),
  html: renderRecurringSeriesCreatedEmail(input, overrides),
});
```
Spelling this out matters: **the single most expensive defect of this programme** was C-08's discovery that admin-edited copy never reached real emails, and C-15's that subjects were editable but unwired. A new template that hardcodes its subject repeats both.

---

## 1 — ▶ RESUME HERE

**Nothing has been implemented.** Working tree clean except the standing deliberate `src/lib/maintenance.ts`.

**Next action: the Owner must resolve §0.4 (the RPC gender-source design gap) and approve §0.3's GRANT addition.** Until then the Phase A ⛔ HARD-STOP cannot be presented with complete, correct SQL — and presenting incomplete SQL for approval would be worse than waiting.

Once resolved: author the RPC body against the live `create_booking_request` definition (`pg_get_functiondef('public.create_booking_request'::regproc)`), fold in the GRANTs, present the whole migration verbatim for per-action approval, apply it as orchestrator, then run the privilege re-check before Phase B.

---

---

## 1 — Phase A migration AUTHORED and Owner-APPROVED — ⏸ awaiting application

**File:** `supabase/migrations/20260802122636_c02_recurring_bookings.sql` — **942 lines, untracked, NOT applied, NOT committed.**

The plan's Phase A could not be applied as written. It has been authored properly against the live schema, and **the Owner approved every element in chat on 2026-08-01/02.** The next orchestrator action is to read the file in full, apply it via `mcp__supabase__apply_migration`, run the post-apply privilege re-check, then commit as `chore(supabase): C-02 migration applied c02_recurring_bookings`.

### 1.1 — What the Owner approved, and why each was needed

| Approved | Why the plan's draft was unapplicable without it |
|---|---|
| **Option (a) gender — persisted as columns** | `booking_participants.participant_gender`, `.required_therapist_gender` and `booking_assignments.required_therapist_gender` are all `NOT NULL` on an enum with only `male`/`female` — there is no "any" value — and `clients` has no gender column. **A parameter alone does not solve it:** the horizon cron materialises occurrences months later, so gender must live on the template row or every future occurrence fails a not-null check. Mirrors the address snapshot the table already carries for exactly this reason. `open_to_any_therapist` stays orthogonal — it governs *which* therapist, not *what gender*. |
| **Two table GRANTs** | `pg_default_acl` for `postgres`-owned tables gives `service_role` only `Dxtm` — **no SELECT/INSERT/UPDATE**. Verified live. Without the grant every write is a silent 42501: the exact C-04a failure. |
| **Function EXECUTE grants** | Same trap, one object type over — `pg_default_acl` for `postgres`-owned **functions** is `{postgres=X/postgres}`, owner only. Every `adminClient.rpc(...)` from Phase C on would 42501. Also REVOKEs from PUBLIC/anon/authenticated so no new advisor findings are introduced. |
| **`bookings_booking_source_check` widened by one value** | The RPC writes `booking_source = 'recurring'`; the live CHECK allows eight values and that is not one. It is `NOT VALID`, which exempts only *existing* rows — every INSERT is still checked, so all occurrences would 23514 and abort. Re-added **validated** (all 15 live rows pass), which is strictly stronger than the `NOT VALID` constraint it replaces. |
| **First batch = 12, per the plan** | The plan's own formula yields **13** (days 0…84 inclusive). Owner ruled the code should match the plan and the customer-facing form copy. |

### 1.2 — The occurrence fix, and the trap inside it

Fixed by subtracting 1 from **`v_horizon_through` itself** — a single variable that feeds both the `compute_occurrence_dates` bound and the stored `horizon_through_date`, so the two can never disagree.

Counts confirmed by **read-only replay across 365 consecutive first-dates × 3 cadences**, min = max on every row (so anchor-independent, not a lucky sample): **weekly 12 · fortnightly 6 · monthly 3.**

**The tempting alternative would have silently lost a visit per series.** Tightening the loop bound instead — or passing `horizon − 1` while still storing `horizon` — also yields 12, but stores a horizon *beyond* the last real occurrence. The cron resumes past `horizon_through_date`, so day 84 (a genuine weekly and fortnightly occurrence) would be claimed as covered and never created. No error anywhere.

Also established: the old header's "monthly yields 4" **was never true** — it is 3 both before and after, across all 336 valid anchors. Any Phase B test written against 4 would have been wrong.

### 1.3 — Six defects the author found and fixed without needing the Owner

1. Brief §2.4's parameter list **would not compile** — defaulted parameters before non-defaulted ones. Reordered.
2. The draft set **both** day-anchors from the first date, so a *weekly* series starting after the 28th tripped `rbt_anchor_day_of_month_in_range` and was rejected. Now exactly one anchor per cadence.
3. The template stored the **raw** address parameters, which are NULL whenever the operator doesn't override — defeating the snapshot's entire purpose. Now stores resolved values.
4. `contact_phone` is `NOT NULL` while `clients.phone` is nullable → raises a readable P0001 instead of leaking a bare 23502.
5. Client lookup had no `deleted_at IS NULL` guard, unlike `create_booking_request` post-C-06. Added.
6. `booking_items` written from the validated service row rather than re-SELECTed — `create_booking_request`'s `is_visible_on_frontend = true` filter would have silently inserted **zero** line items onto a priced booking.

### 1.4 — ⚠️ Carried forward to Phase G (reported, deliberately not fixed)

**The cron's resume point is wrong in both the plan and the brief.** Plan Step 19 and brief §2.5 sketch `compute_occurrence_dates(current_horizon, cadence, new_horizon, …)` — passing `horizon_through_date` as the *first date*. That only ever appeared to work because the old formula made the horizon coincidentally equal the last weekly/fortnightly occurrence; **it was already wrong for monthly** (the day-of-month drifts off the anchor). After the 12-occurrence fix the horizon is `≡ 6 mod 7` from the anchor, so weekly and fortnightly break the same way — every extended visit lands one weekday early, and the duplicate check keyed on `(client, date, start_time)` will not catch it because the dates genuinely differ.

**Phase G must walk from the series anchor or from `max(booking_date)` of the series, never from `horizon_through_date`.** Written into the migration header as a note for Phase G.

### 1.5 — Also logged, not fixed

- Plan §2.4 and brief §2.4 still carry the **un-corrected** horizon formula. Someone reading the drafts later could "restore" the bug.
- `idx_recurring_templates_active` indexes a column that is NULL across its entire partial subset — near-useless. Kept (plan text, negligible cost), flagged in a comment.
- **Pre-existing, unrelated:** `ManualBookingForm`'s `SOURCE_OPTIONS` offers "Facebook" → `'facebook'`, which is absent from the `booking_source` CHECK before *and* after this migration. Choosing it in the admin form fails today.

---

## 2 — ▶ RESUME HERE

### ✅ Phase A APPLIED 2026-08-01 — `59ccb27`

⛔ Zone-2 migration `c02_recurring_bookings` applied by the orchestrator under the Owner's explicit chat approval ("approved, go ahead and apply it"). The file was **read in full before executing** — 942 lines, atomic `BEGIN`/`COMMIT`.

**Post-apply verification, all confirmed:**

| Check | Result |
|---|---|
| `recurring_booking_templates` table | present |
| `services.allow_recurrence` · `bookings.recurring_template_id` | both present |
| `participant_gender` + `required_therapist_gender` on the template | both present |
| **`service_role` INSERT / SELECT / UPDATE on the table** | **all true** |
| **`service_role` EXECUTE on both functions** | **true** |
| `anon` EXECUTE on the series RPC | **false** (REVOKE took) |
| `booking_source` CHECK | widened to 9 values **and `convalidated = true`** — strictly better than the `NOT VALID` it replaced |
| Template rows created · bookings touched | 0 · 15 unchanged |

**Both silent-42501 traps are closed** — the table grant and the function grant. That was this plan's headline risk and the reason C-04a lost a verification cycle.

**Transcription-drift guard.** The SQL was passed by hand to `apply_migration`, so the applied function was checked against the file's load-bearing logic rather than assumed: `(v_horizon_weeks * 7) - 1` present (the 12-occurrence fix survived), writes `'recurring'`, carries the `deleted_at IS NULL` client guard and the phone guard. **Applied `create_recurring_booking_series` md5: `2aefd9d4b0b042eafbc5689b1319343f`** (length 11855) — compare against this if the function is ever suspected of having changed.

---

## 2 — ▶ RESUME HERE

**Exact next action: C-02 Phase B.** Phase A is complete; the schema and both RPCs are live and correctly granted.

Model routing: §5 puts C-02 on `opus` for phases touching the schema, the RPCs or the horizon cron; mechanical phases (form wiring, copy, evidence) may drop to `sonnet` — log any downgrade here.

**Inherited baseline:** tsc 0 · lint 59E/7W six files · vitest **5 failed / 1181 passed (1186)** · build clean. Failures exactly: `admin-access.test.ts` ×2 ("gives Owner broad access while keeping owner-only role actions permission-gated", "gives Admin broad operational access without role template management") + `ManualBookingForm.test.tsx` ×3 ("renders step 1 on first load", "moves focus to the first invalid field when continuing with errors", "shows the consent error when trying to create booking without consent").

---

*C-02 Phase A migration authored, corrected and Owner-approved; **application is the next action**. Nothing applied, nothing committed, no application code touched yet.*

---

# ⏸ INTERRUPT CHECKPOINT — 2026-08-02 (Owner asked to pause)

| Field | Value |
|---|---|
| Plan | **C-02**, plan #12 of 22 |
| Phase / step | **Phase B**, Step 4 complete · Step 5 escalated (not run) |
| Last-good commit | `8ce98f4` (bookkeeping) — this checkpoint's parent |
| Files mid-flight | none — no source file touched; only `redesign/evidence/C-02/phase-b-rpc-verification.md` (new) and this progress file |
| In flight at pause | one read-only Phase-B verifier subagent; its verdict is **not** required to resume (a fresh verifier re-derives everything) |
| Exact next action | Put the three questions in §B3 below to the Owner, then start **Phase C** (Step 6) |

## B1 — Phase B result

**Step 4 ✅ COMPLETE (exceeded).** `compute_occurrence_dates` verified by exhaustive SELECT-only replay: 366 anchors × 3 cadences with `horizon = first + 83`, **min = max = 12 weekly / 6 fortnightly / 3 monthly**, first date always the anchor; plus 10 end-condition edge cases. Full evidence + queries in `redesign/evidence/C-02/phase-b-rpc-verification.md`.

**Step 5 ⛔ NOT RUN — agent-impossible, not skipped.** See §B3 Q1.

**Drift guard ✅** — applied `create_recurring_booking_series` md5 `2aefd9d4b0b042eafbc5689b1319343f` / length 11855, byte-identical to Phase A's record. **Zero writes**: templates 0 · recurring bookings 0 · bookings 15, unchanged.

**Phase G trap re-proven numerically** (evidence §3): weekly anchor `2026-09-04` → horizon `2026-11-26`, last real occurrence `2026-11-20`, **overshoot 6 days**; resuming from the horizon yields a **Thursday**, walking from the anchor yields the correct **Friday**. Phase G must walk from the series anchor or `max(booking_date)`.

**Why no code:** verified three ways — no vitest spec anywhere touches a real DB or network; vitest never loads `.env` (no `setupFiles`, no dotenv); and Step 4's literal suggestion (call `mcp__supabase__execute_sql` *from inside a spec*) is not implementable, since MCP tools exist only in the agent harness. Plan §9.2 left this open ("decide at impl time"); exhaustive SQL replay is strictly stronger than mocking a TS re-implementation. Phase E was checked for a client-side occurrence preview that might justify a TS mirror — it has none.

## B2 — Phase C pre-read findings (read-only prep, done during Phase B per §2.8c)

1. **⚠️ Plan-vs-reality: Phase C's code sketch omits both gender parameters.** The applied RPC requires `p_participant_gender` and `p_required_therapist_gender` (`staff_gender_type`, NOT NULL, no default). Plan Step 6's `recurringSchema` and RPC call carry no gender at all, and Phase E's `RecurringSectionProps` (plan lines 530–537) likewise. **Not a new question** — §0.4/§1.1 records the Owner's approved Option (a): thread the gender end-to-end (RPC param → action schema → section props) *and* persist it on the template row, because the horizon cron materialises occurrences months later. The implementer follows the recorded approval; the plan's stale sketch does not override it.
2. **Ordering defect inside the plan.** Phase C Step 6 imports `sendRecurringSeriesCreatedEmail`, which is **Phase D**'s Step 10 deliverable — so Phase C cannot pass its own `tsc` gate as written. **Resolution (no phase reorder): Phase C ships the action without the email call; Phase D lands the send fn and wires it in.** Nothing calls the action until Phase E mounts the form, so there is no window where the email is genuinely missing.
3. `getLondonTodayISO()` (plan lines 480–485) duplicates the existing `getTodayIsoDate()` in `src/app/admin/bookings/_helpers.ts:198-205` — import, don't redefine.
4. Plan line 463 has a literal bug: `after_state: { cancelled_at: template.id, … }` writes the template id into a timestamp field, and `template` isn't even selected with that column.
5. `cancelRecurringSeries` omits the `.active` check that `createRecurringSeries` and every comparable action in `actions.ts` apply. Add it for consistency.
6. File idiom confirmed: `actions.ts` actions **return** result objects (never throw); cache invalidation is `updateTag("report-data")` + `updateTag("dashboard-data")` + `revalidatePath(...)`; Zod is `zod/v4` with `z.flattenError(...).fieldErrors`.

## B3 — Three questions for the Owner (blocking Phase C only on Q2)

**Q1 — Phase B Step 5 (live integration test).** Needs 1 template + 12 bookings + 12 participants + 12 items + 12 assignments + 1 audit row written to the live DB. Routes: **(a)** defer to the Owner's Phase-I UI sweep, which exercises the same path for real *(recommended — matches programme precedent)*; **(b)** a Supabase dev branch, the only way to run it literally with zero production impact (cost-bearing, Zone-2); **(c)** approve production writes on test fixtures (plan §6 has cleanup SQL, but leaves cancelled rows in a 15-booking table permanently).

**Q2 — Series cancellation sends NO emails at all.** Plan Step 7's cascade is a raw bulk `UPDATE` on `bookings`; it never calls `sendBookingCancellationEmails`, and no later phase adds one. Both single-booking cancel paths (`quickUpdateBooking`, `updateBookingManagement`) notify unconditionally — customer, admin and assigned staff. As written, a client with 6 upcoming occurrences is told nothing when the series is cancelled. Intentional simplification, or a gap to close?

**Q3 — Files needed outside the plan's §2 files-touched list (protocol rule 6b).** Not yet required, so not yet a STOP; will be raised formally when Phase D starts.
- *Phase D:* `src/lib/email/sample-data.ts` and `src/lib/email/__tests__/resolveSubject.test.ts` both fail on a 17th template (dispatch-table and CASES completeness assertions) — in addition to `registry-defaults.test.ts`, which §0.5 already caught. Optionally the preview-route spec and the render-parity fixture.
- *Phase H:* the bookings-list filter chip lives in `src/app/admin/bookings/BookingsChrome.tsx` and the row icon in `BookingCard.tsx` — `page.tsx` only mounts them, so Step 23 cannot be done in the listed file alone.

## B4 — Anchor drift re-verified at `8ce98f4`

§0.6's table holds on 7 of 8 rows. One change: `AUDIT_PHRASING` is now **19** entries (not 18) — `email_template_sent_manually` was added by `10ca7db7` after §0.6 was written. Line span `:141-165` is still correct. Step 25 should anchor on literal keys, never the count. Both `ManualBookingForm` submit strips confirmed present (desktop `:1923-1960`, mobile `:2048-2057`) — both need the conditional-action treatment.

## 3 — Phases C, D, E — implemented and independently verified

| Phase | Commit | Model | Verify |
|---|---|---|---|
| C — server actions | `cb0de35` | `opus` — threads a NOT-NULL enum contract into a 20-param RPC whose applied signature disagrees with the plan's sketch, and writes a cascade against a live production table | **PASS**, zero defects |
| D — email template | `1d2ed98` | `sonnet` — mechanical registration across 10 files against a fully-documented pattern | **PASS**, zero defects |
| E — form integration | `66afd6b` | `opus` — live-surface edit to the programme's most contended file plus a React state-machine change | pending at time of writing |

### 3.1 — Phase C (`cb0de35`)

`src/app/admin/bookings/recurring-actions.ts` + two specs (32 tests). Five corrections were applied against the plan's own code text, all instructed rather than improvised:

1. **The RPC signature in the plan is stale.** The applied function takes 20 params (9 required); the plan's sketch omitted **both gender parameters**, which are `staff_gender_type` NOT NULL with no default — the call would have failed at runtime. Threaded per the Owner's recorded Option (a): `p_participant_gender` and `p_required_therapist_gender` both receive the participant's own gender, mirroring exactly what live `create_booking_request` does (it writes one `v_gender` into both columns).
2. **Result keys are camelCase** — `{ templateId, occurrenceCount, skippedCount, horizonThrough, firstOccurrenceDate, serviceName }`.
3. **No email call in this phase.** Step 6 imports `sendRecurringSeriesCreatedEmail`, a Phase D deliverable — as written, Phase C could not pass its own tsc gate. Resolved without reordering phases: C ships the action, D lands the fn and wires it.
4. **No duplicate audit row.** The RPC writes its own `recurring_series_created` row internally; a second one from the action would double-count. (The cancel path has no RPC, so its audit insert stands.)
5. **Three defects in the plan's own code text**, fixed: `after_state: { cancelled_at: template.id }` wrote a template id into a timestamp field on a column that wasn't even selected; `getLondonTodayISO()` duplicated the existing `getTodayIsoDate()` in `_helpers.ts`; and `cancelRecurringSeries` omitted the `.active` check every comparable action applies.

The verifier additionally confirmed live that `service_role` holds UPDATE on `recurring_booking_templates` and `bookings` — the §3b pre-flight that cost C-04a a full cycle. It does.

### 3.2 — Phase D (`1d2ed98`)

Registers a 17th template, `recurring_series_created_client`, across 10 files. The renderer is **sync with positional `overrides`**, matching `renderBookingRestoredEmail` per §0.8 — not the async `providedOverrides` variant.

**The load-bearing check passed.** One `resolveTemplateOverrides` call feeds `resolveSubject` *and* both render legs, so the HTML and plain-text parts cannot disagree (C-15's F-6 defect) and the subject cannot be a hardcoded literal (C-15's AC2 defect). `subjectDefault` is byte-identical to the literal a zero-override send emits — C-15's fix round found 12 of 16 disagreeing, so this was checked character-for-character. Escaping is `escapeHtml(substituteVars(...))` at every new site, and the specs assert on the real `sendEmail` argument rather than a mock's own return.

A plain-text renderer was added beyond the plan's literal wording; the verifier confirmed `sendTrackedEmail`'s `text` field is non-optional, so tsc would fail without it — necessary, not scope.

### 3.3 — Phase E (`66afd6b`)

**The plan's locked approach did not survive contact with the component.** Step 14 says "conditionally render two different forms", which read literally would fork a ~900-line JSX subtree — a clear rule-3 violation. And it cannot mean swapping one hook's action, because `createRecurringSeries` and `createManualBooking` return **different state types** and `useActionState` binds its state type at the call site (Rules of Hooks also forbid calling it conditionally).

Implemented instead: **two `useActionState` hooks called unconditionally, one shared `<form>` and one shared JSX tree, three derived bindings** (`formAction` / `formPending` / `formState`). Nine former `pending`/`state.` reference sites were repointed. Key-based remount was rejected outright — it would destroy steps 1–3's local state the instant the toggle flipped.

Consent is threaded per §B6: the **existing** step-4 checkbox feeds `recurringSchema`'s `z.literal(true)`, which rejects before the RPC, and `p_consent_acknowledged` is passed explicitly rather than relying on the RPC default. No second checkbox — `RecurringSection` deliberately omits `consent_acknowledged` and `client_id` because `FormData.get` returns the first entry and a duplicate would shadow the real one.

### 3.4 — Logged, not fixed (rule 6a) — two worth the Owner's attention

- **⚠️ Recurring is only reachable from `/admin/bookings/new?clientId=…`.** `createRecurringSeries` needs an existing `client_id`, which the form emits only when prefilled from a client record. An operator starting a booking from scratch cannot create a client and a series in one pass. Surfaced honestly in-section (disabled toggle with the reason) rather than failing at submit — but it is a real workflow limit that should be seen before the Phase I sweep.
- **End-condition errors are inline-only and do not gate the submit button.** Step 4's `isStepReady` is still just `consentAcknowledged`, so an empty visit count or an end date before the first visit shows an inline error yet can still be submitted, where the action rejects it. Gating would have meant lifting section validity into the parent — deferred rather than widened.
- `handleFormSubmit` sets the `booking-new-created-toast` key in both modes, so a stale "booking created" toast can fire after a recurring submit redirects to the series view.
- No client-side occurrence preview exists, so the section's banner is worded cadence-agnostically. Brief §4.1's "the first 12 occurrences" would have been **wrong for two of three cadences** — the real first batch is 12 weekly / 6 fortnightly / 3 monthly.

## B6 — Owner decisions, taken in chat 2026-08-02 (all three answered)

**1. Files-touched list WIDENED — approved ("approve all").** Protocol rule 6(b) STOP raised before Phase D and answered. The following are now in scope for C-02, because the plan's own steps cannot complete without them:

| File | Why the plan's own step forces it |
|---|---|
| `src/lib/email/sample-data.ts` | `sample-data.test.ts` asserts `SAMPLE_RENDERERS` keys ≡ `TEMPLATES` ids; a 17th template without a renderer entry fails it |
| `src/lib/email/__tests__/resolveSubject.test.ts` | asserts `CASES` covers every registered template |
| `src/lib/email/__tests__/registry-defaults.test.ts` | hardcoded `TEMPLATES.length` count (already anticipated in §0.5) |
| `src/app/admin/email-templates/preview/[id]/__tests__/route.test.ts` | hardcoded id array — does not auto-break, added for coverage parity |
| `src/app/admin/bookings/BookingsChrome.tsx` | Step 23's Series filter chip lives here; `page.tsx` only mounts the component |
| `src/app/admin/bookings/BookingCard.tsx` | Step 23's row-level recurring icon lives here |

**2. Phase B Step 5 — DEFERRED to the Owner's Phase I sweep** (route (a)). No production writes, no Supabase dev branch. Plan §3.2's critical-path test 1 ("Owner creates weekly until_cancelled series → 12 occurrences materialise") exercises the same RPC through the admin form, covering Phases C and E in the same pass. The RPC's contract is pinned statically meanwhile (24 guards, 6-table write order, exact signature — `redesign/evidence/C-02/phase-b-rpc-verification.md`). **Step 5 is closed as Owner-deferred, not as passed.**

**3. Consent — the recurring path MUST be gated.** `createManualBooking` requires an explicit consent tick and rejects without it; the recurring RPC defaults `p_consent_acknowledged` to `true`, so as built a 12-visit series was created with implicit consent while a single visit needed an explicit one. Owner ruled: gate it. **Assigned to Phase E**, where `RecurringSection` mounts inside the same step-4 block as the existing checkbox — the form field and the action wiring land and get tested together. Phase E must add `consent_acknowledged` to `recurringSchema`, reject when false, and pass `p_consent_acknowledged` explicitly rather than relying on the RPC default.

## B5 — Security hygiene note for the Owner

A prep agent grepping `.env` for *key names* matched whole lines and pulled **real secret values** (Supabase service-role key, Resend API key, Cloudflare token, Sentry auth token, `CRON_SECRET`) into its own tool output. It did not reproduce them in its report and none reached a commit. No exposure beyond this machine's temp transcript directory, which already sits alongside `.env` itself — but worth knowing, and worth avoiding broad greps against `.env` in future dispatches.

