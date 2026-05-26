# C-A.1 #07 — `/admin/clients/[clientId]` audit

**Surface:** `/admin/clients/[clientId]` (client detail — LTV ribbon, contact, summary, notes, privacy, audit, booking history)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `57b36a0`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Source surveyed:** `page.tsx` (1528 LOC), `ClientDetailForms.tsx`, `ClientLtvRibbon.tsx` (B-6 shipped at `a4c71cf`), `error.tsx`. Explore subagent + live DOM evals.
**Roles swept:** Owner @ 1280 + 375 on client `5d5d7a36-…` ("Fatima Ahmed", 2 bookings). Therapist narrowing inferred from access.ts predicates (not separately swept — same client wouldn't be accessible).
**Screenshots:** `redesign/audits/C-A/screenshots-07-client-detail/` — 2 PNGs.

---

## 1 — Bugs found

### B-32 — Booking history panel renders unbounded
**Severity:** medium (C-09 hazard, prolific clients)
**Source:** subagent — `page.tsx:535` `visibleBookings = bookingsForTab.filter(...)` — no `.limit()`, no `.slice()`. Rendered directly in a `<ul>` loop at lines 752-761.
**Current state:** benign (sample client has 2 bookings). For Fatima today the panel renders cleanly. A long-term loyal client with 50+ visits would render every row.
**Maps to:** C-09.

### B-33 — Two unguarded `animate-spin` icons in ClientDetailForms.tsx
**Severity:** low (a11y consistency)
**Source:** subagent `ClientDetailForms.tsx:179, :300`. Inside pending-submit buttons. Visible <1s but uncompliant with `prefers-reduced-motion`.

### B-34 — Client profile fields NOT editable on this detail page
**Severity:** medium (UX — the only path to edit a phone / email / address is "elsewhere")
**Source:** subagent — no input fields on detail; only display + notes/privacy forms. The client `/admin/clients/new` is for CREATE, not EDIT. So a typo in a client's phone is uncorrectable from this surface.
**Flag:** worth confirming there's an edit route somewhere (perhaps `/admin/clients/[clientId]/edit`?) — if not, this is a real gap. **Spot-check needed in C-B planning.**

### B-35 — `FILTER_THRESHOLD = 5` is an unexplained magic number
**Severity:** very low
**Source:** subagent `page.tsx:79`. Threshold below which the filter strip doesn't render. Sensible UX but should be a documented constant.

---

## 2 — Visual issues

### V-20 — Privacy workflow IS surfaced on this surface (unlike list)
**Source:** Privacy section heading renders + "Submit request" button visible — verified via DOM eval. Maps four request types per `ClientDetailForms.tsx:62-67`:
- `data_export` (default)
- `correction`
- `deletion_review` ← **the GDPR right-to-erasure path that #05 noted was missing from the list**
- `sensitive_note_review`

**Cross-reference to #05 B-25:** the privacy machinery exists on the detail surface only. The list surface needs row-action affordances to drive users here.

### V-21 — LTV ribbon renders correctly (B-6 verified)
**Source:** DOM eval — "Total visits 2 / Upcoming 0 / Completed 0 / Repeat / Total paid £0.00 / Last visit 21 May 2026 · 10:00" + "Supreme Combo Package" as common service.
**Subagent confirmation:** matches B-6 plan; 6 tiles + 12-month sparkline (inline SVG per B-6 deviation rationale to avoid Recharts pulling 97 kB into the route bundle).
**Status:** ✅ B-6 shipped per brief.

### V-22 — H1 = client name (compared with #04 booking detail H1 = "#ID")
**Source:** verified live — `<h1>Fatima Ahmed</h1>`.
**Cross-reference to #04 V-11:** inconsistent semantic — client detail uses human name, booking detail uses ID. Either intentional (client-as-entity vs booking-as-ticket) or a drift to reconcile during C-07 routing pass.

---

## 3 — Empty / edge states

### E-18 — Filter strip hidden below 5 bookings (FILTER_THRESHOLD)
**Source:** B-35 + subagent `page.tsx:539`. Smart adaptive — avoids filter strip on sparse clients. ✅ Accept.

### E-19 — Empty-state CTAs for new/empty tabs
**Source:** subagent — when filtered to empty, shows `EmptyFilteredState`; when tab is empty with no filters, shows `EmptyTab` with "Book now" CTA if user has `canCreateBooking`. ✅ Good empty-state UX.

### E-20 — Notes are read-only after creation; delete-note logged but no delete UI
**Source:** subagent `page.tsx:131` references `client_note_deleted` audit action — but no UI button to trigger it. So notes are append-only from the UI; deletion only happens via direct DB or an unsurfaced action. Worth flagging for C-12+ if note-management becomes scope.

---

## 4 — Cross-role inconsistencies

### CR-15 — Therapist sees a narrower view per `getClientDataAccess`
**Source:** subagent `access.ts:30-60`. Therapist sees the client only if `hasAssignedBooking`. Contact details depend on a separate `canViewClientContactInfo` predicate; sensitive notes are gated on `canManageSensitive || canManagePrivacy`. Owner sees everything.
**Status:** intended RBAC narrowing. Accept.

### CR-16 — Privacy panel only shows when `canManagePrivacyOperations`
**Source:** subagent `page.tsx:511-513`. So Therapist (without privacy perm) doesn't see the Submit Request form. Good — Therapist shouldn't be triggering GDPR workflows.

---

## 5 — Cross-viewport issues

### CV-16 — `lg:grid-cols-[24rem_minmax(0,1fr)]` sidebar layout (subagent line 683)
**Source:** sidebar moves below content on mobile via `order-2 lg:order-1` (:685). ✅ Better than the booking-detail mobile reorder issue (#04 V-13).

### CV-17 — Avatar + name + clamp typography all responsive
**Source:** `text-[clamp(1.778rem,3vw,2.369rem)]` for client name. ✅ Clean.

---

## 6 — Console / network issues

### CN-17 — 0 errors / 0 warnings on detail load
### CN-18 — Same persistent Sentry + font-preload warnings

---

## 7 — Pre-existing items the audit accepts

### PE-23 — Strong accessibility baseline
**Source:** subagent — 90+ `focus-visible:ring-2` instances; `role="tablist" / "tab"` + `aria-current` on booking tabs; `role="region"` on critical notes; semantic `<dl><dt><dd>` for definition lists; `<aside>` for sidebar. ✅ Best a11y of any surface audited so far.

### PE-24 — Print button + tel: + mailto: + maps link
**Source:** "Print" button, `tel:07700900456`, `mailto:fatima.verify@example.com`. ✅ Good contact-action affordances.

### PE-25 — `client_note_deleted` audit action exists in code but no UI to trigger
**Source:** B-34 + subagent. Could be unused, could be DB-only. Leave for future review.

---

## 8 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-32 — unbounded booking history | Pagination / "Load more" / virtualisation | C-09 |
| 2 | B-33 — 2 unguarded animate-spin | Add `motion-safe:` prefix | C-11 design-system pass |
| 3 | B-34 — no edit-client-profile UI | Verify edit route exists OR add one | C-07 routing or C-12+ |
| 4 | V-22 — H1 inconsistency client-detail vs booking-detail | Decide on entity-as-H1 pattern | C-07 |
| 5 | E-20 — `client_note_deleted` audit action without UI trigger | Either add delete-note UI or remove dead audit action | C-12+ |
| 6 | List-surface delete affordance (cross-ref #05) | Surface "Request deletion review" link from list rows | C-06 |

---

## 9 — Hand-off

**State:** 2 screenshots. 0 code changes. B-6 LTV ribbon verified to spec live. Privacy workflow surfaced; client profile editing is not. Booking history is unbounded.
**Next surface:** #08 `/admin/enquiries` (high priority — C-03 entry point lives here).

*End of client-detail audit.*
