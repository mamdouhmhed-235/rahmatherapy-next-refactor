# Band C — Consolidated Migration Ledger

**Created:** 2026-07-26 (plan-refinement pass) · **Authority:** derived from all 23 plan reviews + verifier verdicts + a read-only production schema snapshot (2026-07-25, project `twzutkfgqclqurvkmvqz`) · **Status annotations dated 2026-07-26** reflect the refinement commits that landed the same day (`docs(redesign): C-NN refinement` series).

**Scope confirmed:** of 23 Band-C plans, **9 carry a schema migration**: C-01, C-02, C-03 (conditional — confirmed it WILL apply), C-04a, C-06, C-08, C-11, C-14, C-18. The other 14 (C-05, C-07, C-09, C-10, C-13, C-15, C-16, C-17, C-19, C-20, C-21, C-22, C-23, C-FIELDWORK) declare "no migrations" in their plan text — confirmed by DDL-keyword grep. C-05 is schema-*dependent* on C-06's migration without shipping one of its own (see §3).

Every migration below is Zone-2 (explicit user confirmation required before `mcp__supabase__apply_migration`). **Update 2026-07-26:** every migration step in every plan now carries a formatted, grep-able `⛔ HARD-STOP — ZONE-2` block (added during the refinement pass; verify with `grep -l "HARD-STOP" redesign/plans/C-phase/C-*plan.md`). The review-time finding that zero markers existed is resolved.

---

## 1 — Migration-by-migration ledger

### C-01 — Review-request email infrastructure

- **File:** `supabase/migrations/<ts>_c01_review_email_infrastructure.sql` · **Phase/step:** Phase A, Step 1–2
- **DDL:** `bookings.completed_at` + `bookings.review_email_sent_at` (both `ADD COLUMN IF NOT EXISTS timestamptz`); `bookings_set_completed_at()` function + `bookings_completed_at_trigger` (`BEFORE UPDATE OF status`; stamps on transition into `completed`, preserved on reopen); backfill (2 existing completed bookings; Owner test account force-suppressed). Conditional event_type CHECK extension **confirmed SKIPPED** — `event_type` is free text, no CHECK exists.
- **Ordering:** 4th among migration-bearing plans. No DDL dependency — new, uncontested columns.
- **Schema premises (verified 2026-07-25):** both columns absent today — HOLDS. No pg_cron — HOLDS (Cloudflare Workers cron is the pattern).
- **Post-apply verification:**
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name='bookings' AND column_name IN ('completed_at','review_email_sent_at'); -- expect 2 rows
  SELECT tgname FROM pg_trigger WHERE tgname = 'bookings_completed_at_trigger'; -- expect 1 row
  SELECT COUNT(*) FROM bookings
  WHERE status='completed' AND (completed_at IS NULL OR review_email_sent_at IS NULL); -- expect 0
  ```

### C-02 — Recurring / standing bookings

- **File:** `supabase/migrations/<ts>_c02_recurring_bookings.sql` · **Phase/step:** Phase A, Step 1–2
- **DDL:** `services.allow_recurrence boolean NOT NULL DEFAULT true`; new table `recurring_booking_templates` (`client_id … ON DELETE RESTRICT`, `service_id … ON DELETE RESTRICT`, `bound_therapist_id … ON DELETE SET NULL`, cadence/end-type CHECKs, consistency constraints, horizon + cancellation + address-snapshot columns) + 3 indexes + RLS (service-role ALL, authenticated SELECT); `bookings.recurring_template_id … ON DELETE SET NULL` + partial index; `compute_occurrence_dates()` + `create_recurring_booking_series` RPCs (full DDL lifted verbatim from brief §2.4 at impl).
- **Ordering — load-bearing, not cosmetic:** ships late (`… → C-13 → C-02 → …`). `recurring_booking_templates.client_id ON DELETE RESTRICT` requires `deleteClient` to cancel active templates first. **Resolved 2026-07-26 (D1):** the recurring-cascade branch is now written into C-06 Step 9 (commit `7993139`); C-02's cross-reference updated (commit `3e91a33`). Because C-06 ships (and is implemented) before C-02, the cascade code exists before this FK ever does. Also soft-gated on C-01 (cron pattern) + C-08 (template-override pattern) per its own pre-flight — now marker-verifiable gates.
- **Schema premises:** all greenfield objects absent today — HOLDS.
- **Post-apply verification:** re-run the plan's three pre-flight negative-existence queries expecting 1 row each (`recurring_booking_templates` table; `services.allow_recurrence`; `bookings.recurring_template_id`).

### C-03 — Enquiry→booking conversion (conditional index — WILL apply)

- **File:** `supabase/migrations/<ts>_c03_enquiries_converted_booking_index.sql` · **Phase/step:** Phase A, Step 1
- **DDL:** `CREATE INDEX IF NOT EXISTS idx_enquiries_converted_booking ON enquiries (converted_booking_id) WHERE converted_booking_id IS NOT NULL;`
- **Premise:** production has NO such index (verified 2026-07-25) → the conditional resolves to APPLY. Independent; no other plan touches `enquiries`.
- **Post-apply verification:** `SELECT indexname FROM pg_indexes WHERE tablename='enquiries' AND indexdef LIKE '%converted_booking_id%';` — expect 1 row.

### C-04a — Cancellation restore: delayed-email infra + unified `cancelled_at`

- **File:** `supabase/migrations/<ts>_c04a_scheduled_emails.sql` · **Phase/step:** Phase F, Step 10
- **DDL:** `email_delivery_events` +5 columns (`scheduled_for`, `html_payload`, `text_payload`, `to_email`, `subject`) + partial index `idx_email_delivery_events_scheduled_pending` (`WHERE scheduled_for IS NOT NULL AND delivery_status='queued'`); `bookings.cancelled_at timestamptz` (S7) + two backfill UPDATEs (customer timestamp first, then latest cancel audit row; unreached rows stay NULL → fail-closed as expired). The separate ENUM-premised event-type migration is **confirmed SKIPPED** (free-text event_type).
- **Ordering:** 2nd (before C-05 — Restore is C-05's escape hatch). No DDL dependency on C-01/C-06/C-08 (disjoint columns).
- **Schema premises:** all 5 columns + `cancelled_at` absent; `customer_cancelled_at` exists as backfill source; audit_logs free-text — all HOLD.
- **Post-apply verification:** 5-column existence query (expect 5 rows) + stamped/unstamped cancelled-booking counts reported to the user.
- **Code-consumer status:** the review-time defects around this migration's consumers (fictional cron dispatch, single-cron wrangler premise, event-type naming drift) were **resolved 2026-07-26** (D2 keep `booking_cancellation_customer`; D3 order-agnostic cron-dispatch rewrite in both C-01 and C-04a; D26 notifications-region annotations) — commit `3826b9d`.

### C-06 — Client CRUD hardening (largest schema footprint — apply FIRST)

- **File:** `supabase/migrations/<ts>_c06_client_crud_hardening.sql` · **Phase/step:** Phase E, Step 12 (Step 13 amendment folded in)
- **DDL:** `clients.deleted_at` + `bookings.deleted_at`; `bookings.contact_email DROP NOT NULL`; 2 new `permissions` rows (`manage_client_identity_fields`, `manage_client_destructive_ops`) granted Owner+Admin only; full `create_booking_request` RPC rewrite (positional params preserved, 2 new trailing defaults; destructive `ON CONFLICT (email) DO UPDATE` → `DO NOTHING` + `duplicate_client_exists` exception + phone-fallback dedup branch for null-email admin bookings).
- **Ordering:** **1st — every downstream constraint pivots on it.** (a) C-05's `ensureBookingActive` unconditionally SELECTs `deleted_at` columns (hard gate written into C-05's pre-flight 2026-07-26, D4). (b) **deleteClient recurring-cascade now included (D1, 2026-07-26)** — Step 9 cancels active recurring templates (future-proofing for C-02's RESTRICT FK; stamps `cancelled_at` per C-04a S7).
- **Schema premises:** `deleted_at` columns absent; `contact_email` NOT NULL today (the DROP is meaningful); `clients.email` nullable + UNIQUE (multiple NULLs fine — load-bearing for phone-fallback); both permission names absent — all HOLD.
- **Post-apply verification:** `pg_get_functiondef('public.create_booking_request'::regproc)` shows new body; `contact_email` `is_nullable='YES'`; createBookingTransaction vitest file goes green.

### C-08 — Business-notification bundle + resend metadata

- **File:** `supabase/migrations/<ts>_c08_notification_email_and_metadata.sql` · **Phase/step:** Phase D, Step 13 (absorbs the old Step 7 conditional)
- **DDL:** `staff_profiles.notification_email text` + `staff_profiles.business_notification_prefs jsonb` + Owner seed (`{"enabled": true}` for active Owner rows only); `email_delivery_events.metadata jsonb DEFAULT '{}'`.
- **Ordering:** order-independent vs C-11 (disjoint `staff_profiles` columns); C-15/C-13 consume its patterns but not its tables.
- **Schema premises:** all three columns absent; event_type unconstrained — HOLD.
- **Post-apply verification:** column-existence query + "only active-Owner rows seeded" spot query.
- **OPEN ITEM (unchanged from review — verify before C-08 ships):** C-08's pre-flight treats `resend_booking_emails` / `manage_email_templates` permission names as already existing; no Band-C migration creates `resend_booking_emails`, and the schema snapshot records column shape, not row contents. Spot-check the live `permissions` table (read-only) at C-08 pre-flight.

### C-11 — Dashboard variants: theme preference

- **File:** `supabase/migrations/<ts>_c11_theme_preference.sql` · **Phase/step:** Phase E, Step 10
- **DDL:** `staff_profiles.theme_preference text` + CHECK (`NULL | 'dark' | 'light' | 'system'`).
- **Ordering:** gated on C-FIELDWORK merging first (code dependency, not schema). No DDL conflict with C-08.
- **Schema premise:** column absent — HOLDS.
- **Post-apply verification:** column-existence query; post-toggle spot-read on the Owner row.

### C-14 — Granular working hours: override-date uniqueness drop (riskiest DDL operationally)

- **File:** `supabase/migrations/<ts>_c14_override_breaks.sql` (+ optional atomic-save RPC file) · **Phase/step:** Phase C, Step 12
- **DDL:** `DROP INDEX IF EXISTS availability_overrides_override_date_key;` + confirmed-name drop of `staff_availability_overrides_staff_id_override_date_key`.
- **ATOMIC CO-DEPLOY REQUIREMENT (written into the plan 2026-07-26, D12 — commit for C-14 refinement):** the migration must land in the same deploy as (1) `createAvailabilityOverride`'s upsert rewrite (its `onConflict:'override_date'` errors at runtime the moment the index drops), (2) `assignment-eligibility.ts` `.maybeSingle()` widening (silently wrong once any date has 2+ rows), (3) the replacement duplicate-date guard for staff overrides. All three are now in C-14's files-touched list and Phase C verify checkpoint.
- **Serialization (2026-07-26):** C-23 Phase B lands BEFORE C-14's engine phases (both edit `availability.ts`; both plans carry the note). The engine also serves the LIVE public customer calendar — treat every Phase C/D engine edit as a production customer-surface change.
- **Schema premises:** recurring tables have no day-uniqueness (Phases A/B zero-schema) — HOLDS; both unique drop-targets exist — HOLD.
- **Post-apply verification:** `pg_indexes` unique scan on both tables → drop-targets gone.

### C-18 — Cookie consent: consent-proof table (lowest-risk migration)

- **File:** `supabase/migrations/<ts>_c18_consent_events.sql` · **Phase/step:** Phase E, Step 9
- **DDL:** `CREATE TABLE consent_events (id, created_at, consent_id, banner_version, purposes_offered jsonb, choices jsonb, action CHECK IN ('granted','rejected','updated','withdrawn'))` + RLS enabled with **no policies** (deny-all; service-role writes via `POST /api/consent-events` only).
- **Ordering:** independent; co-ships with C-17 (code pairing, not DDL).
- **Schema premise:** table absent — HOLDS.
- **Post-apply verification:** `to_regclass('public.consent_events')` non-null; `relrowsecurity` true; anon insert/select denied.

---

## 2 — Per-table view (tables hit by ≥2 plans)

### `bookings` ← C-01, C-02, C-04a, C-06

| Plan | Change |
|---|---|
| C-01 | `completed_at`, `review_email_sent_at` + status trigger |
| C-02 | `recurring_template_id` (FK) |
| C-04a | `cancelled_at` |
| C-06 | `deleted_at`, `contact_email` NOT NULL → nullable |

**Conflict verdict: NONE.** Five distinct additive columns, all `IF NOT EXISTS`, order-commutative. `cancelled_at` (any-path) deliberately coexists with the pre-existing `customer_cancelled_at` (customer-flow) — documented + backfilled, not a collision. C-06's RPC only INSERTs (no interaction with C-01's status trigger); C-01's Owner-suppression string check is NULL-safe post-C-06.
**Real ordering constraints (code-level, not DDL):** C-06 migration before C-05 code (hard gate now in C-05 pre-flight, D4); C-06's cascade before C-02's FK (**resolved by D1** — cascade ships inside C-06 itself).

### `clients` ← C-06 (column), C-02 (inbound RESTRICT FK)

**Conflict verdict: NONE at DDL level.** The review-time coordination gap (deleteClient vs the future FK) is **resolved 2026-07-26 (D1)**: C-06 Step 9 cancels active recurring templates before soft-delete, so the cascade exists before the FK is ever created.

### `email_delivery_events` ← C-04a (+5 cols, partial index), C-08 (metadata)

**Conflict verdict: NONE.** Six distinct additive columns, order-commutative. C-01/C-04a event_type values need no DDL (free text).

### `staff_profiles` ← C-08 (2 cols), C-11 (theme_preference)

**Conflict verdict: NONE.** Distinct columns, order-commutative in both directions.

### Single-plan tables

`permissions`/`role_permissions` ← C-06 only (C-08 reads, never creates — see its OPEN ITEM). `consent_events` ← C-18. `availability_overrides`/`staff_availability_overrides` ← C-14 (but NOT single-plan in consumers — see the C-14 atomic co-deploy block). `enquiries` ← C-03.

---

## 3 — Programme-wide migration sequence

Filtered to migration-bearing plans, in recommended execution order. **Every row's plan now carries a formatted HARD-STOP block at the apply step (2026-07-26).**

| # | Plan | Migration | Notes |
|---|---|---|---|
| 1 | **C-06** | `deleted_at` ×2, `contact_email` nullable, 2 permissions, RPC rewrite | Highest blast radius; everything pivots on it. Cascade (D1) included. |
| 2 | **C-04a** | `email_delivery_events` ×5 + index, `bookings.cancelled_at` + backfill | HARD-STOP requires confirming the `audit_logs.after_state` JSON shape before the backfill runs. |
| — | *(C-05 — no migration; schema-dependent on #1 being live — hard gate in its pre-flight)* | | |
| 3 | **C-01** | `completed_at`/`review_email_sent_at` + trigger + backfill | |
| 4 | **C-11** | `theme_preference` + CHECK | Also gated on C-FIELDWORK code merge. |
| 5 | **C-08** | `staff_profiles` ×2 + `metadata` | Run the permissions spot-check (OPEN ITEM) first. |
| 6 | **C-02** | `recurring_booking_templates` + FK + 2 RPCs | Cascade already live via C-06 (D1). |
| 7 | **C-03** | conditional index (confirmed will apply) | |
| ind. | **C-14** | unique-index drops | ATOMIC co-deploy with its 3 code fixes (D12); after C-23 Phase B. |
| ind. | **C-18** | `consent_events` + RLS | Lowest risk; additive only, zero existing consumers. |

---

## 4 — Summary

- 9 of 23 plans migrate; per-table conflict verdicts **all NONE at the DDL level** — proven per table, not asserted (distinct column names, additive idempotent DDL throughout).
- Real ordering constraints are **code-level**: C-06→C-05 (hard gate, D4) and C-06-cascade→C-02-FK (**resolved inside C-06 via D1**).
- C-14 Phase C is the operationally riskiest migration (atomic co-deploy, live engine) — its plan now carries the full requirement (D12).
- Every migration step carries a grep-able HARD-STOP; an orchestrator can mechanically enforce the pause (`grep -n "HARD-STOP" <plan>`).
- One open verification item survives into C-C: the `resend_booking_emails` permission-row existence check at C-08 pre-flight (read-only).
