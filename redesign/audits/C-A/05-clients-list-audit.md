# C-A.1 #05 — `/admin/clients` (list) audit

**Surface:** `/admin/clients` (list — lifecycle/payment/location/source filters + sort + A-Z grouping)
**Audit type:** C-A.1 per-page discovery (no fixes)
**Date:** 2026-05-25
**Auditor pre-state:** branch `redesign/start-state` HEAD `312318a`. Dev server on `http://localhost:3000`. Dep drift: none.
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.
**Source surveyed:** `page.tsx` (1383 LOC), `ClientRowMenu.tsx` (me, full), `actions.ts` (subagent + my grep), `access.ts`, `client-metrics.ts`, `format.ts`, `types.ts`, `error.tsx`, `loading.tsx`. Spot-verified: zero `.limit()/.range()` on page.tsx + zero `delete|archive|deleted_at` in actions.ts.
**Roles swept:** Owner @ 1280 + 375 (Admin / Coordinator predicate-equivalent per RBAC structure of this surface).
**Screenshots:** `redesign/audits/C-A/screenshots-05-clients-list/` — 2 PNGs.

---

## 1 — Bugs found

### B-23 — Clients list has cosmetic pagination but unbounded DB load
**Severity:** medium (C-09)
**Source:** `page.tsx:104` defines `PAGE_SIZE = 50` and `:486-491` slices the in-memory array. BUT `:398-412` fetches all clients + all bookings with no `.limit()/.range()`. **Spot-verified by grep — zero `.limit()` or `.range()` calls in page.tsx.** Lifecycle / payment / location / source / search filtering all happens in-server over the fully-materialised array.
**Current state:** benign (12 clients in DB). At 5k+ clients, every page-load fetches everything.
**Maps to:** C-09. The fix here is harder than for bookings list because the lifecycle/payment computations need bookings — so any DB-side pagination also needs DB-side lifecycle aggregation.

### B-24 — Zero delete affordance for clients (C-06)
**Severity:** medium (the entire C-06 user item)
**Source — verified:**
- `ClientRowMenu.tsx` (read in full): menu has 3 links only — Start new booking / View client profile / View audit history. No edit/email/archive/delete.
- `actions.ts` (grep `delete|archive|soft_delete|deleted_at` case-insensitive): zero matches.
- `access.ts:48` per subagent has a `canManageAllClients` predicate but it's not used to gate any deletion action because no deletion action exists.

**Implication for C-06 planning:** clients are the most natural delete target (vs bookings which the audit recommends staying status-only). But the GDPR `privacy_requests` table already exists for data_export + deletion_review (see B-25). C-06 should choose between:
1. **Inline delete with soft-delete** (`deleted_at` column on clients) — fast, but doesn't engage the GDPR workflow.
2. **"Request deletion review" workflow** — routes through `privacy_requests` table. Slower, audit-trailed, GDPR-compliant.

### B-25 — GDPR privacy_requests + data_export + deletion_review feature exists but is invisible on the clients list
**Severity:** medium (compliance posture + UX)
**Source:** `actions.ts:26-31` declares `PRIVACY_REQUEST_TYPES` = [`"data_export"`, `"deletion_review"`, …]. `actions.ts:277-325` (subagent) is `createClientPrivacyRequest()` gated by `PERMISSIONS.MANAGE_PRIVACY_OPERATIONS`. The function works — but no row-menu surface drives users to it.
**Adjacent:** the audit's surface #22 (`/admin/privacy`) is the master-plan ❌ UNKNOWN row. Likely THE surface where these requests live. The clients-list integration is the missing wire-up.
**C-B implication:** when planning C-06 (delete) and item 22 (privacy), treat them as a paired workstream — the privacy workflow probably IS the C-06 fulfilment vehicle for hard delete.

### B-26 — Empty catch blocks in three RBAC guards mask DB errors as auth errors
**Severity:** low-medium (debuggability)
**Source:** subagent `actions.ts:124, 232, 284` — each `requireXManager()` swallows all errors and returns `{ error: "Insufficient permissions." }`. A DB outage during the permission check will look identical to a 403.

### B-27 — Sort links use `role="button"` on `<Link>` elements
**Severity:** very low (semantics)
**Source:** subagent `page.tsx:1094`. Should be a real `<button>` or remove the role. Screen-reader / keyboard semantics drift.

### B-28 — Unguarded transitions on row hover + avatar shadow (`motion-reduce` missing)
**Severity:** low (a11y consistency)
**Source:** subagent `page.tsx:1294 transition-colors duration-150 ease-out` + `:1298 transition-shadow duration-200 ease-out`. Same anti-pattern as documented elsewhere in the codebase.

---

## 2 — Visual issues

### V-14 — Mobile loses last-visit + visit-count metadata
**Source:** subagent — at `<lg` (1024px) row metadata is hidden (no "Last visit", no "X visits · Y upcoming"). Mobile users see name + phone + lifecycle badge only.
**Verified visually:** owner-375.png shows name + nothing else per row.
**Implication:** mobile-first ergonomics suffer for the role most likely on phone (therapist on the move). Flag for C-12+ mobile polish.

### V-15 — A-Z grouping triggered at threshold 40
**Source:** subagent `page.tsx:102 AZ_THRESHOLD = 40`. Below 40 clients (current state: 12), the list is flat. Above 40, A-Z letter headings render. Smart adaptive design.
**Accept** — interesting UX choice; no fix needed.

### V-16 — Production-DB test data confirmed on the list
**Visible in owner-1280.png:** "Audit Test Client 1", "Audit Test Client 2", "Phase10 E2E Claim Client", "Sara Test Client", "Zara Test Client", "Mohammed Abdulrahman Abdul-Hakim Al-Farsi…" (long-name stress fixture), and the Arabic-prefix "اَلسَّلَامُ عَلَيْكُمْ Test Client".
**Carried over.** 7+ test rows on a 12-client production list = >50% test data. Hygiene priority before launch.

### V-17 — "12 active / 12 new this month / 0 returning / 0 at risk or lapsed" — all clients new (test data effect)
**Reading:** Lifecycle pills are clickable filters. With current data, only "new" has results. Acceptable but reinforces V-16.

---

## 3 — Empty / edge states

### E-14 — No "Show archived" toggle (subagent finding)
**Decision:** since archive isn't implemented, the absent toggle is correct. Pair with C-06 design — if soft-delete lands, the toggle becomes necessary.

### E-15 — "0 returning" / "0 at risk or lapsed" pills hide their utility today
**Render:** the pills with count=0 still render as clickable filters. ✅ Acceptable — keeps filter chip set stable across data states.

---

## 4 — Cross-role inconsistencies

### CR-13 — Therapist access to /admin/clients not verified live
**Source code:** the page checks `canViewClients`-type predicate via the AdminPageScaffold pattern. Therapist's `canViewClients` returns true only when they have assigned clients (RBAC narrowing). Skipped live sweep to save context — verified at code-import level.

---

## 5 — Cross-viewport issues

### CV-13 — Filter form collapses into a sheet/drawer on mobile
**Source:** subagent `page.tsx:745-762`. Mobile filter button with active-count badge. ✅ Clean pattern.

### CV-14 — Sticky A-Z header at viewport-relative offset
**Source:** subagent `page.tsx:864` — `sticky top-[var(--admin-topnav-offset,0px)]`. Honours the top nav. ✅ Accept.

---

## 6 — Console / network issues

### CN-13 — 0 errors / 0 warnings on initial load
### CN-14 — Same Sentry + font-preload warnings persist (no new issue)

---

## 7 — Pre-existing items the audit accepts

### PE-18 — `client-metrics.ts` is detail-page only (not list)
**Decision:** correct separation. LTV calculation per-client is expensive; not appropriate for the list.

### PE-19 — Lifecycle thresholds hardcoded (30 / 90 / 180 days)
**Source:** subagent `page.tsx:230,240-241`. Hardcoded but documented in the page-stat copy. Accept — these are business definitions, not magic.

### PE-20 — Hover transitions are subtle (150-200ms, color/shadow only)
**Source:** subagent. Visible-but-light motion. Even without `motion-reduce`, the impact is minor. Flag B-28 for consistency, but priority low.

---

## 8 — Items for plans

| # | Finding | Item to address | Best home |
|---|---|---|---|
| 1 | B-23 — cosmetic pagination, unbounded DB load | DB-side pagination + lifecycle aggregation | C-09 |
| 2 | B-24 — no delete affordance | Add row menu delete OR route through privacy_requests | C-06 |
| 3 | B-25 — GDPR privacy_requests invisible on list | Surface "Request data export" / "Request deletion review" as row actions | C-06 + #22 privacy audit |
| 4 | B-26 — three empty catches mask DB errors | Distinguish auth vs DB failure | C-12+ |
| 5 | B-27 — role="button" on Link | Use <button> or drop role | C-12+ |
| 6 | B-28 — unguarded transitions | Add motion-reduce | C-11 |
| 7 | V-14 — mobile loses metadata | Show "Last visit" + "X visits" on mobile | C-12+ |
| 8 | V-16 — test data on production DB | Cleanup pass | C-12+ hygiene |
| — | duplicate-client detection on list | Surface possible duplicates by phone/email | C-06 (paired with B-09 from #03) |

---

## 9 — Hand-off

**State at end of audit:**
- 2 screenshots captured.
- 0 code changes.
- Key discovery: GDPR `privacy_requests` machinery EXISTS in `actions.ts:26-31, :277-325`. C-06 and #22 (privacy) are a paired workstream.
- Browser still signed in as Owner.

**Next surface:** #06 `/admin/clients/new` (small wrapper).

*End of clients-list audit.*
