# C-A.1 #08 — `/admin/enquiries` audit

**Surface:** `/admin/enquiries` (enquiries list — tabs New / Contacted / Converted / Closed)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `0957c14`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Source surveyed:** `page.tsx` (880), `EnquiryList.tsx` (610), `EnquiryForm.tsx` (327), `actions.ts` (175), 3 smaller files. Explore subagent + my grep for the critical C-03 link.
**Roles swept:** Owner @ 1280 + 375. RBAC permits Owner / Admin / Coord via `canManageEnquiries` (Therapist blocked at middleware).
**Screenshots:** 2 PNGs in `screenshots-08-enquiries/`.

---

## 1 — Bugs found

### B-36 — REVISION OF #03 V-08: C-03 entry point EXISTS — my #03 audit was wrong
**Severity:** revision (not a bug, but corrects a finding)
**Source — verified by grep + DOM:**
- `EnquiryList.tsx:522` — `href={\`/admin/bookings/new?enquiryId=${enquiry.id}\`}`
- Live DOM: "Convert" buttons render on enquiry rows in new + contacted statuses, hrefs correctly populated.

**C-03 status revised:**
- ✅ Convert button exists per row (didn't see this when writing #03 because I didn't audit /admin/enquiries until now)
- ✅ Routes correctly with `?enquiryId=…`
- ✅ Form prefills name/phone/source/customer-notes
- ❌ Service is NOT pre-selected (still a gap from #03)
- ❌ Email blank when enquiry had phone only
- ❌ No participant gender prefill

**C-03 scope is smaller than master plan implies.** The "one-click" framing is mostly delivered — only the service-prefill enrichment is missing. The C-B plan for C-03 should focus narrowly on service fuzzy-match.

### B-37 — Two explicit `// FAKE: BUILD-enquiries-filter-query` comments mark the unbounded fetch as known-temporary
**Severity:** medium-high (C-09 hazard, but already acknowledged)
**Source:** subagent `page.tsx:160-162, :187`. The codebase explicitly admits the in-memory filter approach is a placeholder.
**Implications:**
- Pagination at the DB layer is already-flagged-as-needed. C-09 work won't surprise anyone.
- These FAKE comments are valuable breadcrumbs — C-09 plan should grep for `// FAKE` across the codebase to find all temporary patterns.

### B-38 — No delete affordance (C-06)
**Severity:** medium
**Source:** subagent — actions.ts has `createEnquiry` + `updateEnquiryStatus` only; no delete. "Close enquiry" exists as a soft-state transition.
**Decision for C-06 plan:** for enquiries, "Close" might suffice as the delete-equivalent (similar reasoning to bookings being status-only per #02). Confirm with user during C-B.

### B-39 — Three unguarded `animate-spin` instances (consistent codebase pattern)
**Severity:** low (a11y)
**Source:** subagent `EnquiryForm.tsx:199`, `EnquiryList.tsx:578`, `EnquiryStatusButton.tsx:101`.

### B-40 — "Convert" is a `<Link>` but carries intent (state-changing trigger)
**Severity:** very low (semantics)
**Source:** subagent. From RBAC + UX perspective Convert *initiates a new booking* — that's a state-change. Modelling it as a navigation link is acceptable (no server mutation until form submit), but worth noting if any consistency pass touches this.

### B-41 — Checkbox tap targets are 16px (below WCAG / iOS 44px standard)
**Severity:** low (a11y mobile)
**Source:** subagent — `size-4` classes (4 × 4 = 16px). Pairs with C-12+ mobile polish.

### B-42 — No timestamped contact-attempt log
**Severity:** low (CRM completeness)
**Source:** subagent. Only `first_contacted_at` timestamp on the enquiry row + unstructured `notes` field. No "called at 14:30 / left voicemail" structured log.
**Decision:** flag for C-12+ (CRM polish). Not in user item scope.

---

## 2 — Visual issues

### V-23 — Stats chips: "Today 0 new" / "Conversion this month 0% (0/3)" / "Resume last filters"
**Source:** verified live. Nice quick-glance KPIs above the tab strip. Note `Resume last filters` references `EnquiryFilterPersistence.tsx` — server-side persistence pattern worth noting for C-07 routing work.

### V-24 — 4 lifecycle tabs + "All"
**Source:** subagent — All / New / Contacted / Converted / Closed. Counts on each tab. ✅ Clean.

### V-25 — Production-DB enquiries are mostly test data
**Visible rows:** "Audit Enquiry One", "Audit Enquiry Two", "Phase10 E2E Enquiry". 3 enquiries; all named with explicit audit/test prefixes. **No real client enquiries visible.** Master-plan Part 3 hygiene finding extends to this surface.

---

## 3 — Empty / edge states

### E-21 — Active filters render as removable chips (`FilterChips()`)
**Source:** subagent. ✅ Good. Cross-references B-5 SHARED-NOTES §18 filter-vs-data discipline.

### E-22 — Bulk actions: "Mark contacted" + "Close" via row checkboxes + sticky action bar
**Source:** subagent `EnquiryList.tsx:243-252` (partial-success handling), :296-314 (bulk affordance). Toast surfaces partial success ("N of M failed"). Sophisticated UX.

---

## 4 — Cross-role inconsistencies

### CR-17 — RBAC at code: `canManageEnquiries` (Owner / Admin / Coord). Therapist blocked.
**Status:** intended. Therapist doesn't manage enquiries.

---

## 5 — Cross-viewport issues

### CV-18 — Mobile filter sheet via AdminSheet pattern (consistent with clients list)
**Source:** subagent. ✅ Accept.

### CV-19 — Tab strip sticky with soft right fade for overflow on mobile
**Source:** subagent. ✅ Good mobile polish (addresses the absent date-range overflow affordance noted in #01 CV-01).

---

## 6 — Console / network issues

### CN-19 — 0 errors / 0 warnings.
### CN-20 — Sentry + font-preload baseline persists.

---

## 7 — Pre-existing items the audit accepts

### PE-26 — `first_contacted_at` idempotent guard
**Source:** subagent `actions.ts:145-147`. Set once, immutable thereafter. ✅ Solid pattern (per B-2 audit notes).

### PE-27 — In-page error boundary at `error.tsx`
**Source:** subagent — comprehensive Try Again + console-log pattern. ✅ Accept.

### PE-28 — Hardcoded SOURCE_LABELS duplicated in `page.tsx:71-79` and `EnquiryList.tsx:67-74`
**Status:** low-priority duplication. Flag for C-12+ refactor.

---

## 8 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-36 — C-03 scope revision | Service fuzzy-match for prefill + maybe gender prefill; everything else works | C-03 (scope down) |
| 2 | B-37 — FAKE filter-query is acknowledged tech debt | DB-side query + pagination | C-09 |
| 3 | B-38 — no delete affordance | Decide: "Close" IS the delete, or add hard-delete | C-06 |
| 4 | B-39 — 3 unguarded animate-spin | Add `motion-safe:` | C-11 |
| 5 | B-40 — "Convert" link semantics | Audit pass only (not blocking) | C-12+ |
| 6 | B-41 — 16px checkbox tap targets | Bump to min 44px on mobile | C-12+ |
| 7 | B-42 — no structured contact-attempt log | Activity timeline per enquiry | C-12+ CRM polish |
| 8 | V-25 — test enquiries in prod DB | DB cleanup pass | C-12+ hygiene |
| 9 | PE-28 — SOURCE_LABELS duplicated | Shared constant | C-12+ |

---

## 9 — Hand-off

**State:** 2 screenshots. 0 code changes. C-03 scope corrected downward (entry point exists; only prefill enrichment is missing). FAKE comments at enquiries page.tsx are useful breadcrumbs for C-09.
**Next surface:** #09 `/admin/calendar` (medium priority).

*End of enquiries audit.*
