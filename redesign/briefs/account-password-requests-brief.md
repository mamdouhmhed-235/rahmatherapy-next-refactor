# Brief: account-password-requests

## 1. Feature Summary

`/admin/account-password-requests` is the Owner / Admin review queue for staff password-reset requests. It is the administrative counterpart to Brief 10 (the staff-facing password-reset flow): every row written to `account_password_requests` by a staff member submitting state-1 of that flow lands here for human review. Greenfield in the codebase; the table has sat in production with one pending row and zero application code since the phase-9 migration; this brief builds the page from the schema. Two destructive review actions: **Approve** (triggers the Supabase Auth admin-API password reset, generates the one-time token, sends the approval email carrying the link to `/admin/password-reset/<token>`) and **Reject** (records the reviewer note, sends the rejection email). Both follow the standard destructive-action confirmation pattern from DESIGN.md §5 / §6: `ConfirmActionModal` with plain-English summary, Primary "Confirm" + Secondary "Cancel". The page also surfaces requests that have aged into `expired` status (token TTL elapsed before review) so the queue gives the reviewer a complete record of every request the system has seen, not just the actionable ones.

## 2. Primary User Action

**Read the pending queue, decide approve / reject for each row, leave a reviewer note when context is warranted, and clear the queue. Anything else on the page is reference.**

## 3. Design Direction

**Colour strategy:** Restrained, with two status families doing the lifting. Pending family on rows awaiting review (the page's primary content), Confirmed / Cancelled / Restricted on rows that have already been resolved (a quiet at-a-glance state communicator on the tabs and rows). The destructive `ConfirmActionModal`s use the standard Cancelled family for the reject confirmation and Confirmed family for the approve confirmation; never the other way round (approving is "yes, this is them"; rejecting is "no, don't grant access"). The page reads as administrative, not security-theatre: this is a review queue, not an intrusion-detection panel.

**Theme scene sentence:** *"Fatimah on her laptop on a Wednesday morning before her first call, going through the three password-reset requests that came in overnight, opening each one in turn and deciding whether the email address matches a staff member she actually expects to be asking."* Forces light mode, a queue layout that surfaces three or four rows at once (not infinite scroll), and copy that frames the decision as routine review, not threat assessment.

**Anchor references:**
- **GitHub's "Pending invitations" / organisation admin** — list-row queue with per-row Primary "Approve" / Ghost "Reject", a status filter strip, and an empty-state that doesn't celebrate inbox-zero
- **Notion's workspace member-request page** — calm review surface, reviewer-note field expands inline rather than as a modal, request context kept compact
- **Auth0's "Pending user verifications"** — the queue is the page; everything else is filter chrome

Anti-anchor: a SOC-style alert queue with red severity scores and "investigate" CTAs. This is a review queue inside a small clinic; the visual register is "back office", not "security operations".

## 4. Scope

Production-ready, greenfield. Page at `/admin/account-password-requests`. Includes: status filter tabs (Pending / Approved / Rejected / Expired / All) with Pending default, per-request list rows with email + submitted-time + expiry-time + status badge + action affordances, **Approve and Reject as destructive actions wrapped in `ConfirmActionModal` per DESIGN.md** (the project's `ConfirmActionModal` is currently orphan per RECON §4; this surface is its first wire-up), reviewer-note field handling (required on reject, optional on approve), audit-log writes per RECON §6.2 (new action types added by this brief), and the standard `AdminAccessDenied` for the four out-of-scope roles. Gates on the new RBAC permission `manage_account_password_requests` (Owner + Admin / Practice Manager).

**Out of scope:** the Supabase Auth admin-API call internals (Phase 6 implementer wires the existing admin client; this brief specs the UI contract). Token generation, hashing, TTL policy (lives in the migration). The two new email templates (`password_reset_approved`, `password_reset_rejected`); owned by Brief 02 / email-templates, this brief defines the on-page voice they must match. Brief 10 (staff-facing flow) and Brief 11 (audit log) are siblings; cross-brief consistency flagged at Phase 7 Gate 2.

## 5. Layout Strategy

**Page rhythm (top to bottom, desktop ≥1024px):**

1. **`AdminPageHeader`** — H1 "Password-reset requests". Subtitle Soft Slate Work Sans 400 label step: "Approve or reject staff requests to reset their password. Approval sends a one-time link to the requester's email." Subtitle does the work of explaining the consequence of approve before the reviewer touches a button; no surprise side-effects.

2. **Status filter tabs** — horizontal pill strip identical in mechanics to the Brief 04 bookings primary tabs. Five tabs: **Pending (N)** · Approved · Rejected · Expired · All. Pending is the **default active tab** and is the only one that carries a count in the label (the actionable count is the only one the reviewer needs at a glance; counts on the resolved tabs would create visual noise). `aria-current="page"` on the active tab. Active: Clinic Green fill + Field White text. Inactive: transparent + Practice Charcoal. Hover: Hover Moss. On mobile: horizontal momentum-scroll strip.

3. **Result count line** — single Work Sans 400 label step Soft Slate line: "Showing {N} pending requests." When unfiltered ("All" tab): "Showing {N} requests across all statuses."

4. **Request list** — vertical stack of `AdminPanel` rows, one per request, separated by `md` (16px) gap. Each row:
   - **Top row (horizontal):** 32px avatar placeholder (since this is a pre-auth identity, the avatar is a neutral `user-question` Lucide glyph on a Hover Moss circle; *never* the gendered avatar palette from Brief 06, because the system cannot yet confirm whose request this is) + email address (Urbanist 500 title step, monospace digits only on the domain) + status badge (DESIGN.md §5 AdminStatusBadge, Pending / Confirmed / Cancelled / Restricted per row's `status`) + relative submitted-time right-aligned (Work Sans 500 label step, Soft Slate, e.g. "2 hours ago"). The full ISO timestamp + Europe/London absolute time appears in a native `title` tooltip on hover.
   - **Sub-row (Pending status only):** Soft Slate Work Sans 400 body step "Expires in {time}, e.g. about 21 hours"; this is the actionable urgency cue; if the reviewer doesn't act, the row will move to Expired status and the requester has to start over (a frustration for them).
   - **Sub-row (Approved / Rejected status):** Soft Slate Work Sans 400 body step "Reviewed by {reviewer name} {time-ago}, e.g. by Fatimah, 18 minutes ago." Plus, when a `reviewer_note` is present, a quoted block beneath in a `surface-page` well: `<blockquote>` with Work Sans 400 body step in Practice Charcoal, prefixed by a Work Sans 500 label step "Note from {reviewer name}:"; same well treatment as the staff-facing state 5 rejection screen in Brief 10, so the reviewer sees the exact text the requester will see.
   - **Sub-row (Expired status):** Soft Slate Work Sans 400 body step "Expired {time-ago, e.g. 4 days ago} without review." Plain. Not apologetic, not blaming.
   - **Action row (Pending status only):** Right-aligned action group with three controls; Primary "Approve" + Destructive "Reject" + Ghost "Open audit row". Mobile: stacked full-width buttons in the same order. The two destructive controls trigger their respective `ConfirmActionModal`s.
   - **Action row (Approved status):** Single Ghost "Open audit row" link. No re-approve, no revoke (the password has already been reset; revocation is a separate concern handled at the Supabase Auth admin-API level via /admin/staff/<id>).
   - **Action row (Rejected status):** Single Ghost "Open audit row" link. No re-process from this surface; the requester must submit a new request via the staff-facing flow.
   - **Action row (Expired status):** Single Ghost "Open audit row" link.

5. **`EmptyState`** — when the active tab returns zero rows. Pending tab empty (the routine state; the reviewer cleared the queue): Confirmed family lock-with-check illustration, "All caught up", "No password-reset requests are waiting for review." No CTA. Other tabs empty: standard "No requests in this status" with a Ghost "Show pending" link routing back to the Pending tab.

**Approve `ConfirmActionModal`** (per DESIGN.md destructive-action pattern):
- Dialog overlay using DESIGN.md §4 overlay shadow + Confirmed family `check-circle` 20px icon as the header glyph.
- H2 "Approve this request?"
- Body Work Sans 400 body step: "An approval email with a one-time reset link will be sent to {email}. The link expires in 24 hours."
- Optional `<textarea name="reviewer_note">` labelled "Note (optional)" with placeholder "Anything you want the requester to see in the email." 240ch maximum (DB column constraint), live character count beneath in Soft Slate.
- Footer: Primary "Send approval email" + Secondary "Cancel". Primary uses the standard loading-button spinner pattern (16px Field White spinner replaces the leading icon during the server action).

**Reject `ConfirmActionModal`**:
- Dialog overlay with **Cancelled family** `x-circle` 20px icon (per DESIGN.md destructive variant).
- H2 "Reject this request?"
- Body Work Sans 400 body step: "A rejection email will be sent to {email}. The requester will see the note you write below."
- **Required** `<textarea name="reviewer_note" required>` labelled "Reason for rejection" with placeholder "What should the requester know?" Required marker (`*` in Cancelled text colour, `aria-hidden="true"`) adjacent to label. 240ch maximum, live character count. Validation: server action rejects submission if note is empty.
- Footer: Destructive "Send rejection" + Secondary "Cancel". Loading state mirrors the approve modal.

**Mobile rhythm (<768px):** Tabs become a horizontal momentum-scroll strip. Each request row stacks vertically: top row collapses (avatar + email above the status badge); sub-rows stack; action row becomes three stacked full-width buttons. `ConfirmActionModal`s render as full-screen sheets from the bottom (per DESIGN.md §6 motion-token mobile bias) with the reviewer-note textarea full-width.

## 6. Key States

| State | What the reviewer sees |
|---|---|
| Default (Pending tab, one+ requests waiting) | Header + 5-tab strip with Pending active + result count "{N} pending requests" + list of pending rows each with Approve / Reject / Open audit |
| Default (Pending tab, zero requests) | Header + tabs + `EmptyState`: "All caught up. No password-reset requests are waiting for review." |
| Approved tab | Filtered list, sorted reverse-chronological by `reviewed_at`. Each row shows Reviewed-by line + optional reviewer-note well |
| Rejected tab | Same as Approved structure, reviewer-note well always present (note is required on reject) |
| Expired tab | Filtered list, sorted reverse-chronological by `created_at`. "Expired N ago without review" sub-row |
| All tab | All rows mixed, sorted reverse-chronological by `created_at`. Each row's status badge does the visual sorting at-a-glance |
| Loading (tab switch) | `AdminSkeleton` rows; tab strip stable; result count "…" |
| Empty tab non-Pending | `EmptyState`: "No {status} requests" + Ghost "Show pending" |
| Error loading rows | Inline Cancelled-family `role="alert" aria-live="polite"` in place of the list: "Couldn't load requests. Try refreshing." Ghost "Try again". Tabs stay usable |
| Approve modal open | Overlay dialog, Confirmed family header, optional note textarea, Primary "Send approval email" + Secondary "Cancel" |
| Reject modal open | Overlay dialog, Cancelled family header, **required** note textarea with `*` marker, Destructive "Send rejection" + Secondary "Cancel" |
| Reject modal note empty + submit attempted | `role="alert"` region beneath the textarea: "Add a note before rejecting. The requester needs to know why." Cancelled family colours. Destructive button does NOT trigger loading state; modal stays open |
| Approve in flight | Modal Primary button: 16px Field White spinner, text unchanged, `aria-busy="true"`. Modal dismissal disabled (no ESC, no backdrop click) until response |
| Approve success | Modal closes. Sonner toast Confirmed family: "Approval email sent to {email}." 4s auto-dismiss. Row in list updates to Approved status without page reload (server action revalidates the route) |
| Reject success | Same pattern. Toast Cancelled family: "Rejection email sent to {email}." Row updates to Rejected status |
| Approve / Reject server error (Supabase Auth admin-API failure, email service failure, etc.) | Modal stays open. `role="alert"` region above the footer: "Couldn't send the email. Try again in a minute." Cancelled family. The DB row is NOT updated until the email succeeds (server action is transactional) |
| Race condition: row already reviewed by another admin | Modal stays open. `role="alert"` region: "This request was just reviewed by {other reviewer name}. Refresh to see the latest." Ghost "Refresh now" reloads |
| Self-approval attempted (reviewer submits Approve on their own request) | Modal Primary fires; server returns `{ error: "self_approval_not_allowed" }`; modal stays open; `role="alert"` above the footer: "You can't approve your own request. Ask another owner or admin to review." Cancelled family. DB row untouched |
| "Open audit row" Ghost link | Navigates to `/admin/audit?q={request-id-prefix}` so the reviewer can see the audit chain for this request (Brief 11 audit page handles the rest) |

## 7. Interaction Model

- **Tab switch.** Submits a GET form with `?status=` param. URL becomes `/admin/account-password-requests?status=pending`; deep-linkable. Pending is the default when `?status` is absent. Refreshing the page after approving the last pending request lands the reviewer on the empty state of Pending, which is a small UX reward for clearing the queue.
- **Approve button → ConfirmActionModal.** Opens the modal. Optional note. On confirm: server action `approvePasswordResetRequest({ requestId, reviewerNote? })` runs. Server action steps: (1) verify the row is still `pending` (race-safe); (2) call Supabase Auth admin-API to generate the password-reset token; (3) write the token to the row + `status='approved'` + `reviewed_by` + `reviewed_at` + `reviewer_note`; (4) send `password_reset_approved` email via Resend; (5) write `password_reset_approved` audit row. If any step fails, the transaction rolls back and the modal renders the error region.
- **Reject button → ConfirmActionModal.** Opens the modal. **Required** note. On confirm: server action `rejectPasswordResetRequest({ requestId, reviewerNote })` runs. Server action steps: (1) verify the row is still `pending`; (2) update row to `status='rejected'` + `reviewed_by` + `reviewed_at` + `reviewer_note`; (3) send `password_reset_rejected` email via Resend; (4) write `password_reset_rejected` audit row. Same transactional rollback on failure.
- **"Open audit row" Ghost link.** Navigates to `/admin/audit?q={requestId-first-8}` so the reviewer can see the full audit chain. Brief 11 handles that surface.
- **ConfirmActionModal mechanics.** ESC closes the modal (unless `aria-busy="true"`). Backdrop click closes the modal (same rule). Focus traps inside the modal per DESIGN.md §4 overlay convention. On close, focus returns to the originating button.
- **Keyboard.** Tab order on a row: row anchor (sr-only "Password-reset request from {email}, status {status}") → Approve → Reject → Open audit. Inside the modal: H2 (sr-only focused first) → textarea → Primary/Destructive button → Secondary. Tab does not exit the modal until it closes.
- **`prefers-reduced-motion`.** Modal fade-in 240ms `ease-gentle`; reduced-motion replaces with instant. Tab strip switches submit normal route re-renders; no client transitions to disable.

## 8. Content Requirements

**Headings.**
- H1: "Password-reset requests"
- H2 (per row, sr-only for heading nav): `<h2 class="sr-only">Password-reset request from {email}, {status}.</h2>`
- H2 (modal): "Approve this request?" / "Reject this request?"

**Status badge labels (DESIGN.md §5).**
- Pending → Pending family chip "Pending review" + `clock` icon
- Approved → Confirmed family chip "Approved" + `check-circle` icon
- Rejected → Cancelled family chip "Rejected" + `x-circle` icon
- Expired → Restricted family chip "Expired" + `lock` icon

**Subtitle.** "Approve or reject staff requests to reset their password. Approval sends a one-time link to the requester's email."

**Per-row sub-row copy.**
- Pending: "Expires in {time-from-now}." When < 1 hour: "Expires soon. Less than {N} minutes left." (No alarmist colour change; the copy carries the urgency; Pending family already tints the row.)
- Approved: "Approved by {reviewer name} {time-ago}." If reviewer is the current user: "Approved by you {time-ago}."
- Rejected: "Rejected by {reviewer name} {time-ago}." Same self-reference rule.
- Expired: "Expired {time-ago} without review."

**Reviewer-note well copy (Approved / Rejected rows).**
- Label above the well: "Note from {reviewer name}:" Work Sans 500 label step. Self-reference: "Note from you:"
- Note body: plain text, max-height 8em, "Show full note" Ghost link when overflowing.
- When the approval has no note (note is optional on approve): well is hidden entirely, no "No note provided" placeholder.

**Approve modal copy.**
- H2: "Approve this request?"
- Body: "An approval email with a one-time reset link will be sent to {email}. The link expires in 24 hours."
- Note label: "Note (optional)"
- Note placeholder: "Anything you want the requester to see in the email."
- Note character counter: "{N} / 240"
- Primary button: "Send approval email"
- Secondary button: "Cancel"

**Reject modal copy.**
- H2: "Reject this request?"
- Body: "A rejection email will be sent to {email}. The requester will see the note you write below."
- Note label: "Reason for rejection"
- Note required-empty error: "Add a note before rejecting. The requester needs to know why."
- Note placeholder: "What should the requester know?"
- Note character counter: "{N} / 240"
- Destructive button: "Send rejection"
- Secondary button: "Cancel"

**Empty-state copy.**

| State | Heading | Body | CTA |
|---|---|---|---|
| Pending tab, zero pending | "All caught up" | "No password-reset requests are waiting for review." | (no CTA) |
| Approved tab, zero approved | "No approved requests yet" | "Approvals will appear here once you act on a pending request." | Ghost "Show pending" |
| Rejected tab, zero rejected | "No rejections" | "Rejections will appear here once you act on a pending request." | Ghost "Show pending" |
| Expired tab, zero expired | "No expired requests" | "Requests that pass their review window without action will appear here." | Ghost "Show pending" |
| All tab, zero anywhere | "No requests yet" | "Password-reset requests appear here as staff submit them." | (no CTA) |

**Toast copy.**
- Approve success (Confirmed family, `check-circle`): "Approval email sent to {email}."
- Reject success (Cancelled family, `x-circle`): "Rejection email sent to {email}."
- Error (Cancelled family, `x-circle`, no auto-dismiss): "Couldn't send the email. Try again in a minute."

**Voice anchors hit.** Verbs over nouns ("Approve", "Reject", "Send", "Show"). Real names ("Fatimah", not "the reviewer", in self-reference). Plain English on the destructive action consequences. Stripe-style state-word discipline on chips. No apology copy on rejection ("we're sorry to reject this" would patronise both the reviewer and the requester).

## 9. Recommended References

- **`reference/interaction-design.md`** — for the `ConfirmActionModal` mechanics, focus trap, race-condition handling, and the GET-form tab contract.
- **`reference/copywriting.md`** — for the reviewer-facing voice (administrative, calm, never threat-assessment) and cross-consistency with the staff-facing email-template voice owned by Brief 02.
- **`reference/spatial-design.md`** — for the per-row sub-row rhythm and the reviewer-note well treatment that matches Brief 10's state-5 staff-facing rejection screen.

## 10. Open Questions

1. **Token TTL on approval.** This brief commits to "24 hours" in the modal copy. The actual TTL is a Supabase setting; if Phase 6 chooses a different value, update the modal copy in lock-step. Flag for cross-brief consistency with Brief 10 (which also names 24 hours in its Open Questions).
2. **Self-approval.** A row submitted by Owner A could theoretically be approved by Owner A (same person logged in, perhaps after a phone reset gone wrong). Recommendation: **disallow self-approval**; server action rejects with a Cancelled-family inline error "You can't approve your own request. Ask another Owner or Admin to review." Reduces the risk of a compromised Owner account approving its own reset. Confirm with Phase 6 owner.
3. **Bulk approve / bulk reject.** Out of scope; the queue is expected to have <5 rows on a typical week. If Phase 7 shows the queue routinely has 20+ pending, revisit. The page intentionally does NOT add the leading-column checkbox pattern from DESIGN.md §6 Bulk Actions yet.
4. **Audit-row "Open audit" Ghost link target.** This brief links to `/admin/audit?q={requestId-first-8}`. Owner has audit access; Admin / Practice Manager does NOT (`manage_audit_logs` is Owner-only per Brief 11). For Admin reviewers the link should render as Soft Slate "Open audit row" with a `title` tooltip "Audit access is owner-only" and a click that does nothing (or, alternatively, the link is hidden for Admin). **Current call:** hide for Admin, since a non-functional link is worse than no link. Confirm with Phase 6.
5. **Email enumeration on the queue itself.** The queue exposes email addresses of staff who have submitted requests. The reviewer is authenticated as Owner or Admin and has staff-management access already, so this is not a new leak. But: if a non-staff email somehow gets a row written (impossible if the staff-facing flow gates submission, but defensive), this surface would expose that address. Brief 10 gates the submission at the staff-table lookup; trust that contract. No mitigation needed here.

---

## 11. Role variants

`/admin/account-password-requests` is gated on the new permission `manage_account_password_requests`, granted to **Owner + Admin / Practice Manager** per the RECON post-Phase-0 amendment. Coordinator and Therapist are denied.

### Owner / Main Admin

**What is visible.** Everything in §5: H1 + subtitle + 5-tab strip + result count + request list + per-row action group (Approve / Reject / Open audit on pending rows; reviewed-by + reviewer-note well + Open audit on resolved rows). Both `ConfirmActionModal`s usable. **"Open audit row" Ghost link is functional** (Owner has `manage_audit_logs` per Brief 11) and navigates to `/admin/audit?q={requestId-first-8}`.

**What is hidden.** Nothing on the queue surface. The `encrypted_payload` column from the row never renders in the UI (no row-detail expand on this surface; the surface is the queue, not an inspection panel). If the Owner needs the encrypted payload for forensic reasons, they reach it via the Audit page's JSON `<details>` expansion in Brief 11 (where it renders as `[redacted: payload]` per the RECON §6.2 regex).

**Role-specific copy.** None. The canonical copy in §8 applies verbatim.

**Role-specific actions.** None unique to Owner beyond the functional "Open audit row" link.

### Admin / Practice Manager

**What is visible.** Everything Owner sees, with one difference noted below. Subtitle, tabs, list, modals all identical. Both Approve and Reject available.

**What is hidden.** The "Open audit row" Ghost link **is hidden** (not greyed-out) because Admin / Practice Manager does not hold `manage_audit_logs` (Owner-only per Brief 11 / RECON §2). Showing a link the user cannot follow is worse UX than not showing it. Each row's audit footer collapses to a single Soft Slate line: "Audit details available to the owner only." Optional, non-judgmental, factual.

**Role-specific copy.** The page subtitle is identical to Owner's. The hidden-audit footer line is the only difference: "Audit details available to the owner only." Plain, no judgment.

**Role-specific actions.** Admin/PM can approve and reject identically to Owner. Server-side action handlers check `manage_account_password_requests` and don't differentiate Owner from Admin for the mutation itself. Audit-log writes record `reviewed_by` with the Admin's staff ID exactly as for Owner; both roles appear by name in Brief 10's staff-facing state-5 reviewer-note attribution and in Brief 11's audit timeline.

### Booking Coordinator

**Collapses to the Denied state below.** Coordinator does not hold `manage_account_password_requests`.

### Therapist

**Collapses to the Denied state below.** Therapist does not hold `manage_account_password_requests`.

### Denied state

**Who lands here.** Any authenticated staff member without `manage_account_password_requests`. That is Booking Coordinator, Therapist, Inactive (the middleware redirects Inactive at `/admin/login?reason=inactive` upstream, so in practice only Coordinator and Therapist), plus any custom role lacking the permission. The middleware redirects unauthenticated visitors to `/admin/login` before this page renders, so the denied state is only seen by authenticated staff without permission.

**What is visible.** The shared admin shell renders normally (top nav, role badge). The page body renders the standard `AdminAccessDenied` component per `00-shared-components-brief.md`: illustrated `EmptyState` with the lock-icon variant, heading "You don't have access to this section.", body "Password-reset reviews are restricted to the practice owner and admin. Contact one of them if you think this is a mistake.", Secondary "Back to dashboard" button → `/admin/dashboard`.

**What is hidden.** The 5-tab strip, request list, every row, every action. The server short-circuits the data fetch when the permission gate fails; not a single row's email address leaks. The browser tab title reads "Access denied · Rahma".

**Role-specific copy.** The denied-state body is **slightly more specific** than the generic denied copy from `00-shared-components-brief.md`: it names *which two roles* can act on this surface ("the practice owner and admin"), matching the audit-page denied state's pattern (which names the practice owner). This is consistent with the brief-11 principle: where the role-restriction reason is the useful info, surface it; otherwise, use the generic copy.

**Role-specific actions.** "Back to dashboard" Secondary button. No "Request access" affordance; the request route is in-person / out-of-band (the user contacts the Owner or Admin, the same channel by which a password reset itself would now be solved).

---

**Carry-forwards this brief logs for Phase 6 implementation:**
- New route: `src/app/admin/account-password-requests/page.tsx` (Server Component; reads `?status=` GET param; permission-gates on `manage_account_password_requests`).
- New server actions in `src/app/admin/account-password-requests/actions.ts`: `approvePasswordResetRequest({ requestId, reviewerNote? })` and `rejectPasswordResetRequest({ requestId, reviewerNote })`. Both: row-status idempotency check + Supabase Auth admin-API call (approve only) + DB update + Resend send + audit-log write, all in one transactional unit.
- New RBAC permission: `manage_account_password_requests` (Owner + Admin/PM). RBAC matrix update lives outside this brief but Phase 6 owner must seed it.
- New audit-log action types (added to RECON §6.2 list, picked up by Brief 11 audit-family taxonomy): `password_reset_approved`, `password_reset_rejected`. (Brief 10 already adds `password_reset_requested`, `password_reset_request_lookup_failed`, `password_reset_completed`, `password_reset_token_rejected`.)
- Wires the existing `ConfirmActionModal` from `admin-ui-interactions.tsx` (currently orphan per RECON §4) as its first consumer. The same modal will be wired by `BookingManagementForm` cancel / staff deactivate / service delete in later briefs.
- Two email templates (Brief 02 owners): `password_reset_approved`, `password_reset_rejected`. Voice consistency with Brief 10's on-page voice + this brief's reviewer-note treatment is the cross-brief check at Phase 7 Gate 2.

---

## Recipe Context

### Files to edit

This page is greenfield. All files in the table are net-new and do not exist before Phase 6.

| File | What it is |
|---|---|
| `src/app/admin/account-password-requests/page.tsx` | New route. Server Component. Reads `?status=` GET param (pending / approved / rejected / expired / all; default pending). Permission-gates on `manage_account_password_requests`; renders `AdminAccessDenied` for everyone else. Renders the H1 + subtitle + 5-tab strip + result count + request list. Each row composed from `RequestRow.tsx`. |
| `src/app/admin/account-password-requests/actions.ts` | New server actions file: `approvePasswordResetRequest({ requestId, reviewerNote? })` and `rejectPasswordResetRequest({ requestId, reviewerNote })`. Both transactional: row-status idempotency check → Supabase Auth admin-API call (approve only) → DB update → Resend send → audit-log write. |
| `src/app/admin/account-password-requests/RequestRow.tsx` | New server/client-blended component for each list row. Top row (avatar / email / status / time), sub-row (status-specific copy + reviewer-note well), action row (status-specific buttons). Reviewer-note well treatment matches Brief 10's state-5 staff-facing rejection screen verbatim. |
| `src/app/admin/account-password-requests/ApproveModal.tsx`, `RejectModal.tsx` | New client components wrapping the existing `ConfirmActionModal` from `admin-ui-interactions.tsx`. Approve modal: Confirmed family glyph + optional textarea + Primary "Send approval email". Reject modal: Cancelled family glyph + required textarea + Destructive "Send rejection". Both use the standard loading-button spinner pattern. |
| `src/lib/email/templates.ts` | Two new template definitions: `password_reset_approved` (carries the token link) and `password_reset_rejected` (carries the reviewer note). Voice must match the on-page voice + Brief 10's staff-facing voice. Brief 02 (email-templates) owner finalises at Phase 7 Gate 2. |
| RBAC seed / role-template helpers | New permission `manage_account_password_requests` added to the RBAC matrix and granted to Owner + Admin / Practice Manager role templates. Exact file owned by Phase 6 implementer (lives in `src/lib/auth/**` family but the brief does not modify those files directly; the seed is the only allowed mutation). |

### Files to NEVER touch

- `supabase/migrations/**`; the `account_password_requests` table already exists. This brief does NOT propose schema changes.
- `src/lib/auth/**`; RBAC matrix logic; the brief only adds a permission via the seed mechanism Phase 6 implements (no direct edits to the auth library code).
- `src/lib/supabase/**`; client factories used unchanged.
- `src/middleware.ts`; the route is added to the admin-protected route set, but middleware logic is untouched.
- `src/app/admin/audit/**`; Brief 11 audit page owns these; cross-link target only.
- `src/app/admin/password-reset/**`; Brief 10 owns the sibling staff-facing flow.
- `src/app/admin/components/admin-ui-interactions.tsx` (where `ConfirmActionModal` lives); used as-is, no modifications to the modal primitive.
- All build/config files.

### Feature Preservation Manifest

This is a net-new surface. There is no existing UI to preserve. The preservation contract is forward-looking:

**Permission gate that must apply:**
- `manage_account_password_requests` (new; Owner + Admin / Practice Manager). Server-side gate at the page level (renders `AdminAccessDenied` on fail) AND at every server action entry (rejects with 403 on fail).

**Database contract:**
- Table: `account_password_requests` (existing, no schema change)
- Read columns: `id`, `email` (or `email_hash` + display surface), `status`, `created_at`, `expires_at`, `reviewer_note`, `reviewed_by`, `reviewed_at`
- Write columns: server actions update `status`, `reviewer_note`, `reviewed_by`, `reviewed_at`, and (approve only) the encrypted token payload columns per the migration's schema. **Never** writes the staff member's password directly; the Supabase Auth admin-API is the only path to that mutation.
- The `encrypted_payload` column is never rendered to the UI; reviewer never sees plaintext form data either, per Brief 10's encryption-at-write design.

**Audit log writes to ADD (RECON §6.2 extension):**
- `password_reset_approved` (approve action success)
- `password_reset_rejected` (reject action success)
- Both records include `actor_staff_id` (the reviewer), `target_id` (the request row), `before_state` and `after_state` snapshots (reviewer note included; sensitive keys still redacted per RECON §6.2 regex if any future field name matches).

**JS hooks / IDs to preserve:**
- `id="admin-main"` skip-link target (inherited from shared shell)
- `id="admin-command-search"` (in shared top nav, not duplicated here)
- No surface-specific hooks

**External / deep links to preserve (RECON §6.5):**
- POST `/admin/signout` (shared top nav)
- New deep-link targets the brief adds: `/admin/account-password-requests?status=pending|approved|rejected|expired|all`
- Cross-brief link to: `/admin/audit?q={requestId-first-8}` (Owner only; Admin sees the line hidden)
- Email templates link to: `/admin/password-reset/<token>` (Brief 10 owns this; this brief sends emails carrying that URL)

### Information hierarchy (top to bottom)

1. Page identity + consequence disclosure (H1 + subtitle naming "approval sends a one-time link")
2. Status filter tabs (Pending default, the actionable lens)
3. Result count (always-visible context)
4. Request list (queue rows; the page's primary content)
5. `ConfirmActionModal` overlays (destructive confirmations, overlay layer, not in document flow)

### Design direction, tokens and components

- **H1 "Password-reset requests":** Urbanist 600 display step, Chronicle.
- **Subtitle:** Work Sans 400 label step, Soft Slate, max 65ch.
- **Status filter tab strip:** identical to Brief 04 primary tabs. Active: `action-primary` (`oklch(23% 0.073 155)`) fill + Field White text + `aria-current="page"`. Inactive: transparent + Practice Charcoal. Hover: `surface-hover`. Pending count badge: Pending family chip embedded in the active-tab label as "Pending ({N})".
- **Result count line:** Work Sans 400 label step, Soft Slate.
- **Request row card:** `AdminPanel` at `surface-card` (`oklch(99.2% 0.004 88)`); 8px radius; 1px `border-subtle`; padding `md`; `md` (16px) gap between cards.
- **Row avatar (pre-auth placeholder):** 32px circle, Hover Moss (`oklch(95.5% 0.012 155)`) background, `user-question` Lucide 16px in Soft Slate. **Never** the gendered avatar palette from Brief 06; the system has not yet verified whose request this is.
- **Email address:** Urbanist 500 title step, Chronicle.
- **Status badge:** DESIGN.md §5 AdminStatusBadge spec; Pending / Confirmed / Cancelled / Restricted families per row's `status`.
- **Relative timestamp:** Work Sans 500 label step, Soft Slate, right-aligned, with `title` attribute for absolute time on hover.
- **Sub-row body copy:** Work Sans 400 body step, Practice Charcoal for the primary statement; Soft Slate for "Expires in" or "Expired" framing.
- **Reviewer-note well:** `surface-page` background (steps down from `surface-card` per Tonal Lift Rule); 8px radius; 1px `border-subtle`; `md` padding; label "Note from {reviewer name}:" in Work Sans 500 label step above; note body in Work Sans 400 body step Practice Charcoal; plain text only (no HTML rendering, no `dangerouslySetInnerHTML`).
- **Action row buttons (Pending row):** Primary "Approve" (Clinic Green fill, Field White text) + Destructive "Reject" (`oklch(40% 0.14 25)` fill, Field White text) + Ghost "Open audit row" (Practice Charcoal text, Hover Moss hover fill). Right-aligned desktop; stacked full-width mobile.
- **Action row Ghost (resolved row):** Ghost "Open audit row" only. Soft Slate fallback line for Admin role per §11.
- **`ConfirmActionModal` (approve):** DESIGN.md §4 overlay shadow; `surface-card` background; 8px radius; 32px padding; Confirmed family `check-circle` 20px header glyph. Footer Primary + Secondary buttons full-width on mobile, right-aligned on desktop.
- **`ConfirmActionModal` (reject):** Same modal mechanics; Cancelled family `x-circle` 20px header glyph; Destructive button replaces Primary.
- **Modal textarea:** DESIGN.md §5 Input spec; `surface-input` ground; `border-default` Form Seam; 6px radius; 240ch max with live character count beneath in Soft Slate Work Sans 400 label step "{N} / 240".
- **Required marker on reject textarea label:** `<span aria-hidden="true">*</span>` in Cancelled text colour (`oklch(26% 0.140 25)`).
- **Validation error region (modal):** `role="alert" aria-live="polite" aria-atomic="true"` beneath the textarea; Cancelled family colours; `x-circle` 16px Lucide icon.
- **Loading-button spinner (modal Primary/Destructive):** 16px Field White spinner replaces the leading icon during the server action; button text unchanged; `aria-busy="true"`; modal dismissal disabled.
- **Sonner toast (success):** Confirmed or Cancelled family per action; 4s auto-dismiss; leading family icon 16px.
- **Sonner toast (server error):** Cancelled family; **no auto-dismiss**; manual dismiss only.
- **Focus ring:** 3px Focus Azure (`oklch(47% 0.095 230)`) with 2px offset on every interactive element.
- **Modal entrance motion:** 240ms `ease-gentle` fade-in on overlay + backdrop; `prefers-reduced-motion: reduce` → instant.
- **Skeleton:** `AdminSkeleton` request-row placeholders during tab switches; tab strip stable.

---

## Implementation Notes

Per-state intent lives in §6 Key States (above). Per-viewport intent lives in §5 Layout Strategy (above); desktop ≥1024px rhythm with explicit mobile <768px row stacking and modal-as-bottom-sheet rules.

**Verification steps (for Phase 6 Step 6 verify):** Playwright + DevTools + `/impeccable audit` + `/impeccable critique`. Additional destructive-action verification: confirm both server actions fail closed when `manage_account_password_requests` is absent (403, no DB write, no email send); confirm reject server action rejects empty `reviewerNote` server-side independent of the client-side `required` attribute; confirm idempotent row-status check prevents double-approval when two admins race; confirm `reviewer_note` renders as plain text even when DB row contains HTML or script tags; confirm audit rows are written with the correct `actor_staff_id` for the reviewer.

---

## Copy

Voice: calm, plain, direct, kind. Verbs over nouns. Encouraging empty states; specific errors; no raw permission names.

### Form labels

- Approve modal textarea: `Note (optional)` — placeholder `Anything you want the requester to see in the email.` Counter: `{N} / 240`.
- Reject modal textarea: `Reason for rejection` with required `*` marker (Cancelled text colour, `aria-hidden="true"`) — placeholder `What should the requester know?` Counter: `{N} / 240`.
- Status filter tab strip (each pill is a labelled link): `Pending`, `Approved`, `Rejected`, `Expired`, `All`. Active tab carries `aria-current="page"`. Active Pending tab includes count: `Pending (3)`.

### Form button text

| Slot | Text | Variant |
|---|---|---|
| Per-row approve trigger | `Approve` | Primary |
| Per-row reject trigger | `Reject` | Destructive |
| Per-row audit link | `Open audit row` | Ghost |
| Approve modal confirm | `Send approval email` | Primary |
| Reject modal confirm | `Send rejection email` | Destructive |
| Both modal cancels | `Cancel` | Secondary |
| Empty-state CTA (non-Pending tabs) | `Show pending` | Ghost |
| Race-condition recovery | `Refresh now` | Ghost |
| Load failure retry | `Try again` | Ghost |

### Error messages

- Reject note empty (client + server): `Add a note before rejecting. The requester needs to know why.`
- Email-send failure: `Couldn't send the email. Try again in a minute.`
- Race condition (row already reviewed): `This request was just reviewed by {other reviewer}. Refresh to see the latest.`
- Self-approval attempt (per §10.2): `You can't approve your own request. Ask another owner or admin to review.`
- List load failure: `Couldn't load requests. Try refreshing the page.`
- Permission changed mid-session: `Your access has changed. Refresh to continue.` (toast, persistent)
- Note over 240 chars: `Trim the note to 240 characters or fewer.`

### Empty-state text

| Tab | Heading | Body | CTA |
|---|---|---|---|
| Pending, zero | `All caught up` | `No password-reset requests are waiting for review.` | — |
| Approved, zero | `No approved requests yet` | `Once you approve a request, it'll appear here.` | `Show pending` |
| Rejected, zero | `No rejections` | `Once you reject a request, it'll appear here.` | `Show pending` |
| Expired, zero | `No expired requests` | `Requests left unreviewed past their deadline appear here.` | `Show pending` |
| All, zero | `No requests yet` | `Password-reset requests appear here as staff submit them.` | — |
| Denied (Coordinator / Therapist) | `You don't have access to this section` | `Password-reset reviews are restricted to the practice owner and admin. Contact one of them if you think this is a mistake.` | `Back to dashboard` |

### Tooltip text

- Status badge on row: native `title` shows the absolute timestamp, e.g. `Submitted 12 May 2026, 19:42 BST`.
- Truncated email (mobile overflow): `title` reveals full address.
- "Open audit row" Ghost (Admin only, hidden in this brief — but if surfaced as disabled): `Audit access is owner-only`.
- Pending-row "Expires in {time}" line under 1 hour: native `title` — `Expires soon: less than {N} minutes left.`
- Approve modal Primary in loading state: `aria-busy="true"` is the announcement; no visible tooltip.
- Reviewer-note well "Show full note" trigger: native — none beyond visible label.

### Confirmation dialog text

**Approve modal** (first wire-up of `ConfirmActionModal` per brief 00)
- Heading: `Approve this request?`
- Body: `An approval email with a one-time reset link will be sent to {email}. The link expires in 24 hours.`
- Primary: `Send approval email`
- Secondary: `Cancel`

**Reject modal**
- Heading: `Reject this request?`
- Body: `A rejection email will be sent to {email}. The requester will see the note you write below.`
- Destructive: `Send rejection email`
- Secondary: `Cancel`

**Toasts**
- Approve success: `Approval email sent to {email}.`
- Reject success: `Rejection email sent to {email}.`
- Both errors: `Couldn't send the email. Try again in a minute.` (persistent, Retry Ghost)

