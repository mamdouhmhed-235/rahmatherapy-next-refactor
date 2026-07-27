# C-06 — Client CRUD hardening — PROGRESS

**Plan:** `redesign/plans/C-phase/C-06-client-crud-hardening-plan.md`
**Brief:** `redesign/briefs/C-06-client-crud-hardening-brief.md`
**Programme:** Band C, C-C implementation — plan **#3 of 22** (§4 order). Main-chain start.
**Started:** 2026-07-27 · orchestrated session (implementer + independent verifier per phase)
**Predecessor plan closed at:** `d1630af` (C-22)

> ## ⏸ STATUS: IN PROGRESS — Phases A, B, C landed. Phases D, E (migration), F outstanding.
> **Last good commit:** `1b802ed` · **Next action:** Phase C verifier result → then Phase D (Steps 9–10, `deleteClient` + delete UI).
> This file is written incrementally so the plan can be resumed from git alone (protocol §3).

---

## 1 — Commits so far

| # | SHA | Phase | Message |
|---|---|---|---|
| 1 | `5398837` | A | `feat(redesign): C-06 Phase A — DuplicateWarningBanner extract + RBAC helpers + deleted_at type` |
| 2 | `7ebdb25` | B | `feat(redesign): C-06 Phase B — client_id plumbing + duplicate warning on manual booking` |
| 3 | `065c659` | B fix | `fix(redesign): C-06 — p_raise_on_duplicate so public bookings never 409 on a returning customer` |
| 4 | `83724b8` | docs | `docs(redesign): C-06 Step 12 SQL corrections — p_raise_on_duplicate + soft-delete clash guard (Owner-approved)` |
| 5 | `c20dc5e` | B fix | `test(redesign): C-06 Phase B — duplicate-flow + client_id specs, pin raiseOnDuplicate` |
| 6 | `1b802ed` | C | `feat(redesign): C-06 Phase C — updateClient + client edit route + detail Edit button` |

Not pushed.

---

## 2 — Owner decisions recorded (all 2026-07-27, in chat)

1. **⏸ Protocol §1.3 backup precondition — SATISFIED via option (b).** The Owner **explicitly accepts applying the programme's first migration without a backup or PITR point** (backup/DR remains Owner-deferred per `BAND-C-REFINEMENT-2026-07-26.md` §6.1). Mitigation adopted: capture the current 14,686-character `create_booking_request` body verbatim **before** applying, so the rollback in plan §5.1 is exact rather than reconstructed.
2. **Soft-delete read posture (plan §4.1 / §9.1): leave reports UNFILTERED.** Filter `deleted_at IS NULL` only on the working surfaces C-06 touches. `reporting.ts` stays untouched — RECON §5 permits additive changes only, and filtering is subtractive; it would silently change historical revenue figures. Rationale: the booking was real revenue; only the client record is scrubbed. The full read-path grep is logged as a follow-up inventory rather than actioned.
3. **`p_raise_on_duplicate`** — see §3 below.
4. **Soft-delete clash guard** — see §3 below.

---

## 3 — ⚠️ TWO PLAN DEFECTS FOUND AND CORRECTED BEFORE THE MIGRATION

Both were defects in the **plan's own Step 12 SQL**, not in anyone's implementation. Both were caught by adversarial review of the plan against the live schema, and neither was reachable by any static gate. Corrections are committed into the plan text at **`83724b8`** — **Phase E must build the migration from the corrected plan §1 Step 12, never from memory.**

### 3.1 — Every returning public customer would have received a 409

Plan branch 2 raised `duplicate_client_exists` whenever a non-deleted client already held the submitted email and `p_confirm_duplicate` was false. `src/app/api/bookings/route.ts:103` calls `createBookingTransaction(parsed.data, supabase)` passing **neither** param, so both defaulted — meaning every repeat public booking would fail. Verified live: **2 clients already have repeat bookings**; 4 bookings are website-sourced. `booking_source` is **not** a usable discriminator (the admin form lets staff choose "website" from the enum).

**Owner-approved fix:** a third appended RPC param **`p_raise_on_duplicate boolean DEFAULT false`**.

| Caller | `p_client_id` | `p_confirm_duplicate` | `p_raise_on_duplicate` | Duplicate-email outcome |
|---|---|---|---|---|
| Public `route.ts` | — | — | **false** (default) | Silently links to the existing client. **No 409.** No field overwritten. |
| Admin `createManualBooking` | when prefilled | when acknowledged | **true** | Raises → warning banner → admin acknowledges → links. |

The flag controls **only whether we warn** — never whether we overwrite. `DO UPDATE` → `DO NOTHING` kills the destructive overwrite for *both* paths. `route.ts` stays on the UNCHANGED list, untouched.

### 3.2 — A public booking against a soft-deleted client's email would have crashed

Verified live: `bookings.client_id` is **NOT NULL**, and `clients_email_key` is a **plain** unique index (`CREATE UNIQUE INDEX clients_email_key ON public.clients USING btree (email)` — no partial predicate).

Once a client with email `E` is soft-deleted — a state **C-06's own Phase D creates** — a public booking with `E`: the dup-check filters `deleted_at IS NULL` → no match → `ON CONFLICT (email) DO NOTHING` collides with the erased row → 0 rows → the re-fetch also filters `deleted_at IS NULL` → NULL → `INSERT INTO bookings (client_id, …)` NULL → **raw `23502` not_null_violation**, echoed verbatim to the customer by `route.ts:145`.

**Owner-approved fix:** a **soft-delete clash guard** — the RPC raises `client_record_removed` (P0001) instead of falling through.
**Phase E must also** map `client_record_removed` inside `createBookingTransaction.ts` (already on the files-touched list) to a customer-safe `BookingCreationError` message offering the clinic phone. **Do NOT edit `route.ts`.**
**Follow-up recorded, deliberately NOT bundled:** a partial unique index `WHERE deleted_at IS NULL` is the better long-term data model, but it would drop and recreate an existing constraint *and* force `ON CONFLICT (email)` to carry the predicate for index inference — too much added blast radius on the band's riskiest migration, against a database with no backup.

---

## 4 — ⚠️ HARD PRECONDITIONS FOR PHASES D / E

### 4.1 — `deleted_at` is typed but selected nowhere (invisible to every static gate)

Phase A added `deleted_at` to `ClientRecord` / `ClientBookingRecord`, but it appears in **none** of the 10 `.select(...)` column strings across `clients/page.tsx` (4) and `clients/[clientId]/page.tsx` (6). Every read goes through an unchecked `.returns<>()` / `.single<>()` cast, so **tsc can never catch this**.

If not fixed, `if (client.deleted_at) notFound()` reads `undefined` and **silently never fires** — soft-deleted clients stay fully visible, reinstating the exact GDPR "UI lie" C-06 exists to kill, while passing tsc, lint **and** vitest. (Proof the compiler is blind here: `ClientRecord.notes` is already a required field absent from `CLIENT_SELECT`, and nothing flags it. Pre-existing — logged, not fixed, per protocol §1.6a.)

**Phase D/E must:**
1. Add `deleted_at` to **`CLIENT_SELECT` and `CLIENT_SAFE_SELECT` in both files** — missing either RBAC branch reopens the hole for that role only — plus the relevant `BOOKING_*` constants.
2. Resolve the `TODO(C-06 Phase E)` at `src/app/admin/clients/[clientId]/edit/page.tsx:71-74` (the soft-delete 404, deliberately deferred because the column does not exist yet).
3. **Verify at runtime, per role — not by type-check.** A soft-deleted fixture client must 404 on detail and drop off the list.

### 4.2 — Phase E post-apply verification must include the permissions check

Plan §3.4 omits it. Run `SELECT name FROM public.permissions WHERE name IN ('manage_client_identity_fields','manage_client_destructive_ops')` → expect 2 rows, plus the `role_permissions` grants for Owner + Admin only. The Phase A spec named "keeps the permission names aligned with the seeded DB values" is **tautological** — it asserts a literal against itself and never queries the database.

### 4.3 — Interim state, expected, not a defect

- **Booking creation currently fails locally with `PGRST202`.** Phase B's code sends three RPC params the un-migrated function does not accept, and Supabase resolves overloads by exact argument-key set. Local dev server only — production runs deployed code. **Nothing is deployable between Phase B and Phase E.**
- **`canManageClientIdentityFields()` returns `false` for everyone**, including Owner, because the permission row does not exist yet and `hasPermission` has no Owner bypass. So the edit form locks full name / email / gender preference for all roles. Self-resolves when Phase E's migration inserts and grants the permission.

---

## 5 — Phases landed

### Phase A — foundation (`5398837`)
`DuplicateWarningBanner` extracted verbatim to `src/app/admin/clients/components/` (byte-identical apart from `export`; the moved `ATTENTION_*` constants and `AlertCircle` import were proven to have zero remaining references). Two `PERMISSIONS` constants + `canManageClientIdentityFields` / `canManageClientDestructiveOps` helpers, with 5 specs. `deleted_at` added to the client types.

**Recorded judgement calls (both ruled correct by the verifier):**
- The helpers gate on `profile?.active && hasPermission(...)` rather than bare `hasPermission`, because Step 2 simultaneously demanded "follow the existing `hasPermission` pattern" **and** "return false for an inactive profile" — only the gated form satisfies both. Precedent: `canClaimAssignments` in the same file. The gate is strictly restrictive, so it cannot over-grant.
- `ClientBookingRecord.deleted_at` is **optional**, not required, because two fixture files outside the permitted list build full literals and a required field would have broken tsc in files the implementer was forbidden to edit (protocol §1.6b). Optional also matches that interface's existing convention — it already carries 10 optional fields for the same RBAC-conditioned-select reason.

### Phase B — the headline fix (`7ebdb25` + `065c659` + `c20dc5e`)
Hidden `client_id` input, `confirm_duplicate` acknowledgement, `DuplicateClientError`, and the duplicate-warning surface on the manual booking form. Plus the two Owner-approved corrections in §3.

**Expected shrinkage CONFIRMED:** `createBookingTransaction` :: *"normalizes a single public booking into the RPC payload"* has been **removed from the baseline failure list**. The verifier ruled it **legitimately fixed and in fact strengthened** — the spec diff is six additions and zero deletions, the assertion remains exact deep-equality (not `objectContaining`), and the three keys it had been missing (`p_area`, `p_override_availability`, `p_participant_service_slugs`) were already being sent before this plan. A stale spec, not a code defect, and not weakened into passing.

**Notable design points:**
- The catch narrows on **both** SQLSTATE `P0001` **and** the `duplicate_client_exists` message prefix. Necessary: of the live RPC's 15 `RAISE EXCEPTION` calls, **14 are bare** and therefore default to P0001, so matching on the code alone would misclassify ordinary validation failures ("Contact full name is required") as duplicates.
- `DuplicateClientError`'s public `message` is a PII-free constant; the matched client's id and name ride as typed properties the public route never emits.
- The banner sits inside `<form>` but **outside** all step containers. Non-active steps carry Tailwind `hidden` (`display:none`), and the acknowledgement checkbox is `required` — inside a step container it would be a non-focusable invalid control and Chrome would silently refuse to submit. This also satisfies brief §5.1's "banner persists across step navigations", resolving an internal contradiction in that section.
- Checkbox copy on this form reads **"Use the existing client record for this booking."** `clients_email_key` is UNIQUE, so `ON CONFLICT (email) DO NOTHING` + re-fetch can only ever **link** — the inherited "Create a separate client profile anyway" would have been a lie here. `ClientCreateForm` keeps the original copy via a defaulted prop and is byte-identical.
  - **⚠️ Phase F note:** on the phone-dedup branch (no email), acknowledging genuinely *does* create a new NULL-email client, so this label becomes inaccurate there. Unreachable today (email still required). Revisit when Step 13b relaxes the schema — the label may need to be branch-aware.

### Phase C — edit surface (`1b802ed`)
`updateClient` server action, `/admin/clients/[clientId]/edit` route + form, Edit button on the detail header. 10 new specs.

- **Field-level RBAC is enforced server-side**, not just by disabled inputs: identity keys are deleted from the patch before any query, so they reach neither the UPDATE nor the audit diff. Locked fields render `disabled` **and nameless** with a hidden twin carrying the unchanged value (disabled controls submit nothing, and the schema would otherwise reject).
- **Optimistic concurrency** via a `client_updated_at` token compared before any write, backed by the `clients_updated_at` BEFORE UPDATE trigger.
- **Plan/brief divergence, resolved plan-faithfully:** plan Step 8 gates the Edit button on `canManageAllBookings`; brief §2.2 says `canManageAllClients`. Verified equivalent for every live role today (Owner/Admin/Coordinator hold both; Therapist holds neither), so behaviour is identical either way. Followed the plan. **Flagged for the Owner:** gating a *client-edit* affordance on a *booking* permission is a latent hazard if those permissions ever diverge.
- `?updated=1` is emitted but not yet consumed — the flash-toast surface lands in Phase D (Step 10).

---

## 6 — Baseline identity (current, after Phase C)

- **tsc:** 0 errors · **lint:** 59 errors / 7 warnings, same 6 files as the programme baseline
- **vitest: 5 failed / 540 passed / 545**
  1. `src/lib/auth/admin-access.test.ts` :: admin access matrix gives Owner broad access while keeping owner-only role actions permission-gated
  2. `src/lib/auth/admin-access.test.ts` :: admin access matrix gives Admin broad operational access without role template management
  3. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` :: ManualBookingForm renders step 1 on first load
  4. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` :: ManualBookingForm moves focus to the first invalid field when continuing with errors
  5. `src/app/admin/bookings/new/ManualBookingForm.test.tsx` :: ManualBookingForm shows the consent error when trying to create booking without consent

`createBookingTransaction` is **no longer** a baseline failure — the plan's expected shrinkage, confirmed. `canonical-domain.test.ts` (C-21 tripwire) stays 3/3.

---

## 7 — Outstanding

- Phase D (Steps 9–10): `deleteClient` + `adminDeleteClient` + `bulkDeleteClients`, delete button, bulk toolbar, "Show deleted (N)" toggle. **Step 9.6 audit-log anonymisation is SKIPPED** — `audit_logs.target_label` does not exist (verified live; the plan already permits skipping). **Step 2b recurring-template cascade must treat undefined-table (SQLSTATE 42P01) as a clean no-op** — `recurring_booking_templates` does not exist until C-02.
- Phase E (Steps 11–12): privacy wiring + JSON export + **⛔ the migration** (Zone-2, orchestrator-only, built from the corrected plan §1 Step 12).
- Phase F (Step 13): email-optional admin booking.
- Full §3 verification gate, evidence into `redesign/evidence/C-06/`, master-plan row → ✅.

**Bonus finding for a later plan:** `resend_booking_emails` **exists** in `public.permissions` (verified live 2026-07-27) — this closes the one open verification item the migration ledger carried into C-C for **C-08**'s pre-flight.

---

*C-06 in progress. This file is updated as phases land.*
