# C-16 — Data growth: pagination standard + bounded lists — PROGRESS

**Plan:** `redesign/plans/C-phase/C-16-data-growth-pagination-plan.md`
**Brief:** `redesign/briefs/C-16-data-growth-pagination-brief.md`
**Programme:** Band C, C-C implementation — plan **#16 of 22** (§4 order).
**Predecessor:** C-07, final commit `f038b4f` (closeout `435472a`); drift checkpoint #3 `74ed6ed`.
**Dependencies:** C-05, C-06, C-09 — all shipped and verified present at pre-flight.
**Migration:** none. C-16 is not among the ledger's 9 migration-bearing plans. **No Zone-2 actions.**

---

## 0 — Pre-flight (2026-08-03, at `74ed6ed`)

- `git branch --show-current` → `master`. `git merge-base --is-ancestor ea97932 HEAD` → exit 0. ✅
- `git status --porcelain` over all nine of the plan's named paths → **empty**. ✅ The wider tree is intentionally dirty (241 deleted `.playwright-mcp/*`, 17 deleted `design_handoff_public_pages/*`, untracked design/photo dirs) and `src/lib/maintenance.ts` carries the standing Owner-owned change — never staged.
- Dependency commits confirmed for C-05, C-06, C-09. ✅
- **Inherited baseline — BY IDENTITY** (supersedes the plan's own §0/§3.1 text, which is a plan-writing-time snapshot from 2026-07-16 naming a 6th `createBookingTransaction` failure that C-06 fixed): tsc **0 errors** · vitest failures exactly `admin-access.test.ts` ×2 + `ManualBookingForm.test.tsx` ×3 · eslint **59E/7W** in exactly six files · build clean. Independently re-measured at `435472a` by two separate agents during drift checkpoint #3.
- **Row-count baseline (SELECT-only, 2026-08-03):** bookings 15 · clients 15 · enquiries 3 · email_delivery_events 43 · audit_logs 121 · operational_events 1 · client_privacy_requests 1 · staff_profiles 12 · services 5. **The database is pre-launch — every unbounded query in this plan's scope looks healthy today.** Every verdict is reasoned from query shape, never from observed speed. The plan's §3.3 approach (prove multi-page behaviour with a temporary page-size-3 override, never by seeding production) is therefore the only workable one — confirmed rather than assumed.

**Verification tiers, declared in advance per §2.9c:**

| Phase | Tier | Why |
|---|---|---|
| A — inventory | FULL | Every later phase derives from it; a wrong verdict propagates silently. |
| B — shared primitives | FULL | Clamp/range math is off-by-one territory and every surface consumes it. |
| C Steps 5–7 — bookings | FULL | Mandatory: shared file + correctness parity against an in-memory oracle. |
| C Step 8 — clients/enquiries | FULL | Same query-shape change class; several named traps. |
| D Step 9 — emails | FULL | Date-group headers + C-08's Resend buttons interact with the page boundary. |
| D Steps 10, 12 | TARGETED | Mechanical cap→pager. |
| D Step 11 — operations | FULL | Verdict-gated (see §1). |
| E Steps 13–15 | TARGETED | Density/disclosure + bookkeeping. |

**Model routing (§5):** C-16 is a `sonnet` plan. **Exception — Phase C Steps 5–7 route to `opus`:** translating 11 view predicates into SQL against an in-memory oracle, keeping a count-query and a range-query's WHERE clauses in exact sync, is a correctness-critical semantic port where a silent mismatch shows staff the wrong bookings. All verifiers and reviewers `sonnet`.

---

## 1 — ⛔ Phase A Step 2 — HARD-STOP user checkpoint: **ANSWERED 2026-08-03**

The plan requires the Phase A inventory and the Q9.4 operations verdict to be confirmed by the Owner in chat before Phase C, and **Step 11 explicitly refuses to re-decide the operations verdict if this record is missing.** All four questions were put in chat and answered. Recorded here for Step 11's use.

| # | Question | **Owner's answer (2026-08-03)** |
|---|---|---|
| 1 | **Q9.4 — operations: pager or documented cap?** | **PAGER at 100/page (LOG_PAGE_SIZE).** Decisive evidence: nothing in the codebase links to a specific operational-event row (every `/admin/operations` reference was grepped), so eviction never breaks a link — **but the original event detail (`safe_context`) is NOT duplicated into `audit_logs`**, only status-transition metadata is. Today's 300-row cap therefore destroys the only copy of older event detail. Step 11 implements a pager; it does not re-decide. |
| 2 | **`reporting.ts` (finding N1) — grant a Part 0 exception?** | **NO — log it, do not touch.** `getReportData` reads 6 of 9 tables with no date filter and no limit on every dashboard/calendar/reports render, including `email_delivery_events` (50–100k rows projected). It is genuinely load-bearing across three surfaces and a mistake there costs more than the current zero-and-slow-growing cost. **C-16 must NOT claim "no unbounded list queries" without naming this exclusion** — see §2. |
| 3 | **Six unbounded surfaces outside the plan's §2 files-touched list (N2–N7)** | **FOLD ALL SIX INTO C-16.** Rationale accepted: C-16 establishes the standing Part 0 rule every later plan will cite, so shipping it with six known-unbounded surfaces excluded would undercut the rule at the moment it is set. This is an **Owner-approved extension of the plan's files-touched list** — recorded here so it is not later read as scope creep. See §2 for the amended list. |
| 4 | **Punch list confirmation + Phase E scope** | **CONFIRMED. Phase E Step 13 = verify-and-polish, not rebuild.** The roles page's tier grouping, inactive-role `<details>` disclosure, category-grouped sticky headers, filter strip and internal `max-h-[70vh]` scroll cap already exist and already bound the page frame. Step 13 verifies at 375/1280 with before/after screenshots instead of re-deriving them. |

---

## 2 — Amended scope (Owner-approved at the Step 2 checkpoint)

**Added to the plan's §2 files-touched list** under decision 3 above:

| Surface | Finding | Verdict |
|---|---|---|
| `src/app/admin/services/page.tsx` | N2 — fetches **every row of `booking_items`** (no filter, no limit) to compute per-service usage via in-memory reduce; `booking_items` scales with bookings (10–15k projected) | `restructure` — SQL aggregate. Nothing to paginate. |
| `src/app/admin/availability/page.tsx` | N3 — `BlockedDatesManager` + `AvailabilityOverridesManager` fetch full tables, render every row inline; 0 rows today, ~50–150 and ~25–100 over 5 years | `restructure` / `cap+view-all` |
| staff `[staffId]` availability tab | N4 — `staff_blocked_dates` + `staff_availability_overrides`, no query bound at all | `cap+view-all` |
| `src/app/admin/account-password-requests` | N5 — entire table unbounded, 5 status tabs filtered in memory, not cache-wrapped | `paginate` or `cap+view-all` |
| client-detail notes rail (`client-detail-data.ts:342-350`) | N6 — completely unbounded; **separate from** `PRIVACY_NOTES_LIMIT`, which bounds a different rail | `cap+view-all` |
| staff `[staffId]` assigned-bookings panel | N7 — caps at 16+8 with a "Show all assignments" link reaching **upcoming only**; past assignments beyond the cap have no path | `cap+view-all` |

**Explicit exclusion that must be stated wherever C-16's standing rule is cited:** `reporting.ts`'s unfiltered reads (N1) are **knowingly out of scope** by Owner decision. The Part 0 rule as C-16 establishes it covers list *surfaces*; it does not yet cover the shared reporting aggregate layer. Recording this prevents a future reader from concluding the sweep was exhaustive when it was deliberately not.

**Logged, not fixed (rule 6a) — surfaced by the inventory, outside even the amended scope:**
- **The audit log's UI has the unbounded-DOM defect the brief attributes to everything else.** `AuditLoadMoreButton.tsx` is a forward-only *append* control with no Prev, and day-group headers apply only to the initial SSR page — every Load-More batch renders flat. `audit/queries.ts` internals are DO-NOT-TOUCH and the audit UI files are not on the files-touched list, so C-16 leaves it. **Phase B must therefore design `PaginationBar`'s cursor mode from the plan's spec (`{prevHref?, nextHref?}`, no total), NOT by copying the shipped audit UI** — the brief's premise that audit is the working reference is wrong.
- Three further instances of the "bounded query defeats a wider-window in-memory filter" defect C-07 A3 fixed: `nextSevenDays` feeding the Business dashboard header stat and Coordinator's `weekCount` prop (both silently read "0 in the next 7 days" on the default view), and the Therapist "Recent clients · Last 30 days" strip, which has no wider-window fetch backing its 30-day claim.
- Two nav-notification id-lookup queries lack `ORDER BY` before `LIMIT` — soft growth risk, not a confirmed defect.

---

## 3 — Phase A

| Step | Commit | Result |
|---|---|---|
| 1 — inventory (69 regions, 32 pages) | `437c186` | Built by six parallel read-only source lenses (§2.8a). **8 audit/brief premises corrected**, 8 unlisted unbounded surfaces found. Deliverable: `redesign/evidence/C-16/c-16-list-inventory.md` + six per-area files. |
| 2 — ⛔ user checkpoint | (this file) | **ANSWERED** — §1 above. |

**Method deviation, logged:** the plan specifies a "Playwright-assisted" walk. No agent can authenticate (§3b), so the inventory was derived from source. Each row cites `file:line` for the actual query, which is stronger evidence than an observed render. The one item genuinely needing a browser — visual confirmation of the roles page at 375/1280 — is Owner-performed and carried into Phase E Step 13.

---

## 4 — ▶ Position

**Phase A complete and confirmed. Next: Phase B (Steps 3–4)** — `src/lib/pagination.ts` + `src/app/admin/components/PaginationBar.tsx`, both with tests, tier FULL, model `sonnet`. No surface consumes them until Phase C.
