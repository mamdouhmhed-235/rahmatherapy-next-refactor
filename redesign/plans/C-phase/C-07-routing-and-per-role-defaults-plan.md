# C-07 — Cross-page routing improvements + per-role defaults — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none hard — C-03 (BookingDetailToasts.tsx), C-11 (BusinessDashboard.tsx), C-FIELDWORK are soft-coordinated only; §0 Step 4 and §1 Phases A2/B2 carry fallback stubs if any is absent.
> Decisions: C-B-DECISIONS.md §3 C-07; checkpoint resolution D5 (2026-07-26). Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Brief:** `redesign/briefs/C-07-routing-and-per-role-defaults-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-07-routing-and-per-role-defaults-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. **Branch + clean tree (scoped).** On `master`; HEAD at or descended from `ea97932` — verify with `git branch --show-current` (expect `master`) + `git merge-base --is-ancestor ea97932 HEAD` (expect exit 0). Working tree has no modifications under this plan's touched paths: `git status --porcelain -- src/app/admin/clients src/app/admin/bookings src/app/admin/dashboard src/app/admin/me src/lib/booking src/app/booking/manage` returns empty. The wider tree is intentionally dirty (untracked photo/design folders, deleted `.playwright-mcp` logs) — NEVER stage broadly, NEVER stash/restore/checkout to "clean" it.
2. **Dev server.** `curl -I http://localhost:3000/admin/login/` → 200.
3. **Baseline tests + static gates.** `pnpm vitest run` — expect 485/491 passing; the 6 pre-existing failures are the documented baseline (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1) and must remain the ONLY failures — no new ones. `pnpm lint` — expect the 59-error baseline (55 from untracked `design_handoff_area_pages/prototype/*.jsx`, 4 pre-existing in `src/features/booking/`); gate is "no NEW errors vs this baseline," not "0 errors." `tsc --noEmit` — 0 errors (unaffected baseline).
4. **Cross-plan dependency check:**

   ```bash
   git log --oneline | grep -E "C-03|C-11|C-FIELDWORK"
   ```

   C-07 is more cohesive if C-03 (BookingDetailToasts component) is merged first so the `just_created` toast extends existing infrastructure. C-11 + C-FIELDWORK ideally merged so DashboardScopeToggle has a place to mount (BusinessDashboard.tsx). **None are HARD blockers** — C-07 stubs the integrations if prerequisites are missing.

5. **Code-surface verification:**

   ```bash
   # B-134: 3 duplicate CTAs
   git grep -n "clientId=" src/app/admin/clients/[clientId]/page.tsx
   # Expect: 3 occurrences at lines ~556, ~597, ~868 (or close)

   # W02-V-2: existing just_created handling (none should exist yet)
   git grep -n "just_created" src/app/admin/bookings/
   # Expect: 0 occurrences (or only references to C-03's just_converted)

   # W08-V-1: "Personal" label occurrences
   git grep -nE "Personal contribution|Personal stripe|scope.*personal" src/app/admin/dashboard/ src/app/admin/reports/
   # Capture for label-rename sweep
   ```

6. **`/admin/me` page structure:**

   ```bash
   wc -l src/app/admin/me/page.tsx 2>/dev/null
   ls src/app/admin/me/
   ```

   Confirm structure for QuickLinks insertion site.

7. **Filter strip + dashboard infrastructure:**

   > ✅ **STRUCTURE CORRECTION (2026-07-26)** — `RANGE_OPTIONS` does not exist; the real structure is `PresetKey`/`PresetRange`/`buildPresets()` (see Step 9 rewrite below). [C07-F3]

   ```bash
   git grep -n "Today.*This week\|buildPresets\|PresetRange\|PresetKey" src/app/admin/dashboard/dashboard-filters-client.tsx | head -10
   # Locate the buildPresets() preset array for Yesterday insertion
   ```

8. **Test fixture inventory:**
   - At least one client with multi-booking history (B-134 testing — Book again CTAs).
   - At least one test booking for W02-V-2 just-created toast (no-prefill path).
   - One out-of-area test city for W02-E-1 (e.g., "Bedford" — confirm not in `allowed_cities`).
   - Owner + Therapist test accounts active.

9. **DO-NOT-TOUCH list:** Badar's `9d55ce2a`, real customer data.

DO-NOT-TOUCH (live data): booking `9d55ce2a` (Badar — real customer email); Owner account `rahmatherapy@outlook.com` in email-test paths; any client whose email isn't `*.example.test` or name isn't `Phase10*`/`Audit Test*` test patterns.

---

## 1 — Safe implementation order (8 phases — small items grouped)

### Phase A1 — Small UI lifts (B-134 + W05-V-2 + B-140)

**Step 1 — B-134: consolidate `?clientId=` CTAs on client detail.**

Edit `src/app/admin/clients/[clientId]/page.tsx`. Per pre-flight Step 5 grep:
- Locate the 3 `?clientId=` href occurrences.
- Identify primary (header action area ~line 597 — the "Book again" button with primary styling — confirmed in C-06 brief inspection).
- Drop the others. If line 868 was an empty-state CTA, replace with a reference to the existing `EmptyTab`'s "Book now" affordance (which already uses `?clientId=` via different render path).

Verify visually: detail page has ONE prominent "Book again" button in the header. Empty-state booking-list section may still surface a CTA via existing `EmptyTab` — that's fine; same URL but only renders when the bookings panel is empty.

**Step 2 — W05-V-2: staff link in AssignmentManager.**

Edit `src/app/admin/bookings/[bookingId]/page.tsx` (or `AssignmentManager` if separated). Locate the staff-name render (around line 883-890 per C-05 work).

Before:
```tsx
<span>{assignment.staff_profiles?.name ?? "Therapist"}</span>
```

After (RBAC-aware):
```tsx
{canViewStaff && assignment.assigned_staff_id ? (
  <Link
    href={`/admin/staff/${assignment.assigned_staff_id}`}
    className="text-[var(--admin-body)] hover:text-[var(--admin-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
  >
    {assignment.staff_profiles?.name ?? "Therapist"}
  </Link>
) : (
  <span>{assignment.staff_profiles?.name ?? "Therapist"}</span>
)}
```

Pass `canViewStaff` boolean from `page.tsx` body (derived from `canViewStaff(profile)` in rbac.ts).

**Step 3 — B-140: Quick links on `/admin/me`.**

> **Coordination (2026-07-16):** C-08's Phase D also mounts a card on `/admin/me` (`NotificationSettingsCard`, Owner/Admin only). Both are self-contained cards; whichever plan ships second mounts below the other. If C-08 landed first, insert QuickLinks above the Notifications card. Also note C-08 adds `src/app/admin/me/actions.ts` — if this plan needs a me-scoped action file, extend that one rather than creating a duplicate.

New file `src/app/admin/me/QuickLinks.tsx`:

```tsx
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AdminPanel } from "../components/admin-ui";

interface QuickLink {
  label: string;
  href: string;
}

interface QuickLinksProps {
  links: QuickLink[];
  title?: string;
}

export function QuickLinks({ links, title = "Quick links" }: QuickLinksProps) {
  if (links.length === 0) return null;
  return (
    <AdminPanel title={title}>
      <ul className="grid gap-1 md:grid-cols-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex h-9 min-h-11 sm:min-h-9 items-center gap-1.5 rounded-[var(--admin-radius-control)] px-2.5 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              <ArrowUpRight className="size-3.5 text-[var(--admin-text-muted)]" aria-hidden="true" />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}
```

Edit `src/app/admin/me/page.tsx` — render `<QuickLinks links={...}>` after the existing Recent Activity section. Derive `links` per role:

```ts
function getQuickLinksForRole(roleLabel: string, staffId: string): QuickLink[] {
  switch (roleLabel) {
    case "Therapist":
      return [
        { label: "Today's visits", href: "/admin/bookings?view=today" },
        { label: "Claimable work", href: "/admin/bookings?view=claimable" },
        { label: "My staff profile", href: `/admin/staff/${staffId}` },
        { label: "Completed visits", href: "/admin/bookings?view=completed&staffId=" + staffId },
      ];
    case "Coordinator":
      return [
        { label: "Today's bookings", href: "/admin/bookings?view=today" },
        { label: "Triage queue", href: "/admin/bookings?view=attention" },
        { label: "Active enquiries", href: "/admin/enquiries" },
        { label: "My staff profile", href: `/admin/staff/${staffId}` },
      ];
    case "Admin":
      return [
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Today's bookings", href: "/admin/bookings?view=today" },
        { label: "Staff roster", href: "/admin/staff" },
        { label: "Recent activity", href: "/admin/audit" },
      ];
    case "Owner":
      return [
        { label: "Dashboard", href: "/admin/dashboard" },
        { label: "Reports", href: "/admin/reports" },
        { label: "Settings", href: "/admin/settings" },
        { label: "Today's bookings", href: "/admin/bookings?view=today" },
      ];
    default:
      return [];
  }
}
```

Vitest spec: render `QuickLinks` with 3 sample links, verify all render + accessible names correct.

**Phase A1 verify checkpoint:**
- `pnpm lint` + `tsc` + `vitest` green.
- Playwright manual: client detail has 1 CTA; booking detail shows staff link (Owner) / no link (Therapist); `/admin/me` renders Quick links per role.

### Phase A2 — Just-created toast + city validation (W02-V-2 + W02-E-1)

**Step 4 — W02-V-2: just-created toast.**

Edit `src/app/admin/bookings/actions.ts` (`createManualBooking` final redirect ~line 952). C-03 already appends `?just_converted=1&enquiry_id=<id>` for the enquiry path. Extend for no-prefill + clientId paths:

```ts
// Build redirect URL with source-aware just-created hint
const redirectParams = new URLSearchParams();
if (enquiryId) {
  redirectParams.set("just_converted", "1");
  redirectParams.set("enquiry_id", enquiryId);
} else if (/* clientId provided via prefill */ formData.get("client_id")) {
  redirectParams.set("just_created", "1");
  redirectParams.set("client_id", String(formData.get("client_id")));
} else {
  redirectParams.set("just_created", "1");
}
redirect(`/admin/bookings/${result.bookingId}?${redirectParams.toString()}`);
```

Edit `src/app/admin/bookings/[bookingId]/BookingDetailToasts.tsx` (created in C-03 — extend with new toast type):

```tsx
{justCreated ? (
  <BookingDetailToast
    type="just_created"
    message="Booking created."
    actionLabel={clientId ? "↗ View client" : undefined}
    actionHref={clientId ? `/admin/clients/${clientId}` : undefined}
  />
) : null}
```

Read `searchParams.just_created === "1"` and `searchParams.client_id` in the booking detail page; pass to the toast component.

**Step 5 — W02-E-1: city whitelist inline validation.**

Edit `src/app/admin/bookings/new/page.tsx` to fetch `business_settings.allowed_cities`:

```ts
const settingsPromise = adminClient
  .from("business_settings")
  .select("allowed_cities")
  .eq("id", 1)
  .single();
// (extend existing Promise.all)

const allowedCities = (settingsResult.data?.allowed_cities ?? []) as string[];
```

Pass `allowedCities` as a prop to `ManualBookingForm`.

Edit `src/app/admin/bookings/new/ManualBookingForm.tsx`. Add to props interface; add inline validation in step 3 (Location):

```tsx
// Around the city input field
const cityValue = city.trim();
const cityNormalised = cityValue.toLowerCase();
const isCityKnown = cityValue.length === 0 || allowedCities.some((allowed) => {
  const allowedNormalised = allowed.trim().toLowerCase();
  return allowedNormalised === cityNormalised || cityNormalised.includes(allowedNormalised);
});

// Field render — render warning inline (not blocking):
{!isCityKnown && cityValue.length > 0 ? (
  <p className="text-xs text-[oklch(26%_0.14_25)]" role="alert">
    "{cityValue}" is outside our current service area. We deliver to: {allowedCities.join(", ")}.
  </p>
) : null}
```

Warning, NOT a blocker — the SQL function will reject at submit (existing behaviour). Inline warning surfaces the issue earlier.

**Phase A2 verify checkpoint:**
- `pnpm lint` + `tsc` green.
- Playwright manual: create a no-prefill booking → land on detail with "Booking created." toast. Create with `?clientId=` prefill → toast has "↗ View client" link. Type "Bedford" in city field → warning appears inline.

### Phase A3 — Terminology + claimable mismatch (W08-V-1 + B-170)

**Step 6 — W08-V-1: Personal → Mine label sweep.**

Per pre-flight Step 5 grep. For each "Personal" label that's user-facing (not URL param, not internal code):

```bash
# Examples — actual list from pre-flight:
src/app/admin/dashboard/PersonalContributionStripe.tsx — heading text
src/app/admin/reports/... — scope filter chip label
src/app/admin/dashboard/dashboard-cards.tsx — copy strings
```

Replace user-facing strings. URL params (`?scope=personal`) STAY unchanged (backward-compatible).

Verification: visit each surface in Playwright + confirm visible label reads "Mine" (or contextual variants like "My ..." where the grammar requires).

**Step 7 — B-170: TherapistDashboard "Open to claim" filter + copy.**

Edit `src/app/admin/dashboard/TherapistDashboard.tsx`. Locate the "Open to claim" section (line search for the existing copy).

Current logic: filters claimable bookings — no date constraint.

After C-07:
- Filter additionally to `booking_date <= today + 7 days`.
- Copy update:
  - Has matches: "Open to claim — next 7 days · {N} available"
  - Empty: "Open to claim — next 7 days · Nothing scheduled. Browse all claimable work →"
- "Browse all claimable work →" link: `/admin/bookings?view=claimable` (existing).

This narrows the dashboard view; the explicit copy clarifies the narrowness; the link routes to the unfiltered list. R05's reported mismatch resolved.

**Phase A3 verify checkpoint:**
- "Personal" labels read "Mine" in dashboard + reports.
- TherapistDashboard "Open to claim" shows next-7-days view; copy explicit about narrowness; link works.

### Phase A4 — Customer manage page polish

**Step 8 — Customer manage page footer + verifications.**

> ✅ **PATH CORRECTION (2026-07-26)** — real file is `src/app/booking/manage/page.tsx`. `token` is a `searchParams` query param (`Promise<{ token?: string }>`, destructured at page.tsx:43-46) — there is NO `[token]` dynamic route segment / directory. [C07-F1]

> ✅ **DATA-SOURCE CORRECTION (2026-07-26)** — the page already fetches `booking.settings.contactEmail` / `booking.settings.contactPhone` via the existing `getCustomerManageBooking(token)` call (page.tsx:47, used to build `contactLine` at :53-58 and rendered in the "Contact" SideCard at :105-116). Reuse this — do NOT add a second `createSupabaseAdminClient()` fetch of `business_settings`; that duplicates data the page already has and adds an unnecessary DB round-trip. [C07-F4]

Locate `src/app/booking/manage/page.tsx`.

Add footer to the manage page, reusing the already-fetched `booking.settings` values (no new fetch required):

```tsx
// booking.settings.contactEmail / booking.settings.contactPhone come from the
// existing `getCustomerManageBooking(token)` call already in scope (page.tsx:47).

// Render footer (near the end of the page's <main>, after the existing <section>):
<footer className="mt-12 border-t border-[var(--rahma-border)] pt-6 text-center text-sm text-[var(--rahma-muted)]">
  <p>
    Need help?
    {booking.settings.contactPhone ? (
      <> Call us on <a href={`tel:${booking.settings.contactPhone}`}>{booking.settings.contactPhone}</a></>
    ) : null}
    {booking.settings.contactPhone && booking.settings.contactEmail ? " or " : null}
    {booking.settings.contactEmail ? (
      <>email <a href={`mailto:${booking.settings.contactEmail}`}>{booking.settings.contactEmail}</a></>
    ) : null}
  </p>
</footer>
```

Note: this duplicates the existing "Contact" SideCard (page.tsx:105-116) in substance, placed instead as a page-bottom footer per brief §2.8/§4.7. Both may coexist; if the two reads oddly side-by-side at impl time, document the call in the progress file rather than expanding scope.

**Verification:** `git grep -n "contactEmail\|contactPhone" src/app/booking/manage/page.tsx` — expect the existing hits (~47, ~53-58, ~105-116) plus the new footer render; `npx tsc --noEmit` clean (no new admin-client import added).

**Other verifications (no code changes if existing behaviour is correct):**
- Cancel sub-flow → "Back to booking" link works.
- Reschedule sub-flow → "Back to booking" link works.
- Expired token → graceful "This link has expired. Please contact the clinic." render.

If any of these don't work, document in progress file; C-12+ scope.

**Phase A4 verify checkpoint:**
- Footer renders on manage page with contact info.
- Back-links + expired-token render verified.

### Phase B1 — Yesterday chip + dual-date sync (B-154 + B-155)

**Step 9 — B-154: Yesterday chip.**

> ✅ **STRUCTURE CORRECTION (2026-07-26)** — `RANGE_OPTIONS` does not exist. The real structure (`dashboard-filters-client.tsx:40-68`) is: `type PresetKey = "today" | "this_week" | "this_month" | "last_30" | "custom"`; `interface PresetRange { key: PresetKey; label: string; from: string; to: string }`; and a `buildPresets(todayISO: string): PresetRange[]` function that computes `from`/`to` inline per preset entry — there is no separate switch-case date-computation helper. [C07-F3]

Edit `src/app/admin/dashboard/dashboard-filters-client.tsx`. Add `"yesterday"` to `PresetKey` and insert a matching entry into the array `buildPresets()` returns, between `"today"` and `"this_week"`:

```ts
type PresetKey = "today" | "yesterday" | "this_week" | "this_month" | "last_30" | "custom";

function buildPresets(todayISO: string): PresetRange[] {
  const today = parseDate(todayISO) ?? new Date();
  // ...existing weekStart/weekEnd/monthStart/monthEnd/thirtyAgo computation unchanged...
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  return [
    { key: "today", label: "Today", from: isoDate(today), to: isoDate(today) },
    { key: "yesterday", label: "Yesterday", from: isoDate(yesterday), to: isoDate(yesterday) }, // NEW
    { key: "this_week", label: "This week", from: isoDate(weekStart), to: isoDate(weekEnd) },
    { key: "this_month", label: "This month", from: isoDate(monthStart), to: isoDate(monthEnd) },
    { key: "last_30", label: "Last 30 days", from: isoDate(thirtyAgo), to: isoDate(today) },
    { key: "custom", label: "Custom", from: "", to: "" },
  ];
}
```

`getActivePreset()` (dashboard-filters-client.tsx:70-77) already iterates the presets array generically — no change needed there; it picks up the new `"yesterday"` key automatically.

Verify chip renders + click sets from/to to yesterday.

**Verification:** `git grep -n "buildPresets\|PresetKey" src/app/admin/dashboard/dashboard-filters-client.tsx` — expect the edited array/type to include the new `"yesterday"` entry.

**Step 10 — B-155: dual-date sync.**

Audit current behaviour: if the chip strip changes range, does the form's from/to inputs update? If form inputs change, does the chip strip update?

If either direction doesn't sync, refactor to URL-driven state:
- Chip strip reads `?range=` (or computes from `?from=` + `?to=`).
- Form inputs read `?from=` + `?to=` directly.
- Both write to URL on change; `useSearchParams` re-renders both via Next.js routing.

Pattern: single source of truth is the URL. Both UI components are stateless views.

**Phase B1 verify checkpoint:**
- Yesterday chip works.
- Changing chip → form updates → URL has from=yesterday + to=yesterday.
- Changing form → chip updates (or shows "Custom").

### Phase B2 — Scope toggle (B-139)

**Step 11 — DashboardScopeToggle component.**

New file `src/app/admin/dashboard/blocks/DashboardScopeToggle.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface DashboardScopeToggleProps {
  currentScope: "team" | "mine";
}

export function DashboardScopeToggle({ currentScope }: DashboardScopeToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const setScope = (next: "team" | "mine") => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "mine") {
      params.set("scope", "mine");
    } else {
      params.delete("scope");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div role="group" aria-label="Dashboard scope" className="inline-flex rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] overflow-hidden">
      <button
        type="button"
        onClick={() => setScope("team")}
        className={`px-3 py-1.5 text-xs font-medium ${currentScope === "team" ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]" : "bg-transparent text-[var(--admin-body)]"}`}
        aria-pressed={currentScope === "team"}
      >
        Team
      </button>
      <button
        type="button"
        onClick={() => setScope("mine")}
        className={`px-3 py-1.5 text-xs font-medium ${currentScope === "mine" ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]" : "bg-transparent text-[var(--admin-body)]"}`}
        aria-pressed={currentScope === "mine"}
      >
        Mine
      </button>
    </div>
  );
}
```

Mount in `BusinessDashboard.tsx` (C-11) header. If C-11 isn't merged when C-07 ships, mount inline in `page.tsx`'s Business branch — C-11 picks it up during extraction.

**Step 12 — Wire scope param into dashboard data fetch.**

Edit `dashboard-data.ts` (or wherever the data is fetched). When `scope === 'mine'`, narrow the queries to actor's bookings only:

```ts
const scope = searchParams.scope === "mine" ? "mine" : "team";

const bookingsQuery = adminClient.from("bookings").select(...);
if (scope === "mine") {
  bookingsQuery.eq("..., actor's assigned booking subquery, ...");
  // Likely a join with booking_assignments WHERE assigned_staff_id = actorId
}
```

Apply same scope filter to enquiries (Owner who handles enquiries personally), audit log, etc.

**Phase B2 verify checkpoint:**
- Toggle to "Mine" → dashboard tiles narrow to actor's data.
- Toggle to "Team" → restores default.
- URL persists scope.
- Coord + Therapist don't see the toggle.

### Phase B3 — Per-role default tab (B-167)

**Step 13 — Per-role default in `bookings/page.tsx`.**

> ✅ **PREMISE CORRECTION (2026-07-26) — reconcile, don't triplicate (Decision D5).** A role-aware default ALREADY EXISTS at page.tsx:347-349: `const defaultView: BookingViewKey = canViewAll ? "attention" : "today"; const currentView = (getQueryValue(query.view) ?? defaultView) as BookingViewKey;` — this already drives the UI chrome (`view={currentView}`, e.g. passed to `BookingsEmptyState` at :531). However, `filterBookings()` (page.tsx:148-153, called at :501) independently recomputes its OWN default — `const view = (getQueryValue(query.view) || "attention") as BookingViewKey;` — hardcoded to `"attention"` regardless of role, ignoring `currentView`/`defaultView` entirely. This is a latent pre-existing bug: a non-admin role visiting `/admin/bookings` with no `?view=` param sees the "Today" tab highlighted (via `currentView`) while the actual filtered list is computed against `"attention"` (via `filterBookings`'s own default) — tab chrome and rendered results can silently diverge. [C07-F2] **Do not add a third parallel default** — reconcile into ONE source of truth: `filterBookings()` must accept the already-computed `currentView` as a parameter instead of recomputing its own.

Locate the ALREADY-EXISTING role-aware default (`page.tsx:347-349`) and `filterBookings()`'s internal recomputation (`page.tsx:148-153`).

Change `filterBookings()`'s signature to accept the resolved view instead of deriving its own:

```ts
function filterBookings(
  bookings: BookingRecord[],
  query: Record<string, string | string[] | undefined>,
  profile: NonNullable<Awaited<ReturnType<typeof getStaffProfile>>>,
  currentView: BookingViewKey   // NEW — resolved once by the caller; no longer recomputed here
) {
  const view = currentView;   // was: (getQueryValue(query.view) || "attention") as BookingViewKey
  const search = getQueryValue(query.search)?.trim().toLowerCase() ?? "";
  // ...rest of filterBookings unchanged...
```

Update the call site (page.tsx:501) to pass the existing `currentView`:

```ts
const filteredBookings = filterBookings(bookings, query, profile, currentView);
```

`defaultView`/`currentView` (page.tsx:347-349) stay as the single computation — no new `getDefaultViewForRole()` helper is needed; the existing `canViewAll ? "attention" : "today"` check already implements the B-167 role split.

Therapist visiting `/admin/bookings` (no query params) → "Today" tab pre-selected, AND the filtered list now genuinely matches "Today" (previously it silently stayed on `"attention"`-scoped data). URL doesn't auto-update (defaults are render-time only).

**Verification:** `git grep -n "function filterBookings\|filterBookings(bookings" src/app/admin/bookings/page.tsx` — confirm the signature takes `currentView` and the call site passes it; `pnpm vitest run` — no new failures beyond the documented baseline; manually confirm a Therapist test account visiting `/admin/bookings` with no query params sees BOTH the "Today" tab highlighted AND today-scoped results (not attention-scoped).

**Phase B3 verify checkpoint:**
- Therapist visits `/admin/bookings` → "Today" tab active.
- Therapist visits `/admin/bookings?view=claimable` → URL wins, claimable view shown.
- Owner visits → "Attention" default (unchanged).

### Phase B4 — Saved filters bar (B-161)

**Step 14 — `saved-filters.ts` localStorage helper.**

New file `src/lib/booking/saved-filters.ts`:

```ts
const STORAGE_KEY = "rahma-admin-saved-booking-filters";

export interface SavedFilter {
  id: string;       // crypto.randomUUID() at save time
  name: string;     // user-provided
  params: Record<string, string>;
  createdAt: string;
}

export function loadSavedFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedFilter);
  } catch {
    return [];
  }
}

export function saveFilter(filter: Omit<SavedFilter, "id" | "createdAt">): SavedFilter[] {
  const existing = loadSavedFilters();
  const next: SavedFilter = {
    id: crypto.randomUUID(),
    name: filter.name.trim().slice(0, 80),
    params: filter.params,
    createdAt: new Date().toISOString(),
  };
  const all = [...existing, next];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all;
}

export function deleteFilter(id: string): SavedFilter[] {
  const existing = loadSavedFilters();
  const next = existing.filter((f) => f.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function isValidSavedFilter(v: unknown): v is SavedFilter {
  // shape check
  return typeof v === "object" && v !== null
    && "id" in v && typeof (v as any).id === "string"
    && "name" in v && typeof (v as any).name === "string"
    && "params" in v && typeof (v as any).params === "object";
}
```

Vitest spec for save / load / delete idempotency + corrupt-data resilience.

**Step 15 — `SavedFiltersBar` component.**

New file `src/app/admin/bookings/SavedFiltersBar.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Star, X, Plus } from "lucide-react";
import { loadSavedFilters, saveFilter, deleteFilter, type SavedFilter } from "@/lib/booking/saved-filters";

export function SavedFiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [name, setName] = useState("");

  // Hydrate from localStorage on mount
  useEffect(() => {
    setFilters(loadSavedFilters());
  }, []);

  const hasActiveFilter = searchParams.toString().length > 0;
  const showBar = filters.length > 0 || hasActiveFilter;

  if (!showBar) return null;

  return (
    <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((f) => (
          <SavedFilterChip
            key={f.id}
            filter={f}
            onApply={() => router.push(`${pathname}?${new URLSearchParams(f.params).toString()}`)}
            onDelete={() => setFilters(deleteFilter(f.id))}
          />
        ))}
        {hasActiveFilter ? (
          <button
            type="button"
            onClick={() => setShowSavePrompt(true)}
            className="inline-flex h-8 items-center gap-1 rounded-[var(--admin-radius-control)] border border-dashed border-[var(--admin-border-form)] px-2.5 text-xs font-medium text-[var(--admin-text-muted)] hover:text-[var(--admin-body)]"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Save current filter
          </button>
        ) : null}
      </div>

      {showSavePrompt ? (
        <SaveFilterPromptDialog
          onSave={(label) => {
            const params: Record<string, string> = {};
            searchParams.forEach((v, k) => { params[k] = v; });
            setFilters(saveFilter({ name: label, params }));
            setShowSavePrompt(false);
            setName("");
          }}
          onCancel={() => setShowSavePrompt(false)}
        />
      ) : null}
    </div>
  );
}

// ... SavedFilterChip + SaveFilterPromptDialog sub-components
```

**Step 16 — Wire into `bookings/page.tsx`.**

Render `<SavedFiltersBar />` above the bookings table. Hidden when no saved filters AND no active filter.

**Phase B4 verify checkpoint:**
- Apply a filter combo → "Save current filter" appears → save → bar shows the saved chip.
- Click a saved chip → URL updates → list re-fetches.
- Delete a saved chip → removed from list.
- Refresh page → saved filters persist (localStorage survives).
- Clear localStorage → bar hidden when no active filter.

---

## 2 — Files touched (final list)

### NEW (~7 files)
- `src/app/admin/me/QuickLinks.tsx`
- `src/app/admin/dashboard/blocks/DashboardScopeToggle.tsx`
- `src/app/admin/bookings/SavedFiltersBar.tsx`
- `src/lib/booking/saved-filters.ts`
- `src/lib/booking/__tests__/saved-filters.test.ts`
- `src/app/admin/me/__tests__/QuickLinks.test.tsx`
- `src/app/admin/dashboard/blocks/__tests__/DashboardScopeToggle.test.tsx`

### EDITED (~10 files)
| File | Phase | Change |
|---|---|---|
| `src/app/admin/clients/[clientId]/page.tsx` | A1 | Drop 2 duplicate `?clientId=` CTAs (B-134) |
| `src/app/admin/bookings/[bookingId]/page.tsx` | A1 + A2 | Staff link (W05-V-2); read `?just_created=1` (W02-V-2) |
| `src/app/admin/bookings/[bookingId]/BookingDetailToasts.tsx` (from C-03) | A2 | + just_created toast type |
| `src/app/admin/me/page.tsx` | A1 | + QuickLinks render |
| `src/app/admin/bookings/actions.ts` | A2 | Source-aware redirect with `?just_created=1` |
| `src/app/admin/bookings/new/page.tsx` | A2 | + allowedCities fetch |
| `src/app/admin/bookings/new/ManualBookingForm.tsx` | A2 | + inline city validation; + allowedCities prop |
| `src/app/admin/dashboard/PersonalContributionStripe.tsx` | A3 | Label rename |
| `src/app/admin/dashboard/TherapistDashboard.tsx` | A3 | "Open to claim" filter + copy (B-170) |
| `src/app/admin/reports/...` | A3 | Scope filter chip label |
| `src/app/admin/dashboard/dashboard-filters-client.tsx` | B1 | Yesterday chip; URL sync |
| `src/app/admin/dashboard/dashboard-data.ts` | B2 | + scope param narrowing |
| `src/app/admin/dashboard/BusinessDashboard.tsx` (from C-11) | B2 | Mount DashboardScopeToggle |
| `src/app/admin/bookings/page.tsx` | B3 + B4 | Per-role default view; + SavedFiltersBar |
| `src/app/booking/manage/page.tsx` (path corrected 2026-07-26 — see Step 8, C07-F1) | A4 | + Need help footer |

### UNCHANGED
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- URL params (`?scope=personal`) — backward-compatible.
- C-03 / C-11 / C-FIELDWORK / C-09 et al. — orthogonal.

---

## 3 — Verification gate

### 3.1 Static gates

```bash
pnpm lint                       # no NEW errors vs the 59-error baseline (55 untracked design_handoff_area_pages/prototype/*.jsx + 4 pre-existing in src/features/booking/)
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; 6 pre-existing baseline failures preserved (ManualBookingForm ×3, admin-access ×2, createBookingTransaction ×1)
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget:** small additive changes per surface. **Plan ceiling: +5 kB cumulative across `/admin/me`, `/admin/bookings*`, `/admin/dashboard`, `/admin/clients/[id]`.**

### 3.2 Per-role × per-item Playwright sweep

Per role × phase × viewport (1280 minimum, 375 spot-check):

**Owner / Admin:**
1. Visit `/admin/clients/[id]` → 1 "Book again" CTA (header).
2. Visit `/admin/me` → Quick links section visible with role-appropriate links.
3. Visit a booking detail with assigned staff → staff name is a link.
4. Create a manual booking (no-prefill) → land on detail with "Booking created." toast.
5. Type "Bedford" in city field on booking form → warning visible inline.
6. Visit `/admin/dashboard` → "Mine" label visible (not "Personal").
7. Visit dashboard → Yesterday chip in filter strip.
8. Change date via chip → form date inputs sync (and vice versa).
9. Click Team/Mine toggle → dashboard tiles narrow (Mine) or restore (Team).
10. Visit `/admin/bookings` → "Attention" default.
11. Apply a filter combo → save → re-apply by clicking saved chip → URL updates.
12. Visit customer manage URL (sign out first; use a real test booking's token) → footer visible with contact info.

**Coord:**
13. Same as Admin for items 1-5 (no scope toggle visible).
14. Saved filters work.

**Therapist:**
15. Visit `/admin/me` → Therapist-specific Quick links.
16. Visit `/admin/bookings` (no query) → "Today" default.
17. TherapistDashboard "Open to claim" → next-7-days view + clarifying copy.
18. Staff names on booking detail render unlinked (no `view_staff` permission).

### 3.3 DB verification

```sql
-- Saved filters localStorage doesn't touch DB. No DB checks for B-161.

-- City validation against business_settings (verify allowed_cities not edited mid-test)
SELECT allowed_cities FROM business_settings WHERE id = 1;
```

### 3.4 Screenshot evidence

- 1280 × client detail with single CTA
- 1280 × /admin/me Quick links section (per role)
- 1280 × booking detail with staff link
- 1280 × just-created toast on booking detail (with View client link)
- 1280 × booking form with city warning visible
- 1280 × dashboard with scope toggle visible (Owner)
- 1280 × TherapistDashboard with "Open to claim — next 7 days" copy
- 1280 × bookings list with saved filters bar
- 1280 × customer manage page with footer
- 375 × QuickLinks at mobile
- 375 × saved filters bar at mobile

Store in `redesign/evidence/C-07/` (evidence convention 2026-07-26 — supersedes any `redesign/audits/**` write target, which is read-only historical record).

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Dropping 2 of 3 client-detail CTAs breaks a user's muscle memory | low | low | The primary CTA in the header is the most prominent; the others were duplicates. Acceptable. |
| Staff link RBAC misconfigured (Therapist sees colleague links) | low | medium | `canViewStaff(profile)` predicate verified per-role at Step 2. Tests cover. |
| Just-created toast fires after refresh (URL still has `?just_created=1`) | low | low | Toast component strips query params after first fire — same idempotency pattern as C-03 just_converted. |
| City whitelist warning is too aggressive (false positives) | medium | low | Permissive match (`needle.includes(allowed)` OR `allowed.includes(needle)`) mirrors SQL function. Same false-positive surface. Warning, not blocker. |
| "Personal" → "Mine" rename misses a string | medium | low | Pre-flight Step 5 grep generates the punch list. Pass through systematically. |
| TherapistDashboard 7-day filter is too narrow | medium | low | Tunable code constant. R05's reported mismatch is fixed by the explicit copy; window size can adjust. |
| Customer manage page footer breaks if `business_settings.contact_phone` is NULL | low | low | Renders only available channels; both NULL → footer omits. |
| Yesterday chip range calculation off-by-one at DST boundaries | low | low | Use `Europe/London` timezone with date-only arithmetic. Standard `subDays(today, 1)`. |
| Dual-date sync introduces race when both chip + form change simultaneously | very low | low | URL state is single source of truth; both UIs are stateless views. Race resolved by URL update order (last write wins). |
| Scope toggle on Owner dashboard breaks an existing report-data query | low | medium | `scope` param is read at the data-fetcher level; existing queries unaffected if param is absent. Test thoroughly. |
| Per-role default tab confuses Therapists who memorised "Attention" | low | low | User can bookmark `/admin/bookings?view=attention` to keep their preference. Default is only the render-time fallback. |
| Saved filter localStorage quota exceeded | very low | low | 80-char names + small param maps. ~100 saved filters = ~10KB. Well under quota. |
| Saved filter with corrupted localStorage data | low | low | `loadSavedFilters` validates shape + returns empty array on parse failure. |
| Saved filter for a deleted column (e.g., `?status=refunded` after C-04a hygiene tail) | low | low | Filter applied → 0 results + empty-state. Acceptable. |

### 4.1 Real risk: scope-toggle data-narrowing across the dashboard tiles

Mine vs Team requires narrowing MANY queries: bookings, enquiries, audit log, perhaps revenue tiles. Each query needs the conditional. Easy to miss one → tile shows team data on Mine view.

**Mitigation:**
- Centralised helper: `narrowToActorBookings(query, actorId)` that adds the WHERE clause.
- Per-tile review at impl time.
- Playwright verification on Mine view: tile values should be <= Team view values for the same actor.

---

## 5 — Undo procedure

### 5.1 Per-phase revert

Phases are independent. Revert in reverse order.

### 5.2 Migration rollback

None — C-07 has no migrations.

### 5.3 localStorage cleanup

Saved filters in localStorage are user-scoped. Reverting C-07 leaves them in localStorage; harmless (`SavedFiltersBar` removed → no UI consumes the data). User can clear manually if desired.

---

## 6 — Test fixture guidance

**Safe for C-07 E2E:**
- All standard test fixtures.
- Test bookings for just-created toast paths.

**DO NOT touch:**
- Badar's `9d55ce2a`, real customer data.

**Customer manage page E2E:** use a token from a test booking. Cancel/reschedule operations on test data only.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Phase | Coverage |
|---|---|---|
| 1 | A1 | B-134 + W05-V-2 + B-140 (small UI lifts) |
| 2 | A2 | W02-V-2 + W02-E-1 (just-created + city validation) |
| 3 | A3 | W08-V-1 + B-170 (terminology + claimable copy) |
| 4 | A4 | Customer manage page polish |
| 5 | B1 | Yesterday chip + dual-date sync (B-154 + B-155) |
| 6 | B2 | DashboardScopeToggle + scope wiring (B-139) |
| 7 | B3 | Per-role default tab (B-167) |
| 8 | B4 | Saved filters bar (B-161) |
| 9 | Verification — Playwright screenshots + progress + master plan checklist → ✅ |

Each commit `feat(redesign): C-07 {phase} — {summary}` during C-C.

---

## 8 — Hand-off to C-C

1. Read brief + plan.
2. Run §0 Pre-flight.
3. Execute Phase A1 → A2 → A3 → A4 → B1 → B2 → B3 → B4 in order.
4. No migrations.
5. Verification gate (§3) non-negotiable.
6. Update progress file per phase.
7. Final commit updates master plan checklist C-07 → ✅.

---

## 9 — Open questions remaining

1. **B-170 7-day window** — Q9.9 in brief. Tunable; revisit if user feedback says different.
2. **Saved filter DB persistence** — Q9.4. v1 localStorage; v2 DB is C-12+.
3. **Per-role default override per user** — Q9.5. Hardcoded in C-07; user-pref is C-12+.
4. **"Personal" → "Mine" terminology** — Q9.1. Locked at "Mine"; can revert to "My" if reads better.
5. **Customer manage page polish boundary** — Q9.2. Minimum-viable; expansion is C-12+.
6. **DashboardScopeToggle mount location** — locked at BusinessDashboard header (post-C-11). Pre-C-11, mount inline in page.tsx Business branch.
7. **City validation false-positive tolerance** — locked at SQL-mirror logic. If observed false positives, tighten the inclusion check.
8. **Saved filter migration if DB persistence ships** — straightforward; export localStorage → seed DB rows + first-load fallback.

---

*End of C-07 plan. Brief: `redesign/briefs/C-07-routing-and-per-role-defaults-brief.md`. Progress: `redesign/per-page-progress/C-07-routing-and-per-role-defaults-progress.md` (filled during C-C).*
