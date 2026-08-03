# C-16 Phase E Step 13 — Roles page visual checklist (Owner-performed)

**Why this exists.** The original 2026-07-16 direction named `/admin/roles` as a list that "expands the lower boundary of the page and looks like a mess." Phase A's inventory (`redesign/evidence/C-16/inventory-roles-config.md`) found the fix already shipped pre-Band-C — tier grouping, an inactive-role disclosure, category-grouped sticky headers, a filter strip, and a `max-h-[70vh]…lg:max-h-[min(72vh,720px)]` internal scroll cap on the detail page's permission matrix (`src/app/admin/roles/[roleId]/page.tsx:280`). At the Phase A Step 2 checkpoint (2026-08-03) the Owner confirmed Step 13 = **verify-and-polish, not rebuild**.

This agent re-read every relevant file (`src/app/admin/roles/page.tsx`, `src/app/admin/roles/[roleId]/page.tsx`, `PermissionsFilterStrip.tsx`, `PermissionRow.tsx`) against current `HEAD` (`ed9d31b`) and confirms nothing has touched `src/app/admin/roles/**` since the Phase A inventory was written (`74ed6ed..HEAD` is empty for that path) beyond an unrelated global theming/mojibake sweep. **No code was changed.** Because of that, there is no actual "before" state to contrast — this is a single confirmation pass, not a before/after diff. If you remember the old sprawling appearance from before this redesign programme started, this checklist is your one comparison point.

No agent can authenticate as staff (SUBAGENT-RULES rule 10), so this pass has to be done by you in a real browser session.

## Setup

- **Login:** Owner — `rahmatherapy@outlook.com` / `Password123` (canonical Band C credentials, `BAND-C-MASTER-PLAN.md` Part 0).
- **URLs:**
  - List: `/admin/roles`
  - Detail, worst case: `/admin/roles/2d5295c3-5d45-4c96-ab49-d5f87e0464b5` (the Owner role — **39/39 permissions granted**, the maximum possible on this system today, spread across all 11 permission categories). This is the single most sprawl-prone page state that exists; if it holds, everything smaller holds too.
- **Viewports:** 375×812 (mobile) and 1280×800 (desktop) — the two widths named in the dispatch. Browser zoom 100%.
- **Current data** (verified via read-only SQL, 2026-08-03): 5 roles total — Owner + Admin (privileged tier), Booking Coordinator + Therapist (operational tier), Inactive (system role, tucked behind the inactive disclosure). 39 active permissions in 11 categories (clients 10, bookings 7, reports 6, staff 5, emails 3, system 2, availability 2, settings 1, audit 1, privacy 1, services 1). All 5 role descriptions are short (29–83 characters) — none exceed the detail page's 180-character "Show more" threshold, so item 11's collapsed-description state won't actually appear with today's data; noted so you don't go looking for it.

---

## A — List page (`/admin/roles`)

### At 375px

1. Header row ("Roles and permissions" + description + "Create role" button) — no horizontal scrollbar, button doesn't get clipped or overlap the description.
2. Summary line ("4 active roles, 1 inactive. N staff assigned…") wraps cleanly under the people icon, no clipped text.
3. A **"Privileged"** label sits above the Owner/Admin rows and an **"Operational"** label sits above the Booking Coordinator/Therapist rows. GOOD: both small-caps labels visible. BAD: a label is missing — the tiering logic silently broke.
4. Each role row shows, top to bottom: letter avatar, role name + a "System" badge, a description capped at 2 lines (never more, however long the underlying text), a monospace "DB role: …" line, then a **stacked mobile counts block** (permission count, a tappable staff-count link, a tappable "Activity" link). GOOD: description never visibly overflows past 2 lines. BAD: text spills out of the row or pushes the layout.
5. Tap targets: the row is one big link to the role's detail page, **except** the nested staff-count and "Activity" links, which must independently navigate to `/admin/staff?roleId=…` and `/admin/audit?…` respectively. GOOD: tapping the staff-count number goes to the filtered staff list, not the role detail page. BAD: every tap on the row goes to the same place (the nested-link layering broke).
6. Scroll to the bottom of the list: an **"Inactive roles (1)"** bar, collapsed by default, "Show" label + chevron-down. Tap it: it expands in place to reveal the "Inactive" role row, chevron flips up, label flips to "Hide". BAD: the inactive role is visible without expanding, or the disclosure doesn't toggle.
7. Sanity check only (not expected to fail at 5 roles): the whole list — 4 visible rows + collapsed disclosure bar — fits within roughly one to two mobile screen scrolls, no runaway height.

### At 1280px

8. Each row becomes a single horizontal line: avatar | name+badges+description+slug | permission count / staff count / Activity / chevron (the desktop counts cluster, hidden on mobile, appears here instead of the stacked block). GOOD: one row is roughly 90–110px tall even with a 2-line description; the whole panel (4 active rows + collapsed disclosure bar) comfortably fits well under ~600px total, i.e. nowhere near "expands the lower boundary of the page." BAD: rows are much taller than that for no reason, or the panel keeps growing past a normal viewport with no ceiling.
9. Hovering a row tints its background and nudges the trailing chevron right; hovering the nested staff-count / "Activity" links shows their own distinct hover state, separately from the row's. Cursor over a nested link should read as that link, not a duplicate "click the whole row" affordance.
10. **The headline check**: from the page header down through the collapsed Inactive disclosure, the page should read as a short, tidy, fully-visible-without-much-scrolling list — the opposite of the original "expands the lower boundary of the page and looks like a mess" complaint.

---

## B — Detail page (`/admin/roles/2d5295c3-5d45-4c96-ab49-d5f87e0464b5`, the Owner role — worst case, 39/39 permissions)

### At 375px

11. Breadcrumb "‹ Roles" above the header; header shows avatar "O", "Owner" title, "System" + "Active" badges, mono "DB role: owner" line, description. (With today's data the description is 29 characters and always renders in full — the `<details>` "Show more" collapse only appears past 180 characters, which nothing currently reaches; not a defect if you don't see it.)
12. If you're signed in as the Owner viewing the Owner role itself, an amber "You're editing your own role…" banner appears below the header. Expected, not a bug.
13. Below that: a **"Filters"** button with a "Showing 39 of 39" readout beside it (the full inline filter panel is desktop-only). GOOD: tapping "Filters" opens a bottom sheet with a search box, 4 risk-level pills, 11 category pills, and a "Granted only" toggle, and the sheet itself scrolls internally if its content is taller than the screen rather than becoming unreachable.
14. **The core structural check.** The Permissions panel — all 11 category-grouped sections, up to 39 rows — must **not** expand the page indefinitely. It should occupy at most ~70% of the viewport height and scroll *inside itself*, with each category heading ("Clients (10)", "Bookings (7)", etc.) staying pinned to the top of that internal scroll area as you scroll through its rows. GOOD: scrolling inside the permissions panel does not move the page header/breadcrumb, and you can still reach the panels below it (Role details / Staff / Lifecycle) by scrolling the *outer* page separately. BAD: all 39 rows render inline with no internal scroll boundary, stretching the page to an extreme, un-scannable height — this is exactly the sprawl the Owner originally flagged, and source inspection says it should **not** occur (the scroll cap is already in the code at `page.tsx:280`), so this is the one item most worth double-checking with your own eyes.
15. Below the permissions panel (reached by scrolling the outer page): "Role details" form, "Staff with this role" list, "Role lifecycle" panel — ordinary fixed-content cards, unaffected by permission count.

### At 1280px

16. Layout switches to two columns: the permissions panel fills the remaining width on the left; a fixed ~22rem sidebar on the right stacks the three panels from item 15. Both columns start at the same top edge.
17. Repeat item 14's check at this width: the left permissions panel should visibly stop short of the bottom of a normal ~800–900px-tall screen (capped at `min(72vh, 720px)`) and show its own internal scrollbar, while the right sidebar's height is just whatever its three panels need — normally shorter than the capped left column, never artificially clipped.
18. The filter strip renders as the full inline panel here (search box, 4 risk pills, 11 category pills, granted-only toggle) laid out above the permissions panel without wrapping awkwardly or overflowing horizontally.
19. Scroll inside the permissions panel and confirm the sticky category headers actually work: each category's heading sticks to the top of the internal scroll area as you pass through its rows, then hands off to the next category's heading. This is what keeps a 39-row, 11-category list scannable instead of a single undifferentiated wall of switches.

---

## C — What would count as a genuine regression worth reporting back

- Horizontal scrolling on either page at 375px.
- Item 14/17: the permissions panel failing to scroll internally, so the whole page balloons to fit 39 rows at once.
- The inactive-role disclosure on the list page missing, permanently expanded, or not toggling.
- Missing tier labels when both Privileged and Operational roles exist.
- Nested links (staff-count / Activity on the list; any control inside the detail-page cards) unreachable because the row's overlay link swallows the tap.

None of the above were found by reading the source; this checklist exists so you can confirm the rendered page matches what the code says it should do, at the two breakpoints that matter.
