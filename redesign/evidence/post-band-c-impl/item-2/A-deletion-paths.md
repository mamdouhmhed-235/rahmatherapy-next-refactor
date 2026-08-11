# Item 2 — Deletion-paths verification (privacy-policy rewrite)

Repo: `C:\Users\mamdo\Desktop\rahmatherapy - Copy\rahmatherapy-next-refactor`
Method: every claim below was tested against the live tree with ripgrep/Read; commands and actual output are shown. No source files were modified (read-only agent).

---

## Claim 1 — "Nothing in the codebase deletes anything BY AGE"

**Verdict: CONFIRMED.** No age/date-triggered deletion exists anywhere in `src/` or `supabase/migrations/`.

Searched:
- `src/app/api/cron/**` (all 4 cron routes, read in full)
- `retention|purge|prune|expire|expiry|pg_cron` across `src/` and `supabase/`
- Every `.delete()` call site in `src/` (17 total, see Claim 2) and every `DELETE FROM` in `supabase/migrations/**`
- `.delete()` calls followed by `.lt/.lte/.gt/.gte(...)` (date-comparison guards) — none found
- `wrangler.jsonc` cron trigger list, cross-checked against the 4 routes

### Every DELETE-capable candidate found, and why none is age-triggered

**A. The 4 Cloudflare cron routes** (`wrangler.jsonc` line 71: `"crons": ["0 8 * * *", "* * * * *", "*/15 * * * *", "0 3 * * *"]`, each dispatched to one route):

| Route | Schedule | What it does | Deletes? | Age-triggered? |
|---|---|---|---|---|
| `booking-reminders/route.ts` | daily 08:00 | Sends reminder emails for tomorrow's bookings | No `.delete()` at all | N/A |
| `scheduled-emails/route.ts` | every minute | Drains a queued-email table, flips `delivery_status` to `sent`/`failed` | No `.delete()` at all — it's an UPDATE-only queue drain | N/A |
| `review-emails/route.ts` | every 15 min | Sends "leave a review" emails for completions 2h–7d old | No `.delete()` at all | N/A |
| `extend-recurring-horizons/route.ts` | daily 03:00 | Materialises future occurrences of recurring booking series | Yes — 4 `.delete()` calls, lines 569–572 | **No.** They live in `rollbackOccurrence()`, a best-effort undo that fires only when an INSERT of a newly-created occurrence fails partway through (participant/item/assignment insert error). It deletes the just-created booking's own child rows by `booking_id`/`id` equality — not by age. Nothing here is guarded by a date/age comparison. |

**B. Non-cron `.delete()` sites in `src/`** — see the full classification table in Claim 2. All 13 non-cron sites are admin server actions gated by `requirePermission`/role checks, each deleting an explicit row by `id` (or `override_date`/`template_id`) supplied in the request — never by "older than X". None reads `now() - interval` or compares a stored timestamp before deleting.

**C. `supabase/migrations/**`** — `DELETE FROM` appears only twice, both in `20260809120000_c14_save_availability_day.sql` (lines 294, 377), both inside `create or replace function` bodies for saving one staff/global availability day; both delete rows scoped to the specific date/staff being saved, not by age. The only other `delete`/`drop table` hits are one-time RBAC-consolidation migration cleanup (`20260509143000_granular_rbac_consolidation.sql`) removing seed/staging tables, and commented-out `DROP TABLE IF EXISTS ...` rollback notes in migration headers (never executed).

**D. `retention`/`purge`/`prune`/`expire`/`pg_cron` grep hits** — 43 files in `src/` and 6 in `supabase/migrations/` matched, but every one is a false positive on a different meaning of the word:
- Token/session **expiry** (`manage-token.ts`, password-reset `Expired.tsx`, `account_password_requests` status `'expired'` for a TTL'd approval token) — these expire a *token*, not a data row.
- A trigger named `clear_payload_trigger` (`20260521150000...sql`) that nulls out a `payload` column when an account-password-request reaches `rejected`/`expired` status — clears one JSON column, does not delete the row.
- UI copy like "Awaiting longest", dashboard "Avg response time" labels, and code comments using "expired" colloquially (e.g. booking-detail guard comments).
- `pg_cron` / `cron.schedule(...)`: **zero matches** anywhere in `supabase/`. There is no Postgres-side scheduled job at all; the only scheduling mechanism in this repo is the Cloudflare Worker's `wrangler.jsonc` crons table above.

**Conclusion:** the plan's core claim holds. There is no code path — cron, trigger, function, or otherwise — that deletes a row because it has aged past a threshold.

---

## Claim 2 — "17 .delete() call sites exist in src/"

**Verdict: CONFIRMED, exact count.**

```
rg -n "\.delete\(\)" src --type ts | wc -l
17
```

All 17, table + one-line classification (age-based: all No):

| # | File:Line | Table | Trigger | Age-based? |
|---|---|---|---|---|
| 1 | `api/cron/extend-recurring-horizons/route.ts:569` | `booking_assignments` | Rollback of a failed occurrence insert (cron) | No |
| 2 | `api/cron/extend-recurring-horizons/route.ts:570` | `booking_items` | same rollback | No |
| 3 | `api/cron/extend-recurring-horizons/route.ts:571` | `booking_participants` | same rollback | No |
| 4 | `api/cron/extend-recurring-horizons/route.ts:572` | `bookings` | same rollback | No |
| 5 | `admin/staff/actions.ts:655` | `staff_availability_rules` | `deleteStaffAvailabilityRule` — admin deletes one rule by id | No |
| 6 | `admin/staff/actions.ts:743` | `staff_permission_overrides` | `updateStaffPermissionOverride` — admin sets override to "inherit" | No |
| 7 | `admin/availability/actions.ts:144` | `availability_rules` | `deleteAvailabilityRule` — admin deletes one rule by id | No |
| 8 | `admin/availability/actions.ts:229` | `blocked_dates` | `deleteBlockedDate` — admin deletes one blocked date | No |
| 9 | `admin/availability/actions.ts:314` | `availability_overrides` | `saveAvailabilityOverride` — delete-then-reinsert for one date | No |
| 10 | `admin/availability/actions.ts:384` | `availability_overrides` | `deleteAvailabilityOverride` — admin deletes one date's rows | No |
| 11 | `admin/roles/actions.ts:164` | `role_permissions` | Revoke one role↔permission grant | No |
| 12 | `admin/services/actions.ts:232` | `services` | Admin deletes a service (blocked if it has booking snapshots) | No |
| 13 | `admin/staff/[staffId]/availability/actions.ts:159` | `staff_blocked_dates` | Admin deletes one staff closure by id | No |
| 14 | `admin/staff/[staffId]/availability/actions.ts:333` | `staff_availability_overrides` | Admin deletes one date's override rows | No |
| 15 | `admin/clients/actions.ts:630` | `client_notes` | **`deleteClient()`** — hard-deletes rows where `is_sensitive = true` for the target client (see Claim 3) | No (fires on explicit admin/erasure action, not row age) |
| 16 | `admin/email-templates/actions.ts:194` | `email_template_overrides` | Field cleared → delete the override row (revert to default) | No |
| 17 | `admin/email-templates/actions.ts:308` | `email_template_overrides` | `resetTemplateToDefault` — delete all override rows for a template | No |

This matches the plan's "17" exactly — no correction needed here.

---

## Claim 3 — `deleteClient()` exists, is permission-gated, hard-deletes sensitive notes, and is invoked from `updatePrivacyRequestStatus()`

**Verdict: CONFIRMED**, with real line numbers (file: `src/app/admin/clients/actions.ts`):

- **Exists:** `export async function deleteClient(...)` — line 504.
- **Permission-gated:** lines 516–523. It re-derives the permission itself rather than trusting the caller:
  ```
  const permitted =
    reason === "gdpr_erasure"
      ? getClientDataAccess(profile, { hasAssignedBooking: false }).canManagePrivacyOperations
      : canManageAllClients(profile) && canManageClientDestructiveOps(profile);
  if (!permitted) return { success: false, error: "Insufficient permissions." };
  ```
- **Hard-deletes sensitive notes:** lines 628–633:
  ```
  const notes = await adminClient
    .from("client_notes")
    .delete()
    .eq("client_id", clientId)
    .eq("is_sensitive", true)
    .select("id");
  ```
  (Comment directly above, line 626–627: "Hard delete, not soft: UK GDPR Article 17 means special-category health data has to actually disappear.")
- Everything else in the client record is **soft**-deleted (`clients.deleted_at` stamped, line 648–651) and open bookings are cascade-cancelled (lines 600–621); completed bookings are explicitly never touched (comment lines 586–588: "a tax + ICO record").
- **Invoked from `updatePrivacyRequestStatus()`:** confirmed in `src/app/admin/privacy/actions.ts`.
  - `import { deleteClient } from "../clients/actions";` — line 8.
  - `updatePrivacyRequestStatus` — line 26.
  - Call site — lines 100–105, gated to fire only when `status === "completed"` **and** `request_type === "deletion_review"` (lines 93–96):
    ```
    const erasure = await deleteClient(
      before.client_id,
      "gdpr_erasure",
      adminClient,
      actor.id
    );
    ```

All four sub-claims (exists / gated / hard-deletes sensitive notes / invoked from `updatePrivacyRequestStatus`) check out exactly as stated.

---

## Claim 4 — Is the erasure right actually operable end-to-end for a member of the public?

**Verdict: Operable, but entirely staff-mediated — not a self-service/automated path.** The specific sentence tested — "anyone can ask … using the contact details in section 1" — is **TRUE as the intake channel**, but only because a human staff member manually keys the request in; there is no public form, API endpoint, or automatic ingestion.

Traced mechanism, in order:

1. **Intake — email/phone only.** There is no public-facing route or form in `src/app/(public)/**` or `src/app/api/**` that writes to `client_privacy_requests`. The only two `INSERT`s into that table both live in `src/app/admin/clients/actions.ts` and `src/app/admin/privacy/actions.ts`, both behind `requirePrivacyManager()` / `MANAGE_PRIVACY_OPERATIONS`. Confirmed by exhaustive listing: `src/app/(public)/**` contains only content pages (home, services, areas, about, faqs, reviews, cookies, privacy) — no contact/enquiry submission route exists under `src/app/api/**` either (verified via glob: only bookings, availability, cron, consent-events, admin/availability routes exist). So a member of the public's only channel is literally the email/phone in section 1 of the privacy page, exactly as the new copy will say.

2. **Staff creates the request record.** `createClientPrivacyRequest()` (`src/app/admin/clients/actions.ts:833`) is a `requirePrivacyManager()`-gated server action, wired to a form on the client detail page (`src/app/admin/clients/[clientId]/ClientDetailForms.tsx:8,202`). The admin privacy queue's own empty-state copy confirms this is the intended workflow (`src/app/admin/privacy/page.tsx:580`): *"Create one from a client detail page when a customer asks for export, correction, deletion review, or sensitive-note review."* This requires the customer to already correspond to (or be creatable as) a `clients` row — there is no path for a request untethered to a client record.

3. **Staff completes it → cascade fires.** Setting the request's status to `completed` via `updatePrivacyRequestStatus()` (Claim 3) triggers `deleteClient()` when `request_type === "deletion_review"`, which is real, working code (cascades booking cancellation, hard-deletes sensitive notes, soft-deletes the client). It is idempotent and reachable by any staff member holding `MANAGE_PRIVACY_OPERATIONS`.

**So:** the mechanism is real and functional end-to-end, but it is manual/staff-operated at every step after the initial email or call — there is no automated public intake form, no ticket auto-creation, and no self-service deletion button for the public. The proposed copy "anyone can ask … using the contact details in section 1" does not overclaim, because it only promises a contact channel, not a self-service system — but it should not be read as implying an automated online request flow, because none exists.

---

## Claim 5 — Does anything promise or imply a response time?

**Verdict: FALSE — no such promise exists anywhere in the codebase.**

Searched the public privacy page (`src/app/(public)/privacy/page.tsx`, read in full — section 7 "Your rights" says only *"To use any of these rights, contact us using the details in 'Who we are' above"*, no timeframe), the admin privacy operations page/actions, and grepped `src/` broadly for response-time phrasing (`within \d+ (day|days|week|month|hour)`, `respond within`, `response time`, `working days`, `1 month`, `30 days`, `28 days`). All hits were unrelated: dashboard "Avg response time" is an *enquiry-contact* KPI label (nothing to do with privacy requests), and the "28 days" hits are all the booking-cancellation restore window (`admin/bookings/_helpers.ts`, `admin/bookings/actions.ts`) — an unrelated feature. No email template, no UI copy, and no code comment anywhere commits to a response SLA for a privacy/erasure request. The admin privacy queue does surface an internal "oldest open request" staleness metric (`admin/privacy/page.tsx:365-368`), but that is an internal ops dashboard stat, never customer-facing copy or a promise.

---

## Wording hazards found in the CURRENT public copy (context for the rewrite)

Not one of the 5 claims above, but directly relevant to why the rewrite is needed: the **current live copy** at `src/app/(public)/privacy/page.tsx`, section 6 ("How long we keep it"), already says:

> "Our policy is to keep booking and treatment records for 7 years after your last visit with us. If you make an enquiry that doesn't turn into a booking, we keep it for around 12 months."

Per Claim 1, **no code enforces either figure** — there is no 7-year or 12-month age-triggered purge anywhere in the repo. This existing text already implies scheduled/automatic deletion that the codebase does not perform. The rewrite's job is to correct this, not merely avoid introducing a new problem.

---

## Answers to the structured questions

- **Age-triggered deletion exists?** No — confirmed false, exhaustively.
- **`.delete()` call-site count in `src/`?** 17 — confirmed exact.
- **`deleteClient()` claim?** Confirmed in full (exists, gated at lines 516–523, hard-deletes sensitive notes at lines 628–633, invoked from `updatePrivacyRequestStatus()` at `privacy/actions.ts:100`).
- **Erasure mechanism:** Email/phone-only intake (no public form exists) → staff manually creates a `client_privacy_requests` row from the client's admin profile → staff marks it `completed` → `deleteClient()` runs. Fully staff-mediated, not self-service.
- **Response-time promise?** None exists anywhere in the codebase.
