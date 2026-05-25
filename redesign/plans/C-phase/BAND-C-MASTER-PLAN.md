# Band C — Audit, Polish & Feature Completeness — Master Plan

**Purpose:** the post-Band-B programme. Where Band B was a focused rebuild of four surfaces (Dashboard, Reports, Performance, Client detail) on top of a foundation primitives + metric-backend base, Band C is a **comprehensive audit of every admin surface as-is**, followed by **targeted fixes for the gaps that audit surfaces**, plus **a fixed slate of 11 user-prioritised feature + UX items** that close known gaps from the post-Band-B review.

**Programme status:** ⏳ scoping — this file. Per-item briefs + plans + the implementation checklist follow once the audit phase completes.

**Working branch:** `redesign/start-state` (single-branch sequential, same discipline as Band B per HANDOFF §4.1 / AUDIT Q9).

**Predecessor:** Band B completed 2026-05-25 at commit `a4c71cf` (B-6) + doc commits `e6ffcd7` + `6072284`. All 7 Band B phases ✅. See `redesign/plans/B-phase/BAND-B-MASTER-CHECKLIST.md` for full closure detail.

**Reference snapshot:** post-Band-B audit findings (this file Part 2) were captured 2026-05-25 from a fresh-eyes Owner Playwright sweep + 3 parallel research agents (CRM competitor landscape, UK compliance, internal code-level audit). Findings are the baseline; this programme acts on them.

---

## Programme intent

Three working phases:

1. **C-A — Audit pass.** Touch every admin surface individually, then in pairs/workflows, then as a cohesive system across every role. Catalogue everything: bugs, gaps, discrepancies, broken flows, design issues, missing affordances, role-vs-role inconsistencies, business-workflow holes. **Output:** per-page + per-workflow + per-role audit files, each with a categorised findings list.
2. **C-B — Plan writing.** For every audit finding + each of the 11 user-prioritised items below, write a brief + plan (Band B format: scope, layout strategy, key states, files, verification). Bundle related findings under a single brief where it reads cleaner; split when scope diverges.
3. **C-C — Implementation.** Execute plans phase-by-phase against a master implementation checklist (see §"Master implementation checklist" stub at the bottom).

**Sequence:** C-A runs first end-to-end (no fixes during audit — pure discovery to keep the baseline clean). C-B writes plans for the union of C-A findings + the 11 user items. C-C ships in order against the checklist with the same per-phase loop Band B used (pre-flight → read → implement → static gates → Playwright sweep → commit + log).

---

## Part 0 — Operating discipline (credentials, tooling, MCPs)

**This section applies to every C-phase plan file, audit file, and progress log. Every future C-A / C-B / C-C file MUST either embed this section verbatim or reference it by `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`.** Pre-flight steps in per-item plans must verify all of the below are in place before any code or audit work.

### Project root + branch

- Working directory: `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`
- Branch: `redesign/start-state` (single-branch sequential — no worktrees)
- Predecessor commit at programme start: `6072284` (last Band B doc commit, 2026-05-25)

### Dev server

- **Always run on `http://localhost:3000`** via `pnpm dev` in a separate terminal before any Playwright sweep.
- If a port-3000 collision message appears (`Port 3000 is in use by process N, using available port 3001 instead`), **the existing dev server is still running on 3000** — verify with `curl -I http://localhost:3000/admin/login/` returning `HTTP/1.1 200 OK`. Don't kill it; reuse it. (Per HANDOFF §4.1 dev-environment gotcha confirmed end-of-Band-B.)
- The user's own dev server typically already runs on 3000. Don't spawn a duplicate — verify with curl first.

### Login credentials (used across every role-sweep)

These are the canonical Band B credentials. **Every Band C audit + plan + Playwright sweep uses these accounts** — do not invent new ones, do not change passwords, do not create additional test accounts without Zone-2 user confirmation.

| Role | Email | Password | Notes |
|---|---|---|---|
| Owner | `rahmatherapy@outlook.com` | `Password123` | Main owner account. Profile id `01582c5d-bd75-4c49-b207-6f5597e15218`. Per scope clarification 1 below: **Owner takes bookings too.** |
| Admin | `test.admin@rahmatherapy.example.test` | `AdminTest123!` | Practice-Manager scope. |
| Coordinator | `test.coordinator@rahmatherapy.example.test` | `CoordinatorTest123!` | Booking-Coordinator scope. |
| Therapist | `test.therapist@rahmatherapy.example.test` | `TherapistTest123!` | Has assignments + history. Profile id `884311b1-e9d0-44b9-91f3-14188a3baf59`. |
| Therapist (fresh) | `test.therapist.fresh@rahmatherapy.example.test` | `TherapistFresh123!` | Active Therapist with zero assignments / bookings / claimable. Empty-state verification account. Profile id `87e01c11-9d0d-4b52-bf3e-2af16f0f03d5`. |
| Inactive | `test.inactive@rahmatherapy.example.test` | `InactiveTest123!` | Blocked at middleware. Profile id `58784433-cb42-4773-9b22-b792c24b852d`. |

### MCP usage

Both MCPs are available and should be used **where relevant** to the audit / plan / implementation task. Pick the right MCP for the job; don't reach for them unnecessarily.

**`mcp__supabase__*`** (project id `twzutkfgqclqurvkmvqz`, production):
- `mcp__supabase__execute_sql` — read-only queries, schema introspection, DB-state checks during pre-flight + verification.
- `mcp__supabase__apply_migration` — **Zone-2 only.** Requires explicit user confirmation per migration. Band C will need migrations for items like C-02 (recurring bookings — likely `bookings.recurrence_rule` column + companion table) and C-08 (additional `email_template` rows).
- `mcp__supabase__list_tables` / `list_extensions` / `get_advisors` / `get_logs` — diagnostic; safe to use freely during audit.
- `mcp__supabase__generate_typescript_types` — useful after schema changes.

**`mcp__playwright__*`** — canonical browser harness for the audit + post-implementation sweeps. Run against `http://localhost:3000` (the user's own dev server). NOT `preview_start` — that's a different harness the project prompt explicitly de-prioritises.

**Playwright sign-in pattern** (the form schema rejects the standard `browser_fill_form` shape; use `browser_evaluate` to set inputs natively):

```js
() => {
  const ev = (el, val) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  ev(document.querySelector('input[type="email"]'), '<email>');
  ev(document.querySelector('input[type="password"]'), '<password>');
  document.querySelector('button[type="submit"]').click();
}
```

Wait 2–3 seconds after the click for the navigation to settle.

**Playwright sign-out:** POST `/admin/signout`. Use `mcp__playwright__browser_evaluate` with `fetch('/admin/signout', { method: 'POST', credentials: 'include' })`.

**Alternative MCPs available but rarely needed:**
- `mcp__chrome-devtools__*` — alternative browser drive. Use Playwright unless a specific Chrome-only API (performance trace, lighthouse) is needed.

### Hard rules carried forward from Band B

These were programme-wide discipline in Band B and continue to apply throughout Band C. **Per-item plans must list any rule they're at risk of violating in their pre-flight section.**

- **No `pnpm install` / `pnpm add` / `npx <pkg>` / `npm i`** without Zone-2 user confirmation. Band B shipped 0 new deps across 7 phases; Band C should hold the same line unless a plan explicitly justifies a new dep.
- **Stage files explicitly** for every commit — `git add <path>`, never `git add .` / `git add -A`.
- **No `border-l-4` anywhere** (DESIGN.md ban).
- **Honour `prefers-reduced-motion`** in any animated component (use `src/app/admin/components/use-reduced-motion.ts`).
- **`updateTag(tag)` not `revalidateTag(tag, profile)`** for server-action cache invalidation (Next 16).
- **`createSupabaseAdminClient()` after `getStaffProfile()` auth check** — the RBAC pattern for every server action.
- **RECON §5 untouchables**: `reporting.ts` core exports (additive only), `dashboard-helpers.ts`, RBAC matrix, middleware, build configs, B-1 chart + tile primitives in `src/app/admin/components/charts|tiles/**` (import only).
- **SHARED-NOTES §15 (cache hazards)**: never put `Set<>` / `Map<>` / `Date` through `unstable_cache`.
- **SHARED-NOTES §17 (chart fills vs text tokens)**: use `statusChartFillForKey` from `src/app/admin/reports/ReportsCharts.tsx` for chart fills, not `theme.statusFillForName`.
- **SHARED-NOTES §18 (filter-vs-data discipline)**: run the 5-step audit checklist before merging any new filter-equipped surface.
- **Mobile-first.** Every UI change must read cleanly at 375 px. The B-5 mobile-truncation bug is the precedent — don't repeat it.

### Static + verification gates (every implementation phase in C-C)

Mirrors Band B. Per-item plans must run these before commit:

1. `pnpm lint` — 0 errors.
2. `npx tsc --noEmit` — 0 errors.
3. `pnpm vitest run` — new specs pass; **6 pre-existing baseline failures preserved** per HANDOFF §4.5 (`createBookingTransaction` × 1, `admin-access` × 2, `ManualBookingForm` × 3). Band C start baseline: 485 / 491 passing.
4. `pnpm build` — clean.
5. `node scripts/measure-admin-bundles.mjs` — bundle delta within budget per SHARED-NOTES §5 (Band B cumulative deltas are the floor; Band C plans must specify their own delta budget).
6. Playwright role sweep per the plan's verification gate (see Band B master checklist's reusable sweep recipe — steps 6 cache-hit + 7 mutation-flow are mandatory).
7. Screenshot evidence at 375 / 768 / 1280 / 1440 for surfaces with meaningful mobile reflow; 1280 for the rest.

### Site URL

Dev: http://localhost:3000

---

## Scope clarifications (read before any audit / plan work)

1. **Owner takes bookings too.** The Personal Contribution Stripe on `/admin/dashboard` showing all-zeros for the Owner account in the baseline sweep is **correct behaviour for an Owner who happens to have zero bookings in the active period**, not a non-treating-Owner false-state. Any UX redesign that assumes "Owner doesn't take bookings" is wrong. Sub-line "Across N visits" semantics still apply.
2. **All four user roles** must be considered as bookable practitioners where the workflow makes sense: Owner, Admin, Coordinator, Therapist. Clients always see whoever is assigned as their "therapist" regardless of underlying role.
3. **No Zone-2 ops during C-A** (no migrations, no auth.users writes, no Resend sends). Pure read-only audit work. Zone-2 returns case-by-case in C-C as plans require it.
4. **Single-branch sequential.** No worktrees this programme either (HANDOFF §4.1).
5. **Programme target audience.** A Luton-based UK clinic running massage + hijama with one Owner + a handful of self-employed therapists. UK-GDPR + ICO-aware. Cupping/hijama-specific compliance (sterilisation logs, single-use blade traceability, Luton BC skin-piercing licensing) is **out of Band C scope** — those land in a separate Tier-A compliance programme once the operational status of those licences is confirmed with the user.

---

## Part 1 — Baseline: production-readiness of current admin surfaces

Captured 2026-05-25 from the post-Band-B audit. This is the **as-is** state before any Band C work begins. Use as the starting reference for C-A.

| Surface | Verdict | Notes |
|---|---|---|
| `/admin/dashboard` (all variants) | ✅ READY | Polished after B-5 + 4 follow-up fix waves. Real UX observations captured below in Part 3 — three redundant urgency representations, no quick-add CTA, Personal Stripe reads zeros for Owner without bookings (correct per scope clarification 1). |
| `/admin/reports` | ✅ READY | Insight dismissal lacks optimistic UI (small). +2.65 kB over budget (within SHARED-NOTES §5 tolerance). |
| `/admin/bookings` (list) | ✅ READY | Comprehensive — attention/today/upcoming/claimable tabs, filter strip, status pills. Pre-existing `caret-color:transparent` hydration warning on autofilled filter inputs (HANDOFF §1.10). |
| `/admin/bookings/[bookingId]` | ✅ EXCEPTIONAL | The audit agent called it "exceptionally thorough" — reschedule accept/decline, next-action strip, email timeline, audit log. |
| `/admin/clients/[clientId]` | ✅ READY | B-6 ribbon just shipped; underlying page is comprehensive (1528 LOC). |
| `/admin/calendar` | ✅ READY | 1942 LOC — full-featured. |
| `/admin/staff/[staffId]` | ✅ READY | 1115 LOC, profile completeness checker, performance scorecard. |
| `/admin/operations` | ✅ READY | Filtering, presets, severity tiers. |
| `/admin/emails` | ✅ READY (per audit) — but item 8 below contests this | 985 LOC delivery log. **Item 8 marks this as incomplete; needs deeper audit before status holds.** |
| `/admin/services` | ✅ READY | Catalog with in-use guards. |
| `/admin/me` + `/admin/staff/[staffId]/performance` | ✅ READY (Band B) — but item 9 contests | **Recent Activity timeline grows unboundedly on `/admin/me` for Owner — pagination missing per item 9.** Status drops to ⚠️ pending pagination plan. |
| `/admin/bookings/new` | ⚠️ PARTIAL | Page is 102 LOC; the actual form is in `ManualBookingForm`. Form-submission UX, error handling, success redirect not verified end-to-end. Headline revenue mutation. |
| `/admin/clients/new` | ⚠️ STUB-ish | 54 LOC wrapper; form is in a subcomponent. Same verification needed: validation, duplicate-client check, success toast. |
| `/admin/enquiries` | ⚠️ PARTIAL | List + tabs + sort visible. **No verified "convert enquiry → booking" one-click flow** — item 3 below. |
| `/admin/staff/[staffId]/availability` | ⚠️ PARTIAL | 299 LOC — rules UI exists. Verify add/edit/delete and blackout date picker work end-to-end. |
| `/admin/availability` (global) | ⚠️ PARTIAL | 635 LOC. Verify the global form persists, shows affected-staff count, and warns on unsaved changes. |
| `/admin/settings` | ⚠️ PARTIAL | Form wrapping visible; verify validation + audit-log integration + concurrent-edit handling. |
| `/admin/roles` + `/admin/roles/[roleId]` | ⚠️ PARTIAL | 406 + 462 LOC. Verify create/edit/delete + cascade behaviour when archiving a role with assigned staff. |
| `/admin/privacy` | ⚠️ PARTIAL | **Updated 2026-05-25 via #22 audit.** Surface IS implemented (838 LOC). Triage works. But FULFILMENT is missing — see audit `22-privacy-audit.md` for P0 GDPR gaps: no SAR export, no cascade delete on completion, no 30-day SLA timer, no ICO breach workflow. The "Completed" button is a UI lie. |

---

## Part 2 — Band C scope (11 user-prioritised items)

These are the user-specified additions and fixes that Band C must address. Per-item briefs + plans get written in C-B, then implementation lands in C-C against the master checklist. **Preserved in the user's voice** as the source of truth for intent.

> **Updated 2026-05-26 — all 11 user-direction decisions locked.** See `redesign/plans/C-phase/C-B-DECISIONS.md` for full reasoning per question + per-plan final scope. The per-item Status lines below reflect the post-decisions verdict (scope + adjacent fold-ins). The original intent paragraphs are preserved in the user's voice.

### C-01 — Google Business review email after appointment completion

Send a Google Business review email to clients **2 hours after their appointment is marked completed**. Includes:
- A new email template (admin can review + edit pre-send).
- **Service-aware pre-filled review text** — depending on what service the client had, the Google review link should carry a ready-made message that's relevant to that service. Makes it easier for the client to leave a review and makes the resulting reviews more service-specific (and therefore more effective for local-search SEO).
- The clinic has a Google Business profile. The implementer should ask for the Google review link + any other relevant assets before writing the plan.

**Status (post-decisions 2026-05-26):** scope locked — URL `https://g.page/r/Ccfwk27JycKDEBM/review`. 10 variants (5 massage + 5 cupping) editable via existing `email_template_overrides` infrastructure (no new schema). 3 picked randomly per email, `{city}` injected from `clients.city`. Trigger `bookings.status='completed'` + 2h via pg_cron. ⏳ pending brief + plan. See `C-B-DECISIONS.md` §2 Q4 + §3 C-01.

### C-02 — Recurring / standing bookings

Where relevant, admin users with the appropriate roles can set a booking as **recurring** for different time periods (weekly, monthly, etc.). Because hijama clients often book on longer cadences (the lunar / Sunnah cycle pattern), the recurrence options should be **comprehensive** — not just "weekly / monthly" but custom intervals and end-conditions too. This should be an **option where relevant** (some services + clients don't suit recurring bookings).

**Implementer to do before writing the plan:**
- Review the codebase end-to-end for the existing booking flow.
- Ask the user questions about: which services should support recurrence, which roles should be allowed to set it, what cadence options to offer (weekly / fortnightly / monthly / custom / lunar-cycle), end-conditions (forever / N occurrences / until date), what happens when a single occurrence is cancelled, whether reschedules cascade.
- Make suggestions on the right shape.
- Confirm direction with the user before writing the implementation plan.

**Status (post-decisions 2026-05-26):** scope locked — weekly/fortnightly/monthly cadences only (no Hijri/Sunnah, dropped); all services on by default; Owner+Admin+Coord set; Therapist cannot; per-occurrence cancel/reschedule default; therapist binding locked with "Open to any therapist" toggle; hybrid 12-week generation; `recurring_booking_templates` table + RPC + cron; single plan. ⏳ pending brief + plan. See `C-B-DECISIONS.md` §2 Q3 + §3 C-02.

### C-03 — Enquiry → Booking one-click conversion

Add a one-click flow from an enquiry to a booking. Currently the conversion is manual re-entry in the new-booking form. The best way possible + easy.

**Status (post-decisions 2026-05-26):** narrow scope confirmed (~half-day fix). Service fuzzy-match + cross-page bug bundle from W01. ⏳ pending brief + plan. See `C-B-DECISIONS.md` §3 C-03.

### C-04 — Cancellation restore / undo

A cancelled booking can be **restored** (un-cancelled) instead of having to recreate it from scratch. Pairs with C-05.

**Status (post-decisions 2026-05-26):** **split — C-04a only, C-04b DROPPED.** Payment is in-person, no in-app refund tracking. C-04a scope: Restore button + restore email + state-machine guard + no-show quick action + assigned-practitioner auto-promote + hygiene tail (remove dead refunded/waived filters + 1-char `\|\|`→`??` reports fix). **Must ship before/with C-05** (Restore is load-bearing). ⏳ pending brief + plan. See `C-B-DECISIONS.md` §2 Q8 + §3 C-04a.

### C-05 — Bug: cancelled bookings can't be assigned or claimed

Fix the issue where bookings that have been cancelled cannot be assigned or claimed unless they get restored first. (Today they're in a dead state.) Pairs with C-04.

**Status (post-decisions 2026-05-26):** vantage locked — **lock down** (cancelled/no_show inert for all roles). `ensureBookingActive` helper at 7 edit points (6 from W05 §10 + B-171 past-dated). Restore-first via C-04a. ⏳ pending brief + plan. See `C-B-DECISIONS.md` §2 Q1 + §3 C-05.

### C-06 — Delete + bulk delete where relevant

Add delete and bulk-delete options where appropriate — clients, bookings, and whatever else is relevant. **Done in the best way possible suitable for the website as it is now, without causing other issues.** Implementer must consider:
- What stays soft-delete vs hard-delete (audit trail vs storage).
- Cascade behaviour (deleting a client with bookings; deleting a booking with assignments).
- GDPR right-to-erasure compatibility.
- RBAC — who can delete what.
- Undo window if any.

**Status (post-decisions 2026-05-26):** scope EXPANDED to 11 steps — absorbs B-110/B-131 destructive-overwrite fix + B-34 client edit route (Q6 fold) + privacy GDPR honesty fix (Q2 fold). One `deleteClient` primitive shared by privacy workflow and admin Delete button. No undo window, no booking hard-delete. Largest plan alongside C-02. ⏳ pending brief + plan. See `C-B-DECISIONS.md` §2 Q5/Q6/Q2 + §3 C-06.

### C-07 — Proper routing between pages

Improve cross-page navigation. Right now it feels **rudimentary** — too many flows force the user back to a list page and into another detail page, rather than jumping directly. Audit cross-page navigation patterns across the admin and propose a coherent routing model (drill-link patterns, breadcrumb behaviour, back-link semantics, modal-vs-route decisions).

**Status (post-decisions 2026-05-26):** scope grew significantly via C-A.3. Recommend split: C-07a (routing primitives) + C-07b (per-role defaults). Bundle of bugs from C-A.3 (B-108, W01-V-1, B-134, B-140, W05-V-2, W02-V-2, B-139, W08-V-1, W02-E-1, B-154/155/157, B-161, B-167, B-170). ⏳ pending brief + plan. See `C-B-DECISIONS.md` §3 C-07.

### C-08 — More email templates + automated email sends

The emails surface feels incomplete. Audit + expand. Templates + automation for both admin users and clients. Examples called out:
- When a booking is **assigned** to an admin user (or any role-bearing practitioner).
- When a practitioner **claims** a booking.
- When a client is assigned a therapist (or any role-bearing practitioner — clients see them as "therapist" regardless of underlying role per scope clarification 2).
- When a booking is **cancelled** for a client.
- (More to be surfaced during audit.)

Make `/admin/emails` properly production-ready. **Drops the page's verdict from ✅ READY to ⚠️ pending audit.**

**Status (post-decisions 2026-05-26):** scope locked — **5 templates ship in C-08:** assignment, client_assigned_therapist, booking_confirmed_client, staff_unassignment, claim. Plus per-row Resend button on `/admin/emails` delivery log. Drop review_request_client (C-01), booking_restored_client (C-04a), refund_issued (C-04b dropped), booking_completed_client (redundant). Uses existing `email_template_overrides` infrastructure. Single plan. ⏳ pending brief + plan. See `C-B-DECISIONS.md` §2 Q7 + §3 C-08.

### C-09 — Pagination + scale-aware design

Add pagination + other design treatments to pages and sections where unbounded lists ruin the visual design or break design principles at scale. **Headline example: the Recent Activity panel on `/admin/me` for the Owner role** — currently a long list that extends down the page indefinitely, ruining the entire visual hierarchy. Audit the whole admin for similar issues and plan fixes.

**Status (post-decisions 2026-05-26):** scope EXPANDED to cache-invalidation theme + filter-query FAKE cleanup. Tag-based pragmatic approach with 7 resource-level tags (clients, bookings, staff, enquiries, settings, audit, emails). Plus ~10 filter-query FAKE markers wired (enquiries, staff list, operations, emails, privacy). Non-filter FAKEs distribute to C-12+. ⏳ pending brief + plan. See `C-B-DECISIONS.md` §2 Q9 + §3 C-09.

### C-10 — Bottom-of-page spacing / footer overlap fix

Some pages have the bottom section sitting too close to the footer, so the bottom content can't be seen properly. Fix spacing + alignment across **all pages and variants, both mobile and desktop**, wherever the issue exists.

**Status:** unchanged. Need Playwright 375 audit pass to catalogue, then fix. ⏳ pending audit findings + plan.

### C-11 — Dark mode (default on, toggle to light)

Introduce dark mode as the **default**, with a user-switchable toggle to light mode. Persists per user. Honours `prefers-color-scheme` only as a tertiary fallback (default-on means the explicit default beats system preference unless the user toggles).

**Status (post-decisions 2026-05-26):** scope EXPANDED to dashboard variants + design system. **3 variant files matching existing `DashboardVariant` taxonomy** (Business / Coordinator / Therapist) — NOT 4 (Owner+Admin lumped, no current divergence). Shared building blocks + R05 pattern lifts + `PractitionerTodaySection` integration from C-FIELDWORK + dark mode + motion-reduce pass. Single phased plan. ⏳ pending brief + plan. See `C-B-DECISIONS.md` §2 Q11 + §3 C-11.

### C-FIELDWORK-EXPERIENCE — Fieldwork ergonomics (NEW)

Mobile fieldwork experience for any user fulfilling bookings (Owner / Admin / Coord / Therapist — capability-keyed via `staff_profiles.can_take_bookings`, NOT role-keyed). Surfaced from R04 audit findings + user clarification 2026-05-26.

Bundles: booking-detail mobile sidebar reorder (client phone + address prominent), `tel:` deep-link, maps deep-link, mobile-sticky complete action, `PractitionerTodaySection` drop-in component (used by C-11 dashboard variants), time-of-day greeting extraction, pull-to-refresh.

**Status (post-decisions 2026-05-26):** scope locked. Capability-keyed via `isViewerAssignedPractitioner(booking, viewerStaffId, viewerCanTakeBookings)` predicate. Booking detail page renders two ways per viewer (practitioner view vs admin-curator view). Out of scope: offline cache, PWA, native app, push notifications. ⏳ pending brief + plan. See `C-B-DECISIONS.md` §2 Q10 + §3 C-FIELDWORK-EXPERIENCE.

---

## Part 3 — Additional findings carried over from the post-Band-B audit (not yet user-prioritised)

These came out of the 2026-05-25 audit and are not in the 11 above. They live here so they're not lost. The user decides during C-B planning whether to fold any into Band C or defer to a later band.

**From the live Owner Dashboard sweep:**
- Three redundant urgency representations on the Owner Dashboard (Snapshot · Today / Needs your attention / Operations Health) — visually nearly identical, conceptually different. High cognitive load.
- No quick-add CTAs on the dashboard ("Add booking", "Add client", "Add enquiry"). Every CRM in the comparison set puts these in the header.
- Pre-existing `caret-color:transparent` hydration warning on the bookings filter strip (HANDOFF §1.10) — browser-autofill induced; React 19 logs it as a noisy error each page load. Workaround would be `suppressHydrationWarning` on the filter inputs.
- Production DB visibly contains test data — `Audit Test Client 5`, `Phase10 E2E Claim Client`, `Test Therapist Fresh` show up in the bookings list. Either the dev DB is doubling as prod, or the test seed never got cleaned up. Hygiene issue before public launch.

**From the cross-system / operational gaps in the audit:**
- No refund workflow as an atomic action — currently distributed (mark `amount_paid=0` + manual note).
- No bulk-reassignment when a therapist gets sick.
- No conversations/messages surface — client communication happens outside the admin (WhatsApp etc.) so institutional memory is lost.

**From the CRM-competitor comparison (industry table-stakes we don't ship):**
- Online booking widget for the public site (likely exists separately — needs audit).
- Packages / memberships / gift cards sold + redeemed at checkout.
- Deposits + automatic no-show charging (Stripe-backed).
- Therapist commission tracking + payout statements.
- Marketing automation beyond C-08's transactional emails (birthday, re-engagement, post-visit rebook prompt — overlaps C-01).
- Two-way SMS + AI receptionist (longer-term).
- Recurring bookings (overlaps C-02).

**From the UK-compliance research (operational/legal — likely outside Band C, flagged for the user's separate compliance track):**
- Luton BC skin-piercing premises + practitioner registration (mandatory for wet hijama).
- ICO data-controller registration (mandatory for storing health data).
- UK-GDPR Art.9(2)(h) handling for health data + appropriate-policy document on file.
- SAR full-export within 1 month — `/admin/privacy` needs verification this actually works end-to-end.
- 72h breach notification workflow.
- Sharps + clinical-waste consignment-note log.
- Autoclave cycle + monthly spore test log.
- Single-use blade batch traceability per session.
- Therapist credentials register (cert + indemnity + first-aid + IPC + hep-B vaccination expiries).
- HMRC-compliant invoices retained 6 years.
- PECR-compliant marketing consent state per client.

**From the hijama-specific differentiation opportunity:**
- Wet-hijama-specific consent variant.
- Body-map marking with point/dot annotation + comparison view.
- Before/after bruise photo log.
- Hijri-calendar awareness (peak demand on 17/19/21 of lunar month — Sunnah days).
- Religious/cultural fields (gender preference, prayer-time avoidance).
- Multilingual consent (Arabic/Urdu).

---

## Part 4 — C-A audit strategy (how we'll do the audit pass)

The audit runs as three concentric sweeps before any plan-writing or fixing. **No fixes during C-A** — pure discovery to keep the baseline clean.

### C-A.1 — Per-page audit (every admin surface, every role)

For each surface in Part 1's table, do:

1. **Code-level read:** page.tsx + colocated form/component files. Note TODOs / FIXMEs / stub branches / unhandled error paths.
2. **Live visual sweep** via Playwright **per role** (Owner / Admin / Coordinator / Therapist / Therapist-Fresh / Inactive where it applies):
   - 4 viewports for the surfaces that have meaningful mobile design (Dashboard, Bookings list, Client detail, Reports). 1280 for the rest.
   - Empty-state render (no data) + populated render + error-state where reachable.
   - Console: 0 errors, 0 new warnings.
   - Network: no failed requests.
3. **Cross-role parity check:** does the same surface behave consistently for each role's scope? Does the RBAC narrowing happen at data-fetch (correct) or at render (wrong, leaks)?
4. **Findings catalogue:** one Markdown file per surface, e.g. `redesign/audits/C-A/01-dashboard-audit.md`, with sections: Bugs found · Visual issues · Empty/edge states · Cross-role inconsistencies · Cross-viewport issues · Console/network issues · Pre-existing items the audit accepts · Items for plans.

**Surfaces to cover** (numbered for file-naming convention):

| # | Surface | Roles to sweep | Priority |
|---|---|---|---|
| 01 | `/admin/dashboard` | Owner / Admin / Coord / Therapist / Therapist-Fresh | high |
| 02 | `/admin/bookings` (list) | Owner / Admin / Coord / Therapist | high |
| 03 | `/admin/bookings/new` | Owner / Admin / Coord | high (item C-05 bug repro) |
| 04 | `/admin/bookings/[bookingId]` | Owner / Admin / Coord / Therapist | high |
| 05 | `/admin/clients` (list) | Owner / Admin / Coord / Therapist | medium |
| 06 | `/admin/clients/new` | Owner / Admin / Coord | medium |
| 07 | `/admin/clients/[clientId]` | Owner / Admin / Coord / Therapist | medium |
| 08 | `/admin/enquiries` | Owner / Admin / Coord | high (item C-03) |
| 09 | `/admin/calendar` | Owner / Admin / Coord / Therapist | medium |
| 10 | `/admin/staff` (list) | Owner / Admin | medium |
| 11 | `/admin/staff/[staffId]` | Owner / Admin | medium |
| 12 | `/admin/staff/[staffId]/availability` | Owner / Admin | medium |
| 13 | `/admin/staff/[staffId]/performance` | Owner / Admin | medium |
| 14 | `/admin/me` | every role | high (item C-09 repro) |
| 15 | `/admin/availability` (global) | Owner / Admin | medium |
| 16 | `/admin/services` | Owner / Admin | low |
| 17 | `/admin/settings` | Owner / Admin | medium |
| 18 | `/admin/operations` | Owner / Admin / Coord | low |
| 19 | `/admin/emails` | Owner / Admin | high (item C-08) |
| 20 | `/admin/email-templates/preview/[id]` | Owner / Admin | high (item C-08) |
| 21 | `/admin/roles` + `/[roleId]` | Owner / Admin | medium |
| 22 | `/admin/privacy` | Owner / Admin | high (GDPR — unknown status) |
| 23 | `/admin/account-password-requests` | Owner / Admin | low |
| 24 | `/admin/audit` (if linked) | Owner | low |
| 25 | `/admin/reports` | Owner / Admin / Coord / Therapist | medium |

### C-A.2 — Cross-page workflow audit (page-pairs and short flows)

After per-page audit completes, audit the **flows that span multiple pages**. One Markdown file per workflow, e.g. `redesign/audits/C-A/W01-enquiry-to-booking-flow.md`.

**Workflows to cover:**

| # | Workflow | Pages involved | Hits item(s) |
|---|---|---|---|
| W01 | Enquiry → booking conversion | enquiries → bookings/new → bookings/[id] | C-03 |
| W02 | New booking creation end-to-end | dashboard → bookings/new → confirmation → email | C-08 |
| W03 | Booking lifecycle: pending → confirmed → completed → review | bookings/[id] → emails (review send) | C-01, C-08 |
| W04 | Booking cancellation + restore | bookings/[id] cancel → restore | C-04, C-05 |
| W05 | Booking assignment / claim / reassign | bookings/[id] → staff/[id] → emails | C-08 |
| W06 | Client creation + first booking | clients/new → clients/[id] → bookings/new | C-06 (delete pair) |
| W07 | Therapist availability + recurring booking | staff/[id]/availability → bookings/new (recurring) | C-02 |
| W08 | Owner switching scope (own bookings vs team) | dashboard → me → reports?scope=personal | scope clarification 1 |
| W09 | Refund + payment correction | bookings/[id] → audit | (carried from Part 3) |
| W10 | Settings edit + downstream impact | settings → bookings/new (booking window etc.) | |

### C-A.3 — Whole-system synergy audit (one file per role)

Final pass: as each role, **walk the day** end-to-end. Sign in → do the role's primary daily tasks in sequence. Note: friction, dead-ends, missing context handoffs, mode mismatches between surfaces, navigation rudimentaries (item C-07).

| File | Role | Day walked |
|---|---|---|
| `R01-owner-day.md` | Owner | Morning dashboard check → review yesterday → handle today's bookings → respond to enquiries → review reports → handle a refund |
| `R02-admin-day.md` | Admin | Practice-Manager workflow: bookings + staff + reports + emails |
| `R03-coordinator-day.md` | Coordinator | Triage queue: unassigned bookings + enquiry follow-up + active queues |
| `R04-therapist-day.md` | Therapist | Worker app: today's visits + next visit + claim a slot + complete a booking + add a note |
| `R05-therapist-fresh-day.md` | Therapist-Fresh | First-time experience: zero-state ladder, what nudges them into productive work |

---

## Part 5 — C-B plan-writing strategy

Once C-A audit files are written, C-B converts findings into briefs + plans.

**Per-item file layout** (mirrors Band B):

- `redesign/briefs/C-NN-{slug}-brief.md` — design + scope + content + states
- `redesign/plans/C-phase/C-NN-{slug}-plan.md` — execution steps + files + verification gates
- `redesign/per-page-progress/C-NN-{slug}-progress.md` — step-by-step log filled in during C-C

**Numbering convention:**
- `C-01` through `C-11` reserved for the 11 user-prioritised items (Part 2).
- `C-12+` for audit-surfaced items that the user picks up after reviewing C-A findings.
- Letter suffixes for sub-items if an item splits during planning (e.g. `C-08a-email-templates-brief.md` + `C-08b-email-automation-brief.md`).

**Brief ↔ plan ↔ progress file expectations** (same as Band B):
- Brief = "what we're building + why + how it looks". Scope, layout strategy, key states, content requirements, recommended references, open questions.
- Plan = "how we build it safely". Safe implementation order, what can go wrong, verification gate (commands + pass criteria), files touched, undo procedure.
- Progress = "what actually happened". Filled in during C-C — step-by-step COMPLETE lines, deviations from plan, audit findings folded in.

---

## Part 6 — C-C implementation strategy

Once all C-B plans are written:

1. Build the **master implementation checklist** (see stub below) — every plan listed with state ⏳/🔨/✅, commit SHA column, blocked-by column.
2. Execute in dependency order (a plan that adds an `is_recurring` column to `bookings` blocks any plan that consumes it).
3. Same per-phase loop Band B used: pre-flight → read brief + plan → implement → static gates (lint + tsc + vitest + build + bundle delta) → Playwright role sweep → commit + update master checklist + per-phase log + HANDOFF.

**Discipline carried forward from Band B (re-read before C-C starts):**
- `SHARED-IMPLEMENTATION-NOTES.md` §15 (cache hazards), §17 (chart fills vs text tokens), §18 (filter-vs-data discipline). All still apply.
- No `border-l-4` anywhere (DESIGN.md ban).
- Honour `prefers-reduced-motion` in any animated component.
- Server-action RLS pattern: `createSupabaseAdminClient()` after `getStaffProfile()` auth check.
- Cache invalidation in server actions uses `updateTag(tag)` not `revalidateTag(tag, profile)` (Next 16).
- Stage files explicitly — never `git add .` / `git add -A`.

---

## Master implementation checklist (stub — filled in once C-B plans are written)

| # | Plan file | State | Started | Shipped | Commit | Blocked by | Notes |
|---|---|---|---|---|---|---|---|
| C-A.1 | per-page audit files (25 surfaces) | ✅ | 2026-05-25 | 2026-05-25 | bundle | — | **C-A.1 COMPLETE.** All 25 surfaces audited. #21+#23+#24+#25 batched: roles delete is stubbed (PE-58 guard pattern correct), password-requests notes not persisted (data-loss), audit log has proper cursor pagination (C-09 template alongside operations), reports has zero animate-spin (cleanest a11y posture). |
| C-A.2 | workflow audit files (10 flows W01..W10) | ✅ | 2026-05-25 | 2026-05-25 | `46bfa1e` | C-A.1 | **C-A.2 COMPLETE.** All 10 workflows audited. 50 new bugs (B-104..B-153). HEADLINE findings: B-110+B-131 destructive client overwrite (3 paths) → C-06 architecture in W06§10. B-116 C-01 review email fully greenfield → C-01 architecture in W03§11. C-02 fully greenfield → C-02 architecture in W07§10. B-126 6th C-05 edit point + `ensureBookingActive` helper recommendation in W05§10. B-149 settings save only revalidates /admin/settings → C-09 cache pass in W10§10. See `redesign/audits/C-A/C-A-2-SUMMARY.md` for full handoff. |
| C-A.3 | role-day audit files (5 roles) | ✅ | 2026-05-25 | 2026-05-25 | `ac96fe4` | C-A.1, C-A.2 | **C-A.3 COMPLETE.** R01..R05 audited. 20 new bugs (B-154..B-173). HEADLINE: TherapistDashboard.tsx is the strongest empty-state surface — reference template for C-11. B-158 (R02) Admin role-trust on Privacy "Completed" — regulatory exposure. **C-A COMPLETE** (173 bugs across 25 surfaces + 10 workflows + 5 role-days). See `redesign/audits/C-A/C-A-3-SUMMARY.md`. |
| C-B-DECISIONS | answers to 11 open questions blocking C-B | ✅ | 2026-05-26 | 2026-05-26 | (this commit) | C-A | **All 11 questions locked.** See `redesign/plans/C-phase/C-B-DECISIONS.md`. Tier-A Privacy GDPR deferred (folded into C-06). C-04b DROPPED (no in-app refund tracking). C-FIELDWORK-EXPERIENCE added as new plan. C-11 expanded to dashboard variants + design system. C-06 absorbed B-34 client edit + privacy honesty fix. Recommended C-B plan-writing order in §5. |
| C-B | per-item brief + plan writing | ⏳ | — | — | — | C-B-DECISIONS | covers 12 plans (C-04b dropped, C-PRIVACY not written, C-FIELDWORK added). Recommended order: C-06 → C-04a → C-05 → C-01 → C-FIELDWORK → C-11 → C-08 → C-02 → C-09 → C-03 → C-07 → C-10. |
| C-01 | Google review post-completion email | ⏳ | — | — | — | C-B | item 1 — scope locked (see C-B-DECISIONS §3 C-01) |
| C-02 | Recurring / standing bookings | ⏳ | — | — | — | C-B | item 2 — needs DB migration. Weekly/fortnightly/monthly only (no Hijri/Sunnah, dropped). Hybrid 12-week generation. |
| C-03 | Enquiry → booking conversion | ⏳ | — | — | — | C-B | item 3 — narrow (~half-day) scope confirmed |
| C-04a | Cancellation restore | ⏳ | — | — | — | C-B | item 4 — **must ship before/with C-05** (load-bearing). Plus hygiene tail (remove dead refunded/waived filters + 1-char reports fix). |
| ~~C-04b~~ | ~~Refund modal~~ | **DROPPED** | — | — | — | — | Payment is in-person, no in-app refund tracking. See C-B-DECISIONS §2 Q8. |
| C-05 | Bug: cancelled bookings claim/assign | ⏳ | — | — | — | C-B, C-04a | item 5 — lock down via `ensureBookingActive` helper at 7 edit points |
| C-06 | Delete + bulk delete + client CRUD hardening | ⏳ | — | — | — | C-B | item 6 — **EXPANDED to 11 steps.** Absorbs B-110/B-131 destructive-overwrite fix + B-34 client edit (Q6) + privacy GDPR honesty fix (Q2). Largest plan alongside C-02. |
| C-07 | Routing between pages | ⏳ | — | — | — | C-B | item 7 — recommend split C-07a + C-07b |
| C-08 | Email templates + automation expansion | ⏳ | — | — | — | C-B | item 8 — 5 templates + per-row Resend tooling. Uses existing `email_template_overrides` (no new schema). Single plan. |
| C-09 | Cache invalidation + pagination + filter FAKE cleanup | ⏳ | — | — | — | C-B | item 9 — tag-based pragmatic approach (7 resource-level tags) + ~10 filter-query FAKE markers wired |
| C-10 | Bottom-spacing / footer overlap | ⏳ | — | — | — | C-B | item 10 — global polish (unchanged scope) |
| C-11 | Dashboard variants + design system + dark mode | ⏳ | — | — | — | C-B, C-FIELDWORK | item 11 — **EXPANDED.** 3 variant files (Business / Coordinator / Therapist) + shared building blocks + R05 pattern lifts + `PractitionerTodaySection` integration + dark mode + motion-reduce pass. Single phased plan. |
| C-FIELDWORK | Fieldwork ergonomics (capability-keyed) | ⏳ | — | — | — | C-B | NEW from Q10 — `C-FIELDWORK-EXPERIENCE-plan.md`. Capability-keyed via `can_take_bookings` + active assignment. Booking-detail dual-view + `PractitionerTodaySection` (consumed by C-11) + `tel:`/maps/mobile-sticky primitives. |
| ~~C-PRIVACY~~ | ~~Privacy GDPR fulfilment sprint~~ | **NOT WRITTEN** | — | — | — | — | Deferred per Q2. Honesty fix folded into C-06. Full GDPR sprint (B-89 ICO breach + B-90 SLA) deferred to separate compliance band. |
| C-12+ | TBD — audit-surfaced items | ⏳ | — | — | — | C-B | Inventory in C-B-DECISIONS §3: heterogeneous FAKE markers (non-filter), B-89 ICO breach, B-90 SLA, Owner-from-Admin dashboard split (if/when needed). |

**State legend:** ⏳ pending · 🔨 in progress · ✅ complete · ⚠️ blocked · ⏸ paused

---

## Programme-level final gates (Band C completion)

To be ticked once C-C ships all plans:

- [ ] All 11 user-prioritised items addressed (C-01 → C-11).
- [ ] All C-A.1 audit-surfaced items either addressed in C-12+, deferred to a later band (with rationale), or dismissed (with rationale).
- [ ] Production-readiness table in Part 1 has every ⚠️ PARTIAL and ❌ UNKNOWN row resolved to ✅ READY or moved to a future band with a written reason.
- [ ] HANDOFF-2026-05-21.md §1.16+ entries per shipped plan.
- [ ] Per-item progress files complete.
- [ ] Bundle deltas all within budget per `SHARED-IMPLEMENTATION-NOTES.md` §5 (Band B budget envelope still applies; new deltas tracked here).
- [ ] No new persistent Sentry error classes vs the post-Band-B baseline.
- [ ] Vitest baseline (485 / 491 at start of Band C) preserved; new specs all pass.
- [ ] All Band C migrations applied + verified.
- [ ] Production DB cleanup completed (test rows removed; identified in Part 3).
- [ ] Programme-level Phase 8 hand-off written.

---

## Hand-off

**Next session opens here:** read this file end-to-end. Pick a starting point — recommended sequence is C-A.1 (per-page audit) starting with the high-priority surfaces. Each per-page audit file lands one at a time; cross-page workflow audits begin only after the per-page set is complete; role-day walks begin only after the workflow set is complete. Then C-B writes plans against the consolidated findings. Then C-C ships.

**If the user wants to skip the audit phase and go straight to one of the 11 user-prioritised items**, that's allowed — each item is independent enough — but the audit will surface adjacent issues that affect plan scope, so doing them out of order risks rework. Audit first is the recommended discipline.

---

*End of Band C master plan. Update this file as audit findings land, plans get written, items ship, and the checklist fills in. This file is the single source of truth for "where are we in Band C?".*
