# C-16 — Data growth: pagination standard + bounded lists — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: C-09, C-05, C-06 — all soft/conditional (Pre-flight #2 already branches on each's landing state via `git log --oneline | grep -E "C-05|C-06|C-09"`; none hard-gate this plan's start).
> Decisions: C-B-DECISIONS.md — no section references C-16 (confirmed via grep + xref-index.json, 2026-07-26). Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Brief:** `redesign/briefs/C-16-data-growth-pagination-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-16-data-growth-pagination-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. **Branch + clean tree**; ~~verify with user~~ **(2026-07-26, F1)** on `master`; HEAD at or descended from `ea97932` — verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`; working tree has no modifications under the paths this plan touches (`git status --porcelain -- src/lib/pagination.ts src/app/admin/components/PaginationBar.tsx src/app/admin/bookings/page.tsx src/app/admin/clients/page.tsx src/app/admin/enquiries/page.tsx src/app/admin/emails/page.tsx src/app/admin/privacy/page.tsx src/app/admin/operations/page.tsx src/app/admin/roles/` returns empty) — the wider tree is intentionally dirty (untracked photo/design folders, deleted `.playwright-mcp` logs); NEVER stage broadly, NEVER stash/restore/checkout to 'clean' it. Dev server → 200. ~~Baseline tests + static gates green.~~ **(2026-07-26, F2)** Baseline tests + static gates green — `pnpm vitest run` 485/491 (6 pre-existing failures in 3 files: ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1 — is the baseline); `npx tsc --noEmit` clean; `pnpm lint` — no NEW lint errors vs the 59-error baseline (55 untracked `design_handoff_area_pages/prototype/*.jsx` + 4 pre-existing in `src/features/booking/`).
2. **Predecessor landing state** (shapes Phase C):
   ```bash
   git log --oneline | grep -E "C-05|C-06|C-09" | head
   ```
   - C-09 merged → its `*-data.ts` helpers exist with pagination-ready params (its Step 5 note) → Phase C plugs in.
   - C-09 NOT merged → C-16 extracts the two heavy fetches itself (minimal version, tagged for C-09 to adopt) — surface the deviation to the user.
   - C-05 merged → `filterBookings` is status-aware; derive SQL from its final shape. C-06 merged → deleted-toggle param exists.
3. **Row-count + query-cost baseline** (read-only):
   ```sql
   SELECT 'bookings' t, COUNT(*) FROM bookings
   UNION ALL SELECT 'clients', COUNT(*) FROM clients
   UNION ALL SELECT 'enquiries', COUNT(*) FROM enquiries
   UNION ALL SELECT 'email_delivery_events', COUNT(*) FROM email_delivery_events
   UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs;
   ```
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM bookings ORDER BY booking_date DESC, start_time DESC LIMIT 25 OFFSET 0;
   -- Repeat with a status predicate. If a materially-helpful index is missing, FLAG to user (separate follow-up; not C-16).
   ```
4. **Reference implementation read:** `src/app/admin/audit/queries.ts` (cursor pattern) + `AUDIT_PAGE_SIZE` — the house style Phase B generalises.
5. **Current bound inventory refresh** (the audit that motivated this plan — re-verify line numbers):
   ```bash
   grep -rn "\.range(\|\.limit(" src/app/admin --include=*.ts --include=*.tsx | grep -v __tests__
   ```
6. **DO-NOT-TOUCH:** Badar's `9d55ce2a`; real client rows; `audit/queries.ts` pagination internals; RECON §5 untouchables. **(2026-07-26, rubric §9)** DO-NOT-TOUCH (live data): booking `9d55ce2a` (Badar — real customer email); Owner account `rahmatherapy@outlook.com` in email-test paths; any client whose email isn't `*.example.test` or name isn't `Phase10*`/`Audit Test*` test patterns.

---

## 1 — Safe implementation order (5 phases)

### Phase A — Inventory (discovery; no code)

**Step 1 — Walk every `/admin/*` surface** (Playwright-assisted, read-only) and build `redesign/evidence/C-16/c-16-list-inventory.md` **(2026-07-26, rubric §8 — was `redesign/audits/C-A/c-16-list-inventory.md`)**: one row per list-rendering region — surface, component, growth class (`static`/`slow`/`fast`), current bound, 5-year projection, verdict (`paginate`/`cap+view-all`/`restructure`/`already-correct`), notes. Include the new surfaces from shipped plans (C-02 series page, C-06 deleted toggle, C-15 gallery, C-08 delivery additions).

**Step 2 — Checkpoint with the user.**

> ⛔ **HARD-STOP — USER CHECKPOINT: CONFIRMATION REQUIRED** ⛔ **(2026-07-26, F3)**
> An executing agent MUST pause here and obtain explicit user confirmation in chat before proceeding to Phase C.
> Action: present the Phase A inventory (`redesign/evidence/C-16/c-16-list-inventory.md`) diffed against brief §1.1's expected table, plus the Q9.4 operations verdict, for user confirmation.
> Post-action verification: the user has explicitly confirmed the punch list and the Q9.4 operations verdict in chat; record the confirmed verdict for reuse at Step 11 before Phase D begins.
> Never auto-apply. Approval is per-action and does not carry forward.

Diff the inventory against brief §1.1's expected table; present surprises + the Q9.4 operations verdict for confirmation before Phase C. The punch list from here drives Phases C–E; anything verdicted `already-correct` is recorded, not touched.

### Phase B — Shared primitives

**Step 3 — `src/lib/pagination.ts`.**

```ts
export const LIST_PAGE_SIZE = 25;   // row-card lists
export const LOG_PAGE_SIZE = 100;   // dense log-style tables (matches AUDIT_PAGE_SIZE)

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;      // 1-based, clamped
  pageCount: number; // >= 1
}

export function clampPage(rawPage: unknown, pageCount: number): number {
  const n = Number.parseInt(String(rawPage ?? "1"), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, pageCount));
}

export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}
```

`paginateListQuery` stays a thin per-surface pattern rather than a generic query wrapper (Supabase builders don't compose generically without type loss): each surface runs its filtered query twice — once with `count: "exact", head: true` for the total, once with `.range(from, to)` for the rows — through these helpers. Unit tests: clamp (0, negative, NaN, huge), range math, pageCount edge (0 rows → 1 page).

**Step 4 — `PaginationBar.tsx`** (`src/app/admin/components/`).

Server-component-friendly: props `{ page, pageCount, total, pageSize, makeHref(page) }` → renders readout ("Showing 26–50 of 3,412", `tabular-nums`) + Prev/Next as `<Link>`s (disabled state renders a non-link). Cursor mode: `{ prevHref?, nextHref? }` with no total (audit-log-compatible). Nothing renders when `pageCount <= 1`. `min-h-11` targets, `aria-label`s, CSS variables only. Component test.

**Phase B checkpoint:** ~~lint/tsc/tests green~~ **(2026-07-26, F2)** lint (no NEW errors vs the 59-error baseline — 55 untracked `design_handoff_area_pages/prototype/*.jsx` + 4 pre-existing in `src/features/booking/`) / tsc (clean) / tests (vitest 485/491 baseline preserved) green; no surface consumes it yet.

### Phase C — Heavy hitters (bookings → clients → enquiries)

**Step 5 — Bookings list: view predicates move into SQL.**

> **(2026-07-26, collision-map §10 — shared-surface coordination)** `bookings/page.tsx` is edited by C-05 (filter logic, `~148-258`), C-16 (this step, pagination, `~438-446`), and C-13 (row extraction, `~804-927`); C-04a's `BookingRowActions.tsx` is called from this file at `~916`. Re-grep for the current anchor before editing — do not trust cached line numbers once any of the other three plans has landed; expect C-05/C-13/C-04a's edits in this region.

- Map each `filterBookings` view (post-C-05 shape: attention/today/upcoming/claimable/cancelled/no_show/completed/all + status param) to a SQL predicate builder in the bookings data helper (C-09's file if present). Single-source discipline: a vitest spec renders BOTH paths (SQL builder against a fixture table via mocked rows, and `filterBookings` in memory) over the same 20-case fixture set and asserts identical row selection — the in-memory function remains the semantic oracle.
- `canViewAll` path: filtered query + `.range()` (LIST_PAGE_SIZE) + head-count. Scoped practitioner path (assigned + claimable merge): keep in-memory merge, add defensive `.limit(200)` per branch + code comment (one person's live work can't legitimately approach this).
- Search param composes into the same query; `page` resets on any filter/search/view change (`makeHref` drops it).

**Step 6 — Bookings chip counts.** Per-visible-chip head-count queries (cached via C-09 tags when present). Measure render cost in the verification gate; Q9.5 fallback (active chip + total only) pre-approved if it bites.

**Step 7 — Bookings UI wiring.** `PaginationBar` below the list; `?page=` in the URL; C-07's saved-filters (if shipped) store filters only — page always resets (its localStorage schema ignores unknown keys, verified at impl).

**Step 8 — Clients list.** Same pattern: filters (+ C-06 deleted toggle) + search into one query + `.range()` + count + bar. Enquiries next — C-09 already moved its filters server-side; pagination is `.range()` + bar.

**Phase C checkpoint:** query inspection proves no unbounded selects from these three pages (grep + network/DB log during a Playwright walk); temporary `LIST_PAGE_SIZE=3` override exercised — multi-page nav, clamp, filter-reset all observed with existing data.

### Phase D — Capped-but-pagerless surfaces (per inventory verdicts)

**Step 9 — Emails delivery:** 100-cap → pager (LOG_PAGE_SIZE); date-group headers render within the page; Resend buttons (C-08) unaffected.
**Step 10 — Privacy:** 25-cap → pager (LIST_PAGE_SIZE).
**Step 11 — Operations:** pager (LOG_PAGE_SIZE) OR documented cap per the Phase A user-confirmed verdict. **(2026-07-26, F3)** The Q9.4 operations verdict was locked at Phase A Step 2's HARD-STOP user checkpoint — do not re-decide here; if Step 2's checkpoint record shows no explicit operations verdict, STOP and return to Step 2 before implementing this step.
**Step 12 — Password requests:** per verdict (small pager or cap + view-all).

Each step: swap the silent `.limit(N)` for count + range + bar; empty/end states per brief §5; one commit per surface.

### Phase E — Structural fixes for static-long lists

**Step 13 — Roles page (user's named example).** Audit `RoleListRow` + `/admin/roles/[roleId]` at 375/1280 with all current roles: identify the sprawl source (row height / per-role permission detail / detail-page matrix). Apply: denser rows (existing tier grouping + inactive disclosure stay), permission detail behind per-row disclosure or grouped-by-domain collapsibles on the detail page. Before/after screenshots; the page must hold a stable, scannable height.

**Step 14 — Inventory-driven sweep.** Each Phase-A `restructure` verdict gets the same treatment (grouping/disclosure/density — never pagination for static data). Expected candidates: none-to-few; services/staff likely fine.

**Step 15 — Standing rule + gate wiring.** Verify the Part 0 standing rule (landed with this amendment) is reflected: add the "bounded-lists check" line to the plan-template guidance in BAND-C-MASTER-PLAN (bookkeeping edit, done at amendment time) and tick it in C-16's own gate.

---

## 2 — Files touched (final list)

### NEW (~6)
| File | Purpose |
|---|---|
| `src/lib/pagination.ts` (+ `pagination.test.ts`) | clamp/range/pageCount helpers + page-size constants |
| `src/app/admin/components/PaginationBar.tsx` (+ test) | Shared pager UI (offset + cursor modes) |
| `redesign/evidence/C-16/c-16-list-inventory.md` **(2026-07-26, rubric §8 — was `redesign/audits/C-A/c-16-list-inventory.md`)** | Phase A deliverable |
| `src/app/admin/bookings/__tests__/view-predicates-parity.test.ts` | SQL-vs-`filterBookings` parity fixture spec |

### EDITED (~10–14, inventory-dependent)
| File | Change |
|---|---|
| `bookings/page.tsx` + bookings data helper | View predicates → SQL, `.range()`, chip head-counts, bar, scoped-path defensive cap |
| `clients/page.tsx` (+ helper) | Paginated query + bar |
| `enquiries/page.tsx` (+ helper) | `.range()` + bar |
| `emails/page.tsx` | Cap → pager |
| `privacy/page.tsx` | Cap → pager |
| `operations/page.tsx` | Cap → pager or documented verdict |
| password-requests surface | Per verdict |
| `roles/page.tsx` / `roles/[roleId]/page.tsx` | Density/disclosure restructure |
| `BAND-C-MASTER-PLAN.md` | (landed at amendment time) Part 0 standing rule + gate line |

### UNCHANGED (do NOT touch)
- `audit/queries.ts` (reference implementation), dashboard stripes (top-N by design), reports aggregates.
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.

---

## 3 — Verification gate

### 3.1 Static gates
`pnpm lint` **(2026-07-26, F2: no NEW errors vs the 59-error baseline — 55 untracked `design_handoff_area_pages/prototype/*.jsx` + 4 pre-existing in `src/features/booking/`)** · `npx tsc --noEmit` · `pnpm vitest run` (parity spec + pagination helpers + bar; 485/491 baseline — 6 pre-existing failures in 3 files unrelated to this plan) · `pnpm build` · bundle script. **Ceiling: +4 kB shared (bar + helpers), ~net-zero per page** (pagination code replaces in-memory filter mass on bookings).

### 3.2 No-unbounded-queries assertion
```bash
grep -rn "from(\"bookings\")\|from(\"clients\")\|from(\"enquiries\")" src/app/admin/bookings/page.tsx src/app/admin/clients/page.tsx src/app/admin/enquiries/page.tsx
```
Every list-page query visibly carries `.range(` (or a justified `.limit(`). Plus a runtime check: Playwright walk with DB logging — no full-table list selects.

### 3.3 Multi-page behaviour without seeding production
Temporary `LIST_PAGE_SIZE = 3` override (env/constant flip in the dev session only — never committed): with existing rows, walk bookings/clients/enquiries — Prev/Next, readout accuracy, filter-change page reset, stale `?page=99` clamp, empty-search state. Restore the constant; re-run the suite.

### 3.4 Correctness parity
The 20-case fixture spec (§1 Step 5) green — SQL predicates select exactly what `filterBookings` selects, per view, including C-05's cancelled/no_show opt-ins and claimable strictness.

### 3.5 Role sweep + evidence
4 roles × 4 viewports: pager visible + operable on each converted surface; Therapist scoped bookings path unchanged; roles page before/after screenshots at 375 + 1280; chip counts correct across two pages of the same view. Store in `redesign/evidence/C-16/screenshots-c-16/` **(2026-07-26, rubric §8 — was `redesign/audits/C-A/screenshots-c-16/`)**.

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| SQL view predicates drift from `filterBookings` semantics | medium | high | Parity fixture spec is a hard gate (§3.4); in-memory function stays the oracle. |
| Offset pagination + concurrent writes shows a duplicate/missing row at a page boundary | medium | low | Stable sort (`booking_date, start_time, id` tiebreak); cosmetic and self-healing on navigation; documented. |
| Chip head-count fan-out slows the bookings page | low | medium | Counts cached via C-09 tags; Q9.5 fallback pre-approved; measured in gate. |
| C-07 saved filters restore a stale page param | low | low | Saved-filter schema stores filters only; page dropped on apply; verified at impl. |
| Emails date-group headers straddle page boundaries oddly | low | low | Groups render per page (a group may continue on the next page — acceptable, matches audit log). |
| Roles restructure fights the existing tier/disclosure design | low | low | Restructure builds ON the existing grouping; before/after screenshots reviewed against the user's complaint. |
| Scoped practitioner path someday exceeds the 200 defensive cap | very low | low | Cap + code comment; inventory re-check listed in the standing-rule gate for future plans. |
| C-16 lands before C-09 (order deviation) | low | medium | Pre-flight #2 fallback: minimal self-extraction, tagged for C-09 adoption; surfaced to user. |

---

## 5 — Undo procedure

No migration → pure git reverts per phase/surface commit, in reverse. Reverting Phase C restores the unbounded fetches (the old behaviour, not data loss). The inventory doc and standing rule survive any code revert (docs).

---

## 6 — Test fixture guidance

- No production seeding. Multi-page proof via the §3.3 page-size override with existing rows.
- Parity spec uses mocked fixture rows exclusively.
- Playwright walks are read-only except existing-convention test bookings for chip-count checks; Badar's `9d55ce2a` and real client rows untouched.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A — inventory doc (+ user checkpoint recorded) |
| 2 | Phase B — pagination helpers + PaginationBar + tests |
| 3 | Phase C — bookings (predicates→SQL + parity spec + counts + bar) |
| 4 | Phase C — clients + enquiries |
| 5 | Phase D — emails + privacy |
| 6 | Phase D — operations + password requests (per verdicts) |
| 7 | Phase E — roles restructure + sweep |
| 8 | Verification — screenshots + progress file + master plan checklist → ✅ |

`feat(redesign): C-16 {phase/surface}` prefixes. No migration commits.

---

## 8 — Hand-off to C-C

1. Read brief + plan end-to-end; run pre-flight (esp. #2 predecessor state + #3 EXPLAIN flags).
2. Phase A inventory FIRST; pause at the Step 2 user checkpoint.
3. B → C → D → E in order; parity gate blocks Phase C completion.
4. No migrations; no Zone-2 actions (index suggestions are flag-only).
5. Final commit flips the master-plan C-16 row → ✅.

---

## 9 — Open questions remaining

1. **Operations verdict** (Q9.4) — inventory + user checkpoint decides.
2. **Chip-count strategy** (Q9.5) — start all-chips; measured fallback pre-approved.
3. **Roles sprawl source** — list rows vs detail matrix; Phase E Step 13 diagnoses before choosing the treatment.
4. **Index follow-ups** — only if pre-flight EXPLAIN flags one; separate user-confirmed change, never bundled.

---

*End of C-16 plan. Brief: `redesign/briefs/C-16-data-growth-pagination-brief.md`. Progress: `redesign/per-page-progress/C-16-data-growth-pagination-progress.md` (filled during C-C).*
