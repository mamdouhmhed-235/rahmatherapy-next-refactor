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

*C-02 pre-flight complete, implementation blocked at the Phase A HARD-STOP. Inherited baseline: tsc 0 · lint 59E/7W six files · vitest 5 failed / 1181 passed (1186) · build clean.*
