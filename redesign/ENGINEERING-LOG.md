# Engineering Log — Track A Backend Gap-Fill

**Context.** Phase 7 of the admin redesign recipe (`/redesign/impeccable-v5-latest-stable.html`) is paused. Phase 7 Gate 0 (Production Readiness Re-check, `/redesign/FINAL-REPORT.md`) flagged 5 distinct `BLOCKS-REDESIGN` shortfalls — 4 actionable build-or-verify gaps. This log narrates the parallel engineering effort that resolves them.

**Branch.** `engineering/track-a-backend-gap-fill` off `redesign/start-state` HEAD `256d87c` (proposed — awaiting user confirmation before checkout because the working tree carries uncommitted Phase 7 work).

**Verification discipline.** `superpowers:verification-before-completion` — evidence before claims. Each work-item below earns its HANDLED flip only when a corresponding file lands in `/redesign/backend-smoke-tests/` and the BUSINESS-COMPLETENESS status is updated.

**Zone-2 guard.** Pause for explicit user confirmation before: enabling Supabase extensions (`pg_cron`, `pg_net`); creating Edge Functions; applying migrations to the production DB; triggering Sentry from the live project; creating throwaway Supabase projects or branches.

---

## Session plan (5 sessions across this engineering pause)

To be reconciled once the user approves the proposed order. Header section will record actual session boundaries.

---

## Work item 2C-10 — `email_template_overrides` table

*Plan file: `redesign/backend-plans/BUILD-email-template-overrides-table.md`.*
*Triggered by: `email-templates-brief.md` §5, §10 Q2.*
*Smoke test: `redesign/backend-smoke-tests/email-template-overrides-table-2026-05-19.md`.*

**Status (2026-05-19):** TABLE BUILT — Session 1 complete; HANDLED status deferred until Session 2 wires the Save flow end-to-end.

**Migrations applied** (production project `Rahma-therapy` / `twzutkfgqclqurvkmvqz`):
- `20260519120000_email_template_overrides_table` — CREATE TABLE with 6 columns + UNIQUE(template_id, field_key); RLS enabled with 4 policies (SELECT for any active staff; INSERT/UPDATE/DELETE gated by `manage_email_templates OR manage_settings`); `grant select, insert, update, delete on public.email_template_overrides to service_role`; new `manage_email_templates` permission row inserted (category=emails, scope=global, risk_level=standard, is_system=true, active=true, **unassigned to any role**).
- `20260519121000_email_template_overrides_authenticated_select_grant` — one-line follow-up: `grant select on public.email_template_overrides to authenticated`. Matches codebase convention (every other table grants SELECT-only to authenticated; mutations route via service_role through server actions to preserve audit-log writes).

**Smoke-test outcome:** Caught GRANT defect, fixed via follow-up migration; full transcript at `/redesign/backend-smoke-tests/email-template-overrides-table-2026-05-19.txt`. All 6 test categories (schema, indexes, constraints, RLS policies, service_role INSERT, Therapist INSERT denial, Therapist SELECT visibility with impersonation pre-check, UNIQUE constraint, permission registry row + unassigned-to-any-role) PASS on the re-run.

**Defect-caught note:** Initial migration shipped without `GRANT SELECT` to authenticated; caught by smoke tests 2b/2c; fixed via one-line follow-up migration `20260519121000`.

**Not flipped:** BUSINESS-COMPLETENESS.md 2C-10 status remains NOT-STARTED. Per the recipe, HANDLED is earned only when the Save flow works end-to-end — that's Session 2's outcome.

---

## Work item BUILD-email-templates-actions — `saveTemplateOverride` + `sendTemplateManually`

*Plan file: `redesign/backend-plans/BUILD-email-templates-actions.md`.*
*Depends on: 2C-10 table existing.*
*Smoke test: `redesign/backend-smoke-tests/email-templates-actions.md` (to be created).*

(empty — session not yet started)

---

## Work item 2A-16 + 2C-9 — Automated booking reminders + cron infrastructure

*Plan file: `redesign/backend-plans/BUILD-automated-booking-reminders.md`.*
*Triggered by: `BUSINESS-COMPLETENESS.md` 2A-16, confirmed in scope by user during Phase 1 Step 3 review.*
*Smoke test: `redesign/backend-smoke-tests/2A-16-automated-booking-reminders.md` (to be created).*

(empty — session not yet started)

---

## Work item 2A-6 + 2A-9 — Phase 7 a11y audit (PARTIAL → HANDLED)

*Driver: `BUSINESS-COMPLETENESS.md:65` and `:92` defer the HANDLED flip to a Phase 7 "audit of implementations" pass.*
*Smoke test: `redesign/backend-smoke-tests/2A-6-2A-9-a11y-audit.md` (to be created).*

(empty — session not yet started)

---

## Work item Layer 1 — L1-a/L1-b Sentry roundtrip + L1-c backup restore drill

*Driver: `FINAL-REPORT.md` "Layer 1 Runtime Verification" — two DEFER and one FAIL pending user authorisation.*
*Smoke test: `redesign/backend-smoke-tests/L1-runtime-verification.md` (to be created).*

(empty — session not yet started)
