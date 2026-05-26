# C-A.1 — Programme summary (end-of-phase consolidation)

**Status:** ✅ COMPLETE — all 25 surfaces audited
**Date completed:** 2026-05-25
**Branch:** `redesign/start-state` HEAD `a6d3afc`
**Commits in C-A.1:** 22 (from `b9c1403` dashboard audit through `a6d3afc` final bundle)
**Total commits ahead of master at C-A.1 close:** 235

**What this doc is:** the single-source-of-truth handoff between C-A.1 (per-page audit) and what comes next (C-A.2 cross-page workflow audit / C-A.3 role-day audit / C-B plan-writing). Read this before opening any per-surface audit file.

**Operating discipline reminder:** every C-phase file embeds or references `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`. Hard rules carry forward (no new deps, no `border-l-4`, motion-reduce on every animation, RBAC via `getStaffProfile()` then `createSupabaseAdminClient()`, etc.).

---

## 1 — Per-surface index

| # | Surface | Audit file | Verdict | Material findings |
|---|---|---|---|---|
| 01 | `/admin/dashboard` | `01-dashboard-audit.md` | ✅ READY | Coordinator "()" empty parens · 3 urgency reps redundant · no quick-add CTAs · C-11 dark mode greenfield |
| 02 | `/admin/bookings` (list) | `02-bookings-list-audit.md` | ✅ READY | C-05 root cause at `actions.ts:269-275` · unbounded list (C-09) · production-DB test data |
| 03 | `/admin/bookings/new` | `03-bookings-new-audit.md` | ⚠️ → ✅ | C-03 prefill works but service NOT pre-selected · no dup-client guard · `gender_restrictions` unused |
| 04 | `/admin/bookings/[bookingId]` | `04-bookings-detail-audit.md` | ✅ EXCEPTIONAL | **C-05 is 4 edits not 1** (3 UI predicates + server action) · C-04 "restore from audit log" copy is misleading — actual restore is Status form |
| 05 | `/admin/clients` (list) | `05-clients-list-audit.md` | ✅ READY | Cosmetic pagination (PAGE_SIZE=50 in memory, DB unbounded) · zero delete · GDPR `privacy_requests` defined but not surfaced |
| 06 | `/admin/clients/new` | `06-clients-new-audit.md` | ⚠️ → ✅ | `DuplicateWarningBanner` pattern at lines 79-489 → lift to ManualBookingForm for B-09 fix |
| 07 | `/admin/clients/[clientId]` | `07-client-detail-audit.md` | ✅ READY | Booking history unbounded · client profile fields NOT EDITABLE anywhere · B-6 LTV ribbon verified live |
| 08 | `/admin/enquiries` | `08-enquiries-audit.md` | ⚠️ PARTIAL | **C-03 entry point EXISTS at `EnquiryList.tsx:522`** · 2 `// FAKE: BUILD-enquiries-filter-query` markers · 3/3 test enquiries in DB |
| 09 | `/admin/calendar` | `09-calendar-audit.md` | ✅ READY | Cancelled bookings EXCLUDED from grid (correct) · read-only by design · month grid lacks ARIA role |
| 10 | `/admin/staff` (list) | `10-staff-list-audit.md` | ⚠️ PARTIAL | 2 more FAKE markers · 11/12 staff = test data (worst hygiene) |
| 11 | `/admin/staff/[staffId]` | `11-staff-detail-audit.md` | ✅ EXCEPTIONAL | **Cleanest surface audited** — 0 TODOs / 0 unguarded animate-spin / 0 `border-l-4` · reference template for RBAC narrowing + permission matrix + mobile sticky save bar |
| 12 | `/admin/staff/[staffId]/availability` | `12-staff-availability-audit.md` | ⚠️ PARTIAL | UI exposes 2 modes; backend supports 3 (`global_with_overrides` unreachable) · 2 `data-redesign-fake` markers · no edit-in-place · no overlap detection |
| 13 | `/admin/staff/[staffId]/performance` | `13-staff-performance-audit.md` | ✅ READY | Thin wrapper around `<PerformanceSurface>` · self-redirect to /admin/me · no `inactive_since` column documented |
| 14 | `/admin/me` | `14-admin-me-audit.md` | ✅ READY | **Master-plan C-09 example is STALE** — `PerformanceSurface.tsx:319,325` caps at 20 displayed / 100 fetched |
| 15 | `/admin/availability` (global) | `15-availability-global-audit.md` | ⚠️ PARTIAL | No "N staff affected" hint · no unsaved-changes guard · 3 more animate-spin |
| 16 | `/admin/services` | `16-services-audit.md` | ✅ READY | **Has working delete-with-in-use-guard** — C-06 template |
| 17 | `/admin/settings` | `17-settings-audit.md` | ✅ READY | Best mobile sticky save bar · no concurrent-edit guard (medium risk) |
| 18 | `/admin/operations` | `18-operations-audit.md` | ⚠️ PARTIAL | 5 redesign markers (4 FAKE + 1 needs-photo) · **proper pagination + bulk resolve — C-09 template** |
| 19 | `/admin/emails` | `19-emails-audit.md` | ⚠️ PARTIAL | 7 event types in DOM / 9 templates in code · **C-08 missing: assignment / claim / client-assigned** · no Resend on delivery log · template editor + iframe preview already high-quality |
| 20 | `/admin/email-templates/preview/[id]` | (in #19) | ⚠️ PARTIAL | `route.ts` API endpoint (not a page) · permission gate stubbed (`BUILD-rbac-permission-email-templates.md`) |
| 21 | `/admin/roles` + `/[roleId]` | `21-roles-audit.md` | ⚠️ PARTIAL | Delete is stubbed (`data-redesign-fake="delete-role"`) but guard pattern is correct |
| 22 | `/admin/privacy` | `22-privacy-audit.md` | ❌ → ⚠️ PARTIAL | **HEADLINE FINDING — P0 GDPR fulfilment gaps.** "Completed" is a UI lie. No SAR export, no cascade delete, no SLA timer, no ICO breach workflow |
| 23 | `/admin/account-password-requests` | `23-password-requests-audit.md` | ⚠️ PARTIAL | Notes typed during approve/reject are NOT PERSISTED (FAKE) |
| 24 | `/admin/audit` | `24-audit-log-audit.md` | ✅ READY | **Proper cursor pagination (AUDIT_PAGE_SIZE=100 + LoadMore)** — C-09 template alongside operations · `BUILD-audit-target-existence` stubbed |
| 25 | `/admin/reports` | `25-reports-audit.md` | ✅ READY | B-4 shipped clean · **Zero animate-spin in this entire surface** — cleanest a11y posture · revenue-attribution TODO at `reporting.ts:417` |

**Verdict counts:** ✅ READY × 13 · ⚠️ PARTIAL × 11 · ❌ × 0 (Privacy moved from ❌ to ⚠️).

---

## 2 — Re-framing of the 11 user items

The audit changed scope on several items. C-B planning should start from these revised framings, not from master plan Part 2 verbatim.

### C-01 — Google review email 2h after completion
**Scope unchanged.** Audit didn't reach this code path. C-B still needs the user-supplied Google review link + service-specific copy.

### C-02 — Recurring / standing bookings
**Scope unchanged.** Master plan says ask the user before writing the plan. Cupping-cycle / lunar-aware. Discovery questions outstanding.

### C-03 — Enquiry → Booking one-click conversion
**Scope SHRINKS.** Per #08 B-36 + #03 V-08: the Convert button exists at `EnquiryList.tsx:522`, URL routes to `/admin/bookings/new?enquiryId=…`, form prefills name/phone/source/customer-notes. **Only missing: service-prefill (fuzzy-match `enquiry.service_interest` to a package option).** Maybe also: email prefill when only phone is present, participant gender prefill. C-03 is a ~half-day fix, not a feature.

### C-04 — Cancellation restore
**Scope CHANGES.** Per #04 B-16/E-12: the "Restore it from the audit log if it was cancelled by mistake" copy on the cancelled-detail page is misleading — the audit log is read-only. The actual restore mechanism IS the Status & payment form changing Cancelled → Confirmed/Pending. C-04 plan should choose:
- (a) Add an explicit "Restore" button that does the status flip with confirm modal, OR
- (b) Rewrite the hint copy to direct user to the Status panel instead of the audit log.

### C-05 — Cancelled bookings can't be assigned/claimed
**Scope EXPANDS.** Per #02 B-04 + #04 B-15: there are **4 distinct gating bugs**:
1. Server action: `actions.ts:269-275` `claimBookingAssignment()` no booking.status check
2. UI predicate: `page.tsx:787-791` `canClaim` no booking.status check
3. UI predicate: `page.tsx:793-794` `mark complete` no booking.status check
4. UI predicate: `page.tsx:883-890` reassign no booking.status check

PLUS open question: master plan says "can't be assigned/claimed" but Owner CAN currently. Therapist's claimable view IS UI-filtered. **User vantage clarification needed before C-B plan writes.**

### C-06 — Delete + bulk delete
**Scope CHANGES.** Per multiple audits:
- Bookings: no delete by design (status-only). Audit recommends C-06 should NOT add booking deletion.
- Staff: no delete by design (deactivate via `active=false` toggle on detail page).
- Clients: no delete UI anywhere; GDPR `privacy_requests` machinery exists but is invisible on the clients list. **C-06 plan should add row-actions on `/admin/clients` row menu to "Request data export" / "Request deletion review" — routing through the existing privacy workflow.** Pairs with #22 privacy P0 fulfilment fix.
- Services: HAS delete with in-use guard. Use as template.

Suggested C-06 framing: **client-level delete via privacy workflow** (not hard delete) + lift the services delete-with-in-use-guard pattern where direct delete makes sense.

### C-07 — Proper routing between pages
**Scope unchanged.** Audit surfaced specific examples to fold in: nav-label divergence "Staff" vs "Team" (#01 CR-01), H1 inconsistency client-detail uses name / booking-detail uses ID (#04 V-11 + #07 V-22), "today" semantic divergence (#02 E-08), range chip parity dashboard vs performance (#13 V-37), step rail hidden on mobile (#03 V-10).

### C-08 — More email templates + automation
**Scope CLEAR.** Per #19: 7 event types are wired today; **C-08 needs 3 more: assignment / claim / client-assigned**. Cancellation already covered. Auto-reminder (24h-before) is also missing. The template editor + iframe preview at `/admin/emails` components/ + `/admin/email-templates/preview/[id]/route.ts` is high-quality — C-08 is **additive** (new templates + send hooks + event types in `email_delivery_events`). Also: per-row Resend on delivery log (#04 B-18 + #19 B-84).

### C-09 — Pagination + scale-aware
**Scope CLARIFIED.** Master plan's headline example (Recent Activity on /admin/me) is **stale** — already capped at 20 per `PerformanceSurface.tsx:319,325`. Real targets are:
- `/admin/bookings` list (unbounded, V-05)
- `/admin/clients` list (cosmetic pagination, B-23)
- `/admin/enquiries` (FAKE filter-query, B-37)
- `/admin/staff` list (no pagination, B-49)
- `/admin/calendar` (soft-cap 31 days, B-43)
- `/admin/bookings/[id]` audit log (top 20, V-12)
- `/admin/clients/[id]` booking history (unbounded, B-32)
- `/admin/privacy` (unbounded, B-92)
- `/admin/emails` delivery log (100 cap, no Load More, B-85)
- `/admin/availability` (no pagination but small dataset)

**Templates to lift:** `/admin/operations` pagination + Load More (#18 PE-47) + `/admin/audit` cursor-based AuditLoadMoreButton (#24 PE-63).

### C-10 — Bottom-of-page spacing / footer overlap
**Scope unchanged.** Audit didn't deeply repro mobile-bottom-padding issues. `/admin/dashboard` correctly uses `pb-24 md:pb-8` (#01 CV-02). Suggest a Playwright pass across all surfaces at 375 to find ones missing this discipline.

### C-11 — Dark mode default + toggle
**Scope unchanged.** Per #01 — no `data-theme` / no theme-toggle button exists. Greenfield. **Use this band to also fix the many unguarded `animate-spin` instances catalogued below** — folding the motion-reduce a11y pass into the dark-mode design-system work is natural.

---

## 3 — Pattern templates (lift these during C-C implementation)

| Pattern | Source surface(s) | Use for |
|---|---|---|
| Delete-with-in-use-guard | `/admin/services` (#16) — `DeleteServiceButton` + `hasHistoricalBookings` predicate + server-side `booking_items` count | C-06 wherever direct delete makes sense |
| Cursor pagination + Load More | `/admin/audit` `AuditLoadMoreButton` (#24) and `/admin/operations` `initialPageSize=50` (#18) | C-09 across every unbounded list |
| Duplicate detection with override | `/admin/clients/new` `DuplicateWarningBanner` at lines 79-489 (#06) | C-06 dup hygiene + lift to ManualBookingForm |
| RBAC narrowing | `/admin/staff/[staffId]` (#11) — `team-access.ts:108-141` three-scope predicate | Any new RBAC-narrowed surface |
| Permission-overrides UX | `/admin/staff/[staffId]` `StaffPermissionOverridesForm` risk-tier matrix (#11 PE-34) | Future role / permission work |
| Mobile sticky save bar | `/admin/staff/[staffId]` `StaffProfileForm:357-410` and `/admin/settings` `SettingsForm:403` | Any new editable surface |
| Tab roving tabindex + arrow-key nav | `/admin/availability` `AvailabilityManagersTabs:40-62` (#15 PE-43) | Any new tab strip |
| Suspense streaming with `cache()` dedup | `/admin/me` and `/admin/staff/[staffId]/performance` shared `<PerformanceSurface>` (#13/14) | Any new multi-section page |
| Motion-reduce discipline | `/admin/reports` — zero `animate-spin`, uses `AdminSkeleton` (#25 PE-69) and `/admin/staff/[staffId]` `motion-reduce:transition-none` consistently (#11) | C-11 baseline |

---

## 4 — Tech-debt breadcrumb inventory

**The `// FAKE` / `data-redesign-fake` / `BUILD-*.md` / `data-redesign-needs-photo` markers across the codebase form an explicit cleanup workbook.** Grep these patterns at C-09 / C-12+ planning time:

| Surface | Markers |
|---|---|
| `/admin/enquiries` | `page.tsx:160-162, :187` `// FAKE: BUILD-enquiries-filter-query` ×2 |
| `/admin/staff` (list) | `page.tsx:213` `// FAKE: BUILD-staff-filter-query`; `:312` `// FAKE: BUILD-staff-workload-aggregates`; `:439, :515` `data-redesign-backend="FAKE"` |
| `/admin/staff/[staffId]/availability` | `BlockedDatesManager.tsx:176` `data-redesign-fake="staff-blocked-dates-actions"`; `OverridesManager.tsx:200` `data-redesign-fake="staff-availability-override-actions"` |
| `/admin/operations` | `page.tsx:158, :224, :250` `data-redesign-fake="filter-query"` ×3; `event-row.tsx:169` same; `operations-board.tsx:210` `data-redesign-needs-photo="operations-clear.svg"` (missing asset) |
| `/admin/emails` | `page.tsx:140, :251` `// FAKE: BUILD-email-delivery-filter-query` + filter-slice; `:128` `data-redesign-backend="FAKE"`; `DeliveryFilterStrip.tsx:128` same; `ReminderResendForm.tsx:56` `FAKE-FAILURE-PATH` |
| `/admin/email-templates/preview/[id]` | `route.ts:9-11` `BUILD-email-templates-preview-route.md`, `BUILD-rbac-permission-email-templates.md`; `:86` simplified permission gate |
| `/admin/privacy` | `page.tsx:331, :450` `// FAKE — server ignores until BUILD plan` (filter strip backend not wired); `BUILD-privacy-filter-query.md` referenced |
| `/admin/roles` | `DangerZonePanel.tsx:115` `data-redesign-fake="delete-role"` |
| `/admin/account-password-requests` | `ApproveModal.tsx:74` + `RejectModal.tsx:72` `data-redesign-backend="FAKE"` on note textareas (notes NOT persisted) |
| `/admin/audit` | `page.tsx:117` `// FAKE: BUILD-audit-target-existence` |
| `/admin/reports` | `reporting.ts:417` `// TODO(post-Phase-7 policy decision): bookedRevenue...` |

**Total: 11 surfaces have at least one explicit tech-debt marker. Grep `// FAKE` and `data-redesign-fake` across `src/app/admin/` should be a deliverable of C-09 plan-writing.**

---

## 5 — Bug index (B-01 → B-103)

The bug numbering runs continuously across all audits for easy cross-reference:
- B-01 to B-03 — Dashboard (#01)
- B-04 to B-08 — Bookings list (#02)
- B-09 to B-14 — Bookings new (#03)
- B-15 to B-22 — Bookings detail (#04)
- B-23 to B-28 — Clients list (#05)
- B-29 to B-31 — Clients new (#06)
- B-32 to B-35 — Client detail (#07)
- B-36 to B-42 — Enquiries (#08)
- B-43 to B-47 — Calendar (#09)
- B-48 to B-53 — Staff list (#10)
- B-54 — Staff detail (#11) — single "no findings of consequence" marker
- B-55 to B-62 — Staff availability (#12)
- B-63 to B-64 — Staff performance (#13)
- B-65 to B-66 — Admin me (#14)
- B-67 to B-73 — Availability global (#15)
- B-74 to B-77 — Services (#16)
- B-78 to B-79 — Settings (#17)
- B-80 to B-82 — Operations (#18)
- B-83 to B-86 — Emails (#19+#20)
- B-87 to B-94 — **Privacy (#22) — includes the 3 P0 GDPR findings**
- B-95 to B-96 — Roles (#21)
- B-97 to B-99 — Password requests (#23)
- B-100 to B-101 — Audit log (#24)
- B-102 to B-103 — Reports (#25)

**P0 (regulatory) bugs:** B-87, B-88, B-89 — all in `/admin/privacy`.
**High-severity bugs (data integrity / known user items):** B-04 (C-05 server-action gate), B-15 (C-05 three UI predicates), B-67 (no affected-staff count), B-83 (C-08 missing 3 event types).

---

## 6 — Production-DB hygiene confirmed

Test rows visible across 6+ surfaces:
- **Worst:** `/admin/staff` — 11 of 12 records are `Phase10 *` / `Test *` (#10 V-29).
- **Bad:** `/admin/clients` — 7+ of 12 records are `Audit Test Client *` / `Phase10 *` / `Zara Test Client` / Arabic-prefix `Test Client` / stress-test long-name `Mohammed Abdulrahman Abdul-Hakim Al-Farsi-Lampungbungkangkang` (#05 V-16).
- **3/3 test:** `/admin/enquiries` — `Audit Enquiry One/Two`, `Phase10 E2E Enquiry` (#08 V-25).
- **Visible test rows on:** bookings list, cancelled-detail (`Phase10 E2E Claim Client`, `اَلسَّلَامُ عَلَيْكُمْ Test Client`), client detail, privacy.

**Before public launch:** scripted cleanup of `Phase10 *`, `Audit *`, `Test *`, and the explicit Arabic/long-name stress fixtures. Verify against staff fixture seed file location.

---

## 7 — Open questions for the user (C-B can't write plans until these are answered)

1. **C-05 vantage clarification** (high) — master plan says cancelled bookings "can't be assigned/claimed", audit found Owner CAN at the data layer. Two reads possible. Which is the bug?
2. **#22 Privacy GDPR scope** (high — regulatory) — expand Band C to include SAR export + cascade delete + 30-day SLA, or defer to a dedicated compliance band? Three P0 findings.
3. **C-02 recurring bookings discovery** (master-plan-mandated) — services / roles / cadences / end-conditions / cascade behaviour for single-occurrence cancellations.
4. **C-01 Google review link + assets** (master-plan-mandated) — clinic's Google Business profile URL + any service-specific message copy.
5. **C-06 framing decision** — primarily client-deletion via privacy workflow, or hard-delete with audit preservation, or both?
6. **B-34 client-edit surface** — confirmed missing across the admin. Build an edit route, or accept that client details are immutable after creation?

---

## 8 — Recommended next move

Per master plan structure, next phase is **C-A.2 cross-page workflow audit** (10 flows listed in master plan Part 4 — W01 enquiry→booking, W02 new-booking end-to-end, W03 booking lifecycle, W04 cancel+restore, W05 assignment/claim/reassign, W06 client create + first booking, W07 availability + recurring, W08 Owner switching scope, W09 refund + payment correction, W10 settings edit + downstream).

**Alternative paths the user may prefer:**
- **Skip C-A.2/C-A.3 and go to C-B planning** — Part-2 user items are well-scoped from per-surface findings (Section 2 above). The cross-page audit would surface flow-level bugs but the per-surface audits already caught most of them.
- **Stage A: Privacy GDPR sprint first** — given B-87/88/89 P0 severity, write a privacy fulfilment plan and ship it before any other Band C item. Regulatory risk justifies skipping the planning hierarchy.
- **Stage A: Test-data cleanup** — independent of all plans, ~30-minute scripted DELETE pass against the named fixtures. Should land before public launch regardless.

Master plan's recommended sequence is C-A.2 → C-A.3 → C-B → C-C. The user's call.

---

*End of C-A.1 programme summary.*
