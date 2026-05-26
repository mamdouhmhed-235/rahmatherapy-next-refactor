# Test credentials — Phase 6 redesign sessions

Canonical credential source for `/goal`-driven per-page redesign agents. Mirrors `docs/users-credentials` and the Step-6 verification credential card in `redesign/phase6-admin-workflow-guide.html` (L6260-6275).

> **For autonomous agents:** read this file when a recipe instructs you to "resolve credentials from `/redesign/test-credentials.md`". Use the account that matches the page's RBAC requirement listed in the recipe's Context table. If the recipe says "Owner-only" use the Owner row; if it says "Admin or Owner" prefer Admin unless the brief explicitly demands Owner. Never invent accounts — if the page's required role is not listed here, emit `STUCK: <step> — required role <name> has no test credential` and stop.

## Accounts

| Role | Email | Password | RBAC scope |
|---|---|---|---|
| **Owner / Main Admin** | `rahmatherapy@outlook.com` | `Password123` | Every permission. Use for Owner-only pages: `settings`, `roles`, `role-detail`, `services`, `audit`, and any page whose recipe RBAC field reads "test.owner ONLY" or "Owner-only". |
| **Admin / Practice Manager** | `test.admin@rahmatherapy.example.test` | `AdminTest123!` | Full booking + client management, reports, staff profile editing, email + enquiry workflows. No `manage_role_templates`, no `manage_permission_overrides`. Default for most pages. |
| **Booking Coordinator** | `test.coordinator@rahmatherapy.example.test` | `CoordinatorTest123!` | Enquiry + booking management, assignment. No revenue access, no staff/role management, no audit, no privacy. |
| **Therapist** | `test.therapist@rahmatherapy.example.test` | `TherapistTest123!` | Own assigned bookings, own availability, own client contact + health within scope, session notes. |
| **Inactive** | `test.inactive@rahmatherapy.example.test` | `InactiveTest123!` | Sign-in is blocked at middleware (`?reason=inactive` redirect). Surface exists for HR/audit only. Use only when verifying the `/admin/login?reason=inactive` notice or the inactive-redirect path. |

## Notes for agents

- **The Owner account email looks production-shaped** (`rahmatherapy@outlook.com`). It is nonetheless the seeded test owner credential and is safe to use in dev. Per the per-machine seed (RBAC + `auth.users`), this account holds every permission. Do not invent a `test.owner@…` shim — none exists.
- **No `test.owner@rahmatherapy.example.test` account exists.** Any recipe or session that references it is mistaken; substitute `rahmatherapy@outlook.com` / `Password123`.
- **Sign out** between role swaps with `POST /admin/signout` so middleware sees a clean session for the next role check. The recipes call this out at Step 11b.
- **Session-cookie bleed warning** — if you ran a prior session as Inactive, the admin layout will render `AdminAccessDenied` even at `/admin/login`. Clear cookies before screenshotting the default state.

## Why this file exists

Multiple Owner-only per-page recipes (`roles`, `services`, plus older drafts of `settings`) referenced "Resolve owner credentials from `/redesign/test-credentials.md`" before this file was created. Without it the autonomous agent hit STUCK at Step 7. This file is the canonical resolution.
