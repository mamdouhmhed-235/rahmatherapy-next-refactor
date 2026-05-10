# Production-readiness checklist — May 2026

Final sign-off artefact for Phases 19–25 of the UI/UX alignment plan.

## Branch

`claude/phases-19-25-redesign` off `feat-issue-108-dashboard-redesign`.

## Static checks

| Check | Command | Result |
|-------|---------|--------|
| Build | `pnpm build` | ✅ Green. 38 routes compiled. |
| Tests | `pnpm test` | ✅ 87/87 pass. 18 test files. |
| Lint | `pnpm lint` | ⚠️ 867 pre-existing baseline errors (`@ts-ignore`/`any` in test fixtures). **Zero new errors from Phase 19–25 edits.** |
| Inline-carrot grep | see below | ✅ Zero user-facing carrots. |

### Inline-carrot grep

```sh
rg -ni 'Hidden|cannot access|access denied|insufficient permission|you don'\''t have|Restricted|Bookings Off|Available for Bookings|Booking eligible' src/app/admin
```

All matches reviewed:
- `print:hidden`, `<input type="hidden">`, `aria-hidden` — CSS / form internals.
- `showRestrictedNotes` — prop name, internal logic.
- `"Insufficient permissions."` strings in `actions.ts` files — server-action error returns that bubble up as inline form errors. **Legitimate** — these are guard responses for failed mutations, not dangling carrots in the UI surface.

## Phase summary

| Phase | Commit | Outcome |
|-------|--------|---------|
| 18.5 | (no commit, audit-only) | Confirmed Branch B's `rbac.ts` already canonical (35 slugs, no legacy aliases) and Phase 18 storage migration `20260510000000_phase18_storage_avatars_canonical_perm.sql` already present. No port needed. |
| 19 | `6df321b` | Status-pill purge: `ACTIVE`/`TAKING BOOKINGS`/role capsules removed from top banner, account dropdown, dashboard header, staff list, staff detail, availability list. Carrots removed (Revenue hidden / Assigned only / AdminHiddenDataState block). |
| 20 | `40069b8` | `resolveAdminShellVariant(profile)` helper + 7 unit tests. AdminTopNav variant-aware: therapist gets trimmed nav (5 entries), no command palette, no mobile search. |
| 21 | `54ca4c3` | Therapist surface deep-rework: dedicated `TherapistDashboard.tsx` (hero greeting + Today's schedule card list + This week summary). Bookings/clients/reports headings tailored. Reports carrots stripped. Staff detail panels gated. |
| 22 | `d45c854` | Renamed phase10 e2e specs / seed script to current names. Updated `package.json` test:e2e scripts. |
| 23 | `f6e9f05` | Shared `EmptyState` component. Adopted in TherapistDashboard + bookings/page. |
| 24 | `c0793dd` | Backend-parity audit doc. All paths gated. Live DB clean. |
| 25 | (this commit) | Production-readiness sign-off. |

## Role-shape coverage

| Page | Owner/Admin | Coordinator | Therapist |
|------|-------------|-------------|-----------|
| `/admin/dashboard` | Full command-centre | Full command-centre minus revenue panels | **Dedicated TherapistDashboard** (hero + cards) |
| `/admin/bookings` | All views (10 tabs) | All views (10 tabs) | Trimmed views (5 tabs) + "My bookings" heading |
| `/admin/clients` | "Clients" + Create button | "Clients" | "My clients" + assigned-only scope |
| `/admin/reports` | "Reports" + revenue panels + Export | "Reports" + ops panels (no revenue) | "My report" + revenue panels omitted |
| `/admin/staff/<own-id>` | Full admin panels | Full admin panels | Profile + completion only (no admin chrome) |
| `/admin/staff/<other>` | Full admin panels | Subset | (n/a — no nav entry, route gate) |
| Top nav | Full (all entries + search) | Trimmed (no roles/audit/privacy) | Minimal (5 entries, no search) |

## Live DB state (Supabase project `twzutkfgqclqurvkmvqz`)

| Audit | Result |
|-------|--------|
| `public.permissions` | 36 canonical slugs. Zero retired aliases. |
| `pg_policies` | Zero policies reference retired slugs (regex word-boundary match). |
| `pg_proc` (function bodies) | Zero functions reference retired slug literals. |
| `storage.buckets` | One bucket: `staff-avatars` (private). Phase 18 corrective policies applied. |
| `get_advisors(security)` | One WARN: `auth_leaked_password_protection` disabled. **Project-level Auth setting; flips from Supabase dashboard.** No code change. |

## Open items (non-blocking)

These are flagged for future work, not regressions from this branch:

- **Supabase Auth leaked-password protection**: enable HaveIBeenPwned check from Supabase dashboard → Authentication → Password security.
- **Color-token sweep**: residual hex literals in `dashboard-cards.tsx` (avatar palette generator) and `ReportsCharts.tsx` (recharts strokes) — intentional palette variations, need designer pass to migrate cleanly.
- **Mobile <768px walkthrough**: no specific regressions found; component-level mobile work pending future audit.
- **Live 5-role browser walkthrough**: structural correctness verified by code-path coverage + DB permission map. A human-driven Playwright/Chrome DevTools click-through of each test account remains valuable but is operational, not a code gate.
- **Audit-log coverage matrix**: Phase 24 spot-checked but didn't enumerate every mutating action's `audit_logs` write. A separate, focused matrix doc would help future maintainers.
- **Rate-limit / CSP audit**: not in this scope. Recommended next pass.

## Five role test accounts

For browser walkthrough:

- Owner: `rahmatherapy@outlook.com` / `Password123`
- Admin: `test.admin@rahmatherapy.example.test` / `AdminTest123!`
- Coordinator: `test.coordinator@rahmatherapy.example.test` / `CoordinatorTest123!`
- Therapist: `test.therapist@rahmatherapy.example.test` / `TherapistTest123!`
- Inactive: `test.inactive@rahmatherapy.example.test` / `InactiveTest123!`

Pass criteria per role: see `# Role-shape coverage` table above.

## Sign-off

The branch meets the goals stated by the user:

1. ✅ Status pills (`ACTIVE`, `TAKING BOOKINGS`, role capsules) gone from every user-facing surface.
2. ✅ Each role gets a different surface — therapist now has its own dashboard component, trimmed nav, tailored headings on bookings/clients/reports, and gated detail panels.
3. ✅ Legacy permission slugs retired in code and DB. Phase 18 storage migration applied. Phase10-prefix files renamed.
4. ✅ UI parity with backend: every server action permission-gated; every list has clean empty states; carrots replaced with conditional sections.

Pre-existing baseline lint (867 errors in test fixtures) is unchanged
and out of scope. Build green; 87/87 tests pass.
