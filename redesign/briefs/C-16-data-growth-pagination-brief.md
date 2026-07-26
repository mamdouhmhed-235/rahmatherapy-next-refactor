# C-16 — Data growth: pagination standard + bounded lists everywhere

**Type:** Band C plan-writing brief (C-B phase — post-handoff addition)
**Date written:** 2026-07-16 (user direction: plan-refinement phase)
**Predecessors:**
- User direction 2026-07-16: "proper pagination and accounting for when data builds up… for all the admin pages everywhere… think 5 years from now… future proof"; cited the roles page as a list that "expands the lower boundary of the page and looks like a mess."
- Code audit 2026-07-16: bookings list fetches **every booking ever with no limit** (`bookings/page.tsx:438-446`) then filters in memory; clients list unbounded (`clients/page.tsx:400`); enquiries unbounded; emails delivery capped at 100 with no pager (`emails/page.tsx:68`); privacy capped at 25 no pager (`privacy/page.tsx:239`); operations capped at 300 no pager (`operations/page.tsx:76`); **audit log is the one surface done right** — cursor pagination at 100/page (`audit/queries.ts:12,108`).
- `redesign/plans/C-phase/C-09-cache-invalidation-filter-cleanup-plan.md` (its extracted data helpers are C-16's plug-in points — pagination-ready signatures per its Step 5 coordination note, 2026-07-16)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-16-data-growth-pagination-plan.md`
- Progress: `redesign/per-page-progress/C-16-data-growth-pagination-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-16 makes every admin list survive five years of business data. Three problem classes, three treatments:

1. **Unbounded growing lists** (bookings, clients, enquiries) → **server-side pagination**: query only the visible page; shared `PaginationBar` UI; URL-driven. Also fixes the hidden performance cliff — today the bookings page transfers every row ever created on every visit.
2. **Capped-but-pagerless lists** (emails delivery, privacy, operations, password requests) → same shared pager replaces the silent cap, so old rows stay reachable.
3. **Static-but-sprawling lists** (roles — the user's named example) → **structure, not pagination**: tighter rows, grouping, disclosure; the page keeps a sane height forever.

Plus the future-proofing that outlives Band C: a **standing rule in BAND-C-MASTER-PLAN Part 0** — *no unbounded list queries; every list surface ships with a pager or an explicit cap + view-all path* — enforced via a verification-gate line item in every subsequent plan.

**Zero migrations. Ships after C-07 (late, so the sweep covers all new surfaces), before C-10 (pagination changes page heights; the bottom-spacing audit must run after).**

---

## 1 — Why this plan exists

### 1.1 The 5-year projection (at a modest 5–8 bookings/day)

| Surface | Rows in 5 years | Today's fetch behaviour | What the user sees at year 5 |
|---|---|---|---|
| bookings list | ~10–15k | ALL rows, every visit | multi-second loads; scroll forever |
| clients list | ~3–6k | ALL rows | same |
| enquiries | ~1–3k | ALL rows | same |
| emails delivery | ~50–100k | newest 100, hard stop | week-old emails unreachable from the UI |
| audit log | ~100k+ | ✅ cursor pages of 100 | fine — the reference pattern |
| privacy / password requests | hundreds | newest 25 / all | older requests unreachable / slow sprawl |
| operations | tens of thousands (job rows) | newest 300, hard stop | older runs unreachable |
| roles / services / staff | static (≤ ~20) | all (correct) | fine as data; roles page sprawls **visually** |

### 1.2 The performance cliff nobody sees yet

`bookings/page.tsx` fetches the full table and `filterBookings` runs in memory. At today's row count it's invisible. At 10k+ rows it's a slow page AND a memory-heavy render on a phone. Pagination here is not cosmetic — it changes the query shape.

### 1.3 The roles page (user's named example)

Data is static (a handful of roles) but the rendering sprawls past the page frame. This is the third category: **presentation bounds**, where pagination would be wrong and structure is the fix.

### 1.4 Why now, in C-B refinement

Five plans are about to add new list surfaces (C-02 series page, C-06 deleted-clients toggle, C-15 gallery, C-08 delivery additions). Retro-fitting bounds after they ship means touching everything twice. C-16 sets the standard once; the standing rule keeps every future surface honest.

---

## 2 — Scope

### 2.1 Phase A — Inventory (discovery-first, C-10's proven shape)

Walk every `/admin/*` surface. For each list-rendering region, record:

- **Growth class:** `static` (bounded by nature) / `slow` (requests, staff) / `fast` (bookings, clients, enquiries, emails, audit, operations).
- **Current bound:** none / hard cap (N) / paginated.
- **5-year projection** (rows).
- **Verdict:** `paginate` / `cap+view-all` / `restructure` / `already-correct`.

Output: `redesign/evidence/C-16/c-16-list-inventory.md` **(2026-07-26, rubric §8 — was `redesign/audits/C-A/c-16-list-inventory.md`)** with a remediation punch list. **Checkpoint:** the punch list is reviewed against this brief's expected table (§1.1) — surprises surfaced to the user before Phase C.

### 2.2 Phase B — The shared standard (build once)

1. **`PaginationBar` component** (`src/app/admin/components/PaginationBar.tsx`):
   - "Showing 26–50 of 3,412" readout (`tabular-nums`) + Prev / Next buttons (`min-h-11`, disabled at ends, `aria-label`s).
   - URL-driven: `?page=N` (1-based) via `Link`s — bookmarkable, back-button-friendly, server-component-compatible (no client state needed for the default variant).
   - Page-size fixed at **25** for row-card lists (constant `LIST_PAGE_SIZE`); denser log-style tables may pass 100 (matching the audit log).
   - Renders nothing when total ≤ one page.
2. **`paginateListQuery` helper** (`src/lib/pagination.ts`): clamps `page` (≥1, ≤ last), derives `.range(from, to)`, returns `{ rows, total, page, pageCount }` using Supabase `count: "exact", head: false` on the same query. Composes with C-09's helper signatures (limit/offset already in their params).
3. **Standard states:** out-of-range page clamps to the last page (no 404s from stale bookmarks); empty page 1 renders the surface's existing empty state; "end of list" is communicated by a disabled Next + the readout.
4. **Cursor exception:** the audit log keeps its cursor pagination (better for 100k+ append-only rows); documented as the approved alternative for log-scale tables. `PaginationBar` supports a cursor mode (Prev/Next tokens, no total) for these.

### 2.3 Phase C — Heavy hitters: bookings + clients (server-side pagination)

**Bookings list** (largest change in the plan):
- The per-view row query (`attention/today/upcoming/...` after C-05's status-aware `filterBookings`) moves the **view predicate into the SQL query** with `.range()` for the visible page. `filterBookings` stays as the pure predicate source — the plan maps each view's predicate to its SQL equivalent, with the in-memory function retained for the claimable-scoping merge path and tests (single source of truth: the SQL builders are derived from and tested against `filterBookings`' cases).
- Tab badges (view counts) become cheap `count`-only queries (one per visible chip, cached via C-09's tags).
- Search within the list composes with pagination (search param + page param in the same query + cache key).
- The Therapist scoped path (assigned + claimable merge) is naturally small (one person's work) — paginate only the `canViewAll` path; scoped path gets a defensive cap (200) + note.
**Clients list:** same pattern, simpler (one query + existing filters + search). Deleted-toggle (C-06) composes as a filter param.
**Enquiries:** same pattern (C-09 already moved its filters server-side — pagination is one `.range()` + the bar).

### 2.4 Phase D — Capped-but-pagerless surfaces

- **Emails delivery log:** 100-cap → `PaginationBar` (page size 100, matching current density). Date-group headers still render per page.
- **Privacy requests:** 25-cap → pager (page size 25).
- **Operations:** 300-cap → pager (page size 100) OR documented cap-is-correct verdict if the surface is genuinely "recent activity only" — Phase A inventory decides, user confirms.
- **Password requests:** verdict from inventory (slow-growing; likely cap + view-all or a small pager).
- **Audit log:** untouched (already correct); referenced as the pattern.

### 2.5 Phase E — Structural fixes for static-long lists

- **Roles page** (user's named example): keep the tiered grouping + inactive disclosure (already present); tighten `RoleListRow` density (audit its height at impl — likely long description/permission content per row); ensure the page reads as a bounded, scannable table at 1280 and stacks cleanly at 375 without leaving the page frame. If the sprawl source is the role DETAIL page's permission matrix, group permissions by domain with collapsible sections.
- **Inventory-driven sweep:** any other static list Phase A flags as visually unbounded (candidate: services list, settings selects, staff-detail sections) gets the same treatment — grouping/disclosure/density, never pagination.

### 2.6 The standing rule (future-proofing beyond Band C)

Add to `BAND-C-MASTER-PLAN.md` Part 0 hard rules (lands with this amendment, not at C-16 impl time):

> **No unbounded list queries.** Every surface that renders a list backed by a growing table ships with either the shared pager (`PaginationBar` + `paginateListQuery`) or an explicit cap + "view all" path — decided consciously, never defaulted. Every plan's verification gate includes a bounded-lists check for surfaces it adds or touches.

---

## 3 — RBAC matrix

No new permissions; pagination inherits each surface's existing visibility rules. The bookings scoped-path cap (§2.3) preserves the existing Therapist scoping exactly. Page params never widen data access — they only window the already-authorized query.

---

## 4 — Layout strategy

```
┌ list rows (25) ─────────────────────────────────┐
│ …                                               │
└─────────────────────────────────────────────────┘
  Showing 26–50 of 3,412       [← Prev] [Next →]
```

- Bar sits below the list, above the page's bottom padding; at 375 the readout stacks above the buttons; buttons are full-tap-height (`min-h-11`).
- Clears the fixed mobile nav (C-10 pattern `pb-24 md:pb-8` on the page scaffold — C-10's sweep verifies after C-16 ships).
- CSS variables only (dark-mode-safe per C-11).

---

## 5 — States & edge cases

- **5.1 Stale page bookmark** (page 40 of what is now 12 pages): clamp to last page, no error.
- **5.2 Row deleted while viewing** (another admin acts): next navigation recomputes; counts are per-render — acceptable staleness, consistent with C-09's tag invalidation refreshing on mutation.
- **5.3 Filter change resets to page 1** (filter params and page param co-exist; changing any filter drops `page`).
- **5.4 Count query drift** (rows change between count and page queries): cosmetic off-by-a-row in the readout for one render; acceptable, documented.
- **5.5 Search + pagination:** search re-queries server-side with the term + page; empty result renders "No results matching your filters" (C-09's copy) with no bar.
- **5.6 Per-view counts cost (bookings chips):** count-only head queries, one per rendered chip, behind C-09 cache tags — measured in the verification gate; if the chip-count fan-out is too heavy, fall back to counting only the active view + total (user informed).
- **5.7 Cursor-mode surfaces** (audit log): no total readout; Prev/Next tokens only — already the shipped behaviour.
- **5.8 Print:** printing a page prints the visible page only (bounded output is the point).

---

## 6 — Migration footprint

**None.** Query-shape + UI work only. (Phase C's count queries need no indexes beyond what exists; the plan's pre-flight EXPLAINs the two heavy list queries and flags to the user if an index would materially help — any index addition would be a separate, explicitly-confirmed follow-up, not part of C-16.)

---

## 7 — Files touched (preview — full list in plan)

### NEW (~7)
- `src/app/admin/components/PaginationBar.tsx` (+ test)
- `src/lib/pagination.ts` — `paginateListQuery` + `LIST_PAGE_SIZE` (+ test)
- `redesign/evidence/C-16/c-16-list-inventory.md` **(2026-07-26, rubric §8 — was `redesign/audits/C-A/c-16-list-inventory.md`)** — Phase A deliverable
- Per-surface test additions (bookings/clients/enquiries pagination specs)

### EDITED (~10–14, inventory-dependent)
- `bookings/page.tsx` + its data path (view predicates → SQL, `.range()`, chip counts)
- `clients/page.tsx` (+ C-09's `clients-list-data.ts` if extracted first)
- `enquiries/page.tsx` · `emails/page.tsx` · `privacy/page.tsx` · `operations/page.tsx` · password-requests surface
- `roles/page.tsx` / `roles/[roleId]/page.tsx` (structure per §2.5)
- `BAND-C-MASTER-PLAN.md` Part 0 (standing rule — lands with this amendment)

### UNCHANGED (do NOT touch)
- `audit/queries.ts` pagination (already correct — reference only).
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- Dashboard stripes (already top-N capped; inventory verifies, no changes expected).

---

## 8 — Sequencing and dependencies

- **After C-09** (hard-ish): C-16 plugs pagination params into C-09's extracted, pagination-ready helpers; without C-09, C-16 would extract them itself (wasteful duplication).
- **After C-05** (bookings view predicates are C-05's status-aware `filterBookings` — C-16 derives SQL from its final shape) and after C-06 (deleted-toggle filter param exists).
- **After C-03/C-07** (their list-adjacent tweaks — saved filters bar, default tabs — compose with page params; C-07's saved filters store filter state only, page resets per §5.3).
- **Before C-10** (hard): pagination changes page heights; the bottom-spacing catalogue must measure post-C-16 reality.
- **C-02 coordination:** series page caps its visit lists (amended in C-02 plan Step 16, 2026-07-16) — inventory confirms.
- **Recommended order becomes:** … → C-09 → C-03 → C-07 → **C-16** → C-10.

---

## 9 — Open questions

**Q9.1 — Offset vs cursor for the growing trio (bookings/clients/enquiries)?** Locked: **offset** (`.range()`) — admin lists need "jump to a page"-free Prev/Next only, offset is simpler, composes with filters trivially, and at ≤20k rows offset depth is a non-issue. Cursor remains the documented pattern for log-scale tables (audit log).

**Q9.2 — Page-size picker for users?** Locked: no — fixed sizes (25 rows / 100 for logs). A picker is C-12+ polish if ever requested.

**Q9.3 — "Load more" (append) instead of Prev/Next?** Considered for mobile ergonomics; rejected: unbounded DOM growth on long sessions recreates the endless-scroll problem the user named, and URL-driven pages are bookmarkable. Locked: Prev/Next everywhere.

**Q9.4 — Operations page: pager or documented cap?** Inventory decides (Phase A checkpoint); user confirms the verdict before Phase D.

**Q9.5 — Bookings chip counts: all chips or active-only?** Start all-chips (cheap head-counts, cached); fall back per §5.6 if measured cost bites.

---

## 10 — Acceptance criteria (what "done" looks like)

1. Inventory doc exists covering **every** `/admin/*` surface, each with growth class + verdict; no list left unclassified.
2. Bookings, clients, enquiries lists query **only the visible page** (verified via query inspection — no unbounded `select` on those tables from list pages), with `PaginationBar` rendered and functional.
3. Emails / privacy / (operations or documented-cap) / password-requests verdicts implemented — no silent hard caps without a reachable "rest of the data" path.
4. Tab/chip counts on bookings remain correct across pages and filters.
5. Filter or search change resets to page 1; stale deep page clamps; empty states preserved.
6. Roles page (and any Phase-A-flagged sibling) reads bounded at 375 + 1280 — no list expands past the page frame; before/after screenshots prove it.
7. Audit log behaviour unchanged.
8. Multi-page behaviour proven **without seeding production**: temporary page-size-3 override exercised in the Playwright sweep with existing rows; unit tests cover clamp/range/count math with mocked large sets.
9. Standing rule present in BAND-C-MASTER-PLAN Part 0; verification-gate line item added to the plan template guidance.
10. Static gates pass; bundle ceiling respected (+4 kB shared components, ~net-zero per page); no new migration applied.

---

## 11 — References

| Source | What it gives |
|---|---|
| User direction 2026-07-16 | The mandate: bounded lists everywhere, 5-year future-proofing, roles page example |
| `audit/queries.ts:12,108` | The proven in-house pagination pattern (cursor, 100/page) |
| `bookings/page.tsx:438-477` | The unbounded fetch + in-memory merge C-16 Phase C replaces |
| `emails/page.tsx:68,154` · `privacy/page.tsx:239` · `operations/page.tsx:76` | The silent hard caps Phase D replaces |
| C-09 plan Step 5 (2026-07-16 note) | Pagination-ready helper signatures — C-16's plug-in points |
| C-05 plan Edit Point 8 | `filterBookings` final predicate shape — source for Phase C's SQL derivation |
| C-10 plan | Discovery→remediation structure C-16 mirrors; sequencing partner |

---

## 12 — Out of scope (explicit non-goals)

- **Public site lists** — customer-facing surfaces are already short-form; untouched.
- **Infinite scroll / virtualized lists** — rejected per Q9.3.
- **Database indexes** — flagged-only if pre-flight EXPLAIN suggests one; separate confirmed follow-up.
- **Archival / data retention policies** (deleting or cold-storing old rows) — a business decision for a future band; C-16 makes growth *presentable*, not smaller.
- **Reports/dashboard aggregates** — already bounded by design.
- **Page-size preferences per user** — Q9.2, C-12+.

---

*End of C-16 brief. Plan file follows: `redesign/plans/C-phase/C-16-data-growth-pagination-plan.md`.*
