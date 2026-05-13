# Brief 01 — Admin Chrome & Shared Component Library

**Slug:** `00-shared-components`
**Phase:** 5 — Per-Page Briefs (Brief 1 of 29; foundation brief — downstream briefs inherit its vocabulary)
**Register:** product
**Status:** Active — updated 2026-05-13 (grouped nav redesign §5/§11 + RBAC audit fixes §12)
**Date:** 2026-05-13

This brief covers the shell (`AdminLayout`, `AdminTopNav`, `AdminCommandSearch`, mobile `AdminSheet`) plus every shared primitive that ships in `admin-ui.tsx` / `admin-ui-interactions.tsx` / `EmptyState.tsx` and is consumed by 2+ admin pages. Per-page briefs (Briefs 02–29) will reference this document by component name and state requirements; they will not re-specify primitives.

---

## 1. Feature Summary

The admin chrome and shared component library is the connective tissue of Rahma Admin — the persistent top nav, mobile sheet, cmd-K command palette, access-denied surface, plus the primitive library (`AdminPanel`, buttons, inputs, status badges, empty states, the signature `BookingListCard`, stat tiles, urgent-attention panel, sheets, action menus, confirm modals, skeletons, sticky mobile action bar, toast host). It is consumed by all 24 admin pages and must hold the Tactile Card-Board grammar consistent across role variants (Owner / Admin, Coordinator, Therapist) so a tired Owner on a laptop at 8am and a Therapist on a phone in transit both feel fluent inside the first session.

## 2. Primary User Action

**Move between admin work surfaces without losing context, and reach any record or action in two interactions or fewer.** Every other affordance in the chrome (cmd-K, NotificationBell, breadcrumb, mobile sheet) serves that single action. The component library exists so the per-page briefs can compose those surfaces from a shared vocabulary instead of reinventing primitives.

## 3. Design Direction

- **Colour strategy: Full palette.** Inherits PRODUCT.md and DESIGN.md §2: six named status families + Clinic Green chrome + Rahma Gold decorative accent. The Card-Board's defining feature; do not collapse to Restrained on chrome surfaces.
- **Theme scene sentence (light, forced):** *"Fatimah, 45, the Owner, is glancing at today's bookings on her iPhone at 8:12am while making her son's breakfast in a sun-lit kitchen — she has 30 seconds before she has to leave."* The morning-phone scene forces light mode; dark chrome would be illegible in ambient sun and would betray the warm clinical brand. Light-only is locked.
- **Anchor references (named, specific):**
  - **Trello (de-cluttered list view)** — for the card-board grammar applied to per-page surfaces, but with the noise stripped.
  - **Linear's Triage view** — for the chrome restraint, the cmd-K respect for power users, and the way active state is communicated through fill rather than ornament.
  - **Basecamp 4** — for warm-neutral surfaces, generous spacing on novice-facing screens, and dignified empty states.

These anchors describe sensibility, not vocabulary. The visual identity is the Rahma palette and Cormorant numerals, not Trello blue or Linear grey.

## 4. Scope

- **Fidelity:** Production-ready. Foundation brief — every downstream brief depends on this vocabulary, so half-finished primitives cascade into 28 follow-on rewrites.
- **Breadth:** The shell (layout + nav + cmd-K + mobile sheet + access-denied + skip-link + toast host) plus the shared primitive library in `admin-ui.tsx`, `admin-ui-interactions.tsx`, `EmptyState.tsx`, and the two currently-orphan scalable-list components (`AdminListSurface`, `SavedViewTabs`) that downstream briefs will wire up.
- **Interactivity:** Shipped-quality components — Server Components by default, client components only where state demands (cmd-K palette, NotificationBell popover, mobile sheet, sticky mobile action bar, ConfirmActionModal, AdminActionMenu).
- **Time intent:** Polish until it ships. This brief unblocks Phase 6 implementation for all 28 other briefs.

## 5. Layout Strategy

Two-tier chrome plus a tokenised primitive library:

**Tier 1 — Persistent top chrome (`AdminTopNav`).** Full-width, Clinic Green surface (`action-primary`, oklch 23%), 56px tall on desktop, 56px tall on mobile. Three zones:

- **Left zone (anchor):** 36×36 brand tile (Clinic Green with `logo-mark.svg` inverted to Field White, sized 24×24, `alt=""`) + wordmark "Rahma Therapy" in Urbanist 600 at title step, Field White. Adjacent: variant sub-label in Work Sans 500 at label step at 70% opacity ("Owner", "Coordinator", "Therapist" — see §11). On routes deeper than `/admin/{section}`, a single breadcrumb separator `›` and the current page name in Field White Urbanist 500.
- **Centre zone (navigation):** Role-aware, responsive nav strip. Shows **only genuinely daily-use items** — a small fixed set per variant (see §11). No overflow trigger in the strip. All secondary surfaces live in the user menu button (right rail). Inactive: transparent fill, Work Sans 500 at label step, **full Field White (`text-white`, no opacity modifier)**. Hover: Hover Moss tint. Active: `bg-white/20` translucent pill + `ring-1 ring-inset ring-white/25` + Urbanist 600 label in full Field White + `aria-current="page"`. Focus: 3px Focus Azure ring with 2px offset. Hidden on `<768px` viewports — primary navigation on mobile is handled by the bottom tab bar (see Mobile chrome below).

  **Implementation note — nav link text colour.** The global `site-parity.css` rule `a { color: inherit; }` defeats opacity-based white text (`text-white/75`, `text-white/85`) on `<a>` elements when no explicit text colour is set on ancestor elements. The correct implementation is: (1) add `text-white` to the brand `<Link>` element directly, (2) add `text-white` to the `<nav>` element so all child links inherit a white baseline, and (3) use full `text-white` (not `text-white/X`) on inactive nav link elements. The user menu dropdown is inside the right-rail `<div>`, not inside `<nav>`, so it receives no cascade from this `text-white` and retains its own dark text colours correctly.
- **Right rail (utility):** Left-to-right — `cmd-K` chip ("⌘K" / "Search…", Work Sans 500 label, 1px Form Seam border at 30% opacity, Field White text, opens `AdminCommandSearch`), `NotificationBell` (24px Lucide icon + pill count badge in Pending family colours when count > 0), **user menu button** (replaces the former thin avatar-only menu and the former `More ▾` overflow trigger — both consolidated here).

  **User menu button trigger.** On desktop ≥1024px: 32px initials circle (real photo or Work Sans 600 two-letter initials on Hover Moss background) + first name in Work Sans 500 label step Field White + 12px `ChevronDown` icon — e.g. `[FA]  Fatimah ▾`. On 768–1023px: initials circle + `ChevronDown` only (name hidden, space-constrained). When the current page lives inside one of the overflow groups, the trigger adopts Selected Sage tint to signal the active section. `aria-haspopup="menu"` / `aria-expanded` / `aria-label="{First name}'s account menu"`. Focus: 3px Focus Azure ring 2px offset.

  **User menu dropdown.** `surface-card` panel, 280px width, right-aligned to the trigger, 10px radius, 1px `border-subtle`, overlay shadow (`0 8px 24px oklch(23% 0.073 155 / 0.12)`). Opens 160ms `ease-gentle` (scale + opacity from top-right origin); closes 120ms `ease-snappy`. Closes on Escape, click-outside, or item selection. `role="menu"` on the panel.

  Contents top-to-bottom:
  1. **Identity header** (non-interactive): full name in Work Sans 600 body step Chronicle + role sub-label in Work Sans 400 label step Soft Slate. `8px 14px` padding, 1px `border-subtle` below.
  2. **Grouped nav sections** — labelled sections, role-dependent (full section tables in §11). Section labels: Work Sans 500 label step 0.75rem, Soft Slate, letter-spacing 0.05em, `6px 14px 3px` padding, `role="presentation"`. Item rows: 40px min-height, Work Sans 400 body step, leading Lucide icon 16px Soft Slate, Practice Charcoal text, Hover Moss fill on hover, entire row is the link. Active item: Selected Sage tint + Urbanist 600 + `aria-current="page"`. `role="menuitem"` on each item row.
  3. **1px `border-subtle` divider** above account actions.
  4. **Account actions:** "Your profile" → `/admin/staff/{ownStaffId}` (`role="menuitem"`, 40px, leading `user` icon Soft Slate) · "Sign out" → `<form action="/admin/signout" method="POST">` (`role="menuitem"`, 40px, leading `log-out` icon, Cancelled text colour to signal off-domain, never an `<a>` link).

**Tier 2 — Page chrome (`AdminPageHeader` slot).** Sits on Clinic Canvas (oklch 97.8%), full-bleed under the top nav with `xl` (32px) vertical padding on desktop and `lg` (24px) on mobile. H1 in Display step (Urbanist 600, clamp 1.778rem → 2.369rem, Chronicle). Optional supporting sentence below H1 in Body step (Work Sans 400, Soft Slate, max 65ch). Optional primary action button right-aligned on desktop, full-width stacked on mobile.

**Below the page header:** the per-page brief owns the canvas. Page content lives inside an `<main id="admin-main">` (skip-link target, preserved from RECON §6.4). Maximum content width: `--content-width-xl` on dashboard/reports; `--content-width-lg` on detail pages; full-bleed on calendar and bookings list.

**Skip-link** (`<a href="#admin-main">Skip to main content</a>`): visually hidden until focused, then anchored top-left of viewport in Clinic Green fill with Field White text, 12px padding, Focus Azure ring on focus-visible. Preserved verbatim from current code.

**Toast host (Sonner):** top-right on desktop (`md` offset from top + right), top-centre on mobile, max stack height 3. Lives in `AdminLayout`, outside `<main>`.

**Mobile top nav (`<768px`):** collapses to brand tile + wordmark left-aligned only. Centre nav strip hidden. Right rail: search icon (opens `AdminCommandSearch` full-screen) + `NotificationBell` icon only. No hamburger button — primary navigation moves to the bottom tab bar below.

**Mobile bottom tab bar (`<768px`):** fixed, `inset-x-0 bottom-0`, `surface-card` background, 1px `border-subtle` top border, `padding-bottom: env(safe-area-inset-bottom)` (iPhone notch-safe). Height: 56px content + safe-area padding. `z-40` (same stacking layer as top nav). The `<main>` element gains `pb-[calc(56px+env(safe-area-inset-bottom))]` on `<768px` to clear the bar.

  Contains the same primary nav items as the desktop strip for that variant — 4 items for therapist, 5 for owner/admin and coordinator. Each item: 44px touch target (WCAG 2.5.5), 20px Lucide icon + Work Sans 500 label at 10px, stacked vertically, equal-width columns. Active tab: `action-primary` (Clinic Green) icon tint + Clinic Green label text + `aria-current="page"` + subtle Selected Sage background tint on the tab cell. Inactive: Soft Slate icon and label. Pressed state: Hover Moss background. Focus: 3px Focus Azure ring inset.

  **"More" tab** — always the last/rightmost slot. Icon: initials token (same 32px circle as desktop avatar, but 24px on the bar) or Lucide `layout-grid`. Label: "More". `aria-haspopup="dialog"` / `aria-expanded`. Tapping opens the **user menu `AdminSheet`** (slides up from bottom — `bottom-0`, full width, rounded top corners 16px, `surface-card`, overlay shadow). The sheet contains:
  1. **Drag handle** (32px × 4px, `border-subtle` tint, centred, 12px top margin) — visual affordance for swipe-to-close.
  2. **Identity header**: full name Work Sans 600 + role sub-label Work Sans 400 Soft Slate, left-aligned, `14px 16px` padding, 1px `border-subtle` below.
  3. **Grouped nav sections** — identical structure and content to the desktop dropdown (see §11). Item rows: 48px min-height (mobile touch target), Work Sans 500 body step, leading 20px Lucide icon. Active item: Selected Sage tint + `aria-current="page"`.
  4. **1px `border-subtle` divider**.
  5. **Account actions**: "Your profile" row + "Sign out" POST form row (Cancelled text colour + `log-out` icon).

  Sheet close: swipe down, tap backdrop, or Escape. Focus trap inside the sheet while open; restore focus to "More" tab on close. `role="dialog"` / `aria-label="Navigation and account menu"`.

## 6. Key States

Primitive-by-primitive state inventory. Per-page briefs reference these by name; downstream briefs MUST NOT introduce new states without amending this section.

| Primitive | States | Notes |
|---|---|---|
| `AdminLayout` | Authenticated · Unauthenticated (redirect to `/admin/login`) · Inactive (redirect to `/admin/login?reason=inactive`) · Variant-resolved (owner_admin / coordinator / therapist — see §11) | Server Component. Hydrates `pageAccess` into nav children. |
| `AdminTopNav` | Default · Hover (Hover Moss) · Active (Selected Sage + `aria-current="page"`) · Focus (3px Focus Azure ring + 2px offset) · Mobile-stripped (brand + search + bell only, no nav strip) | Variant prop drives nav set + sub-label. Centre strip hidden on `<768px`; bottom tab bar takes over navigation. |
| `AdminBottomTabBar` | Default · Tab-active (Clinic Green icon + label + Selected Sage tint + `aria-current="page"`) · Tab-hover (Hover Moss tint) · Tab-focus (Focus Azure ring inset) · More-open (user menu `AdminSheet` slides up) | Mobile only (`<768px`). Fixed bottom, safe-area-inset-bottom padding. 4 primary tabs + "More" tab (always 5th). |
| User menu dropdown (desktop) | Closed · Opening (160ms ease-gentle) · Open · Item-hovered (Hover Moss) · Item-active (Selected Sage + `aria-current="page"`) · Closing (120ms ease-snappy) | Right-aligned to trigger, 280px, grouped nav sections + identity header + account actions. Replaces former `More ▾` dropdown and former thin avatar dropdown. |
| `AdminCommandSearch` | Closed · Opening (160ms scale + fade entrance, ease-gentle) · Empty (input only, recent-actions hint) · Typing (debounced 120ms) · Results (grouped: Bookings / Clients / Staff / Pages) · Empty results ("Nothing matches '<query>' — try a name or booking ID", Soft Slate) · Error (toast + retain query) | Modal overlay with two-layer green-tinted shadow. `id="admin-command-search"` preserved. ⌘K opens; Escape closes; ↑/↓/Enter navigate. |
| `NotificationBell` | Idle (count 0, no badge) · Idle (count 1-9, numeric badge) · Idle (count 10+, "9+" badge) · Open (popover on desktop, AdminSheet on mobile, 5-item max + "See all" link) · Loading (skeleton) · Error (toast) | Pending family colour pair for the badge tint. |
| `AdminAccessDenied` | Default — illustrated `EmptyState` variant, plain-English copy ("You don't have access to this section. Contact the owner."), no raw permission strings (BASELINE-CRITIQUE Fatimah #3 fix) | Used by every page on RBAC fail. |
| `AdminPanel` | Default (flat) · Interactive-hover (card-hover shadow, only when entire panel is a link) · Loading (`AdminSkeleton` bars) · Error (Cancelled family border + inline `<div role="alert">`) | Heading inside renders as `<h2>` (fixes RECON §8 heading-skip findings). |
| `AdminPageHeader` | Default · With supporting copy · With primary action · Mobile-stacked | Renders the only `<h1>` per page. |
| `AdminFilterBar` | Closed (desktop horizontal grid; mobile → "Refine" trigger button opens AdminSheet) · Open (filters visible) · Active filter chips below · Submitting (Secondary button `aria-busy="true"`) | GET form. Every input has a visible `<label>` (fixes `/admin/clients` `location` finding). |
| Buttons (Primary / Secondary / Destructive / Ghost) | Default · Hover · Active (pressed) · Focus (Focus Azure ring) · Disabled (60% opacity + cursor-not-allowed) · Loading (16px Field White spinner replaces leading icon, text unchanged, `aria-busy="true"`) | Destructive: Cancelled-family fill. Ghost: no border, Hover Moss fill on hover. |
| Inputs | Default · Filled · Focus (Focus Azure border + ring) · Error (Cancelled border + `<div role="alert" aria-live="polite" aria-atomic="true">` below) · Disabled · Read-only | Required marker: `<span aria-hidden="true">*</span>` in Cancelled text colour. |
| `AdminStatusBadge` | One state per family: Confirmed / Pending / Cancelled / Completed / Unassigned-Attention / Restricted | Always pill + bg tint + Lucide icon (`aria-hidden="true"`) + visible text label. No interactive state. |
| `EmptyState` | Default (illustration + Urbanist title + Soft Slate body + optional Primary CTA) · Loading-hidden (renders nothing until parent resolves) | Replaces legacy `AdminEmptyState`. No dashed borders, no "0 items" copy. Voice: "All caught up", "Ready for your first booking", "No one added yet". |
| `BookingListCard` (signature) | Default · Hover (card-hover shadow) · Focus-visible (Focus Azure card ring) · Mobile (stacked, sticky action bar) · With gender-match chip · Without gender-match chip | No `border-l-4`. Status badge top-right. Avatar inline with therapist name. |
| `AdminStat` | Default (label + Cormorant numeral) · With trend indicator (up/down icon + delta) · Loading (skeleton numeral) · Hidden-by-permission (renders nothing) | Cormorant Garamond 700, 3.157rem. Flat, no gradient text. |
| `UrgentAttentionPanel` | Empty ("All caught up" — EmptyState compact variant) · 1-5 items · >5 items (5 visible + "See all N" link) · Loading · Error | Full-border card in status-family tint. Never `border-l-4`. |
| `ConfirmActionModal` | Closed · Opening · Open (overlay + dialog) · Confirming (Primary button `aria-busy="true"`) · Error (toast) · Closing | Wires to destructive actions: cancel booking, deactivate staff, delete service, delete role. Currently orphan per RECON §4. |
| `AdminSheet` | Closed · Opening (240ms slide + fade) · Open (focus-trapped) · Closing | Used by mobile nav, mobile filter bar, NotificationBell on mobile. |
| `AdminActionMenu` | Closed · Open · Item-hovered · Item-focused · Destructive item (Cancelled text colour + leading icon) | Currently orphan per RECON §4. Trailing three-dot menu in list rows. |
| `AdminSkeleton` | Single pulse animation (1.4s ease-in-out, opacity 0.5 ↔ 1.0) honouring `prefers-reduced-motion: reduce` (becomes static Warm Veil block) | Approximates eventual layout. |
| `AdminMobileActionBar` | Hidden (default) · Visible (sticky bottom, 1px Form Seam top border, surface-card) · Submitting (`aria-busy="true"`) | Used on booking detail, booking new, client new. |
| Sonner Toast | Success (Confirmed family, 4s auto-dismiss) · Error (Cancelled family, no auto-dismiss, "Retry" Ghost button) · Warning (Pending family, 6s auto-dismiss) · Info (Restricted family, 4s) · Loading (Restricted family, persists until promise resolves) | All toasts honour `prefers-reduced-motion`. |

## 7. Interaction Model

**Keyboard contract:**
- `Tab` / `Shift+Tab` traverse all interactive elements in document order. Skip-link is first.
- `⌘K` / `Ctrl+K` from anywhere in `/admin/*` opens `AdminCommandSearch`. `Escape` closes any open overlay.
- `Enter` activates focused buttons and links. `Space` activates focused buttons. `↑` / `↓` move between items inside `AdminCommandSearch` and `AdminActionMenu`.
- All focus rings are Focus Azure (oklch 47% 0.095 230) — never Clinic Green, so focus is never confused with hover or active brand state.

**Mouse / touch contract:**
- Hover state is `Hover Moss` tint on rows, nav items, ghost buttons, action menu items.
- Active (pressed) state is `Selected Sage` tint. On Primary buttons, active darkens to `oklch(15% 0.065 155)`.
- Touch targets ≥44px (WCAG 2.5.5) on every interactive element on viewports `<768px`.
- No hover-revealed actions. Every action is visible at rest or reachable via the trailing `AdminActionMenu` (RECON §4 + BASELINE-CRITIQUE Casey #3 fix).

**Flow patterns:**
- **Navigate to a page:** click nav item → page renders → `aria-current="page"` on the active nav item → breadcrumb updates.
- **Search:** ⌘K (or click chip / mobile search icon) → palette opens → type → debounced results group by entity → ↑/↓ → Enter → navigate to record.
- **Open a record's actions:** click trailing `more-horizontal` → AdminActionMenu opens → click item → action runs (instant for non-destructive) or `ConfirmActionModal` opens (destructive).
- **Submit a form:** focus first invalid field on error; announce error region via `role="alert"`; on success, show Sonner toast (Confirmed family, 4s auto-dismiss) and either navigate or refresh in-place.
- **Mobile primary actions:** sticky `AdminMobileActionBar` at viewport bottom replaces inline desktop action rows on `<768px`.

**Motion tokens:** durations 160 / 240 / 360 ms, `ease-gentle` for entrances, `ease-snappy` for exits. Reduced-motion: all transitions become instant; opacity-only fades retained at ≤80ms.

## 8. Content Requirements

**Voice anchors** (PRODUCT.md "Voice Anchors"): Calm, plain, direct, kind. Verbs over nouns. No em dashes. Empty states encourage, never apologise.

**Chrome copy (exhaustive list):**

- Brand wordmark: `Rahma Therapy` (Urbanist 600, Field White).
- Variant sub-label: `Owner` / `Coordinator` / `Therapist` (Work Sans 500, Field White 70%, label step). See §11.
- Skip-link: `Skip to main content`.
- ⌘K chip: `Search…` on desktop (with kbd hint `⌘K` right-aligned); search icon only on mobile.
- ⌘K placeholder: `Search bookings, clients, staff…`
- ⌘K empty-results: `Nothing matches "{query}". Try a name, phone number, or booking ID.`
- NotificationBell tooltip: `Notifications` (Lucide `bell-ring` when count > 0; `bell` when 0).
- NotificationBell empty: `All caught up.` (Confirmed family colour pair, leading `check-circle` icon).
- User menu button `aria-label`: `{First name}'s account menu`.
- User menu identity header: full name (Work Sans 600) + role sub-label (Work Sans 400 Soft Slate). Non-interactive.
- User menu section labels (owner_admin): `Scheduling & Leads` · `Communications` · `Clinic Setup` · `Admin & Compliance`.
- User menu section labels (coordinator): `Scheduling` · `Communications`.
- Therapist user menu: no nav sections — identity header + account actions only.
- Account action items: `Your profile` · `Sign out`.
- Sign-out submit: `<button type="submit">Sign out</button>` inside a `<form action="/admin/signout" method="POST">`.
- Mobile bottom tab bar "More" label: `More`.
- Mobile user menu sheet `aria-label`: `Navigation and account menu`.
- Access-denied heading: `You don't have access to this section.`
- Access-denied body: `Contact the owner if you think this is a mistake.`
- Access-denied CTA: `Back to dashboard` (Secondary button → `/admin/dashboard`).

**Empty-state copy library** (per-page briefs reuse these; never invent new copy):

| Context | Heading | Body |
|---|---|---|
| No bookings yet | `Ready for your first booking` | `Bookings you take by phone, walk-in, or referral land here.` |
| No bookings today | `All caught up` | `Nothing scheduled for today. Quiet days are healthy days.` |
| No clients yet | `No clients yet` | `Add a client to start a history, or take a booking and we'll create one.` |
| No enquiries | `No enquiries waiting` | `New leads from phone, WhatsApp, Instagram, or the website show up here.` |
| No staff matches | `No one added yet` | `Add a therapist to assign work.` |
| No privacy requests | `No requests to review` | `Right-to-erasure and access requests appear here when clients ask.` |
| No audit events | `Nothing to show` | `Audit events appear here as the team works.` |

**Confirmation dialogue copy:**

- Cancel booking: `Cancel this booking?` / `The client will be notified. This can't be undone from the booking page — restore it from the audit log if you need to.`
- Deactivate staff: `Deactivate {name}?` / `{name} will lose access immediately. Reactivate from the staff list anytime.`
- Delete service: `Delete "{service}"?` / `{count} past bookings will keep their service name. New bookings can't use it.`
- Delete role: `Delete the "{role}" role?` / `Staff on this role will need to be reassigned before signing in again.`
- All Primary confirms read `Confirm` (Destructive style); cancels read `Keep it` (Secondary).

**Toast copy library:**

- Generic success: `Saved.` (4s)
- Booking confirmed: `Booking confirmed.` · Booking reminder sent: `Reminder sent.` · Mark paid: `Marked paid.`
- Generic error: `Something didn't save. {retry-button}` (persistent)
- Network error: `Connection lost. We'll keep trying.` (persistent, "Retry" Ghost button)
- Warning, action-blocking: `This therapist is already booked at {time}.` (inline banner, not toast)

**Realistic content ranges** (per-page briefs lean on these):
- Booking count per day: 0 (slow days) / 3-8 (typical) / 15+ (peak) — calendar must scale.
- Client list size: small (Phase 5 data: dozens) → mid-term (low thousands).
- Staff list: 3-6 typically; up to ~12 long-term.
- Enquiry queue: 0-20 typical.

## 9. Recommended References

For Phase 6 implementation of this brief:

- `reference/spatial-design.md` — the chrome's three-zone topology, mobile sheet behaviour, sticky action bar interaction with viewport edges.
- `reference/interaction-design.md` — form field lifecycles, focus management in modals and sheets, keyboard contracts for cmd-K and AdminActionMenu.
- `reference/motion-design.md` — entrance / exit easings, reduced-motion fallbacks, skeleton pulse.
- `reference/typography.md` — Cormorant-only-on-numerals enforcement, fluid type scale clamp values, heading-hierarchy rules.

## 10. Open Questions

Items the implementer must resolve during Phase 6 build, captured here so per-page briefs don't repeat them:

1. **`AdminListSurface` + `SavedViewTabs` wire-up.** The two scalable-list components exist (RECON §4) but are unwired. Bookings and Clients briefs (Briefs 02 + 03) will be the first consumers — decide during this brief's implementation whether `SavedViewTabs` is bound to URL search params (`?view=`) or to a per-user `saved_views` table. Recommendation: URL-bound for v1 to keep audit-trace simple; per-user persistence in a later phase.
2. **NotificationBell data source.** Currently reads in-process. Decide whether to upgrade to a `useQuery` poll (TanStack Query, 60s interval) or a Supabase realtime channel during this phase. Recommendation: TanStack poll for v1; realtime is a Phase 7+ enhancement.
3. **cmd-K result groups for Therapist variant.** Therapists must not see all clients in search results — scope to their own assignments. The server action `searchAdminCommand` already exists; confirm it honours `getAdminPageAccess` for the calling profile before shipping.
4. **Avatar fallback for staff without a photo.** DESIGN.md mandates "real photo or initialled token on Hover Moss background." Decide deterministic initial-colour algorithm (Recommendation: hue from `hash(staff.id) % 360` with chroma 0.025, lightness 88% — stays brand-adjacent and never lands on raw oklch 50% grey).
5. **`logo-mark.svg` re-use on `/admin/login`.** IMAGES-NEEDED.md anticipates net-new use; confirm with brand owner that the same 21KB SVG works at the larger login-hero size, or commission a Cormorant-paired wordmark lockup. Login brief (Brief 04) will resolve.

---

## 11. Shell variants

Three variants resolved by `resolveAdminShellVariant(profile)` in `src/app/admin/shell-variant.ts`. The function is **capability-based, not role-name-based** (first match wins: `VIEW_REPORTS_REVENUE` → owner_admin; else `MANAGE_BOOKINGS_ALL` / `VIEW_BOOKINGS_ALL` / `MANAGE_ENQUIRIES` → coordinator; else `VIEW_BOOKINGS_ASSIGNED` / `MANAGE_BOOKINGS_ASSIGNED` / `CLAIM_ASSIGNMENTS` → therapist). A custom role with the right permissions inherits the right shell; the variant must never be hard-coded from role name.

All three variants share: brand wordmark, skip-link, focus contract, motion tokens, toast host, mobile sheet behaviour, sign-out POST form. Differences are listed below.

### 11.1 `owner_admin` — Owner / Practice Manager shell

- **Nav items — Primary strip (5, always visible, desktop / bottom tab bar on mobile):** `Dashboard` · `Bookings` · `Clients` · `Staff` · `Reports`. These five cover every daily-use surface; everything else is one tap away in the user menu.
- **User menu — grouped nav sections (four labelled sections):**

  | Section label | Items |
  |---|---|
  | Scheduling & Leads | `Calendar` · `Enquiries` |
  | Communications | `Emails` |
  | Clinic Setup | `Availability` · `Services` |
  | Admin & Compliance | `Settings` · `Roles` · `Operations` · `Privacy` · `Audit` · `Account password requests` |

  Section order is fixed (most-frequent-to-least-frequent top-to-bottom). Sections appear in the user menu dropdown on desktop and in the "More" sheet on mobile, in the same order. The `account-password-requests` nav item uses `pageKey: "accountRequests"` (camelCase, matching `ADMIN_PAGE_KEYS` — see §12.2 for the fix this corrects). Permissions the user does not hold are omitted at the item level; sections with zero visible items collapse entirely (no empty section label shown).
- **Command-palette visibility:** Visible. ⌘K chip rendered. Result groups: `Bookings`, `Clients`, `Staff`, `Enquiries`, `Services`, `Pages`. No scope limit on entity results.
- **Brand sub-label:** `Owner` (Work Sans 500, Field White 70%, label step). When the resolved profile is Admin / Practice Manager (capability match identical), the sub-label still reads `Owner` — the variant is capability-keyed, not title-keyed; reserve title-specific copy for the user-menu (`Your profile` shows the actual job title).
- **Page-header style:** Dense — `AdminPageHeader` may render up to one Primary action plus one Secondary action right-aligned on desktop. Dashboard uses tiered disclosure: Tier 1 (Today + Urgent Attention) always visible; Tier 2 (Staff capacity, Payment health, Operations health) collapsed behind a `Business overview` disclosure trigger (BASELINE-CRITIQUE P2 fix).
- **Filter defaults:** Dashboard opens with `range=this-week`. Bookings opens with `view=needs-attention`. Calendar opens with `view=week`, `date=today`. Clients opens unfiltered. Reports opens with `range=this-month`. All filters serialise to URL (RECON §6.5) so deep-links remain valid.

### 11.2 `coordinator` — Booking Coordinator shell

- **Nav items — Primary strip (5, always visible, desktop / bottom tab bar on mobile):** `Dashboard` · `Bookings` · `Clients` · `Team` · `Enquiries`. Front-desk triage work: bookings, client lookup, and the enquiry queue are the coordinator's daily loop.
- **User menu — grouped nav sections (two labelled sections):**

  | Section label | Items |
  |---|---|
  | Scheduling | `Calendar` |
  | Communications | `Emails` · `Availability` |

  Permissions the coordinator does not hold (`Reports`, `Roles`, `Settings`, `Services`, `Operations`, `Privacy`, `Audit`, `Account password requests`) are omitted entirely — the chrome must not advertise surfaces the user cannot access. Permission gates still enforce server-side. The user menu for a coordinator is compact: two small sections + identity header + account actions.
- **Command-palette visibility:** Visible. Result groups: `Bookings`, `Clients`, `Staff`, `Enquiries`, `Pages`. No `Services`, `Reports`, `Roles`. Staff results scope to assignable-team (same-gender + active) per `getStaffTeamAccess`.
- **Brand sub-label:** `Coordinator` (Work Sans 500, Field White 70%, label step).
- **Page-header style:** Standard — single Primary action right-aligned on desktop. No tiered disclosure on dashboard (only Tier 1 surfaces are visible to this variant by permission anyway).
- **Filter defaults:** Dashboard opens with `range=today` (coordinators triage today's queue first, not the week). Bookings opens with `view=today`. Calendar opens with `view=day`, `date=today`. Clients opens unfiltered. Enquiries opens with status filter `status=new`.

### 11.3 `therapist` — Therapist shell

- **Nav items — exactly 4, desktop strip and mobile bottom tab bar:** `My day` (alias for `Dashboard` — copy reflects the personal scope) · `My bookings` (alias for `Bookings`, scoped to assigned only) · `My availability` (deep-link to `/admin/staff/{ownStaffId}/availability` — not the global availability page) · `Team` (alias for `Staff`, scoped to same-gender + self via `getStaffTeamAccess`). No `Calendar` nav item (read-only week view accessible from within `My bookings`); no `Clients` index (clients reachable only via assigned booking rows).

  > **Implementation requirement — do not omit `Team`.** The current codebase (`THERAPIST_NAV_KEYS` in `AdminTopNav.tsx`) is missing `"staff"` and renders only 3 items. This is a bug. Exactly 4 items must render; `Team` is the 4th. See §12.1 for the required fix.

- **User menu — no nav sections.** The therapist's 4-item strip covers their entire surface — there is nothing to overflow. The user menu (desktop dropdown and mobile sheet) contains only: identity header + account actions ("Your profile" + "Sign out"). On the mobile bottom tab bar, the "More" tab still renders (5th slot) because it carries the account actions; it just opens a minimal sheet with no grouped nav sections above the divider.
- **Command-palette visibility:** Visible but narrower. Result groups: `My bookings`, `My clients` (only clients with bookings the therapist is assigned to), `Team`, `Pages`. No global `Bookings`, no `Enquiries`, no `Services`. Confirm `searchAdminCommand` enforces this scope server-side (Open Question §10.3).
- **Brand sub-label:** `Therapist` (Work Sans 500, Field White 70%, label step).
- **Page-header style:** Standard — single Primary action right-aligned on desktop. On `My day`, the H1 is the therapist's first name plus a date (`{firstName} · {weekday}, {dayMonth}`) rather than the generic `Dashboard`, reinforcing the personal scope and avoiding the "owner-style command centre" framing.
- **Filter defaults:** `My day` opens with `range=today`. `My bookings` opens with `view=claimable` when the therapist has zero assigned bookings for today (otherwise `view=today`). `My availability` opens on the current week. `Team` opens unfiltered to same-gender colleagues + self.

**Variant fallthrough:** When `resolveAdminShellVariant` returns `null` (no matching capability, or profile inactive), `AdminLayout` redirects to `/admin/login?reason=inactive`. The chrome itself never renders for null variants — this brief specifies nothing for that state because there is no chrome to specify.

---

**Confirmation gate.** This brief is the foundation for the remaining 28 per-page briefs. Phase 5 cannot proceed to Brief 02 until the user confirms this document. Reply `brief confirmed` to lock vocabulary, or call out specific sections to revise.

---

## 12. RBAC Audit Fixes Required

Identified during Phase 6 pre-implementation audit (2026-05-13). All 8 items are **ship-blockers** for the shared-components page unless marked otherwise. Phase 6 implementer must resolve every Critical item before marking this page complete.

### 12.1 Therapist "Team" nav item missing from code — CRITICAL

**File:** `src/app/admin/components/AdminTopNav.tsx`
**Problem:** `THERAPIST_NAV_KEYS` contains only `"dashboard"`, `"bookings"`, `"availability"` — 3 items. The brief (§11.3) mandates exactly 4: add `"staff"` to the set.
**Fix:** Add `"staff"` to `THERAPIST_NAV_KEYS`. Confirm `getNavLabel()` returns `"Team"` for `item.pageKey === "staff"` on the therapist variant (the coordinator branch already handles `"Team"` — apply the same pattern for therapist).

### 12.2 `account-password-requests` nav pageKey mismatch — CRITICAL

**File:** `src/app/admin/components/AdminTopNav.tsx`
**Problem:** Nav item uses `pageKey: "account-password-requests"` (kebab-case). `ADMIN_PAGE_KEYS` and the access matrix use `"accountRequests"` (camelCase). `hasPageAccess()` lookups fail silently — the item never renders for any role including Owner.
**Fix:** Change `pageKey: "account-password-requests"` → `pageKey: "accountRequests"` on the password-requests nav item.

### 12.3 Shell variant `null` falls back to `owner_admin` — CRITICAL

**File:** `src/app/admin/layout.tsx`
**Problem:** `const variant = resolveAdminShellVariant(profile) ?? "owner_admin"` — when the resolver returns `null` (inactive or no matching capabilities), the layout silently renders the full owner shell, exposing all nav items visually even though the user cannot act on any of them.
**Fix:** Remove the `?? "owner_admin"` fallback. When `resolveAdminShellVariant` returns `null`, redirect to `/admin/login?reason=inactive`. The brief (§11) is explicit: "The chrome itself never renders for null variants."

### 12.4 `manage_account_password_requests` permission not defined — CRITICAL

**Files:** `src/lib/auth/rbac.ts`, `src/app/admin/components/admin-access.ts`
**Problem:** Brief 12 (`account-password-requests`) created this permission for the review queue. It is not defined in `PERMISSIONS`. The access gate falls back to `canManageStaffProfiles()` — a different, broader permission — causing incorrect access decisions.
**Fix:** Add `MANAGE_ACCOUNT_PASSWORD_REQUESTS: "manage_account_password_requests"` to `PERMISSIONS` in `rbac.ts`. Re-gate the `accountRequests` access check to `hasPermission(profile, PERMISSIONS.MANAGE_ACCOUNT_PASSWORD_REQUESTS)`. Ensure Owner and Admin/PM roles have this permission assigned.

### 12.5 `AdminAccessDenied` message prop allows raw permission strings — HIGH

**File:** `src/app/admin/components/admin-ui.tsx`
**Problem:** The component accepts a `message` prop with no sanitisation. Any downstream page that passes a raw permission identifier (e.g. from a caught error) renders it to the user — violating BASELINE-CRITIQUE Fatimah #3 and DESIGN.md Don't list ("Don't display raw permission identifiers").
**Fix:** Either (a) remove the `message` prop and always render the hardcoded brief copy ("You don't have access to this section. Contact the owner if you think this is a mistake."), or (b) add a guard that strips any string matching the known permission-name pattern (`/^[a-z_]+$/`) and falls back to the default copy. Option (a) is simpler and safer.

### 12.6 Button loading spinner appends instead of replacing the leading icon — HIGH

**File:** `src/app/admin/components/admin-ui.tsx`
**Problem:** The loading spinner is unconditionally prepended alongside button children. The brief (§6 Buttons) specifies: "16px Field White spinner **replaces** leading icon, text unchanged." A button with a leading icon shows `<Spinner> <Icon> "Label"` — visually wrong and breaks the design spec.
**Fix:** Implement an icon slot system on the button. When `loading=true` and a leading icon is present, render `<Spinner>` in the icon slot instead of the icon. When `loading=true` and no icon is present, prepend the spinner. Button text stays unchanged in both cases.

### 12.7 Coordinator `assign` flag gated on wrong permission — MEDIUM

**File:** `src/app/admin/components/admin-access.ts`
**Problem:** The `assign` flag on the staff access object checks `ASSIGN_STAFF_ROLES` (assigning role templates to staff) not `ASSIGN_BOOKINGS` (assigning staff to bookings). A coordinator's core workflow is booking assignment, not role assignment.
**Fix:** Confirm intent with the RBAC matrix. If coordinators should be able to assign staff to bookings, gate the `assign` flag on `hasPermission(profile, PERMISSIONS.ASSIGN_BOOKINGS)` or equivalent. If `ASSIGN_BOOKINGS` does not exist as a permission, define it. This may be intentional but must be confirmed before Phase 6 ships.

### 12.8 `AdminAccessDenied` CTA copy not variant-aware — MEDIUM

**File:** `src/app/admin/components/admin-ui.tsx`
**Problem:** The hardcoded CTA reads "Back to dashboard" → `/admin/dashboard`. For a therapist, the nav item is labelled "My day" and the conceptual label has changed — "Back to dashboard" is dissonant.
**Fix:** Accept a `variant` prop on `AdminAccessDenied`. When `variant === "therapist"`, render "Back to My day" as the CTA label (destination `/admin/dashboard` remains the same URL). Default stays "Back to dashboard" for all other variants.

---

## Recipe Context

### Files to edit

| File | What changes |
|---|---|
| `src/app/admin/layout.tsx` | Token restyle; add `<a href="#admin-main">` skip-link if absent; wire toast host (Sonner); resolve variant prop from `shell-variant.ts` and pass to `AdminTopNav` |
| `src/app/admin/components/AdminTopNav.tsx` | Full restyle to Clinic Green chrome; three-zone layout; variant-aware nav sets per §11; replace `border-l-4` notification items with full-border status-family tints; `aria-current="page"` on active nav item |
| `src/app/admin/components/AdminCommandSearch.tsx` | Restyle palette to DESIGN.md tokens; preserve `id="admin-command-search"` and `searchAdminCommand` wire-up |
| `src/app/admin/components/admin-ui.tsx` | Restyle all exported primitives to token system: `AdminPanel`, `AdminPageHeader`, `AdminFilterBar`, `AdminStat`, `AdminStatusBadge`, `AdminEmptyState` → consolidate to `EmptyState`, `AdminSkeleton`, `AdminMobileActionBar`, `AdminProgressBar`, `AdminEntityRow/Card`, `AdminSeverityMeter`; remove raw `bg-gray-*`/`text-gray-*`/`border-orange-200`/`border-red-200` escapes (lines 21, 34-35) |
| `src/app/admin/components/admin-ui-interactions.tsx` | Restyle `AdminSheet`, `AdminActionMenu`, `ConfirmActionModal`; wire `ConfirmActionModal` to destructive actions (currently orphan per RECON §4) |
| `src/app/admin/components/EmptyState.tsx` | Restyle to DESIGN.md §5 spec; update copy to canonical empty-state library (§8 of this brief) |
| `src/app/admin/components/notification-bell.tsx` | Remove `border-l-4` at line 403 (ABSOLUTE BAN — BASELINE-CRITIQUE P1); replace with full-border Pending-family card tint |
| `src/app/admin/dashboard/dashboard-cards.tsx` | Remove `border-l-4` at lines 128 and 417 (ABSOLUTE BAN — BASELINE-CRITIQUE P1); replace with full-border status-family tints; replace `bg-black` at `attention-group-client.tsx:144` with `oklch(12% 0.01 165)` |
| `src/app/admin/components/admin-scalable-lists.tsx` | Restyle `AdminListSurface` + `SavedViewTabs` to token system; keep unwired until Bookings/Clients briefs land (per §10 open question 1) |
| `src/components/ui/button.tsx` | Restyle to DESIGN.md §5 button variants (Primary / Secondary / Destructive / Ghost); 30 admin files inherit |
| `src/components/ui/input.tsx` | Restyle to DESIGN.md §5 Input spec: `surface-input` ground, `border-default` Form Seam, required `*` marker, `role="alert"` error region; 11 admin files inherit |
| `src/components/ui/badge.tsx` | Restyle to DESIGN.md §5 AdminStatusBadge spec; 9 admin files inherit |

### Files to NEVER touch

- `src/middleware.ts` — auth cookie refresh + route protection
- `src/app/admin/signout/route.ts` — POST signout endpoint
- `src/app/admin/components/search-actions.ts` — `searchAdminCommand` server action
- `src/app/admin/shell-variant.ts` — variant resolver (read-only reference)
- `src/lib/auth/**` — RBAC matrix + page access resolver
- `src/lib/supabase/**` — client factories
- All `src/app/admin/*/actions.ts` — every server action file
- `src/app/admin/dashboard/dashboard-data.ts`
- `src/app/admin/reports/reporting.ts` and siblings
- `src/app/admin/bookings/access.ts`, `format.ts`
- `src/app/admin/clients/access.ts`, `format.ts`
- `src/app/admin/staff/team-access.ts`
- `supabase/migrations/**`
- `next.config.ts`, `wrangler.jsonc`, `open-next.config.ts`, all build/config files

### Feature Preservation Manifest

**IDs that must not change (RECON §6.4):**
- `id="admin-main"` on `<main>` + `<a href="#admin-main">` skip-link — a11y critical
- `id="admin-command-search"` — label target for cmd-K input
- `id="attention-dialog-title"` — `aria-labelledby` target on dashboard attention dialog
- Form field IDs (`id="email"`, `id="password"` on login; `id="staff-name"` etc. on NewStaffForm) — all `<label for>` targets

**Form contracts that must not change (RECON §6.1 + §2):**
- Sign-out: `<form action="/admin/signout" method="POST">` — must never become `<a>` link
- All form field `name` attributes across all 24 pages (full list in RECON §2) — server actions bind to these names
- All deep-link patterns must stay reachable: `/admin/bookings/new?clientId=…`, `/admin/bookings?view=claimable`, `/admin/dashboard?range=custom&from=…&to=…`, etc. (RECON §6.5)

**External link to preserve (RECON §6.5):**
- Google Maps deep-link per booking row: `https://www.google.com/maps/search/?api=1&query=${address}`

**Audit log writes (RECON §6.2):** all 40 action types must keep firing post-redesign; the chrome changes no write paths.

### Information hierarchy

Top → bottom across the entire admin surface:

1. Skip-link (visually hidden, first in DOM — a11y first)
2. `AdminTopNav` — brand identity, primary navigation, variant context, global search, notifications, user menu
3. `AdminPageHeader` — page H1 + optional supporting copy + optional primary action
4. Per-page content in `<main id="admin-main">`
5. Sonner toast host (outside `<main>`, fixed position)

### Design direction — tokens and components

- **Chrome surface:** `action-primary` `oklch(23% 0.073 155)` (Clinic Green) — nav bar background
- **Page canvas:** `surface-page` `oklch(97.8% 0.006 88)` — below nav
- **Panel/card surface:** `surface-card` `oklch(99.2% 0.004 88)` + 1px `border-subtle`
- **Active nav:** `surface-selected` `oklch(92.0% 0.022 155)` tint + Urbanist 600
- **Hover (nav + rows):** `surface-hover` `oklch(95.5% 0.012 155)` tint
- **Focus ring:** `border-focus` `oklch(47% 0.095 230)` — 3px offset 2px, never Clinic Green
- **Typography:** Urbanist for nav items/page headings; Work Sans for labels/body; IBM Plex Mono for IDs/timestamps; Cormorant Garamond on stat numerals only
- **Shadows:** green-tinted `oklch(23% 0.073 155 / X)` — `card-hover` on interactive cards, `overlay` on modals/sheets — never `rgba(0,0,0,X)`
- **Status families:** six named pairs — Confirmed/Pending/Cancelled/Completed/Attention/Restricted — always bg tint + icon + text label, never colour alone
- **Banned patterns:** `border-l-4` (absolute ban), gradient text, `bg-black`, hero-metric template, colour-only status

---

## Implementation Notes

### Per-state intent

**Empty state**
- Heading (Urbanist 600, title step): context-specific from §8 copy library (e.g. "All caught up", "No one added yet")
- Body (Work Sans 400, Soft Slate, max 2 lines 45ch): context-specific from §8 copy library
- CTA: Primary button, optional — only when there is a clear next action
- Visual: SVG illustration 80–120px, themed to context; no dashed borders, no sad-face imagery
- Max-width 360px, horizontally centred in container

**Loading state**
- `AdminSkeleton` — pulsing Warm Veil bars matching the expected content layout (never a generic spinner)
- Pulse: opacity 0.5 ↔ 1.0, 1.4s ease-in-out
- `prefers-reduced-motion`: static Warm Veil block (no animation)
- Skeletons must approximate the eventual layout — no reflow on load

**Error state (form-level)**
- Heading: none — inline below the errored field
- Body: plain-English description of what to fix (e.g. "Enter a valid email address")
- Container: `<div role="alert" aria-live="polite" aria-atomic="true">` in Cancelled family colours
- Position: directly below the field; cross-field errors above the submit button

**Error state (system-level)**
- Sonner toast, Cancelled family colours, leading `x-circle` icon
- No auto-dismiss — user must explicitly close
- Ghost "Retry" button when the action is retryable
- Body: "Something didn't save." or "Connection lost. We'll keep trying."

**Permission denied**
- Heading: "You don't have access to this section."
- Body: "Contact the owner if you think this is a mistake."
- CTA: Secondary button "Back to dashboard" → `/admin/dashboard`
- Visual: `AdminAccessDenied` illustrated EmptyState variant
- No raw permission identifier strings (`manage_role_templates`, `availability_mode`) — BASELINE-CRITIQUE Fatimah #3

### Per-viewport intent

**Mobile (375px)**
- `AdminTopNav` strips to 56px bar: brand tile + wordmark left-aligned only. Centre nav strip hidden. Right rail: search icon (opens `AdminCommandSearch` full-screen) + `NotificationBell` icon. No hamburger.
- `AdminBottomTabBar`: fixed bottom, `safe-area-inset-bottom` padding, `surface-card`, 1px `border-subtle` top. Contains 4–5 primary tabs (icon 20px + label 10px, 44px touch target each) + "More" tab (initials token or `layout-grid` icon + "More" label). Tapping "More" opens the user menu `AdminSheet` (slides up from bottom, rounded top 16px, drag handle, focus-trapped).
- Skip-link: visually hidden until focused, anchors top-left in Clinic Green fill.
- `AdminMobileActionBar`: sticky bottom, 1px `border-subtle` top border, `surface-card`, `md` vertical padding — used on booking detail, booking new, client new. Sits above the bottom tab bar (z-index higher); `<main>` padding-bottom accounts for both when both are visible simultaneously.
- Filter bars: collapse to "Refine" trigger opening an `AdminSheet` at `<768px`; never 8-column horizontal grid on mobile.

**Tablet (768px)**
- Breakpoint shared with mobile — `<768px` uses bottom tab bar; `≥768px` shows full three-zone desktop nav with user menu button in right rail.
- No distinct tablet-only layout; treat as desktop from 768px upward.

**Desktop 768–1023px**
- Full `AdminTopNav` at 56px: left zone + centre strip + right rail. User menu button trigger: initials circle + `ChevronDown` only (name hidden).

**Desktop ≥1024px**
- Full `AdminTopNav` at 56px: left zone (brand tile + wordmark + role sub-label + breadcrumb on deep routes), centre zone (nav items per §11 variant), right rail (⌘K chip + `NotificationBell` + user menu button showing initials + first name + `ChevronDown`).
- Content max-width: `--content-width-xl` on dashboard and reports; `--content-width-lg` on detail pages; full-bleed on calendar and bookings list.
- Primary actions right-aligned in `AdminPageHeader`; secondary action beside primary for owner_admin variant (per §11.1).

### Verification steps

**Playwright (automated):**
- Tab through complete nav from skip-link to last right-rail item; confirm focus order matches DOM order
- ⌘K opens `AdminCommandSearch` from any admin route; Escape closes; result navigation via ↑/↓/Enter works
- Mobile viewport (375×812): bottom tab bar visible; primary tabs navigate correctly; "More" tab opens user menu sheet; focus trapped inside sheet; swipe-down / Escape / backdrop close returns focus to "More" tab
- Mobile viewport (375×812): no hamburger button present in DOM
- Sign-out button submits as `POST /admin/signout` (network inspector — must never be a GET request)
- All touch targets on 375px viewport: `min-height 44px` on every interactive element
- `ConfirmActionModal` opens on destructive actions (cancel booking, deactivate staff, delete service) and POSTs correctly

**DevTools:**
- Zero console errors and zero new warnings on all 24 admin routes (baseline: 6 Recharts warnings on `/admin/reports` only — all others must be 0)
- Computed shadow values contain `oklch(` — no `rgba(0,0,0,` anywhere in admin computed styles
- `prefers-reduced-motion: reduce` emulation: all transitions instant; no layout animations firing

**`/impeccable audit`:**
- Zero `border-l-4` instances across all admin files
- Zero gradient text (`background-clip: text` with gradient fill)
- Zero colour-only status signals (every badge has text label + icon)
- Zero raw `bg-black` / `bg-gray-*` / `text-gray-*` Tailwind escapes in admin files

**`/impeccable critique`:**
- Heading hierarchy H1→H2→H3 contiguous on every admin page (no H1→H3 skips)
- Every form error region has `role="alert" aria-live="polite" aria-atomic="true"`
- Every required field has visible `*` marker in Cancelled text colour
- `aria-current="page"` present on active nav item across all roles and routes

---

## Copy

Canonical copy library for the shell and every shared primitive. Per-page briefs (02–29) reference this section by reference name (e.g. "uses empty-state `no-bookings-yet`", "uses confirmation `cancel-booking`"). Never invent variants; if a per-page brief needs a new entry, amend this section first.

### Form labels

No forms live in the shell itself. The only labelled chrome inputs are:

- **`AdminCommandSearch` input** — visible `<label>` reads `Search`; placeholder reads `Search bookings, clients, staff…`. Trailing `kbd` hint reads `⌘K` on desktop, hidden on mobile.
- **`AdminFilterBar` filter fields** — every filter has a visible `<label>` per DESIGN.md Input spec. Per-page briefs supply the field-specific label text; this brief mandates the pattern only.

### Form button text

Verb-first, outcome-specific, never "Submit" or "OK":

| Context | Button text |
|---|---|
| Save a form | `Save changes` |
| Save and exit a sheet/modal | `Save and close` |
| Submit a filter form | `Apply filters` (Secondary, never Primary; the list is the surface) |
| Reset a filter form | `Clear filters` (Ghost) |
| Cancel any modal or sheet | `Cancel` (Secondary) |
| Confirm a destructive action | `Confirm` (Destructive, paired with a Secondary `Keep it`) |
| Discard unsaved form changes | `Discard changes` (Destructive) |
| Sign out | `Sign out` (Ghost inside user menu; Primary on confirmation if ever surfaced) |
| Retry a failed action | `Retry` (Ghost on toast) |
| Dismiss a non-actionable toast | (no button; auto-dismisses) |
| Pagination forward | `Load more` (Secondary) |
| Return from access-denied screen | `Back to dashboard` (Secondary, on AdminAccessDenied) |

### Error messages

Plain English, no blame, no jargon. Always say what to do next.

**System / network-level:**
- Generic save failure: `Something didn't save. Try again, or check your connection.` (Sonner, persistent, Retry button)
- Connection lost mid-action: `Connection lost. We'll keep trying.` (Sonner, persistent, Retry button)
- Server timeout: `That took longer than expected. Try again.` (Sonner, persistent, Retry button)
- Stale session: `You've been signed out. Sign in to continue.` (Sonner, persistent, anchor → `/admin/login`)
- Permission changed mid-session: `Your access has changed. Refresh the page to continue.` (Sonner, persistent)

**Field-level patterns** (per-page briefs reuse these phrasings):
- Required field empty: `{Field name} is needed.` (e.g. `Full name is needed.`)
- Email missing `@`: `Email needs an @ symbol. For example, sara@example.com.`
- Phone too short: `Phone number is too short. Double-check the digits.`
- Date in the past where future-only: `Pick a date from today onwards.`
- Time outside working hours: `Pick a time inside the clinic's working hours.`
- Duplicate detected: `Looks like {name} already exists. Tick the box below to add anyway, or open the existing record.`

**`AdminCommandSearch` empty results:** `Nothing matches "{query}". Try a name, phone number, or booking ID.`

### Empty-state text

Reference name on the left; per-page briefs cite these names. Heading is Urbanist 600 (title step). Body is Work Sans 400 (body step, Soft Slate, max 2 lines, 45ch). CTA is optional.

| Reference | Heading | Body | CTA |
|---|---|---|---|
| `no-bookings-yet` | `Ready for your first booking` | `Bookings you take by phone, walk-in, or referral land here.` | `New booking` → `/admin/bookings/new` |
| `no-bookings-today` | `All caught up` | `Nothing scheduled for today. Quiet days are healthy days.` | — |
| `no-bookings-this-view` | `Nothing in this view` | `Try a different tab or clear your filters.` | `Clear filters` |
| `no-clients-yet` | `No clients yet` | `Add a client to start a history, or take a booking and we'll create one.` | `New client` → `/admin/clients/new` |
| `no-clients-match` | `No matches` | `Try a different search or clear your filters.` | `Clear filters` |
| `no-enquiries` | `No enquiries waiting` | `New leads from phone, WhatsApp, Instagram, or the website show up here.` | `Record enquiry` (scrolls focus to form) |
| `no-staff-yet` | `No one added yet` | `Add a therapist to start assigning bookings.` | `Add staff` |
| `no-privacy-requests` | `No requests to review` | `Data access and deletion requests from clients appear here when submitted.` | — |
| `no-audit-events` | `Nothing to show` | `Changes made by the team are recorded here as they happen.` | — |
| `no-notifications` | `All caught up` | `When something needs your attention, it'll appear here.` | — |
| `command-search-idle` | `Start typing` | `Search bookings, clients, staff, or pages.` | — |
| `access-denied` | `You don't have access to this section` | `Contact the owner if you think this is a mistake.` | `Back to dashboard` |

### Tooltip text

Tooltips are reserved for icon-only affordances and keyboard shortcuts. They are never the only carrier of meaning. Per-page briefs add tooltips only for icon-only buttons; this brief sets the chrome catalogue:

| Surface | Tooltip text |
|---|---|
| `NotificationBell` icon (count 0) | `Notifications: all caught up` |
| `NotificationBell` icon (count > 0) | `{count} need attention` |
| ⌘K chip / mobile search icon | `Search (⌘K)` |
| User avatar (collapsed menu) | `{First name}'s account menu` |
| Hamburger (mobile) | `Open menu` |
| Sheet close (✕) | `Close` |
| `AdminActionMenu` trigger (`more-horizontal`) | `More actions` |
| Trailing copy-to-clipboard icons | `Copy to clipboard` (on success: `Copied`) |
| Skip-link (focused, sighted-keyboard) | (no tooltip; the link text *is* the affordance) |

### Confirmation dialog text

`ConfirmActionModal` uses these slots: heading, body (1 to 2 sentences, plain English consequence), Destructive Primary, Secondary cancel. Per-page briefs reference by name.

| Reference | Heading | Body | Primary | Secondary |
|---|---|---|---|---|
| `cancel-booking` | `Cancel this booking?` | `The client will be notified by email. This cannot be undone from the booking page.` | `Cancel booking` | `Keep it` |
| `deactivate-staff` | `Deactivate {name}?` | `{name} will lose access immediately. Reactivate them from the staff list anytime.` | `Deactivate` | `Keep active` |
| `delete-service` | `Delete "{service}"?` | `Past bookings keep this service name on their record. New bookings won't be able to use it.` | `Delete service` | `Keep it` |
| `delete-role` | `Delete the "{role}" role?` | `Staff on this role will need to be reassigned before signing in again.` | `Delete role` | `Keep it` |
| `discard-changes` | `Discard your changes?` | `Anything you've typed since opening will be lost.` | `Discard` | `Keep editing` |
| `sign-out-mobile` | `Sign out?` | `Your account stays active. Sign back in whenever you're ready.` | `Sign out` | `Stay signed in` |

**Toast copy library** (success / info / warning patterns reused across pages):

| Event | Toast |
|---|---|
| Save success | `Saved.` |
| Booking confirmed | `Booking confirmed.` |
| Booking cancelled | `Booking cancelled. The client has been notified.` |
| Reminder sent | `Reminder sent.` |
| Marked paid | `Marked paid.` |
| Assignment claimed | `Booking claimed.` |
| Assignment released | `Booking released. Others can now claim it.` |
| Copied to clipboard | `Copied.` |
| Filter applied | (no toast; list refresh is the feedback) |
| Action queued offline | `We'll send this when you're back online.` |
