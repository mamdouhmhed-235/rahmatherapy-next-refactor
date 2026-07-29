# Band C — Owner Action Backlog

Consolidated tracking of every item across the programme that only the Owner can perform — because it needs admin sign-in (no agent may authenticate; password entry is prohibited) or is a Zone-2 action awaiting explicit chat approval. Introduced at drift checkpoint #1 (2026-07-29, `redesign/plans/C-phase/DRIFT-CHECKPOINTS.md`) to replace five separate progress-file appendices with one running list. Each entry links back to its plan's progress file for full detail — this file is the index, not the source of truth.

**How to use this:** items don't block a plan's ✅ shipped status (established precedent: C-06, C-22, C-04a, C-05 all shipped with items here still open) — they're independently-tracked follow-up work. Check items off in place (change ⬜ to ✅) as the Owner completes them; leave the row for audit trail rather than deleting it.

---

## ⛔ Zone-2 — awaiting explicit chat approval (not just sign-in)

| Item | From | Status | Detail |
|---|---|---|---|
| ⬜ Cloudflare Workers deploy | C-22, C-04a | **Presented in chat 2026-07-29, awaiting Owner answer.** | Three-in-one: applies C-22's `RateLimiter` Durable Object migration, activates the `* * * * *` scheduled-emails cron, and is the only thing that drains C-04a's cancellation-email queue. Growing — C-01 (plan #6, next) adds more cron work before this is applied. |
| ⬜ `src/lib/maintenance.ts` restore to `MAINTENANCE_MODE = true` | Standing (protocol §3b) | Not yet — deliberately left `false` all programme, Owner-authorized. | **Must happen before any deploy**, including the Cloudflare deploy above. Never staged/committed mid-programme by design. |

## Playwright role sweeps + screenshots (agent cannot authenticate)

| Plan | Item | Fixture(s) | Progress file |
|---|---|---|---|
| ⬜ C-06 | §3.2e/f/g — irreversible sensitive-note deletion, bulk delete, privacy `deletion_review` completion (skipped by Owner decision — consumes fixtures later plans need; covered by unit specs instead) | `Audit Test Client *` | `C-06-client-crud-hardening-progress.md` (top-of-file callout) |
| ⬜ C-22 | §3.2 + §3.7 (need production writes + real emails) · §3.5/§3.5a (structurally impossible pre-deploy — limiter fails open under `next dev`; must run post-deploy) | n/a (rate-limit/honeypot live checks) | `C-22-booking-form-abuse-protection-progress.md` |
| ⬜ C-04a | §3.2 (4-role × 4-viewport sweep, 14 steps) + §3.3 (5 screenshots) | `d8a61721` (both email fields NULL — zero email risk) | `C-04a-cancellation-restore-progress.md` §0k |
| ⬜ C-05 | §3.2 (16-step sweep) + §3.4 (screenshots) | `eaafbb1a` (cancelled), `1d503d3b` (past-dated, B-171 repro) | `C-05-cancelled-bookings-inert-progress.md` §3 |

**Never use in any sweep:** booking `9d55ce2a-7a76-42ed-9166-a33fa66ee7fe` (Badar — real customer, real email) or the Owner's own `rahmatherapy@outlook.com` in any email-test path.

## Logged-not-fixed technical items (no live affordance, no urgency, informational)

| Item | From | Why it's not urgent |
|---|---|---|
| Direct-POST-only state transitions unguarded (`cancelled→confirmed`, `cancelled→no_show`, `X→X` — 5 of 7 informally-implied sites) | C-04a note → C-05 (out of C-05's actual scope) | No live UI path reaches these; hand-crafted POST only |
| `updateBookingManagement`/`quickUpdateBooking`/`respondToCustomerReschedule` don't consult `bookings.deleted_at` | C-06 §8 → C-05 (narrowed to 2 of 11 sites) | Unreachable — C-06's cascade already forces soft-deleted bookings to `cancelled`/`completed`, both inert via existing status checks |
| Two duplicate `MISSING_COLUMN_CODES`/`hasErrorCode` shims (C-06's + C-04a's), both dead | Drift checkpoint #1 | Inert pre-migration guards; share+retire when C-02/C-08/C-14 next need the shape |
| `staff_permission_overrides` upsert lacks `service_role` UPDATE grant, breaks per-staff permission saves (0 rows ever written) | C-04a §0f | Owner explicitly scoped the C-04a grant fix to `email_delivery_events` only; this table's fix deferred |
| `resend_booking_emails` permission-row existence unverified | Migration ledger | Read-only spot-check scheduled at C-08's own pre-flight |

---

*Updated at each drift checkpoint (#1: 2026-07-29) and whenever a plan ships with new deferred items. See `redesign/plans/C-phase/DRIFT-CHECKPOINTS.md` for the checkpoint that introduced this file.*
