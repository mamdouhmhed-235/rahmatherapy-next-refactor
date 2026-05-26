# Band B — Programme Index

**Source of truth for the reframed Band B work.** Read this before opening any individual brief or plan.

**Parents:**
- `redesign/HANDOFF-2026-05-21.md` §1.8 — the locked-decisions summary
- `redesign/BAND-B-RESEARCH-2026-05-22.md` — full research + brainstorm artefact
- **`redesign/plans/B-phase/AUDIT-2026-05-22.md`** — audit report; fixes applied to briefs/plans after first draft. **Read before any implementation.**
- **`redesign/plans/B-phase/SHARED-IMPLEMENTATION-NOTES.md`** — cross-cutting concerns (DB indexes, Sentry, a11y, i18n, bundle budgets, discipline checklist, cohesion contracts)
- `PRODUCT.md`, `DESIGN.md` — brand voice + design system
- `redesign/RECON.md` §5 — untouchable list
- `redesign/BASELINE-ISSUES.md` — pre-existing baseline issues excluded from Phase 6/7

---

## Programme summary

Seven phases (one capture + six implementation). Build sequentially. Each phase has one brief (design spec; B-0 has plan only) and one plan (execution steps). Briefs live in `redesign/briefs/B[N]-*-brief.md`; plans live in `redesign/plans/B-phase/B[N]-*-plan.md`. **Single branch sequential** per session-4 decision (no per-phase worktrees).

| # | Phase | Brief | Plan | Output | Effort |
|---|---|---|---|---|---|
| **B-0** | **Baseline capture** | (none) | `B0-baseline-plan.md` | **Bundle baseline + skeleton screenshots + Sentry baseline + WCAG severity-token verification + fresh test Therapist account + per-phase progress templates.** Without this, "delta vs baseline" assertions in later phases are unenforceable. | **~0.5 day** |
| B-1 | Foundation primitives | `B1-foundation-primitives-brief.md` | `B1-foundation-plan.md` | shadcn-style chart primitives + `<KpiTile>` family + severity-strong tokens + skeleton shimmer + `<CountUp>` | ~1 day |
| B-2 | Metric backend | `B2-metric-backend-brief.md` | `B2-metric-backend-plan.md` | 10 new helpers in `reporting.ts` + `client-metrics.ts` + `report-insights.ts`, 3 migrations (first_contacted_at + indexes + **insight_dismissals**), `dismissInsight` server action, prior-period query infra, Sentry slow-query spans | ~3.5 days |
| B-3 | Performance surface | `B3-performance-surface-brief.md` | `B3-performance-surface-plan.md` | `/admin/me` page + `/admin/staff/[staffId]/performance` **sub-route** (per AUDIT H1), role-aware tile sets, activity timeline, "My Performance" nav self-link, inactive-staff historical render | ~2 days |
| B-4 | Reports rebuild | `B4-reports-rebuild-brief.md` | `B4-reports-rebuild-plan.md` | Full rebuild of `/admin/reports` — 6-tile headline strip, `[Team\|Personal]` toggle (**whole-page narrowing**), scope pill, staff drill-in, semantic charts, **persistent Insights stripe with dismiss**, **print-friendly stylesheet**, all variants | ~3.5 days |
| B-5 | Dashboard rebuild | `B5-dashboard-rebuild-brief.md` | `B5-dashboard-rebuild-plan.md` | Full rebuild of `/admin/dashboard` — operational-triage-only, Personal Contribution stripe (own metrics for every role including Owner), Ops Health promoted, mobile sticky bottom action bar with Therapist fallback ladder + PTR + swipeable today cards, M2/M3 papercuts, all variants. **Therapist fullness pass** (tone-refined per AUDIT Q1 — calm, professional, no gamification) — 5 new content blocks ensure the variant never feels empty. Feature-flagged for safety. | ~4 days |
| B-6 | Client LTV ribbon | `B6-client-ltv-ribbon-brief.md` | `B6-client-ltv-ribbon-plan.md` | LTV ribbon at top of `/admin/clients/[clientId]` — lifetime value, visit count, last seen, repeat status chip, mini-sparkline | ~0.5 day |

**Total: ~15 effort-days, compressed into ~14 elapsed days via overlapping work at phase transitions** (e.g. Day 1: B-0 morning + B-1 afternoon; Day 7: B-3 finish + B-4 start). The Day 14 timeline below shows the elapsed days; effort-day totals match the sum above. Each phase is a logical commit-grain unit (multiple commits per phase OK; one phase = one PR).

---

## Sequencing — hard prerequisites

```
B-1 (Foundation primitives)
  ├─→ B-3 (Performance surface — needs <KpiTile>, <SparklineChart>)
  ├─→ B-4 (Reports rebuild — needs all chart primitives)
  └─→ B-5 (Dashboard rebuild — needs <KpiTile>, severity-strong tokens, shimmer)

B-2 (Metric backend)
  ├─→ B-3 (needs getStaffScorecard, filterReportDataToStaff)
  ├─→ B-4 (needs prior-period query, all new aggregate helpers)
  ├─→ B-5 (needs personal-contribution helper for stripe)
  └─→ B-6 (needs getClientLifetimeMetrics)

B-3, B-4, B-5, B-6 are independent of each other and can ship in any order once B-1 + B-2 are in.
```

**Recommended ship order (mirrors the table):** B-1 → B-2 → B-3 → B-4 → B-5 → B-6.

**Why this order?**
- B-1 first: foundation; nothing visual works without it.
- B-2 second: backend; nothing meaningful without data shape.
- B-3 third: smallest UI surface; lowest risk; validates the foundation in production.
- B-4 fourth: bigger UI surface; uses everything from B-1 + B-2 + lessons from B-3.
- B-5 fifth: biggest UI risk (replaces the most-visited page); benefits from B-4 polish lessons.
- B-6 last: small adjunct, doesn't gate anything else.

---

## Variants preserved

The user explicitly flagged: **do not get rid of variants**. The reframed programme preserves all existing role variants:

### Dashboard (`/admin/dashboard`) — 3 variants
- **business** (Owner / Admin / Practice Manager) — full triage + business macro context (via Personal Contribution stripe + promoted Ops Health)
- **coordinator** — triage with unassigned-first + Active Enquiries focus + Ops Health
- **therapist** — worker tool: Next Visit hero + today's visits + claimable strip + weekly summary

All three variants share the new chrome (header rail, filter strip behaviour, Personal Contribution stripe template) but render different content per role. Resolved by `resolveAdminShellVariant(profile)` — unchanged contract.

### Reports (`/admin/reports`) — 4 scope variants
- **owner / admin** — full surface, all sections (Activity / Workload / Money), all 6 headline tiles, 8 CSV exports
- **coordinator** — Activity + Workload, 4 headline tiles (no revenue/outstanding), 5 CSV exports
- **therapist** — auto-narrowed to own data; "My report" title; Activity + Workload narrowed; 2 headline tiles, 1 CSV export
- **denied** — `AdminAccessDenied` with non-leaking copy

`[Team | Personal]` segmented control (NEW) adds an orthogonal scope to Owner/Admin/Coordinator. Therapist always sees Personal (no toggle needed). Drill-into-staff via `?staffId=` works for Owner/Admin/PM only.

### Performance surface — 4 role-aware tile sets
- **Therapist tiles**: completed sessions · hours worked · revenue attributed · utilisation · retention · no-show rate · clients touched · same-gender fulfilment
- **Coordinator tiles**: enquiries handled · conversion rate · avg time-to-first-contact · bookings assigned · operational events resolved
- **Admin / Owner-who-treats**: union of Therapist + Coordinator tile sets (visible because they may wear both hats)
- **Owner-who-doesn't-treat**: Coordinator-style admin tiles (no clinical work to surface)

All four variants render the same component tree with `tilesForRole(role)` selecting which `<KpiTile>` to render.

### Client detail (`/admin/clients/[clientId]`) — single surface
- LTV ribbon visible to anyone with `canViewClients(profile)` — no variant split. Therapist sees LTV for their own clients only (data layer narrows).

---

## What ships at the end

| Promise | How delivered |
|---|---|
| **Every operator sees their own granular numbers** | B-3 Performance surface — role-aware tile sets, every tile has sparkline + delta. Therapist sees their revenue attributed. Coordinator sees their conversion rate + response time. Admin/Owner see both. |
| **Macro mirror of the business** | B-4 Reports — 6 headline tiles with deltas, drill-into-staff via `?staffId=`, Insights stripe, semantic charts, `[Team\|Personal]` toggle. |
| **Operational triage that doesn't feel hollow** | B-5 Dashboard — Personal Contribution stripe at top, Ops Health promoted to Tier 1, mobile sticky action bar, swipeable cards, PTR. |
| **Consistent professional visual language** | B-1 Foundation — every tile, every chart, every loading state uses the same primitives. Severity tints stronger. Skeletons shimmer. Numerals count up. |
| **Client lifetime value visible where decisions are made** | B-6 LTV ribbon on client detail page. |
| **Zero new dependencies** | shadcn-style copy-paste charts owned in `src/app/admin/components/charts/`. No npm-supply-chain risk. |
| **Variants preserved** | All role variants of every surface continue to render correctly per `resolveAdminShellVariant`. |

---

## What's deliberately NOT in scope (deferred per session-4 decisions)

- Staff goals / targets per person (would need `staff_targets` table + admin UI)
- Public-facing therapist profile metrics
- Full AI / ML anomaly detection (only the simple deterministic Insights stripe ships)
- A separate per-client LTV page (the ribbon lives on the existing client detail page)
- Booking-creation, calendar, enquiry, audit, email, settings, staff-directory rebuilds (out of band)
- Track B operational work (MFA, backup drill, Cloudflare secrets, Sentry verify) — separate carry-over

---

## Per-phase verification gates

Each phase ships only when all four gates pass:

1. **Static**: `pnpm lint` + `npx tsc --noEmit` clean against the worktree.
2. **Unit**: vitest specs added per phase pass (baseline 112/118 preserved; no regression).
3. **Live**: Playwright role sweep — sign in as Owner, Admin, Coordinator, Therapist, Inactive (where relevant); navigate to the phase's primary surface; verify against the brief's Key States table.
4. **Visual**: screenshot at 375px / 768px / 1280px / 1440px; compare against the brief's layout strategy.

Verification commands are spelled out per phase in each plan file's "Verification gate" section.

---

## Discipline rules (carry forward from HANDOFF §4.5)

- **Zone-2 confirmation** required for: DB migrations to production, Edge Functions, Resend sends. The only migration in this programme is in B-2 (`enquiries.first_contacted_at`); explicit user confirmation per `mcp__supabase__apply_migration` call.
- **No scope creep.** Every changed line traces to one of the six phases. If a finding lands outside scope, flag it as a Phase 7 / V1.1 item — do not fix in-place.
- **Surgical edits.** Match existing style. Don't reformat adjacent code.
- **Server-action RLS-grant pattern.** Writes go through `createSupabaseAdminClient()` after `getStaffProfile()` auth check + manual `staff_id` scoping. See `staff/[staffId]/availability/actions.ts` and `phase16_service_role_grants.sql` for the canonical pattern (HANDOFF §4.1).
- **No `border-l-4`.** DESIGN.md ban. Use Pending family tint + full border instead.
- **No new npm dependencies.** shadcn/Tremor charts copy-pasted in. Verified zero-add with `pnpm install --frozen-lockfile` post-phase.

---

## Estimated dates (relative to programme start)

| Day | Phase active | Phase shipped |
|---|---|---|
| Day 1 | B-0 (morning) → B-1 (afternoon) | B-0 |
| Day 2 | B-1 + B-2 | B-1 |
| Day 3 | B-2 | — |
| Day 4 | B-2 (+ insight_dismissals + helpers) | — |
| Day 5 | B-2 → B-3 | B-2 |
| Day 6 | B-3 | — |
| Day 7 | B-3 → B-4 | B-3 |
| Day 8 | B-4 | — |
| Day 9 | B-4 (print + dismiss UX) | — |
| Day 10 | B-4 → B-5 | B-4 |
| Day 11 | B-5 | — |
| Day 12 | B-5 (Therapist fullness pass) | — |
| Day 13 | B-5 | — |
| Day 14 | B-5 → B-6 | B-5, B-6 |

**Day 14: programme complete.** Phase 7 audit re-entry possible from day 15.

---

*End of programme index. Read the individual briefs + plans top-to-bottom before implementing any phase.*
