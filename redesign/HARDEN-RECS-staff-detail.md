# Harden recommendations — staff-detail

Generated 2026-05-18 against `/redesign/briefs/staff-detail-brief.md` §6 (Key States) and §11 (Role variants).

## Coverage check — brief states vs. implementation

| Brief state | Implementation | Notes |
|---|---|---|
| Default; admin viewing colleague | L1 editable + L2 + L3 + R1 + R2 + R3 + R4 + R5 (when `canManageOverrides` and not self) | All five rail panels render under admin scope. Verified visually at 1440. |
| Default; admin viewing self | L1 editable + L2 + L3 + R1 ("You" chip) + R2 + R3 + R4 + R5 (lockout banner replaces editor) | `isOwnProfile === true` branch renders the Restricted-tone banner instead of the form. |
| Coordinator viewing pool colleague | L1 read-only `dl` + L2 (gender-chip variant when no `canViewClientWorkloadContext`) + R1 | Verified by code path: `canShowAdminPanels === false`, `canEditSafeProfile === false`, `showProfileEditor === false`. R2/R3/R4/R5 all gated off. |
| Coordinator viewing self | L1 read-only or safe-fields-editable when `canEditSafeStaffProfile` returns true + L2 + R1 (You) + R2 | `canEditSafeProfile = canEditSafeStaffProfile(profile, staffId)` returns true for self when role permits safe edits. R2 gated on `canShowAdminPanels || isOwnProfile`. |
| Therapist viewing same-gender colleague | L1 read-only + L2 (gender-chip variant) + R1 | Same fall-through as Coordinator on colleague. |
| Therapist viewing self | L1 editable safe-fields + L2 (own assignments with full client context per `isOwnProfile` exception) + R1 (You) + R2 | Iteration-1 polish wired `showClientWorkloadContext = teamAccess.canViewClientWorkloadContext \|\| isOwnProfile` into the SELECT shape so contact_full_name + service_city appear for therapist-on-self. |
| Out-of-scope profile | `AdminAccessDenied` "Team profile not visible" + "Back to team directory" | Renders when `staffQuery.maybeSingle()` returns no row (scope filter excludes the staff). |
| Out-of-team denied | `AdminAccessDenied` "Team access limited" + "Open my profile" + "Back to dashboard" | Renders when `!teamAccess.access && !isOwnProfile`. |
| Inactive staff | Restricted-family banner above tab strip ("This staff member is inactive."), assignments still render | The query already filters to past entries because no upcoming assignments exist for inactive staff. |
| Loading | Next.js streaming + AdminSkeleton on AdminPanel `loading` prop | Default Next.js boundary handles initial paint. |
| Profile form save success | Sonner "Profile saved." toast + `router.refresh()` | revalidates the right rail's completion / onboarding counts via React refresh. |
| Permission override toggle | Risk-tier matrix routed through `ConfirmActionModal` | Critical: always confirms (grant or revoke); High: confirms on grant only; Medium/Low: one-click. |
| No data in any optional field | Inline "This colleague's profile is still being filled in." | ReadOnlyProfile early-return when bio/specialties/languages/service_areas all empty. |
| Empty Assigned bookings | `EmptyState` with `CalendarRange` icon + brief copy | Until `assignments-quiet.svg` lands (IMAGES-NEEDED row appended), Lucide icon stands in. |
| Empty audit history | Inline "No recent activity recorded." | Renders only in admin scope; non-admin viewers don't see L3 at all. |

## Hardening applied during craft (not deferred)

- **Out-of-team vs. out-of-scope denied are now distinct** copy + actions; previously both reused the same generic copy with raw `view_staff` identifier (current code at `page.tsx:91` and `:121` — retired). `AdminAccessDenied` accepts only sanitised `message` (the legacy `permission` prop is accepted but ignored).
- **Inactive banner** uses Restricted family (icon + tinted background + non-color shape cue), not red.
- **Self-overrides lockout** banner uses Restricted tone Panel — same family as the brief's "decorative description gets a Restricted-family banner" requirement.
- **Risk-tier confirm matrix** wired through the shared `ConfirmActionModal`; critical destructive (Cancelled icon + reasoning copy), high uses same Destructive primary on grant only.
- **Profile completion `Add →` Ghost** uses anchor-style `<a href="#field-X">` with `data-staff-focus-field` attribute; the form's `useEffect` intercepts the click, scrolls the matching `[name="X"]` input into view, and focuses it. Falls back to native anchor scroll if the form isn't rendered.

## Edge cases verified

- 60-character `name`: H1 uses `text-balance` + `clamp(1.5rem, 2.5vw, 1.95rem)`; wraps gracefully at 375px. No overflow.
- 600-character `short_bio` (max): textarea expands; `dl` read-only path wraps the paragraph above the chip grid; no overflow.
- R4 disclosure `<details>` expands inside the rail; sticky positioning on `xl:` keeps the panel anchored.
- Profile-completion `0/5` renders Cancelled-family count badge (status-cancelled tokens — bg + danger-tone icon, not raw red).
- Critical-tier override grant: `risk_level === "critical" && nextMode === "grant"` opens `ConfirmActionModal` with "Grant {permission}…?" copy and `destructive` primary; cancel returns silently.

## States that did not require new code

- The data layer's existing scope filters (`active=true`, `can_take_bookings=true`, gender match) continue to govern out-of-scope routing. No additional Phase-6 guarding required.
- Loading state inherits from Next.js — `AdminPanel` exposes a `loading` prop for sub-region skeletons if a future revalidate boundary needs it.

## Items deferred to Phase 7 / 8

- `assignments-quiet.svg` illustration (IMAGES-NEEDED row appended; Lucide placeholder used in the meantime).
- Per-brief §10 Q4: "What clients see on the public site" framing label above the read-only `dl` — not a hard requirement; deferred to gauntlet polish.
- Chip-input UI for specialties / languages / service areas — comma-separated input preserved for parity with existing pattern across the admin; gauntlet may unify.

## Diff scope

- `src/app/admin/staff/[staffId]/page.tsx`
- `src/app/admin/staff/[staffId]/StaffProfileForm.tsx`
- `src/app/admin/staff/[staffId]/StaffPermissionOverridesForm.tsx`

No untouchables changed.
