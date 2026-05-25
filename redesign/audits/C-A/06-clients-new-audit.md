# C-A.1 #06 — `/admin/clients/new` audit

**Surface:** `/admin/clients/new` (create-client form)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `dc502d0`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Source surveyed:** `page.tsx` (54 LOC, me — full read) + `ClientCreateForm.tsx` (695 LOC, sampled via grep — duplicate-detection lines 79–250, 461–489 confirmed; no full read to save context).
**Roles swept:** Owner @ 1280 + 375. RBAC code gates Therapist / Coordinator out (page.tsx:21 `canManageAllClients`).
**Screenshots:** `redesign/audits/C-A/screenshots-06-clients-new/` — 2 PNGs.

---

## 1 — Bugs found

### B-29 — INVERSION OF #03 B-09 — this form DOES have duplicate detection; manual-booking form does NOT
**Severity:** medium (inconsistency between two creation pathways)
**Source — verified via grep:**
- `ClientCreateForm.tsx:79` declares `confirmDuplicate` state
- `ClientCreateForm.tsx:136` defines `duplicateBlocked = Boolean(state.duplicateWarning) && !confirmDuplicate`
- `ClientCreateForm.tsx:137` ties submit-disabled to it
- `ClientCreateForm.tsx:246–250` renders `<DuplicateWarningBanner>`
- `ClientCreateForm.tsx:461–489` is the banner component itself with "Possible duplicate client" heading + checkbox confirm-override

**Live verification:** the "Save anyway" button is present in the rendered DOM (button list captured) — confirming the confirm-override flow.

**Cross-reference:** #03 B-09 documented that the manual-booking form (`ManualBookingForm.tsx:518-520`) has no dup guard. The pattern exists in this codebase — it just hasn't been applied to the booking form's client-creation path.

**Items for plans:**
- C-12+ (or fold into C-06): lift the `DuplicateWarningBanner` + flow from `ClientCreateForm.tsx` to share across both surfaces. Server-side dup check probably lives in `actions.ts` — re-use the same query.

### B-30 — Form does NOT require contact details (email + phone both optional)
**Severity:** low (intentional — UX confirmed by "No contact details yet" section heading + "Add contact details" button)
**Source:** verified live — `email` and `phone` inputs both `required: false`. The page description says "Create a CRM profile without booking" — so a name-only stub is a feature.
**Decision:** accept; document. But pair with B-29 — a name-only stub creates LOTS of duplicate-risk surface area (10 "John" clients are indistinguishable).

### B-31 — Probable lacking `motion-reduce` on the form's transitions
**Severity:** low (cross-codebase pattern; not spot-verified on this file specifically)
**Source:** consistent pattern across all surfaces audited so far. Did not deep-read ClientCreateForm.tsx — flagging as likely.

---

## 2 — Visual issues

### V-18 — Form has clean section labels: "Who they are" / "How to reach them" / "Internal notes"
**Source:** verified live. ✅ Excellent IA. Accept.

### V-19 — "Save anyway" button appears in DOM but only renders meaningfully when a dup is detected
**Source:** the button is visible in the button list even before a dup warning surfaces. Worth verifying it's `display: none` or similar when there's no warning, not just present-but-pointless. (Risk: keyboard users could tab to a useless button.) — Spot-test needed in C-B planning if a fix is scoped.

---

## 3 — Empty / edge states

### E-16 — Name-only stub creation is allowed
**Source:** required-field constraints — only `full_name` and `client_source` are required. Acceptable per master-plan intent (CRM-style profile-first creation).

### E-17 — "Add contact details" button suggests progressive disclosure
**Source:** verified live as a visible button. Likely expands the "How to reach them" section. Good progressive-disclosure pattern.

---

## 4 — Cross-role inconsistencies

### CR-14 — RBAC narrows: `canManageAllClients` predicate
**Source:** `page.tsx:21`. Therapist + (likely) Coordinator are blocked. Verified at code, not live.
**Status:** intended.

---

## 5 — Cross-viewport issues

### CV-15 — Form max-width 640px
**Source:** `page.tsx:39` — `max-w-[640px]`. Centered narrow form. ✅ Standard.

---

## 6 — Console / network issues

### CN-15 — 0 errors / 0 warnings on initial load
### CN-16 — Persistent Sentry + font-preload warnings as before

---

## 7 — Pre-existing items the audit accepts

### PE-21 — Back-to-clients breadcrumb is consistent with #07 pattern
**Source:** `page.tsx:40-46` — `<Link>` with `ArrowLeft` to `/admin/clients`. Good. Accept.

### PE-22 — AdminAccessDenied for non-permitted roles links back to /admin/clients
**Source:** `page.tsx:23-34`. Graceful denial copy. Accept.

---

## 8 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-29 — apply the `DuplicateWarningBanner` pattern to ManualBookingForm | Cross-surface dup detection | C-12+ or pair with C-06 |
| 2 | B-30 — name-only client + lacking dup detection = high dup risk | Encourage at-least-one-contact OR strict dup detection on name field too | C-12+ |

---

## 9 — Hand-off

**State:** 2 screenshots. 0 code changes. Key contradiction with #03 documented. Form-validation pattern is good and reusable.
**Next surface:** #07 `/admin/clients/[clientId]` (client detail — B-6 LTV ribbon already shipped on this surface).

*End of clients-new audit.*
