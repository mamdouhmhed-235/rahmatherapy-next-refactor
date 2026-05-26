# Research-grounded contemplation: R1, R2, R3 reframed

**Date:** 2026-05-22
**Context:** Band B (R1 Dashboard / R2 Reports / R3 Per-user metrics) reframed after the user reported the post-Phase-6 surfaces still feel dead/unprofessional, and that per-user metric tracking is missing as a first-class concept.
**Status:** research + brainstorm, not yet locked. Concrete decisions pending — see §8.

---

Plenty of new ground here. Let me organise this into seven movements: what I heard, what the industry actually does, what the metric canon should look like, where each metric should live, the backend gaps, the design direction, and a revised programme. I'll close with concrete decisions to lock.

---

## 1. What you actually said (re-grounded)

Three things, reframed precisely:

1. **The dashboard and reports surfaces feel dead and unprofessional NOW, post-Phase-6.** Spacing, alignment, card sizing, colours, visuals — not the IA. Phase 6 polish didn't get it there.
2. **Per-user metrics don't exist as a first-class thing.** Every operator (Owner, Admin, Coordinator, Therapist) should be able to see *their own* numbers in a granular, visual way — bookings, revenue brought in, retention, etc. Owner/Admin additionally need a macro view that overlays everyone.
3. **Reports should be the macro mirror** (business-wide); **per-user metrics should live on the user's own account/profile page** (or equivalent). Right now neither exists properly.

The "where does my own data live" question is the real architectural one. Industry resolves it by a triad — and our codebase is missing the third surface entirely.

---

## 2. What the industry actually does

A few patterns I confirmed across SimplePractice, Jane App, Cliniko, TherapyNotes, Mindbody, Mangomint, Vagaro and the broader 2026 SaaS dashboard literature:

### The triad pattern (universal)

| Surface | Audience | Question it answers |
|---|---|---|
| **Dashboard / "Today"** | All roles | "What do I need to do *right now*?" — operational triage. |
| **Reports / "Insights"** | Owner / Admin / Practice Manager (drill-into-staff via filter) | "How is the *business* doing across any time window?" — macro lens with micro drill. |
| **Practitioner / Staff page** | Each individual + their managers | "How am *I* doing?" — personal scorecard. |

Jane App calls these "Schedule," "Insights," and "Practitioner Dashboard." SimplePractice calls them "Calendar," "Reports," and "My Profile → Performance." TherapyNotes splits the same way. Cliniko does too. **The pattern is so consistent it's effectively a standard.**

We have the first two surfaces; the third doesn't exist as a UI in our app. R3 as currently scoped (two helpers, no new page) is half-hearted — the helpers without a home leave the actual problem unsolved.

### Standard metrics canon for therapy/wellness clinics

What every comparable platform tracks (sources cited at end):

**Business-wide (macro):**
- Booking utilisation rate (sessions delivered ÷ available slots; industry target 70–85%)
- Revenue per visit / Average Treatment Revenue
- Net collection rate (collected ÷ owed; target >95%)
- New client acquisition (count + by source)
- Client retention rate (% of clients with ≥3 sessions, or ≥8 for mental-health benchmarks)
- No-show + cancellation rate (with lost-revenue calculation)
- Repeat client rate
- Source attribution (which channels drive bookings)
- Service mix
- Therapist workload distribution

**Per-staff (micro):**
- Personal booking count (assigned / completed)
- Hours worked
- Clients touched (unique)
- Revenue attributed (their share of revenue, via the staff-revenue-attribution logic we already have)
- Personal utilisation rate (their slots booked ÷ their available slots)
- Personal no-show rate (their bookings that didn't happen)
- Personal retention (their clients who came back)
- Same-gender / specialty fulfilment count (clinically relevant for Rahma)
- Time-to-first-contact (Coordinator-specific: how fast they reach new enquiries)
- Enquiry conversion rate (Coordinator: enquiries they touched → bookings)

### Modern dashboard design rules (2026 consensus)

- **5–9 cards on first paint, not 50.** Research finds users spend 3–5 minutes per dashboard session; every pixel must justify itself.
- **40-30-20-10 space rule.** 40% to the single most important metric, 30% to 2–3 secondary KPIs, 20% to trend context (sparklines, comparison bars), 10% to navigation/filters.
- **Tile = number + delta chip + sparkline.** Stripe-pattern. We have the number; deltas and sparklines are missing across most of our tiles.
- **Progressive disclosure**, not "everything visible." Headline first; drill down on demand.
- **Skeleton + shimmer**, not pulse. Content-shaped placeholders that mirror the final layout, with a horizontal gradient sweep. We currently use pulse — feels older.
- **F-shape reading pattern.** Top-left → right → drop → repeat. Most important card top-left, not centred.
- **Charts use 5–9 distinct hues max**, and status colours should be semantic (green = good, amber = needs attention, red = problem). Recharts default colours are arbitrary and we still use them in some places.
- **Card system**: 8–12px corner radius, 24px internal padding, consistent border or subtle shadow. Tremor and shadcn's defaults match this exactly.

---

## 3. The metric canon for Rahma — what to actually track

Mapping the industry canon to what the data layer can already produce vs. what's missing:

| Metric | Macro | Micro | We can compute today? |
|---|---|---|---|
| Bookings (count, window) | ✓ | ✓ | Yes |
| Revenue collected | ✓ | ✓ via `getStaffRevenueAttribution` | Yes |
| Outstanding revenue | ✓ | ✓ scoped | Yes |
| Repeat clients | ✓ | ✓ scoped | Yes (have it for macro; not for micro) |
| New clients | ✓ | ✓ scoped | Yes (have it for macro; not for micro) |
| Avg booking value | ✓ | ✓ | Yes (derive from totals ÷ count) |
| **Utilisation rate** | ✓ | ✓ | **Partial** — we have `assignment_status` and staff availability rules, but no canonical helper computing % |
| **No-show rate** | ✓ | ✓ | **Partial** — `status='no_show'` exists, no aggregate helper |
| **Client retention rate** | ✓ | ✓ | **Partial** — need "% of clients with N+ completed bookings" helper |
| **Source attribution** | ✓ | partial | **Partial** — `booking_source` exists, used in Reports CountBy but not exposed as a dashboard tile |
| **Net collection rate** | ✓ | ✓ | Yes (collected ÷ booked × 100) |
| Service mix | ✓ | ✓ | Yes |
| **Time-to-first-contact (enquiries)** | ✓ | ✓ (Coordinator) | **No** — needs `enquiries.first_contacted_at` column |
| **Enquiry conversion rate** | ✓ | ✓ (Coordinator) | **Partial** — `enquiries.converted_to_booking_id` may or may not exist; need to verify |
| Same-gender fulfilment | ✓ | ✓ (Therapist) | Yes (assignments have `required_therapist_gender`) |
| Period-over-period delta on all of the above | ✓ | ✓ | **No** — needs prior-period query (cheap fix) |

**Roughly 70% of the canon is already computable from existing tables.** The 30% gap is the actionable backend work — I'll detail it in §5.

---

## 4. Where each metric should live — proper separation

This is the architectural decision that unifies everything else.

### Surface A — Dashboard (`/admin/dashboard`)
**Audience:** All roles. **Question:** "What do I need to do today?"

- **Today + Attention** (operational triage; what we have, sharpened).
- A thin **Personal Contribution stripe** at the top: 4 numerals scoped to the operator. For Owner/Admin: "Today's bookings · This week's revenue · Open attention · Clients this month." For Therapist: "Next visit · Today's visits · Hours this week · Clients this month." For Coordinator: "Unassigned today · Enquiries to call · Conversions this week · Avg response time."
- **NO macro charts here.** Dashboard is not a report card.

### Surface B — Reports (`/admin/reports`)
**Audience:** Owner, Admin, Coordinator (limited), Therapist (own slice only).
**Question:** "How is the *business* doing, with the ability to drill into any window or any person?"

- **6 headline tiles** (number + delta + sparkline) covering the core canon.
- **Scope pill** + **`[ Personal | Team ]` segmented control** + **staff combobox** (drill into one).
- **Macro charts**: revenue trend, status mix, source mix, workload stacked bar, service performance.
- **Drill-into-staff**: when `?staffId=` is set, the entire page narrows to that staff member, and the page heading becomes "Reports — Aisha Hassan." Same component tree, different scope.
- **CSV exports** grouped per section (already specced).

### Surface C — Staff profile / "Performance" tab (`/admin/staff/[id]?tab=performance`) — NEW
**Audience:** The staff member themselves + their managers.
**Question:** "How am *I* doing?"

- A **personal scorecard** with 5–7 tiles tuned to the role:
  - **Therapist**: completed sessions · hours worked · personal utilisation · personal retention · personal no-show rate · revenue attributed · clients touched.
  - **Coordinator**: enquiries handled · conversion rate · avg time-to-first-contact · bookings assigned · operational events resolved.
  - **Admin / Owner-who-treats**: union of both, plus a "Business" tab that points to Reports.
- **Personal sparklines + monthly deltas.** Same visual language as Reports.
- **Personal target rings** (later): "Utilisation: 73% / target 80%."
- **Activity timeline**: last N actions from the audit log, scoped to this staff member.

### What about a `/admin/me` shortcut?
A self-link in the nav going to `/admin/staff/<my-id>?tab=performance` is the cleanest UX. Staff don't have to find themselves in a directory — one click to "My Performance." Owner/Admin keeps the staff directory as the manager view.

---

## 5. Backend gaps — what's missing or under-used

This is the part you asked me to think about deliberately. Going line-by-line:

### Missing data (real gaps)
1. **`enquiries.first_contacted_at`** — for time-to-first-contact and conversion-rate metrics. Migration needed; update path on whatever "Mark contacted" action exists.
2. **`enquiries.converted_to_booking_id`** — verify it exists; if not, add it. Wire on the existing "Convert enquiry → booking" flow.
3. **Staff weekly capacity column or derived view** — utilisation rate needs a denominator (hours available). We have `availability_mode` + `staff_availability_rules`, but no canonical helper that computes "weekly available hours per staff." Pure-function helper, no migration.
4. **`bookings.client_id` consistency** — check that every booking has a non-null `client_id` (the retention helpers depend on it). Existing data may have gaps from before the contract column was enforced.

### Under-used / under-exposed (no migration needed)
5. **`booking_source` is captured but barely surfaced.** We have `getCountBy(bookings, b => b.booking_source)` in Reports — fine — but no source-attribution helper that gives revenue by source. One-line addition.
6. **`audit_logs` actor data is rich but unused for personal views.** "Actions performed this week" per staff is computable from the audit log without a single new column.
7. **`operational_events.staff_id` (if populated)** can drive a "Operational events resolved by me" personal metric. Verify the column exists and is populated.
8. **`amount_paid` / `amount_due` already track collection.** Net collection rate is `(collected ÷ booked) × 100` — derivable today, no new helper needed beyond exposing it as a tile.
9. **`booking_assignments.completed_at` / `status='completed'`** can drive same-gender fulfilment, hours worked, and personal completion rate without new columns.

### Architectural / performance
10. **Prior-period queries for deltas.** Each Reports request currently runs one `getReportData` call. Adding deltas means a second call with shifted window — same shape, run in parallel. Cost: ~50–150ms; cacheable per (range, staff). Worth it.
11. **`getStaffScorecard(data, staffId, priorData?)`** — a single backend function returning the full per-staff metric bundle. R3's two-helper sketch is too thin; one richer helper that R1/R2 + Surface C all consume is better.
12. **Realtime invalidation.** R4's Supabase realtime channel is on `notification_state` only. Adding `bookings` and `enquiries` to a lightweight broadcast channel means dashboards update without a manual refresh when assignments change. Optional but moderns the feel.
13. **Server-side cache layer.** With six tiles each needing prior-period comparisons, an `unstable_cache` wrapper on `getReportData(filters)` keyed by `(filters, profile.id)` would deliver substantially faster reloads. Currently every navigation re-runs the aggregation.

### Charts library
14. **Recharts default theming is what makes things feel SaaS-template.** Two options:
    - **Stay on Recharts** but build a small theming layer (`<TintedBarChart>`, `<SparklineLine>`, `<StackedWorkloadBar>`) with our OKLCH status palette baked in. ~1 day of work; controls drift.
    - **Add Tremor** (Recharts-based shadcn-styled wrapper, no migration needed because it sits on top of Recharts) — gets us professional defaults instantly. ~0.5 day to wrap + restyle existing charts. The dashboards in Mangomint/Mindbody screenshots look exactly like Tremor under the hood.

I'd recommend Tremor unless you specifically want hand-rolled charts. It doesn't replace Recharts; it composes on top.

---

## 6. Design direction — what'll actually make these feel alive

You said the current pages feel dead and look unprofessional. Five concrete shifts I'd make:

### 6.1 Numerals that feel like the headline of a financial paper
Owner's dashboard should open with something that feels editorial. The Phase 6 brief already commits to Cormorant Garamond marquee numerals; the implementation under-uses them (small, tucked-away). Push to `clamp(3rem, 6vw, 5.5rem)` on the lead tile, with the delta chip and sparkline tucked underneath. One unmissable number per role.

### 6.2 Status colour, semantic and stronger
Right now everything is muted — tints are at 0.30 opacity-equivalents. The deferral file already names the missing tokens: `--admin-{severity}-bg-strong`. Add them, and use them on attention rows and tile edges. Mint green for Confirmed, Amber for Pending, Soft Coral for Cancelled, Slate for Completed — all warm-side, not clinical-cold. Sherwin-Williams' 2026 Sanctuary palette + Practice Better's actual palette both confirm this direction is right for therapy.

### 6.3 Sparkline + delta on every tile, no exceptions
Every numeral gets a 14-day sparkline below it (8px tall, full tile width) and a delta chip ("+12% vs prior 30d") in the corner. The delta is the single biggest "this is granular" win. Stripe/Vercel/Linear all do this; we currently don't.

### 6.4 Skeleton shimmer, not pulse
The current `AdminSkeleton` is opacity pulse. Replace with horizontal gradient sweep — content-shaped placeholders that mirror the final layout. Cheap CSS change, materially modernises the feel.

### 6.5 Micro-interactions on tile interactions
- Hover-lift on tiles (already partially there)
- Animated count-up on numeral changes (200–500ms, respects `prefers-reduced-motion`)
- "Last updated 23 seconds ago" with revalidate-on-focus (we have the infrastructure from R4)
- Active filter chip removal animation
- Subtle parallax / depth on Tier-1 panels when scrolling (optional, very modern)

### 6.6 Mobile-first re-think
Today the mobile dashboard stacks vertically with horizontal-scroll chips. Modern industry pattern for field workers (Uber driver, Calendly mobile, Square for Retail) is:
- **Sticky bottom action bar** with the one most-likely action: Therapist gets "Open in Maps" + "Call client" on the active booking; Coordinator gets "Assign" on the top unassigned.
- **Pull-to-refresh** (deferred from R4; really should land here).
- **Single-screen, swipeable horizontal cards** for today's bookings instead of a list.

---

## 7. Revised programme — what I'd actually propose

R1/R2/R3 as named were under-scoped for what you've described. Here's the honest restructure:

### B-1 — Chart + tile theming layer (foundation) — ~1 day
- Add Tremor (or build the equivalent wrappers if you prefer no new dep).
- Define `<KpiTile>`, `<DeltaChip>`, `<Sparkline>`, `<StackedWorkloadRow>`, `<StatusBreakdownChart>` as the canonical visual primitives. Ship empty implementations.
- Define `--admin-{severity}-bg-strong` tokens. Update skeleton from pulse → shimmer.

### B-2 — Metric backend (replaces R3) — ~2 days
- One migration: `enquiries.first_contacted_at`, verify `enquiries.converted_to_booking_id`.
- New helpers in `reporting.ts`: `getUtilisationRate`, `getNoShowRate`, `getRetentionRate`, `getSourceAttribution`, `getNetCollectionRate`, `getStaffScorecard(data, staffId, priorData?)`, `filterReportDataToStaff`, `buildPriorPeriodFilters`.
- One server-action: extend the "Mark contacted" enquiry flow to write `first_contacted_at`.

### B-3 — Surface C: Personal Performance tab on staff page — ~2 days
- New tab on `/admin/staff/[id]`: "Performance."
- Role-aware tile set (Therapist / Coordinator / Admin / Owner).
- 14-day sparklines, monthly deltas, period selector.
- "Activity timeline" pulled from audit logs.
- Self-link "My Performance" added to the global nav for every role.

### B-4 — Reports rebuild (replaces R2) — ~3 days
- 6-tile headline strip with delta chips and sparklines.
- `[ Personal | Team ]` toggle, scope pill, staff drill-in.
- Recoloured status chart, stacked-bar workload rows, larger Cormorant numerals.
- Receive `BusinessPulseCard` from dashboard.
- Mobile filter sheet refinement.

### B-5 — Dashboard rebuild (replaces R1, NOT just polish) — ~3 days
- Operational triage only: Today + Attention up top.
- Personal Contribution stripe at the very top (role-aware).
- Operations Health promoted into Tier 1 (kills the "hollow when collapsed" feel).
- Drop `BusinessPulseCard` (goes to Reports).
- Strong severity tints, larger numerals, full sparkline + delta treatment.
- Mobile: sticky bottom action bar, swipeable today cards, PTR.
- Equal min-heights, consistent card system across all variants.
- M2 + M3 papercuts folded in.

### Total: ~11 days for the full programme

Compared to the original R1/R2/R3 estimate of ~6 days, this is ~5 extra days for:
- Surface C (the missing third leg of the triad)
- Backend gaps (the metrics canon)
- Chart theming foundation
- Genuine rebuild rather than targeted polish

If 11 days is too long, the high-impact subset is **B-1 + B-2 + B-3** (~5 days) — gets you the per-user surface and the metric canon without rebuilding Reports/Dashboard yet. The new Performance tab alone resolves the "metrics not granular" complaint for every role. Dashboard + Reports rebuilds become optional follow-ups.

---

## 8. What I haven't considered that you might want to — and what I'd ask before locking direction

**Considerations I'd flag:**
- **Goals / targets per staff** (e.g. "Aisha's utilisation target is 80%") — Mangomint, Jane, and MindBody all have this. Requires a `staff_targets` table. Worth it later; not blocking.
- **AI insights / anomaly detection** (the 2026 dashboard trend) — "Bookings dropped 18% this week" auto-surfaced. Possible but adds complexity; would defer.
- **Client-level lifetime value page** — Cliniko and Practice Better both have a "Client overview" per-client page with LTV/visit history/last-seen. We have client detail pages; whether they need an LTV ribbon is a separate brief.
- **Public-facing therapist profile metrics** ("Aisha completed 1,200 sessions") — sometimes used as social proof on therapist booking pages. Out of scope for admin redesign but worth flagging.

**Concrete questions before I'd write briefs:**
1. **Programme scope: B-1 → B-5 (~11 days) or B-1 + B-2 + B-3 only (~5 days)?** The 5-day path solves the per-user metric gap definitively; the 11-day path also rebuilds the two main pages.
2. **Tremor (new dependency, ~50kB gzipped) or hand-rolled chart wrappers (no dependency, ~1 day of work)?** Tremor gets us closer to Mangomint/Mindbody fast; hand-rolled keeps the bundle leaner.
3. **The personal performance tab — separate route (`/admin/me`) or tab on `/admin/staff/[id]`?** Tab is more discoverable; separate route is more invitational.
4. **Goals/targets per staff this round, or later?** Adds value but adds a table + an admin UI to set targets.
5. **For each staff role, are the metric tiles I proposed the right canon?** (Therapist gets revenue attributed; Coordinator gets time-to-first-contact; Admin gets union. Want to confirm Therapist seeing revenue is acceptable — some clinics hide that.)

Tell me which of those to lock and I'll start writing the brief for whichever piece you want first.

---

## Sources

- [Top Therapy Clinic Software 2026 — ZipDo](https://zipdo.co/best/therapy-clinic-software/)
- [Top Therapy Practice Management Software 2026 — Gitnux](https://gitnux.org/best/therapy-practice-management-software/)
- [Jane App vs SimplePractice — Software Finder](https://softwarefinder.com/resources/jane-app-vs-simplepractice)
- [Practitioner Dashboard Hub — Jane App](https://jane.app/guide/the-practitioner-dashboard-explained)
- [7 KPIs for Therapy Clinics — Financial Models Lab](https://financialmodelslab.com/blogs/kpi-metrics/physiotherapy)
- [Key Performance Indicators for Modern Therapy Clinics — Spry](https://www.sprypt.com/blog/measuring-what-matters-key-performance-indicators-modern-therapy-clinics)
- [Clinic KPI Benchmarks for 2026 — OmniMD](https://omnimd.com/blog/clinic-kpi-benchmarks/)
- [Top 26 Healthcare KPIs — InsightSoftware](https://insightsoftware.com/blog/25-best-healthcare-kpis-and-metric-examples/)
- [PracticeVital Group Therapy Analytics](https://www.practicevital.com/)
- [Top 7 KPIs Mental Healthcare Providers Should Track — LeadSquared](https://www.leadsquared.com/industries/healthcare/importance-of-tracking-mental-healthcare-kpis/)
- [Smart SaaS Dashboard Design Guide 2026 — F1Studioz](https://f1studioz.com/blog/smart-saas-dashboard-design/)
- [Dashboard Design in 2026: Do's and Don'ts — Think.Design](https://think.design/blog/dashboard-design-in-2026-dos-and-donts/)
- [Dashboard Design Patterns for Modern Web Apps 2026 — Art of Style Frame](https://artofstyleframe.com/blog/dashboard-design-patterns-web-apps/)
- [SaaS Dashboard Design Examples 2026 — 925 Studios](https://www.925studios.co/blog/saas-dashboard-design-examples-2026)
- [Mindbody vs Vagaro — Pabau](https://pabau.com/blog/mindbody-vs-vagaro)
- [Business Reporting & Analytics — Mindbody](https://www.mindbodyonline.com/business/reporting)
- [Recharts v3 vs Tremor vs Nivo — PkgPulse](https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026)
- [Top React Chart Libraries 2026 — Querio](https://querio.ai/articles/top-react-chart-libraries-data-visualization)
- [How Productive is My Therapy Clinic? — Productivity Calculator](https://cdcalculators.com/therapy-productivity-calculator/)
- [Calculate Patient Lifetime Value — Spry](https://www.sprypt.com/blog/calculating-lifetime-value)
- [Micro Animation Examples 2026 — Bricx Labs](https://bricxlabs.com/blogs/micro-interactions-2025-examples)
- [Motion Design & Micro-Interactions 2026 — Techqware](https://www.techqware.com/blog/motion-design-micro-interactions-what-users-expect)
- [Healthcare Color Palettes — Piktochart](https://piktochart.com/blog/medical-color-palette/)
- [Colormix Forecast 2026 Healthcare — Sherwin-Williams](https://www.sherwin-williams.com/architects-specifiers-designers/facility-solutions/healthcare/healthcare-color-collection)
- [Dashboard Patterns for Psychologists — Zigpoll](https://www.zigpoll.com/content/how-can-we-design-an-engaging-dashboard-that-visualizes-key-metrics-on-client-wellness-trends-and-therapist-performance-in-a-way-that-is-intuitive-for-psychologists-tracking-their-practice-outcomes)
- [Healthcare Mobile App Design Guide — Topflight](https://topflightapps.com/ideas/healthcare-mobile-app-design/)
- [UX Tips for Healthcare Mobile Apps — MedMatch](https://medmatchnetwork.com/10-ux-tips-for-healthcare-mobile-apps/)
- [Employee Scorecard Design 2026 — AIHR](https://www.aihr.com/blog/employee-scorecard/)
- [30 Employee Performance Metrics 2026 — Thirst](https://thirst.io/blog/employee-performance-metrics/)
- [Mobile Dashboard Apps 2026 — FanRuan](https://www.fanruan.com/en/blog/top-12-mobile-dashboard-apps)
