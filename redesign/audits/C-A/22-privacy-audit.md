# C-A.1 #22 — `/admin/privacy` audit

**Surface:** `/admin/privacy` (privacy operations — GDPR request triage)
**Audit type:** C-A.1 discovery (no fixes)
**Master plan starting verdict:** ❌ UNKNOWN
**Audit verdict:** ⚠️ **PARTIAL** — surface exists and is well-designed for triage, but **fulfilment machinery is absent**. UI is a "lie" for deletion_review and data_export.
**Date:** 2026-05-25 | **Pre-state:** HEAD `12ded5c`.
**Source:** `page.tsx` (838 LOC) + 4 colocated. Subagent + Owner @ 1280 + 375.
**Screenshots:** 2 PNGs.

---

## Bugs found

### B-87 — **P0 GDPR: marking a deletion_review "Completed" does NOT delete the client**
**Severity:** P0 (regulatory)
**Source:** subagent — `updatePrivacyRequestStatus` (`actions.ts:24-84`) updates status only. No delete/anonymise/cascade logic anywhere. `createClientPrivacyRequest` inserts a row but does not act on it. So if an admin reviews a deletion request and clicks "Completed", the client + bookings + notes remain in the DB.
**Implication:** the clinic could miss a UK GDPR Article 17 right-to-erasure obligation while the system reports the request as fulfilled. Audit log says completed; data still there.
**Items for C-B planning:** Band C (or a dedicated compliance band) MUST add cascade-delete-or-anonymise on "completed" transition for deletion_review type.

### B-88 — **P0 GDPR: no SAR export generator exists**
**Severity:** P0 (regulatory — 30-day UK GDPR deadline)
**Source:** subagent — no PDF / CSV / JSON / ZIP export logic in the surface or actions. `sensitive_notes` are flagged as "not in exports" (page.tsx:772) but the surface offers no export to flag-out-of.
**Items for C-B:** a `data_export` request fulfilled "Completed" produces nothing. Need an actual generator that bundles client + bookings + notes (excluding sensitive_notes) as a downloadable file.

### B-89 — **P0 GDPR: no ICO breach notification workflow (72h)**
**Severity:** P0 (regulatory)
**Source:** subagent — no escalation timer, no breach-detection trigger, no automated alert if a SAR ages past 30 days. The ConfirmActionModal copy at brief line 139 mentions ICO escalation but no system trigger exists.
**Items for C-B:** out-of-Band-C scope per master-plan scope clarification 5 ("Cupping/hijama-specific compliance is OUT of Band C scope"). Possibly a separate compliance band — but worth flagging as a Tier-A risk that the user should sequence.

### B-90 — **P1: no `due_date` column on `client_privacy_requests`**
**Severity:** P1 (no 30-day visibility)
**Source:** subagent. `daysSince()` exists (`page.tsx:183-185`) but isn't wired to a deadline UI. No red-flag aging.
**Items:** add `due_date generated always as (created_at + interval '30 days')` column + visual SLA badge.

### B-91 — **P1: PrivacyFilterBar backend is FAKE**
**Severity:** medium (works in URL but server ignores it)
**Source:** subagent — `page.tsx:331, :450` explicit `// FAKE — server ignores until BUILD plan` markers. Filter UI exists but server query doesn't apply the filters.
**Items:** wire backend filter query.

### B-92 — **P2: unbounded query on main list** (no `.limit()`)
**Source:** subagent `page.tsx:224-230`. Maps to C-09.

### B-93 — Audit trail incomplete: only status transitions logged, not reads
**Severity:** P2
**Source:** subagent. Sensitive-note review (read-only) leaves no audit trace. UK ICO recommends logging access to special-category health data.
**Items:** instrument read events for sensitive_notes.

### B-94 — `PrivacyStatusForm.tsx:184` unguarded `animate-spin`
**Severity:** low (consistent pattern).

---

## Strengths

### PE-54 — Surface IS implemented; master-plan ❌ UNKNOWN verdict is wrong
**Source:** 838 LOC + 4 components. Lifecycle states (Received / Reviewing / Completed / Declined), request types (data_export / correction / deletion_review / sensitive_note_review), ConfirmActionModal on completed/declined transitions, sensitive-notes rail.

### PE-55 — RBAC tight: `requirePrivacyManager()` + `MANAGE_PRIVACY_OPERATIONS` permission
**Source:** subagent `actions.ts:19-22`, `page.tsx:207-220`. Only Owner + Admin/Manager hold the permission by default.

### PE-56 — RLS hardening migration exists
**Source:** subagent — `supabase/migrations/20260503230000_phase9_privacy_rls_hardening.sql`. Phase-9 work confirmed RLS at DB level.

### PE-57 — Mobile UX: stat strip stacks, filter behind sheet, sensitive-rail collapses to `<details>` below xl
**Source:** subagent. Adaptive.

---

## Hardcoded

`PrivacyStatusForm.tsx:64, :67` toast copy; CopyIdButton.tsx:18 copy fallback. Standard.

---

## Production-DB note

**Visible client name on the surface:** "Phase10 E2E Claim Client" — test data on the privacy surface too. V-16 hygiene issue carries across.

---

## Items for plans

| # | Finding | Severity | Item | Home |
|---|---|---|---|---|
| 1 | B-87 — completion lies, no cascade delete | P0 | Wire cascade-delete on deletion_review completion | **NEW user item OR C-06 expansion** |
| 2 | B-88 — no SAR export | P0 | Build SAR export generator (PDF/JSON) | **NEW user item — UK GDPR critical** |
| 3 | B-89 — no ICO breach workflow | P0 | Separate compliance band (out-of-Band-C per scope clarification 5) |
| 4 | B-90 — no SLA timer | P1 | Add `due_date` + 30-day badge | C-12+ |
| 5 | B-91 — filter backend FAKE | P1 | Wire server-side filter | C-09 / C-12+ |
| 6 | B-92 — unbounded query | P2 | Add `.limit()` + cursor | C-09 |
| 7 | B-93 — sensitive-note read events not logged | P2 | Instrument | C-12+ |
| 8 | B-94 — animate-spin | low | motion-safe: | C-11 |
| — | Master-plan Part-1 update | — | Move /admin/privacy from ❌ UNKNOWN to ⚠️ PARTIAL | Master plan housekeeping |

---

## Hand-off

**State:** 2 screenshots. 0 code changes. **HEADLINE: GDPR compliance gap is the most consequential finding of the entire C-A audit phase so far.** This needs a discussion with the user about scope expansion vs deferring to a separate compliance band.
**Next surface:** #21 `/admin/roles + /[roleId]`.

*End of privacy audit.*
