# C-06 — closeout role sweep (plan §3.2 / §3.3)

**Run:** 2026-07-27, HEAD `bca91c3`, dev server `http://localhost:3000`, production DB `twzutkfgqclqurvkmvqz` (migration `20260727202424_c06_client_crud_hardening` live).
**Scope:** Owner-limited — read-only sweep + REVERSIBLE mutations only. The three destructive tests (§3.2e delete cascade, §3.2f bulk delete, §3.2g privacy `deletion_review` completion) were **NOT RUN** — see §6.
**SQL:** SELECT-only throughout. No `apply_migration`, no INSERT/UPDATE/DELETE issued through `execute_sql`.

---

## 0 — Fixture drift found before any action (must be recorded)

Plan §0.6 names `Audit Test Client 1..5`. **Only two of those five names still exist.** Slots 2–5 of the
`1779055968…` fixture batch were renamed by a later unicode/stress-name audit, so they no longer match the
DO-NOT-TOUCH safe-name pattern (`Phase10*` / `Audit Test*`) even though their emails still carry the
`audit.client.N.<epoch>@example.test` convention.

| Plan name | Live row | id |
|---|---|---|
| Audit Test Client 1 | `Audit Test Client 1` | `bfbd6c37-83d6-4af5-88a8-571f8f374f7e` |
| Audit Test Client 2 | `Mohammed Abdulrahman Abdul-Hakim Al-Farsi-Lampungbungkangkang` | `65108c42-1dce-4a32-9137-751ed0d3e4ae` |
| Audit Test Client 3 | `李小龍 (Lǐ Xiǎolóng) 👨‍⚕️🌿` | `a11402ca-7ca7-4cc2-aeeb-e6faa944e5cd` |
| Audit Test Client 4 | `Ñoño García-López y Vega Romero` | `8f680e50-8449-4bb4-9c05-a2854bfe2d1d` |
| Audit Test Client 5 | `اَلسَّلَامُ عَلَيْكُمْ Test Client` (batch `…969016`) | `c9ddb740-dd1c-4dbf-a642-3448fefc578a` |
| — | `Audit Test Client 5` (earlier batch `…142886`) | `64f142ee-9b13-4d43-a827-26d0eafad5de` |

**Substitution used** (both rows satisfy the safe name *and* the example.test email convention):
- §3.2c edit happy path → **`Audit Test Client 1`** instead of "Audit Test Client 3".
- §3.2d email collision → edit **`Audit Test Client 5`**, target **`Audit Test Client 1`**'s address
  (same semantics: collision against a different live client).

---

## 1 — RBAC matrix: observed vs expected (brief §3)

Client used for every detail/edit probe: `Audit Test Client 1` (`bfbd6c37…`).

| Surface | Owner | Admin | Booking Coordinator | Therapist |
|---|---|---|---|---|
| **Expected** (brief §3) | everything | everything | edit route, identity read-only, no delete | refused |
| `/admin/clients` list reachable | ✅ | ✅ | ✅ (15 of 15) | ❌ *"You don't have access to this section"* |
| Row checkbox column | ✅ 15 | ✅ 15 | ❌ 0 | n/a |
| Sticky bulk bar on 2 selections | ✅ `2 clients selected` · `Delete selected` · `Clear` | not re-tested (same code path, gated on the same permission) | ❌ absent | n/a |
| "Show deleted (N)" toggle | absent — **0 soft-deleted clients**; renders `Hide deleted` on `?show_deleted=1` | absent (same reason) | absent (same reason) | n/a |
| Row-menu items | Start new booking · View client profile · View audit history · **Delete client** | identical, **Delete client** present | Start new booking · View client profile · View audit history — **no Delete client** | n/a |
| Detail header actions | Print · **Edit** · **Delete** · New booking | Print · **Edit** · **Delete** · New booking | Print · **Edit** · New booking — **no Delete** | 404 |
| `/admin/clients/[id]/edit` | renders, **all fields editable** | renders, **all fields editable** | renders, identity fields **disabled** | refused — *"Client editing limited…"*, no form rendered |
| Identity fields (`full_name`, `email`, `gender_preference`) | editable | editable | `disabled` + nameless, each with a hidden twin carrying the unchanged value; helper text ×3 *"Only Owner and Admin can change identity fields. Contact one of them if this needs updating."* | n/a |
| Operational fields (`phone`, `address`, `postcode`, `city`, `area`, `notes`, `client_source`, `source_detail`) | editable | editable | editable | n/a |

**Verdict: matches the expected matrix on every row.** No affordance was missing where one was expected, and
none appeared where it should have been hidden.

Grants confirming the UI (SELECT on `role_permissions`):

```
Admin               | manage_bookings_all, manage_client_destructive_ops, manage_client_identity_fields, manage_clients_all
Owner               | manage_bookings_all, manage_client_destructive_ops, manage_client_identity_fields, manage_clients_all
Booking Coordinator | manage_bookings_all, manage_clients_all
```

### Deviations from the plan *text* (not from the brief's matrix)

1. **`Show deleted (N)` is conditional on `deletedCount > 0`** (`clients/page.tsx:880`). With zero soft-deleted
   clients the toggle is correctly absent for every role; `?show_deleted=1` proves the affordance exists
   (renders `Hide deleted`). It is **not** RBAC-gated — brief §4.3's "hidden when actor lacks
   `manage_client_destructive_ops`" applies to the bulk toolbar list, not this toggle.
2. **Therapist is refused `/admin/clients` outright**, not "list visible but limited to assigned clients" as
   plan §3.2j predicted. Copy: *"You don't have access to this section — Therapists see clients only through
   their assigned bookings."* Client detail for a non-assigned client returns a hard **404**. This is
   pre-existing RBAC scoping, not a C-06 change, but plan §3.2j's expectation is stale.
3. **Delete-confirm modal copy** (opened + cancelled as Owner, nothing deleted):
   *"Delete Audit Test Client 1 and cancel all their open bookings? · Past completed bookings stay on the
   record. · Sensitive health notes are deleted permanently. · Only the notes are unrecoverable — the profile
   is hidden, not erased."* Buttons `Keep client` / `Delete client`. This is the corrected Phase-F copy
   (brief §2.3's "This cannot be undone." was deliberately replaced), so it diverges from the brief as
   written — intentionally, per the progress file.

### Mobile defect found at 375 px — bulk-bar actions unreachable

At a 375/376 px CSS viewport the `/admin/clients` single-column grid resolves a **track wider than its
container**, so the sticky selection bar is clipped:

| Role | viewport clientWidth | grid container | grid track | outcome |
|---|---|---|---|---|
| Owner (2 rows selected) | 376 | 344 | **564** | `Delete selected` spans x=353→502; page `scrollWidth` is 376, so the button is off-screen and **not reachable by scrolling** |
| Coordinator (no checkbox column, no bar) | 376 | 344 | **508** | same overflow, smaller |

Because the overflow is still 508 px with **no** C-06 affordance rendered, the container overflow is
**pre-existing**, not introduced by C-06. C-06 inherits it and adds ~56 px, and the user-visible consequence
lands on a C-06 deliverable: at 375 px an Owner/Admin can select rows but cannot reach `Delete selected` or
`Clear`. Evidence: `clients-list-checkboxes-375.png`. Logged, not fixed (protocol §1.6a).

---

## 2 — §3.2c Edit happy path (Owner) — **PASS**

`Audit Test Client 1` (`bfbd6c37…`), phone only.

- Pre-state: `phone = 07000000000`, `updated_at = 2026-05-17 22:12:48.776482+00`
- Changed phone → `07000000009`, saved. Redirect landed on `/admin/clients/bfbd6c37…/` and the flash toast
  rendered `Client updated.` (`ClientFlashToast` then strips `?updated=1` via `history.replaceState`, which
  is why the address bar shows no query — verified in `components/DeleteClientButton.tsx:106-125`).
- Post-state SELECT:

```
id       bfbd6c37-83d6-4af5-88a8-571f8f374f7e
phone    07000000009
updated_at 2026-07-27 22:17:32.900713+00
```

- Audit row (exactly one):

```
action_type  client_updated
target_type  clients
target_id    bfbd6c37-83d6-4af5-88a8-571f8f374f7e
actor        01582c5d-bd75-4c49-b207-6f5597e15218 (Owner)
after_state  {"phone": "07000000009"}      <- only the changed field
before_state full prior row (before_state->>'phone' = 07000000000)
```

- **Restored through the UI**: phone back to `07000000000` (`updated_at 2026-07-27 22:19:13.733324+00`).
  Only `updated_at` differs from the original snapshot; two `client_updated` rows record the round trip.

## 3 — §3.2d Email collision (Owner) — **PASS, no write**

Edited `Audit Test Client 5` (`64f142ee…`), set email to `audit.client.1.1779055968846@example.test`.

- Hard error banner: **"Couldn't save changes. Email already in use by Audit Test Client 1. Resolve manually."**
  Stayed on the edit route; no redirect.
- Post-state SELECT — **neither row moved**:

```
Audit Test Client 1 | audit.client.1.1779055968846@example.test | updated_at 2026-07-27 22:17:32.900713+00 (unchanged)
Audit Test Client 5 | audit.client.5.1779047142886@example.test | updated_at 2026-05-17 19:45:42.813989+00 (unchanged)
```

- `SELECT count(*) FROM audit_logs WHERE created_at > '2026-07-27 22:17:33+00'` → **0**.

## 4 — §3.2k No-email admin booking (Owner) — **PASS**

`/admin/bookings/new`, no prefill, email left empty.

| Criterion | Observed |
|---|---|
| Email field required marker | absent — label `Email address` (no `*`), `input.required === false` |
| Step 1 → Step 2 with empty email | **reachable** — `Continue` enabled, landed on "Services & participants" |
| Confirmation-email checkbox on the Confirm step | **absent** — only `consent_acknowledged` is visible; hidden `send_confirmation_email` submitted as `""` |
| Booking created | `d8a61721-71ec-419b-a5b9-b711f88d35bd` |
| `contact_email` | **NULL** (`contact_email IS NULL` → `true`) |
| `email_delivery_events` for the booking | **0**; global count unchanged at 42 (before and after) |
| Booking detail chip | **"No email — reminders off — add one on the client record"**, linking to `/admin/clients/e518393f…/edit/` |

```
id                d8a61721-71ec-419b-a5b9-b711f88d35bd
client_id         e518393f-d5aa-42c7-b87b-52faf8526abe
contact_full_name C06 Closeout NoEmail Test
contact_email     NULL
contact_phone     07999000106
booking_date      2026-08-11   start_time 19:00:00
status            pending      booking_source phone
created_at        2026-07-27 22:22:27.396844+00
```

**Owner cleanup list (two rows, both created by this test, neither deleted by me):**
- booking `d8a61721-71ec-419b-a5b9-b711f88d35bd`
- client `e518393f-d5aa-42c7-b87b-52faf8526abe` — `C06 Closeout NoEmail Test`, `email = NULL`,
  `phone = 07999000106` (created by the RPC's phone-dedup branch 3; no phone match existed, so no
  duplicate warning fired — that path is untested here)

Screenshot: `booking-no-email-chip-1280.png`.

## 5 — Screenshots written (§3.3)

All under `redesign/evidence/C-06/`. Viewports are true CSS pixels — the browser runs at DPR 0.9, so the
window was sized to 353 / 1167 device px to land on 375 / 1280 CSS px.

| File | Content |
|---|---|
| `clients-detail-owner-1280.png` | Owner detail header — Print · Edit · Delete · New booking |
| `clients-detail-owner-375.png` | same at 375 |
| `client-edit-owner-1280.png` | Owner edit form, all fields editable |
| `client-edit-coordinator-1280.png` | Coordinator edit form, identity fields disabled + helper text ×3 |
| `clients-list-checkboxes-375.png` | checkbox column + sticky bar at 375 (also documents the clipping defect) |
| `booking-no-email-chip-1280.png` | booking detail with the "No email — reminders off" chip |

## 6 — NOT RUN (Owner-excluded), with the coverage that stands in

Excluded by Owner decision 2026-07-27: irreversible (hard-deletes special-category health notes) and would
consume `Audit Test Client` fixtures that C-05, C-02, C-09 and C-16 still need.

| Plan test | Status | Standing coverage |
|---|---|---|
| §3.2e delete cascade | **NOT RUN** | `src/app/admin/clients/__tests__/deleteClient.test.ts` — soft-delete + open-booking cascade + sensitive-note hard-delete, completed bookings untouched, `deleted_at` stamped only after the cascade succeeds, idempotency, rolled-up audit row shape |
| §3.2f bulk delete | **NOT RUN** | same file — *"deletes each selection in series and accumulates failures"*, *"refuses a coordinator before touching the database"* |
| §3.2g privacy `deletion_review` completion | **NOT RUN** | `src/app/admin/privacy/__tests__/updatePrivacyRequestStatus.test.ts` — *"erases the client when a deletion_review is marked completed"*, already-deleted client (brief §5.5), partial-failure reporting, permission refusal |

Also not run, deliberately:
- **§3.2h data-export completion** — would generate a real export containing live client PII.
- **§3.2i Coordinator direct `adminDeleteClient` invocation** — a server-side RBAC failure would hard-delete
  sensitive notes. Covered by `deleteClient.test.ts` *"refuses a coordinator, who manages clients but not
  destructive ops"* and *"refuses an admin_delete from an actor without destructive ops"*.
- No email was sent by any step of this sweep.

## 7 — Database evidence roll-up (§3.4)

Sweep window from `2026-07-27 22:17:25+00`:

```
action_type                  | count
client_updated               |   2     -- phone change + restore
manual_admin_booking_created |   1     -- the no-email booking

clients_soft_deleted   0
bookings_soft_deleted  0
clients_total          15   (14 + the one test client this sweep created)
email_delivery_events  42   (unchanged across the whole sweep)
```

DO-NOT-TOUCH check: booking `9d55ce2a-7a76-42ed-9166-a33fa66ee7fe` (Badar) — `status cancelled`,
`deleted_at NULL`, `updated_at 2026-05-19 17:16:59.107635+00`, untouched. The Owner account
`rahmatherapy@outlook.com` was used only to sign in; it appears in no email path.
