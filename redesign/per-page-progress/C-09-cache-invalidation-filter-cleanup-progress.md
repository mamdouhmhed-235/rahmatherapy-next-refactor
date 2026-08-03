# C-09 — Cache invalidation + pagination-ready + filter FAKE cleanup — PROGRESS

**Plan:** `redesign/plans/C-phase/C-09-cache-invalidation-filter-cleanup-plan.md`
**Brief:** `redesign/briefs/C-09-cache-invalidation-filter-cleanup-brief.md`
**Programme:** Band C, C-C implementation — plan **#13 of 22** (§4 order).
**Predecessor closed at:** `934d86a` (C-02 shipped)
**Range:** `934d86a..HEAD` — **17 commits, 81 files, +7974 / −1704**

> ## ✅ STATUS: all five phases (A · B · C · D · E) implemented and independently verified.

---

## 0 — Pre-flight (5 read-only agents, HEAD `934d86a`)

| Check | Result |
|---|---|
| Branch + `7fe8b4f` ancestor | **PASS** |
| Dependency gates — C-06, C-04a, C-05, C-01, C-FIELDWORK, C-11, C-08, C-02 | **all 8 PASS**, each verified by phase commits *and* its master-plan row |
| Full tree vs excluded set | **PASS** — 277 porcelain lines, all accounted for |
| Path-scoped (`src/app/admin`, `src/lib/cache`) | **empty** — safe to dispatch |
| Static gates | tsc 0 · lint 59E/7W six files · vitest 5 failed / 1258 passed (1263) · build clean — identity-exact |

**Stale anchor caught at pre-flight:** the plan's own §0 Step 1 tells the implementer to verify against `ea97932`, a plan-writing-time SHA twelve plans old. The live programme anchor is `7fe8b4f`. Every dispatch carried that correction so no implementer re-anchored to it.

**Baseline precedence applied:** the plan's §0 hardcodes "485/491, 6 failures incl. `createBookingTransaction`". C-06 fixed that entry long ago. Protocol §0's precedence rule was applied throughout — the inherited identity list governs, never the plan's frozen text.

---

## 1 — Phases

| Phase | Commit(s) | Model + §5 justification | Verify |
|---|---|---|---|
| A — tag taxonomy | `b652bea` | `sonnet` — pure constants | **PASS** (1 note) |
| B — action sweep | `e45d0d1` + fix `ef231bb` | `sonnet` — mechanical sweep over ~10 known files | **FAIL → fixed → PASS** |
| C — cached fetchers | `c0251b5` … `b615ba1` (7) | `opus` — cross-cutting refactor of 13 data paths with the `unstable_cache` JSON hazard | **PASS** on 3 lenses |
| D — filter cleanup | `bc752d8`, `8c29721`, `e2271c7`, `46d5706`, `a3291cd` + fix `880809e` | `sonnet` — routine filter wiring | **FAIL → fixed → PASS** |
| E — C-12+ inventory | `cf9a436` | `sonnet` — docs | **PASS** |

Every dispatch carried an explicit `model` parameter (§5 requires it — inheritance would silently mean Opus). All verifiers ran `sonnet` at high effort.

---

## 2 — What the verification actually caught

This plan is the one drift checkpoint #2 flagged as **"the first genuinely retroactive plan — the first chance for a plan to undo earlier plans' fixes at scale."** That prediction was right, though not in the way expected: nothing earlier was undone, but three real defects were introduced and caught, none of them visible to any static gate.

### 2.1 — Phase B: a mutating action nobody was looking at

Phase B's diff was **clean** — purely additive, no line removed, all gates green, and two of three lenses passed it. The third caught it only because its brief was to independently enumerate every mutating server action in the tree rather than check the plan's matrix.

`updateOperationalEventStatus` (`operations/actions.ts`) mutates `operational_events` and writes `audit_logs`, but was in neither the plan's Phase B matrix nor its §2 files-touched list — **while Phase C was about to cache `/admin/operations` on `audit` + `bookings` + `settings`.** Shipping both phases as written would have left the page stale after every event resolution: silent, permanent, and untestable by any gate.

**Rule-6(b) STOP raised; Owner approved widening to `operations/actions.ts` only** (2026-08-02). The other four un-swept files (`roles`, `services`, `account-password-requests`, `me`) are **not** wrapped by Phase C, so their lack of tags is pre-existing behaviour C-09 neither causes nor worsens — deliberately left, logged below.

Same fix round also closed: `createEnquiry` missing `TAGS.EMAILS` (it writes an `email_delivery_events` row via `sendTrackedEmail`, verified through the call chain); `deleteClient` carrying an unsupported `TAGS.EMAILS` (removed — the booking cascade is a direct status UPDATE, no notification path, and no DB trigger fires one); `deleteClient`'s idempotent early-return writing an audit row with no tag at all; the per-staff availability mutations missing `TAGS.BOOKINGS` that their global siblings carry for booking-eligibility; and **four specs that stubbed `updateTag` while asserting nothing about it** — plus entirely missing specs for `updateBusinessSettings`, the B-149 fix this whole plan cites as its motivation.

### 2.2 — Phase D: two regressions behind a malformed verdict

**The behaviour-preservation lens returned a stub** — its entire summary was the word `"test"`, no findings — and validated against the schema, so the workflow scored it PASS. The other two lenses (cache keys, gates) passed legitimately. Re-running the missing lens found two confirmed regressions:

1. **`/admin/staff` "Bookable" silently lost half its meaning.** In-memory it was `member.active && member.can_take_bookings`; the SQL port kept only `can_take_bookings`. An admin filtering by Bookable without also setting Status=Active would see **deactivated staff** — someone on leave presented as available for work. Untestable by the existing spec, whose fake Supabase client does not evaluate `.eq()` predicates at all.
2. **A malformed date in the URL 500s two admin pages.** `new Date("garbage").toISOString()` throws `RangeError`. The in-memory code these replaced guarded with `Number.isNaN` and ignored bad input; the SQL port dropped the guard. `/admin/emails?range=custom&from=x` crashed server-side render. **Phase D turned a harmless no-op into an outage**, reachable from a truncated bookmark.

Both are the same failure mode — **a SQL predicate not semantically equivalent to the JS predicate it replaced** — and neither is visible to tsc, lint, vitest or build.

The verdict schema was tightened with minimum lengths so a stub summary cannot validate again.

### 2.3 — And a third, found by investigating rather than assuming

`escapeLike()` backslash-prefixed `,` `(` `)` before the value entered a `.or(...)` string. **PostgREST never honours that outside double quotes.** Confirmed from three independent sources rather than memory: `postgrest-js`'s `.or()` does zero escaping (`url.searchParams.append(key, `(${filters})`)` — the caller's string goes in verbatim); PostgREST's URL-grammar docs require percent-encoded double quotes for reserved characters; and a maintainer's answer in PostgREST discussion #3466 confirms it.

A staff search for **"Smith, John"** would have produced a malformed `or=` filter — and because both call sites discard the query error and fall back to `?? []`, the symptom was a **silently empty result**, not an error. Fixed at the two `.or()` call sites (`enquiries-data.ts`, `emails-data.ts`) via a `quoteOrValue()` wrapper; `escapeLike` now escapes only what ILIKE itself treats specially. The single-column `.ilike()` sites (`operations`, `privacy`) were verified unaffected — no top-level comma splitting — and correctly left alone.

---

## 3 — Phase C: the JSON-safety hazard, and why it held

`unstable_cache` serialises through JSON: a `Date` goes in and a **string** comes out, a `Set`/`Map` returns as `{}` — while TypeScript still believes the declared type. tsc passes, lint passes, vitest passes (mocks return real objects), the build passes, and the page throws in production.

All 16 wraps (13 new + 3 extended) were traced for runtime shape rather than declared type. **Every one is JSON-safe**, and in each case the `Set`/`Map`/`Date` construction happens *inside* the closure and is consumed before `return`, or on the consumer side after the cache boundary — several files carry an explicit "Map rebuilt on THIS side of the cache boundary" comment.

The genuine countermeasure: **every one of the 13 new spec files asserts `JSON.parse(JSON.stringify(data))` round-trips equal.** That catches a `Set`→`{}` or `Date`→string leak regardless of the cache mock's fidelity — which matters, because the shared fake cache stores the raw JS value on a hit and could not catch it alone. 108 tests, all green.

**`settings-data.ts`'s service-role swap was scrutinised and cleared.** The `business_settings` read moved from the RLS-bound request client to the admin client, because `unstable_cache` forbids `cookies()` inside a cached function. Verified safe: the RLS policy was `current_staff_has_permission('manage_settings')` — *identical authority* to the `PERMISSIONS.MANAGE_SETTINGS` gate that still runs before the fetch; the table has no credential columns across its whole migration history; and the same pattern is used by all 13 fetchers out of necessity.

---

## 4 — Logged, not fixed

- **⚠️ `getSettingsPageData`'s cache key is `["settings-page"]` with no permission flag**, unlike every sibling fetcher which keys on the caller's RBAC flags. Safe *only* because its single consumer is unconditionally gated. RLS used to be the backstop and no longer is, so a future direct importer (a cron, a script, another route) would get the full settings row with nothing left to catch the omission. Worth a guard comment or lint convention.
- **⚠️ `/admin/staff`'s `q`, workload and onboarding filters remain in-memory** — correctly, for now: `team-access.ts`'s `StaffProfilesQueryBuilder` exposes only `select/eq/order/maybeSingle` (RECON §5 untouchable, claim verified), and workload/onboarding have no backing column and depend on a live `now`. **But this is a C-16 pre-condition, not just a comment:** the moment `/admin/staff` gets a `.range()`-bounded query, those in-memory filters will silently filter only the current page instead of the whole directory. `/admin/staff` is not on C-16's pagination list today — if that changes, this must be revisited first.
- **`/admin/audit`'s relative date presets resolve `Date.now()` inside the cached closure**, so `today`/`this_week` can lag by up to the 60 s revalidate window. Not a JSON-safety violation (only ISO strings are returned).
- **`audit-data.ts` passes a nested object to `cacheKeyPart`**, whose normaliser sorts only top-level keys — key stability there rests on a single call site building `AuditFilters` in fixed order. Pre-existing Phase C code, not one of Phase D's surfaces.
- **⚠️ Four mutating action files remain untagged — and the reasoning given to the Owner was PARTLY WRONG.** `roles/actions.ts`, `services/actions.ts`, `account-password-requests/actions.ts`, `me/actions.ts`. The rule-6(b) ask presented all four as inert *because Phase C does not wrap their pages*. That is true page-by-page but **false at the table level**, which is what actually matters for cache invalidation — a cached fetcher on page X can read a table mutated from page Y:
  - `toggleRolePermission` writes `role_permissions`, which **`staff-detail-data.ts` reads** (a Phase C wrap tagged STAFF/BOOKINGS/AUDIT) to render effective permissions on `/admin/staff/[staffId]`.
  - `createService` / `updateService` / `deleteService` write `services`, which **`bookings-list-data.ts`'s `getBookingsChromeData` reads** to populate the `/admin/bookings` filter dropdown.
  So a permission grant/revoke, or a new/renamed/deleted service, **does** leave a cached surface stale — bounded to the 60 s revalidate window rather than permanently, but not "nothing". `account-password-requests/actions.ts` and `me/actions.ts` were re-checked and **are** genuinely inert: the tables and columns they touch are selected by none of the 13 cached fetchers.
  Caught by the closeout's cache-correctness lens, which rebuilt the writer→table→fetcher matrix from the shipped code rather than from this file's narrative.
  **✅ RESOLVED — Owner approved adding roles + services (chat 2026-08-03).** Fixed in `08bee11` (`toggleRolePermission` → STAFF+AUDIT; the three `services` mutations → BOOKINGS+AUDIT) and `2d5bcdb` (`updateRoleMetadata` → STAFF+AUDIT). Tag choices follow what the *reading* fetcher caches on, since the taxonomy has no `ROLES` or `SERVICES` tag; `audit` per the plan's Q9.2 rule. `account-password-requests` and `me` stay untagged, confirmed genuinely inert.
  **The addendum needed two commits, which is the lesson worth keeping.** The first fix scoped itself to the literal wording of the finding and skipped `updateRoleMetadata` — three lines above the function it did fix, writing `roles.display_label`, which `dashboard-data.ts` reads through a `roles(name, display_label)` **join** and caches on `TAGS.STAFF`. Both the original ask and the first fix failed the same way: **checking the page rather than the table, and missing a joined column.** The correct question is always "does any cached fetcher read a table this action writes", never "is this action's own page cached".
- **The brief's §2.5 lists `emails/ManualSendSheet:291` as a C-12+ deferred FAKE marker** — it no longer exists; an earlier plan removed it. Corrected in the Phase E inventory.
- **Commit convention — NOT a deviation after all.** Phase D's five commits use `chore(redesign): C-09 filter wiring — <surface>`, which differs from protocol §1 rule 5's general form. But **the plan itself pre-authorises exactly that string at its line 684**, so it is a plan-sanctioned exception, not a departure. This file previously overstated it; corrected at closeout.
- **⚠️ Phase-sequencing deviation (orchestrator's, not an implementer's).** Phase E's docs commit `cf9a436` (2026-08-03 01:08) landed **before** Phase D's fix commit `880809e` (01:41) — i.e. Phase D's verifier-found regressions were still open when Phase E's work began, contrary to §1 rule 1 (phases strictly sequential) and §2.3 (fail → one fix round → re-verify → advance). Cause: D and E were dispatched in a single workflow whose gate ran on D's *first* verdicts; the behaviour lens that found the regressions was a later re-run, because its original returned a malformed empty verdict. No functional harm — Phase E is docs-only with no code dependency on Phase D — but the sequencing itself is the deviation and is recorded rather than glossed.
- **Known flake:** `emails-data.test.ts`'s "does not re-run the fetcher on a cache hit" failed once in four full-suite runs under parallel load (expected 1 call, got 2); clean in isolation and on every re-run. Alongside the pre-existing `ManualBookingForm` load flake.

---

## 5 — Owner actions

Plan §3.3's manual Playwright verification (per-mutation invalidation, cross-surface invalidation, per-surface filter round-trips) is **Owner-performed by necessity** — every surface sits behind admin sign-in and no agent may authenticate (protocol §3b). Checklist written into `OWNER-ACTION-BACKLOG.md` at closeout. *(An earlier draft of this file asserted the hand-off had already happened when it had not — caught by the closeout's bookkeeping lens and corrected.)*

Nothing in C-09 is Zone-2: **no migration, no production write, no env change, no deploy.** It does not join the pending Cloudflare bundle.
