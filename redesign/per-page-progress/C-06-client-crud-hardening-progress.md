# C-06 — Client CRUD hardening — PROGRESS

**Plan:** `redesign/plans/C-phase/C-06-client-crud-hardening-plan.md`
**Brief:** `redesign/briefs/C-06-client-crud-hardening-brief.md`
**Programme:** Band C, C-C implementation — plan **#3 of 22** (§4 order). Main-chain start.
**Started:** 2026-07-27 · orchestrated session (implementer + independent verifier per phase)
**Predecessor plan closed at:** `d1630af` (C-22)

> ## ✅ STATUS: SHIPPED — all six phases implemented + independently verified, migration applied, §3 gate passed within the Owner-set scope.
> **Final commit:** `88d2a6d` · **18 commits** across the plan (`d1630af..88d2a6d`).
>
> **Owner decision on the closeout sweep (2026-07-27): read-only sweep + REVERSIBLE mutations only.**
> Run: the full role sweep, RBAC visibility checks, the edit happy-path, the email-collision test, and the no-email booking creation. **SKIP** the delete cascade (§3.2e), the bulk delete (§3.2f) and the privacy `deletion_review` completion (§3.2g) — those hard-delete sensitive health notes (irreversible) and consume `Audit Test Client` fixtures that later plans (C-05, C-02, C-09, C-16) still need. Record all three as NOT RUN against their unit-spec coverage.

---

## 5b — Phase F (`e5d5d47` + `c57721f`) — optional email on the admin booking flow

Email is now optional on `/admin/bookings/new` only. Phone stays required at all three layers. The confirmation checkbox is hidden **and forced false** via the hidden input when there is no address; downstream guards added to `sendBookingCreatedEmails` and the booking-reminders cron. "No email — reminders off" chip on the booking detail.

**Public-flow isolation holds — the load-bearing guarantee.** `src/app/api/bookings/route.ts` is **byte-untouched** across the entire C-06 range (blob hash identical at both ends). Both a missing-email and an `email: ""` payload still return 400 with the RPC and mailer never invoked. The verifier further reasoned that the RPC's null-email branch 3 is unreachable from the public path: there are only two callers, and the public one passes a `z.email()`-validated string that cannot be empty or whitespace-only.

**The acknowledge label is now branch-aware** (closes the Phase B note). Verified against the *deployed* function: on the email branch the UNIQUE index means confirming can only ever link, but on the phone branch `p_confirm_duplicate` falls through to `insert … values (…, null, …) returning id` — a brand-new NULL-email client. The old fixed label would have lied at the exact moment the admin consented to it.

**Two Phase-F fixes after the verifier returned FAIL:**
- *Lost plan step:* Step 13f bullet 2's `p_contact_email: ""` assertion in `createBookingTransaction.test.ts` had been silently dropped. Added — as a new spec, leaving that file's existing exact deep-equality assertion untouched (it is C-06's expected-shrinkage target and must stay passing).
- *A real bug Phase F introduced:* the form submitted `value={email}` **untrimmed** while every gate used `.trim()`, so a whitespace-only email matched neither union member, and the resulting `fieldErrors` are **never rendered** — the admin saw "Check the highlighted booking details" with nothing highlighted and no way out. Fixed at source (`value={email.trim()}`) plus `z.string().trim().pipe(...)` as defence in depth.
  - **Why the specs for this nearly proved nothing:** the first draft drove whitespace in by *typing*, and passed against the broken code — `<input type="email">` has an HTML value-sanitization algorithm that strips leading/trailing whitespace, which jsdom implements. The bug is only reachable via `prefillClient?.email`, `enquiry?.email`, or a restored sessionStorage draft. The specs were rewritten to seed via `prefillClient`, the true failing path, and were then demonstrated failing against the un-trimmed code.

**Also folded in:** the `admin_delete` modals in `DeleteClientButton.tsx` and `BulkDeleteToolbar.tsx` dropped "This cannot be undone." (which overstated a soft-delete) and gained the honest clause used by `PrivacyStatusForm`. The bulk modal *gained* a sensitive-notes bullet, because removing the blanket claim would otherwise have left it with no irreversibility warning at all.

### Outstanding notes from the Phase F verifier (recorded, not actioned)
1. **Staff assignment emails are now silently skipped for phone-only bookings.** `sendStaffAssignmentEmail` / `sendAssignedStaffBookingChangeEmails` throw "Booking has no contact email address.", and every call site swallows it with `.catch(console.error)`. No admin action breaks, but a therapist will not be emailed. Plan §13c scoped the guards to `sendBookingCreatedEmails` + crons, so this is plan-faithful. **C-08 follow-up.**
2. **"Only the notes are unrecoverable" is still slightly broad** — cascade-cancelled bookings lose their prior status (`pending` vs `confirmed`) with no record of it, and at HEAD there is no restore affordance at all. C-04a ships Restore next, which resolves the second half.
3. `src/app/admin/bookings/types.ts` still types `contact_email: string` against a now-nullable column — the same unchecked-cast hazard class as the `deleted_at` select gap, invisible to tsc. Not on Phase F's file list.
4. A narrow acknowledge-label staleness case: the banner stays visible while the email field is still editable, so typing a *new* unmatched address after a phone-branch warning flips the label while the next submit takes branch 2. The reverse mismatch is impossible.

---

## 0 — ⛔ MIGRATION APPLIED (2026-07-27) — Owner-approved in chat

**Applied to production `twzutkfgqclqurvkmvqz`** via `mcp__supabase__apply_migration` by the orchestrator (never a subagent — protocol §1.2).

- **Recorded version:** `20260727202424` / `c06_client_crud_hardening`
- **Repo file:** `supabase/migrations/20260727120000_c06_client_crud_hardening.sql` (698 lines)
- ⚠️ **Version-vs-filename drift:** the recorded version differs from the filename. This is the repo's **pre-existing pattern** (both Band-B migrations differ from their recorded versions too). Harmless here because every statement is idempotent — `ADD COLUMN IF NOT EXISTS`, `DROP NOT NULL`, `ON CONFLICT DO NOTHING` ×2, `DROP FUNCTION IF EXISTS` + `CREATE OR REPLACE` — so a re-apply is a no-op.

### Rollback artefact (the mitigation for applying without a backup)
`redesign/evidence/C-06/create_booking_request-BEFORE.sql` — **14,686 bytes, md5 `b44229fac5da168afb60fbd742565164`**, captured verbatim from the live function and re-confirmed byte-identical immediately before applying. Plan §5.1's rollback is therefore exact, not reconstructed.

### Fidelity — verified twice, independently
1. **Before applying:** diffed the reconstruction against the live capture. Six hunks; the only lines *removed* were the old signature, the email-required check, the destructive `on conflict (email) do update` block, one `v_normalized_email` value, and the `$function$` terminator. Every validation, the availability block, the participant/items/assignment loops and the return shape carried over untouched.
2. **After applying:** the live `pg_get_functiondef` is **byte-identical** to the reviewed reconstruction — **19,001 bytes, md5 `9ec3ca132042e3d22463de26fdc7008a`**. Zero transcription error introduced by passing the SQL through the MCP tool.

### Post-apply verification (all pass)

| Check | Result |
|---|---|
| `overload_count` | **1** — the DROP worked; no second function left behind |
| `clients.deleted_at` / `bookings.deleted_at` | both exist |
| `bookings.contact_email` | `is_nullable = YES` |
| New permissions | **2** present |
| Grants | **Admin, Owner** only — never Booking Coordinator ✅ |
| `service_role` execute grant | restored (1 row) |
| Destructive `set full_name = excluded.full_name` | **0 matches — the headline bug is gone** |
| `on conflict (email) do nothing` | 1 match (the replacement) |
| `p_raise_on_duplicate` / `client_record_removed` | both present in the body |

*Note: a naive grep for `on conflict (email) do update` still returns 1 hit — it is the explanatory **comment** describing what was replaced. The executable `set … = excluded.…` clause has zero matches, which is the check that actually matters.*

### The third plan defect, corrected in this migration
The plan specified a bare `CREATE OR REPLACE FUNCTION` with three appended parameters. **PostgreSQL identifies a function by name + argument types**, so that would have created a *second* function and left the 20-argument version — destructive `on conflict do update` and all — **live in production**, while making 20-arg calls ambiguous (`42725`). An explicit `drop function` of the exact 20-arg signature was added. Preconditions verified live beforehand: exactly **1 overload**, **0 dependent objects**; the ACL is restored by the `grant execute … to service_role` that follows (PUBLIC EXECUTE is the Postgres default).

Two smaller Owner-approved deviations: email validation relaxed to format-only-when-present (required for the phone-fallback branch to be reachable; inert today since both callers' Zod still require an email), and `category`/`scope`/`risk_level` set on the two permission rows (the table defaults would have filed two *client* permissions under "System" on `/admin/roles/[roleId]`).

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

## 6b — CLOSEOUT (§3 gate) — results

**All 18 commits:** `5398837` A · `7ebdb25` B · `065c659` B-fix · `83724b8` plan corrections · `c20dc5e` B-tests · `1b802ed` C · `7dc8f82` checkpoint · `f0487b6` D · `862115b` D-fix · `90d1558` E-code · `1b9daf4` migration applied · `624c5ab` E-fix · `96adc51` erasure copy · `e5d5d47` F · `c57721f` F-fix · `bca91c3` checkpoint · `64f6e8c` closeout fixes · `88d2a6d` closeout fixes 2.

### Phase D (`f0487b6` + `862115b`) — the delete primitive
`deleteClient` helper + `adminDeleteClient` + `bulkDeleteClients` (serial), delete button, bulk toolbar, "Show deleted (N)" toggle, row-menu item. **Step 9.6 `target_label` anonymisation SKIPPED** — the column does not exist (confirmed twice live; the plan permits skipping). Step 2b's recurring-template cascade treats a missing table as a clean no-op.

Owner-approved corrections after the verifier found a permanently-unrecoverable failure mode: **the client soft-delete moved to LAST** (a mid-cascade failure previously left the client stamped, bookings uncancelled, notes intact, no audit row — and the retry short-circuited on idempotency and reported success, so health data survived an "completed" erasure); and **`before_state` is PII-redacted for `gdpr_erasure`** via a whitelist, applied on the idempotent path too.

### Phase E (`90d1558` + `624c5ab` + `96adc51`) — privacy wiring + export + migration
The privacy "Completed" button now does what it says. Per-request-type modal copy replaced a single string that was a lie for **all four** types. JSON export per brief §2.4 with non-sensitive notes only and a 50-row audit cap. Fix round: the export now **fails loudly on a partial fetch** (it previously shipped a file claiming the data subject had no bookings, with a success toast), is reachable for an already-completed request, and its copy is pinned by spec.

### §3 gate results
| Gate | Result |
|---|---|
| §3.1 lint / tsc / vitest / build | **59E+7W identity · 0 · 5 failed 612 passed 617 · clean** |
| §3.1 bundle (+15 kB ceiling) | **≤ 1.24 kB** — and the new edit route lands *below* the existing detail route, disproving the plan's `DuplicateWarningBanner`-duplication worry |
| §3.2 RBAC role sweep, 4 roles | **PASS on every row of brief §3** |
| §3.2c edit happy path | PASS — one audit row, `after_state` = only the changed field; value restored via the UI |
| §3.2d email collision | PASS — hard error, **no** DB write, 0 audit rows |
| §3.2k no-email booking | PASS on all five criteria — `contact_email IS NULL`, no `email_delivery_events` row, chip renders |
| §3.2e / §3.2f / §3.2g | **NOT RUN — Owner-excluded** (irreversible sensitive-note deletion; consumes fixtures later plans need). Covered by `deleteClient.test.ts` + `updatePrivacyRequestStatus.test.ts`. |
| §3.2h data export / §3.2i direct RBAC invocation | NOT RUN — real PII / a server-side miss would hard-delete notes. Covered by specs. |
| §3.3 screenshots | 6 PNGs + `closeout-role-sweep.md` in `redesign/evidence/C-06/` |

### Closeout fixes (`64f6e8c`, `88d2a6d`)
- **`updateClient` had no `deleted_at` guard** — a dispatchable-server-action POST could rewrite an erased client's PII and re-add it to `audit_logs`, undoing the redaction. Guarded before the concurrency check.
- **Deleted rows' promised affordances were dead** — "View" 404'd; the audit link used `target_type=client` (singular) against rows written as `clients`. Dead link suppressed; audit link switched to `?q=<id>`, which works regardless of how the naming split is resolved.
- **`client_deleted` was in no audit family** (Owner-approved, files-list extended to `audit/format.ts`) — every family filter on `/admin/audit` excluded the only forensic record of an erasure.
- **All five cache invalidations were no-ops** (Owner-approved) — `updateTag("clients"|"bookings"|"audit")` name tags that do not exist. Replaced with the real `report-data` / `dashboard-data`, matching `createClient` in the same file.
- **375 px: the bulk "Delete selected" button was unreachable.** Root cause: an implicit grid track sized `auto` resolved to the rows' ~508 px min-content, stretching every page-level sibling to 564 px inside a 344 px container. Fixed with `grid-cols-[minmax(0,1fr)]` on the page scaffold (in-repo precedent), leaving row geometry untouched.

---

## 7 — Outstanding

### Owner actions
| # | Action |
|---|---|
| 1 | **Remove two rows the closeout sweep created** (I did not delete them): booking `d8a61721-71ec-419b-a5b9-b711f88d35bd` and client `e518393f-d5aa-42c7-b87b-52faf8526abe` (`C06 Closeout NoEmail Test`, NULL email). |
| 2 | **Fixture drift:** plan §0.6's `Audit Test Client 2/3/4/5` were renamed by a later unicode/stress audit (slot 3 is now `李小龍 …`, slot 4 `Ñoño García-López …`). Their emails still follow `audit.client.N@example.test` but their **names no longer match the DO-NOT-TOUCH safe pattern**, so later plans must not assume those fixtures. |
| 3 | Decide whether `/admin/clients/[clientId]` should render erased records read-only — brief §5.3's "View" affordance is currently absent rather than dead. |
| 4 | Decide on real PII scrubbing for `gdpr_erasure` (deferred to the compliance band; the copy is now honest either way). |
| 5 | The deferred soft-delete read-path inventory is in §8 below — several entries need a posture decision. |

### Carried to later plans
- **C-04a (next):** three specific items in §8.
- **C-05:** its hard gate on the `deleted_at` columns **will pass** — both exist, and the dependency grep matches six `feat(redesign): C-06 Phase …` commits. Its `ensureBookingActive` select is explicit and does not repeat C-06's select-omission trap. It also closes the `bookings/actions.ts` mutable-soft-deleted-booking group.
- **C-08:** staff-assignment and status-change emails are now **silently skipped for phone-only bookings** (the throw is swallowed at every call site). Also `sendBookingCreatedEmails`' early return suppresses the clinic's own `admin_booking_notification`, not just the customer send.
- **C-09:** C-06 now uses the real `report-data` / `dashboard-data` tags; the three phantom names are gone, so C-09 inherits no fictional taxonomy.
- **C-02:** the cascade branch is present and schema-matched, and the missing-table no-op will correctly stop being a no-op. **But the recorded rationale is factually wrong** — the branch is justified in code and plan as preventing C-02's `ON DELETE RESTRICT` FK from blocking deletion, which it never would, because C-06 **soft**-deletes and no row is ever removed. The real reason is that a deleted client must stop generating recurring occurrences. Recorded here so a later audit does not conclude the branch is dead code and delete it.
- **Shared surfaces:** `ManualBookingForm.tsx` anchors shifted substantially; the `DuplicateWarningBanner` block sits inside `<form>` but **outside every step container** deliberately (its checkbox is `required`, and inside a `hidden` step Chrome silently refuses to submit). Re-grep by symbol per §1.9.
- **Latent type hazard:** `bookings/types.ts:85`, `search-actions.ts:26`, `customer-manage.ts:31` and `notifications.ts:65` all still declare `contact_email: string` against a now-nullable column, invisible to tsc because reads cast through `.returns<>()`. Null-safe at runtime today by luck.

**Bonus finding for a later plan:** `resend_booking_emails` **exists** in `public.permissions` (verified live 2026-07-27) — this closes the one open verification item the migration ledger carried into C-C for **C-08**'s pre-flight.

---

## 8 — Deferred soft-delete read-path inventory (the Owner's §2.2 follow-up)

Produced by the closeout adversarial review. Owner ruling: reports stay unfiltered; filter only the working surfaces C-06 touched.

**Standing fact: nothing in `src/` reads `bookings.deleted_at` at all.** C-06 writes that column and no code consumes it — cascade-cancelled bookings are hidden today *only* by their `status`. **C-05 will be its first reader.**

**Filtered correctly (C-06's own surfaces):** `clients/page.tsx`, `clients/[clientId]/page.tsx`, `clients/[clientId]/edit/page.tsx`.

**(b) — working surfaces that should filter and don't:**
- **`search-actions.ts:121` (`searchClients`)** — highest value. Surfaces an erased subject's name, email, phone and postcode in the global search dropdown to any client-viewer, linking to a page that now 404s.
- **`search-actions.ts:73` (`searchBookings`)** — no status *or* `deleted_at` filter; returns cascade-cancelled bookings carrying the erased subject's contact details.
- `clients/actions.ts:208,215` (`createClient` dedup) — surfaces an erased person as a "possible duplicate", then dead-ends on `clients_email_key` with a raw Postgres message. The migration's `client_record_removed` guard covers only the RPC, not this path.
- `bookings/new/page.tsx:49` — `?clientId=<soft-deleted>` prefills a client the RPC then rejects with an unmapped `P0002`, surfacing the raw sentence to the admin.

**(c) — ambiguous, need a posture decision:**
- `dashboard/dashboard-data.ts:404` (`getClients`) and `:349` (`getBookings`) — report-shaped data on a working surface; the ruling doesn't clearly cover it.
- `bookings/page.tsx:441,452,465` and `bookings/[bookingId]/page.tsx:292,299` — the latter becomes moot once C-05 lands.
- `bookings/actions.ts` (11 sites) — all by-id mutations; a soft-deleted booking stays mutable. **C-05's remit.**
- `nav-notifications.ts:442` — a cascade-cancelled booking with a live reschedule request still raises a nav badge.
- `customer-manage.ts:277` + `booking/manage/actions.ts` — a manage token held before erasure still resolves and renders the customer's own details (mutations are status-guarded).
- `clients/actions.ts:314` — the email-clash probe must include deleted rows (the index is plain), but its message leaks an erased subject's name.

**(a) — correctly unfiltered:** `reporting.ts`, `reports/export`, `privacy/page.tsx` (a completed `deletion_review` must keep its subject's name), `privacy/data-export.ts`, and every booking read already gated by `status` or by a client that passed a `deleted_at` gate.

### C-04a hand-off (plan #4, next)
1. **Verify the SELECT STRING, not the type.** C-04a's restore guard reads `beforeState.clients?.deleted_at`, which is `undefined` unless the embedded select literally includes `clients(deleted_at)` — the identical silent-cast trap C-06 hit and documented in §4.1. tsc, lint and vitest are all blind to it.
2. **Its refusal copy points at something that doesn't exist.** *"Restore the client first, then the booking."* — C-06 ships **no** un-delete affordance of any kind. Reword at implementation time.
3. **Backfill interaction is benign but should be stated.** C-06's cascade writes neither `customer_cancelled_at` nor a booking-level cancellation audit row, so pre-C-04a cascade-cancelled bookings land in C-04a's `unstamped_will_be_unrestorable` bucket — the right outcome, reached by accident.
4. C-04a's restore clears `cancelled_at` but **not** `bookings.deleted_at`, leaving a restored booking permanently flagged deleted for C-05's `ensureBookingActive`.

---

*C-06 SHIPPED 2026-07-27. Final commit `88d2a6d`.*
