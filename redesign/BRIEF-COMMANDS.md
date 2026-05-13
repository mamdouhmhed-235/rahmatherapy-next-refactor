# Phase 5 — Per-Page Brief Commands

Final, locked queue of 29 `/impeccable shape` invocations for the admin redesign. Run one at a time. Each command stands alone — copy the entire line (including the suffix where present) and paste into Claude Code.

**Coverage:**
- 23 unique admin pages from `redesign/RECON.md` §2 (the 24th, the `/admin` index, is a hard `redirect()` with no UI)
- Dashboard split into 3 sibling briefs (different component trees, different user-tasks)
- `00-shared-components` for the admin chrome + shared component library
- `email-templates` for the 9 transactional emails in `src/lib/email/templates.ts`
- **2 net-new pages closing real Supabase-schema gaps**: `password-reset` (staff-facing) and `account-password-requests` (admin review queue). The `account_password_requests` table exists in production (migration `phase9_account_password_requests`, 2026-05-09) with a pending row and zero application code referencing it — a half-built workflow that needs UI.
- **`staff-availability` brief extended** to cover `staff_blocked_dates` and `staff_availability_overrides` — both tables are read by the booking engine but have no editable UI today.

**What's excluded and why:**
- `/admin/signout/route.ts`, `/admin/reports/export/route.ts` — route handlers, no UI
- `/api/availability/route.ts`, `/api/bookings/route.ts` — public JSON APIs, no UI
- `/booking/manage/page.tsx` — customer self-service, out of admin scope (user-confirmed)
- `error.tsx` / `not-found.tsx` / `loading.tsx` — none currently exist under `/admin`
- Modals, dialogs, popovers — component-level, covered inside parent page briefs or `00-shared-components`
- MFA/2FA UI, dedicated help center, session management, dedicated notification center, system health dashboard — over-engineering for a 3-4 person clinic at this stage

---

## Suffix variants

Three variant suffixes appear in the queue below. They are NOT optional — they are the mechanism that forces each brief to address role / shell / audience variation explicitly. Without them, briefs default to the highest-permission view and gloss over the role differences PRODUCT.md identifies as the primary UX problem.

### Canonical "Role variants" suffix

Applied to every page brief where multiple roles can reach it, AND to single-role pages (collapses cleanly to that one role plus a Denied-state sub-block).

> — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.

### "Shell variants" suffix

Used only on `00-shared-components`. The admin chrome (nav, command palette, brand sub-label, page-header style) varies by shell variant, not by role directly.

> — The brief MUST include a final section titled "Shell variants" (after section 10) with one sub-heading per AdminShellVariant defined in src/app/admin/shell-variant.ts: owner_admin, coordinator, therapist. Each sub-heading specifies which chrome elements (nav items, command-palette visibility, brand sub-label, page-header style, filter defaults) differ for that shell variant.

### "Audience variants" suffix

Used only on `email-templates`. Variation here is by recipient audience, not by role.

> — The brief MUST include a final section titled "Audience variants" (after section 10) with one sub-heading per audience: Customer, Staff (therapist recipient), Admin internal. Each sub-heading specifies tone, density, and template-level decisions for that audience, and lists which of the 9 templates in src/lib/email/templates.ts belong to that audience.

### No suffix

- The three `dashboard-*` sibling briefs — already role-scoped by name
- `login` and `password-reset` — pre-authentication, no roles apply

---

## Run order

The order locks the design vocabulary from chrome outward, then walks through PRODUCT.md's KEY_TASKS-heavy pages, then the remainder in RECON.md's inventory order. The two net-new password-flow briefs sit next to their conceptual neighbours (`password-reset` after `login`; `account-password-requests` after `audit`).

1. Chrome and shared system first (`00-shared-components`, `email-templates`)
2. KEY_TASKS-heavy pages (booking-new, bookings, clients, dashboard variants, reports)
3. Auth surfaces (login, password-reset)
4. Admin-review surfaces (audit, account-password-requests)
5. Remaining 17 pages in RECON.md table order

---

## The 29 commands

### 1. Shared components and admin chrome

```
/impeccable shape redesign of admin page 00-shared-components — The brief MUST include a final section titled "Shell variants" (after section 10) with one sub-heading per AdminShellVariant defined in src/app/admin/shell-variant.ts: owner_admin, coordinator, therapist. Each sub-heading specifies which chrome elements (nav items, command-palette visibility, brand sub-label, page-header style, filter defaults) differ for that shell variant.
```

---

### 2. Transactional email templates

```
/impeccable shape redesign of admin page email-templates — The brief MUST include a final section titled "Audience variants" (after section 10) with one sub-heading per audience: Customer, Staff (therapist recipient), Admin internal. Each sub-heading specifies tone, density, and template-level decisions for that audience, and lists which of the 9 templates in src/lib/email/templates.ts belong to that audience.
```

---

### 3. Booking new (KEY_TASK: create bookings)

```
/impeccable shape redesign of admin page booking-new — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 4. Bookings list (KEY_TASK: triage created bookings)

```
/impeccable shape redesign of admin page bookings — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 5. Clients list (KEY_TASK: find existing client to rebook)

```
/impeccable shape redesign of admin page clients — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 6. Dashboard — Owner / Admin variant (KEY_TASK: CRM metrics)

```
/impeccable shape redesign of admin page dashboard-owner-admin
```

---

### 7. Dashboard — Booking Coordinator variant

```
/impeccable shape redesign of admin page dashboard-coordinator
```

---

### 8. Dashboard — Therapist variant

```
/impeccable shape redesign of admin page dashboard-therapist
```

---

### 9. Reports (KEY_TASK: deeper business metrics)

```
/impeccable shape redesign of admin page reports — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 10. Login

```
/impeccable shape redesign of admin page login
```

---

### 11. Password reset (NET-NEW — closes Supabase schema gap)

This is a net-new page. Database table `account_password_requests` already exists (migration `phase9_account_password_requests`) with columns: `staff_id`, `status` enum (`pending` / `approved` / `rejected` / `expired`), `encrypted_payload`, `payload_nonce`, `expires_at`, `reviewed_at`, `reviewed_by`, `reviewer_note`. Zero application code currently references it. This brief shapes the staff-facing flow: a "Forgot password" link from `/admin/login`, the request submission form, the "request submitted, awaiting review" confirmation state, and (if the workflow supports it) the post-approval set-new-password landing surface reached via signed link/token. Pre-authentication context — no role variants apply; flow states (request, pending, approved-with-token, expired, rejected) are the variation axis.

```
/impeccable shape redesign of admin page password-reset — This is a new page — it does not exist in the codebase yet. There is no existing file to preserve. Build this as greenfield using DESIGN.md tokens and PRODUCT.md direction. The brief MUST design from the database schema: account_password_requests table (status enum pending/approved/rejected/expired, encrypted_payload, expires_at, reviewer_note). The brief MUST include a final section titled "Flow states" (after section 10) with one sub-heading per workflow state the staff member can encounter: initial forgot-password form, request-submitted confirmation, pending-review status check, approved-with-token (set-new-password) form, rejected, expired. Each sub-heading specifies what the user sees, what action is available, and the copy voice. No role variants section — this surface is pre-authentication.
```

---

### 12. Audit log

```
/impeccable shape redesign of admin page audit — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 13. Account password requests — admin review queue (NET-NEW — closes Supabase schema gap)

This is a net-new admin surface paired with brief #11. Owners and Admins review pending records in `account_password_requests`: approve (which triggers password reset via Supabase Auth admin API), reject with note, or let expire. Every state transition writes to `audit_logs`. Restricted to permission holders (Owner and Admin / Practice Manager — Coordinator and Therapist denied). Currently 1 row sits pending in production with no UI to act on it.

```
/impeccable shape redesign of admin page account-password-requests — This is a new page — it does not exist in the codebase yet. There is no existing file to preserve. Build this as greenfield using DESIGN.md tokens and PRODUCT.md direction. The brief MUST design from the database schema: account_password_requests table reviewed via Owner/Admin queue (status enum pending/approved/rejected/expired, reviewer_note, reviewed_by, reviewed_at). Approve and reject are the destructive actions and must follow the same confirmation pattern as other destructive admin actions per DESIGN.md. The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Booking Coordinator and Therapist must collapse to the Denied state.
```

---

### 14. Availability (global)

```
/impeccable shape redesign of admin page availability — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 15. Booking detail

```
/impeccable shape redesign of admin page booking-detail — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 16. Calendar

```
/impeccable shape redesign of admin page calendar — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 17. Client detail

```
/impeccable shape redesign of admin page client-detail — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 18. Client new

```
/impeccable shape redesign of admin page client-new — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 19. Emails (delivery events + manual reminders)

```
/impeccable shape redesign of admin page emails — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 20. Enquiries

```
/impeccable shape redesign of admin page enquiries — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 21. Operations

```
/impeccable shape redesign of admin page operations — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 22. Privacy

```
/impeccable shape redesign of admin page privacy — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 23. Roles list

```
/impeccable shape redesign of admin page roles — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 24. Role detail

```
/impeccable shape redesign of admin page role-detail — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 25. Services

```
/impeccable shape redesign of admin page services — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 26. Settings

```
/impeccable shape redesign of admin page settings — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 27. Staff list

```
/impeccable shape redesign of admin page staff — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. For pages only one role can reach, collapse to that role plus the Denied state.
```

---

### 28. Staff detail (extended suffix — varies on two axes)

`staff-detail` is the only page in the queue whose role variation depends on both who is viewing AND whom they are viewing. The Role variants section must express this as a matrix.

```
/impeccable shape redesign of admin page staff-detail — The brief MUST include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions. The "Role variants" section must additionally express the (role × viewing-context) matrix that applies here — Admin viewing any colleague, Self viewing own profile, Coordinator viewing assignment pool, Therapist viewing same-gender colleague — since this page varies on both axes.
```

---

### 29. Staff availability (extended scope — closes Supabase schema gap)

`staff-availability` currently edits only `staff_availability_rules` (per-day working hours). Two sibling tables — `staff_blocked_dates` and `staff_availability_overrides` — exist in the database and are read by the booking engine (`/admin/availability/page.tsx`, `/admin/bookings/assignment-eligibility.ts`, `/lib/booking/availability.ts`) but have NO editable UI. A therapist who needs to mark "I'm off May 15" or "I work different hours May 20" cannot do it. The redesign closes this gap by adding both editors to the page, mirroring `BlockedDatesManager` and `AvailabilityOverridesManager` that already exist on the global `/admin/availability` page.

```
/impeccable shape redesign of admin page staff-availability — The brief MUST cover THREE editable surfaces on this page, not just one: (a) per-day working rules (staff_availability_rules) — currently shipped; (b) per-staff blocked dates (staff_blocked_dates) — table exists, booking engine reads it, NO editor UI yet; (c) per-staff availability overrides (staff_availability_overrides) — same status as (b). Treat (b) and (c) as net-new editable surfaces the redesign must add, paralleling BlockedDatesManager and AvailabilityOverridesManager that already exist for global availability on /admin/availability. The brief MUST also include a final section titled "Role variants" (after section 10) with one sub-heading per role that can reach this page: Owner, Admin (Practice Manager), Booking Coordinator, Therapist, plus a final "Denied state" sub-heading. Each sub-heading specifies what is visible, what is hidden, and any role-specific copy or actions.
```

---

## Tracking

When a brief is confirmed by the user during `/impeccable shape`, mark it complete here:

- [ ] 1. 00-shared-components
- [ ] 2. email-templates
- [ ] 3. booking-new
- [ ] 4. bookings
- [ ] 5. clients
- [ ] 6. dashboard-owner-admin
- [ ] 7. dashboard-coordinator
- [ ] 8. dashboard-therapist
- [ ] 9. reports
- [ ] 10. login
- [ ] 11. password-reset *(NET-NEW)*
- [ ] 12. audit
- [ ] 13. account-password-requests *(NET-NEW)*
- [ ] 14. availability
- [ ] 15. booking-detail
- [ ] 16. calendar
- [ ] 17. client-detail
- [ ] 18. client-new
- [ ] 19. emails
- [ ] 20. enquiries
- [ ] 21. operations
- [ ] 22. privacy
- [ ] 23. roles
- [ ] 24. role-detail
- [ ] 25. services
- [ ] 26. settings
- [ ] 27. staff
- [ ] 28. staff-detail
- [ ] 29. staff-availability *(extended scope)*
