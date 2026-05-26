# staff — deferrals

## Mobile filter strip → AdminSheet bottom-sheet
- **Source:** brief §5 Mobile (≤md), Step 8 adapt
- **Verbatim:** "Filter strip collapses behind 'Filters' Ghost → AdminSheet from the bottom."
- **Defer to:** Phase 7
- **Why deferred:** No `AdminSheet` primitive exists in this codebase yet (`admin-ui-interactions.tsx` ships `AdminActionMenu` and `ConfirmActionModal` but no `AdminSheet`). Building one inside the staff page would violate the recipe's "no new components outside the scope's Files to edit" contract, and the equivalent component will be introduced in Phase 7 / Phase 8 as part of `00-shared-components` rework. Until then, the mobile filter strip renders inline (acceptable: it's still functional, just heavier vertical real-estate than the brief calls for).
- **Provisional Phase 6 answer used to continue this session:** mobile filter strip renders inline as a stacked column of GET-form fields.

## Smooth height transition on inactive disclosure
- **Source:** brief §6 Key States — "Inactive disclosure expanded. Smooth height transition"
- **Verbatim:** "Smooth height transition; rows render with the Restricted-family 'Inactive' chip alongside the Active/Bookings-off chip."
- **Defer to:** Phase 7
- **Why deferred:** Native `<details>` does not animate height transitions by default in stable browsers. The animatable `::details-content` pseudo-element + `interpolate-size: allow-keywords` proposal is not yet baseline cross-browser. Building a JS-driven height animation here would add a client component and exceed the scope's "no new components" rule. Phase 7's gauntlet can decide whether to ship a polyfill or accept the instant toggle.
- **Provisional Phase 6 answer used to continue this session:** native `<details>` toggles instantly (still respects `prefers-reduced-motion` because it doesn't animate at all).

## Loading skeleton (page header + workload-strip + filter strip + 5 row skeletons)
- **Source:** brief §6 Key States — "Loading. AdminSkeleton: page header (instant), workload-strip (instant), filter strip (instant), 5 row skeletons."
- **Verbatim:** "Loading. AdminSkeleton: page header (instant), workload-strip (instant), filter strip (instant), 5 row skeletons."
- **Defer to:** Phase 7
- **Why deferred:** A Next.js `loading.tsx` boundary file is the convention for route-level skeletons. That's a NEW file in `src/app/admin/staff/`, which is outside the recipe scope's "Files to edit: page.tsx + NewStaffForm.tsx" contract. Cold-compile blink is brief and the framework default (blank during fetch) is acceptable for Phase 6; Phase 7 lands the framework-convention file alongside other skeleton work.
- **Provisional Phase 6 answer used to continue this session:** Next.js default loading (blank surface during server fetch).

## Pagination / Load-more (scales-for-50+ design directive)
- **Source:** Design Route Directives #6 — "Designed for lists that grow. Where data lists exist, plan for 50+ rows: pagination/load-more"
- **Verbatim:** "Default: 'Load more' button at list bottom, Secondary Button style, full-width on mobile / max-width 240px on desktop. Loads the next page in place" (DESIGN.md §Admin-Specific Patterns / Pagination)
- **Defer to:** Phase 7
- **Why deferred:** Pagination only makes sense after server-side filtering lands; client-side pagination on a fully-loaded array would just paint partial rows from already-fetched data without reducing the over-the-wire payload. Blocking BUILD plan `BUILD-staff-filter-query.md` lands server-side limit/offset; pagination wires in atop that.
- **Provisional Phase 6 answer used to continue this session:** all rows render. Current real data sits at ~11 rows so density is acceptable.

## Last sign-in / Last active timestamp on each row
- **Source:** Post-handoff polish review (HR signal — spot dormant accounts)
- **Verbatim:** "Last sign-in 3 days ago sub-line for HR awareness"
- **Defer to:** Phase 7
- **Why deferred:** `auth.users.last_sign_in_at` is not exposed by the current `getStaffTeamSelect` projection. That helper sits in `src/lib/staff/team-access.ts`, which is RECON §5 untouchable from this page. Phase 7 can extend the select via the proper data-access change.
- **Provisional Phase 6 answer used to continue this session:** no dormant-account signal on the directory; surfaced indirectly via the "Onboarding 5/6" + workload-pill ladder.

## Real avatar photo from auth.users.raw_user_meta_data.avatar_url
- **Source:** brief §5 Layout Strategy — "Left, 56px column: 40px circular avatar; real photo from `auth.users.raw_user_meta_data.avatar_url` if present"
- **Verbatim:** "real photo when available, initialled token on Hover Moss when not"
- **Defer to:** Phase 7
- **Why deferred:** The avatar_url is not part of the current `getStaffTeamSelect` projection, and that helper is RECON §5 untouchable from this page. Adding the field requires editing `src/lib/staff/team-access.ts`, which is on the recipe's "Files to NEVER touch" list. Phase 7 can extend the select via the proper data-access change.
- **Provisional Phase 6 answer used to continue this session:** initialled-letter tokens with deterministic per-id tint rotation (4-tone palette from existing status family backgrounds) so the directory still reads as distinct members.
