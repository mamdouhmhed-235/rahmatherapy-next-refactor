# HARDEN — dashboard-owner-admin

Date: 2026-05-17 (2nd pass after editorial-warm rebuild + filter cohesion + impeccable adapt)
Source: `/impeccable harden` invoked under refined plan. Probed extreme inputs, empty range, key collisions, focus management, large numbers.

## Findings actioned this pass

### 1. React key collision in booking list rows — FIXED
**Symptom:** When two bookings shared identical `date + time + title` (real-world: walk-ins with placeholder names, or seed re-runs), React threw "Encountered two children with the same key" and could omit one row.
**Root cause:** `SnapshotListRow` key was `${a.date}-${a.time}-${a.title}` and `${a.time}-${a.title}` — derived data, not a primary key.
**Fix:** Added optional `id` to `SnapshotAppointment` type, threaded `booking.id` through both `appointments` and `upcomingAppointments` props in `page.tsx`. Key now uses `a.id ?? <derived>-<index>` so collisions become impossible even when DB inserts the same client twice. Verified via console: no key warning after seeding extreme-input dataset with deliberate duplicates. (`dashboard-cards.tsx:200, 430, 471, 618`, `page.tsx:617-635`)

### 2. Sparkline rendered a flat zero-line — FIXED
**Symptom:** With a date range that has zero bookings, the 7-day sparkline still rendered as a flat baseline, creating visual noise that suggested "data" when there was none.
**Fix:** Sparkline now only renders when `dailySeries.some(v => v > 0)` is true. Empty ranges show just `0 upcoming` with no sparkline. (`dashboard-cards.tsx`, snapshot header)

### 3. Custom date misorder silently failed — FIXED (also closes brief §6 "Couldn't load…" intent for inline form validation)
**Symptom:** Submitting `from > to` returned silently with no UI feedback. User couldn't tell whether the form had ignored their input or was still loading.
**Fix:** Added `customDateError` state; on misorder sets `"End date must be on or after the start date."`; renders inline `<p role="alert" aria-live="polite">` under the form (both desktop and mobile variants), wired via `aria-describedby` on the form. Cleared when a valid range is submitted. (`dashboard-filters-client.tsx:188, 293-307, 357-385, 504-529`)

### 4. `formatPounds` broke at millions — FIXED
**Symptom:** £1,500,000 outstanding rendered as `£1500.0k` (wrong). Original logic only handled <£10k and ≥£1k bands.
**Fix:** Tiered to `£N.NM` at ≥£1M, `£Nk` at ≥£10k, `£N.Nk` at ≥£1k, full currency below. Also handles negative values via sign extraction. (`dashboard-filters-client.tsx:642-650`)

## Findings verified PASS (already hardened in prior passes)

- **Recharts `width(-1) height(-1)`** — Explicit `height={288}` + `style={{ height: 288, minWidth: 0 }}` on wrapper. Console verified 0 warnings on populated + empty ranges.
- **`prefers-reduced-motion: reduce`** — `BusinessOverviewDisclosure` honours via `matchMedia` listener; transition becomes instant.
- **`aria-expanded` + `aria-controls`** — Disclosure trigger reflects state.
- **Tier 2 disclosure auto-disabled when `hasActivity = false`** — chevron disabled, children hidden, accessible.
- **localStorage persistence** — Disclosure preference and notification read/dismissed state both `try/catch`-wrapped for private mode.
- **Skip-link present** — `<a href="#admin-main">` in shell.
- **All filter strip controls have `focus-visible:ring`** — 7/7 verified at runtime (`browser_evaluate`).
- **Filter pill remove buttons have `aria-label`** — `Remove <field> filter (<value>)`.
- **Tabular numerics** — 18 numeric displays use `tabular-nums` so digits don't jiggle on update.
- **Currency rendering** — `Intl.NumberFormat("en-GB", style: "currency", currency: "GBP")` everywhere for proper £ symbol + UK grouping.
- **Date formatting** — `Intl.DateTimeFormat("en-GB", timeZone: "Europe/London")` server- and client-side.
- **Pluralisation** — `count === 1 ? "" : "s"` everywhere (English-only product, brief explicit).
- **Empty-state copy adapts to range** — `"No appointments today"` vs `"No upcoming appointments in <RangeLabel>"`.
- **Sticky filter strip + backdrop blur** — pins on scroll, content beneath stays readable.
- **Concurrent submission** — `isPending` + `aria-busy="true"` + `pointer-events-none opacity-60` on the filter section prevents double-submit during route transitions.
- **Avatar tints deterministic** — `oklch(85% 0.035 ${hue})` from `(index * 37) % 360` clamped to brand-adjacent 75–165 / 30–80 ranges.
- **Status families** (success / warning / danger / info / clear) — each pair of bg+text+icon used together; no colour-only signalling.
- **Filter form names preserved verbatim** — `range, from, to, city, service, staffId, source, status, paymentStatus`.
- **IDs preserved verbatim** — `admin-main`, `admin-command-search`, `attention-dialog-title`, SVG `linearGradient#demandGradient`.
- **RBAC gates** — `getAdminPageAccess`, `viewReportsRevenue` (Export), `manage_settings` / `manage_emails` (Operations health).
- **External URL contracts** — POST `/admin/signout`, GET `/admin/reports/export?<filters>`, deep-link `?range=custom&from=…&to=…`.
- **Therapist-variant branch** — untouched early-return.

## Extreme-input behaviour (verified visually)

Probed with names like:
- `Mohammed Abdulrahman Abdul-Hakim Al-Farsi-Lampungbungkangkang` — wraps cleanly to 3 lines on mobile, truncates with ellipsis at desktop.
- `李小龍 (Lǐ Xiǎolóng) 👨‍⚕️🌿` — CJK + emoji + parens render correctly; avatar initials extract Chinese first chars.
- `Ñoño García-López y Vega Romero` — accents render; hyphens preserved.
- `اَلسَّلَامُ عَلَيْكُمْ Test Client` — bidirectional RTL + LTR mix renders with proper direction reflow; gold dot positions correctly.

## Recommendations not actioned (out of recipe scope or future iteration)

- **`AdminErrorBoundary` fallback lacks `role="alert"`** — `src/app/admin/components/admin-error-boundary.tsx` is shared infra outside the 7-file scope. The deferral file already records this for Phase 7 / 00-shared-components.
- **Mobile bottom-nav safe-area overlap** — page-level `pb-24` mitigates, but the shell's `#admin-main` padding rule only kicks in landscape; portrait mobile relies on the dashboard padding. Shell-level proper fix deferred.
- **Pluralisation** — strict English plural rules in inline strings; an i18n library would handle Russian/Arabic/etc. plural classes. Not in brief scope.
- **Sparkline accessibility** — currently `role="img" aria-label="7-day booking trend"` (no underlying data table fallback). Acceptable for a decorative trend indicator on a server-rendered page.
- **`Updated <relative-time>` staleness warning** — could turn amber when >5min stale. Currently just shows the relative time without escalation; product hasn't requested this.

## Verification

- Console: 0 errors, 0 warnings at populated, empty, and extreme-input states.
- All 4 viewports (375 / 768 / 1280 / 1440): no horizontal scroll, all features render.
- Custom date misorder: now blocks submission AND announces the error to AT via `role="alert"`.
- Booking list with duplicate seed rows: no React key warning.
- Empty `?range=custom&from=2030-01-01&to=2030-01-31`: sparkline hidden, scope summary shows zeros, snapshot empty state mentions the range, attention panel still surfaces independent ops events.
