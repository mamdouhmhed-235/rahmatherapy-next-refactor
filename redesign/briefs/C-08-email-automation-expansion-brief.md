# C-08 — Email automation expansion (5 NEW templates + 1 existing-template verification + per-row Resend tooling + business-notification routing)

**Type:** Band C plan-writing brief (C-B phase)
**Date written:** 2026-05-26
**Amended:** 2026-07-16 — business-notifications bundle (user direction): personal notification email + per-type alert preferences on staff profiles, a business-notification recipient resolver replacing `getAdminRecipient` for internal alerts, and a new `enquiry_logged` template. See §2.7–§2.9. Supersedes the §5.6 and Q9.3 locks (noted inline).
**Predecessors:**
- `redesign/plans/C-phase/C-B-DECISIONS.md` §2 Q7 + §3 C-08 (5-template scope locked + Resend tooling + capability-keyed audience)
- `redesign/audits/C-A/19-emails-audit.md` (B-83 missing event types + B-84 no per-row Resend + PE-51 existing template editor is exemplary)
- `redesign/audits/C-A/W03-booking-lifecycle-flow.md` §2 B-115 (booking_confirmed_client gap)
- `redesign/audits/C-A/W05-assignment-claim-reassign-flow.md` §2 B-127 (staff_unassignment gap)
**Companion files:**
- Plan: `redesign/plans/C-phase/C-08-email-automation-expansion-plan.md`
- Progress: `redesign/per-page-progress/C-08-email-automation-expansion-progress.md` (filled during C-C)

---

## 0 — TL;DR

C-08 fills the email-automation gaps surfaced by W03 + W05 + audit #19. **Discovery during plan-writing reframed the scope:** the decisions doc Q7 listed "5 new templates", but inspection shows `staff_assignment` already exists in `templates.ts` + `templates-data.ts` + the SUBJECTS map + the production `email_delivery_events` (4 rows). Net scope:

- **5 NEW templates** ship in C-08:
  1. `client_assigned_therapist` — customer audience. Fires every time a booking's assignment changes. Client always knows who's coming.
  2. `booking_confirmed_client` — customer audience. Fires on `pending → confirmed`. Closes B-115 gap.
  3. `staff_unassignment` — staff audience. Fires when a practitioner is removed (reassign or unassign). Closes B-127 gap.
  4. `claim` — admin_internal audience. Fires when a practitioner claims an unassigned slot. Gives admin operational awareness.
  5. `enquiry_logged` — admin_internal audience (2026-07-16 amendment). Fires when an enquiry is created, skipping the staff member who logged it. Closes the "owner never hears about queries" gap.

- **1 existing template verified for override coverage**:
  6. `staff_assignment` already exists (audit confirmed; `templates-data.ts` line 115 registered). C-08 verifies it's fully `resolveTemplateOverrides`-integrated and the fields list is current. Likely no code change beyond a templates-data.ts field-list audit.

- **Plus per-row Resend tooling** on `/admin/emails` delivery log (B-84). New server action `resendEmail(deliveryEventId)` looks up the original event, re-renders with current overrides, sends, logs a new event with `resent_from_event_id` linkage.

- **Plus business-notification routing (2026-07-16 amendment, §2.7–§2.9):** internal alerts stop going to the public clinic contact email. A new resolver sends them to every **active Owner/Admin who has opted in**, at a personal notification email they set themselves in a new "Notifications" section on `/admin/me` — with per-alert-type preferences ("only the most important things") and a generalised **skip-self rule** (you're never emailed about an action you performed yourself).

**Cross-cutting changes:**
- All assignment-related emails fire to **any practitioner with `can_take_bookings=true`**, not just role=therapist. Aligns with C-B-DECISIONS Q10 capability-keyed model.
- All admin_internal emails (3 existing + `claim` + `enquiry_logged`) route through the new `resolveBusinessNotificationRecipients` resolver (§2.9). `getAdminRecipient(settings)` survives only as the zero-opt-in fallback.
- **Migration now required (2026-07-16 amendment)** — two new `staff_profiles` columns (`notification_email`, `business_notification_prefs`), plus the pre-existing conditional `email_delivery_events.metadata` addition, in one Zone-2 migration. `email_delivery_events.event_type` remains free-text (verified) — new event_type values are still code constants.

---

## 1 — Why this plan exists

### 1.1 Audit #19 surfaced the gap (B-83)

`/admin/emails` Templates tab + Delivery tab + Reminders tab is the most sophisticated admin surface — full editor, iframe preview, override-able copy. PE-51: *"This is the most sophisticated email-template UX I've seen in the audit. C-08 is additive (new templates) not redesign."*

But 4 events that should fire emails currently don't:
- Client never knows who's coming (no `client_assigned_therapist`)
- Client never knows their booking is confirmed (no `booking_confirmed_client`)
- Removed practitioner never told they're off the assignment (no `staff_unassignment`)
- Admin gets no operational signal when a slot is claimed (no `claim`)

C-08 fills these.

### 1.2 W03 + W05 corroborated

- W03 B-115: `pending → confirmed` transition fires `sendAssignedStaffBookingChangeEmails` (staff-only). Client gets the original confirmation email then silence until reminder. **C-08 adds `booking_confirmed_client`.**
- W05 B-127: When admin reassigns A → B or unassigns A entirely, A gets nothing. B gets a `staff_assignment` email (existing). **C-08 adds `staff_unassignment` for A.**

### 1.3 Audit B-84 — no per-row Resend

`/admin/emails` Delivery tab shows email_delivery_events as a list. No Resend button. `ReminderResendForm.tsx` exists scoped to the Reminders tab only. A failed `booking_confirmation` send has no remediation path.

C-08 adds a Resend button on every delivery row (RBAC-gated by `RESEND_BOOKING_EMAILS`).

### 1.4 The `staff_assignment` existing template (decisions doc Q7 re-framed)

The decisions doc treated `assignment` as a new template. Code inspection during plan-writing:

- `src/lib/email/notifications.ts:471` exports `sendStaffAssignmentEmail` — fires `staff_assignment` event_type to assigned practitioner.
- `src/lib/email/templates.ts:326` exports `renderStaffAssignmentEmail`.
- `src/app/admin/emails/components/templates-data.ts:115` registers it for the admin UI.
- `src/app/admin/email-templates/actions.ts:73` lists it in SUBJECTS: `staff_assignment: "Booking assignment"`.
- Production: 4 `staff_assignment` rows in `email_delivery_events` already sent.

C-08 doesn't re-build `assignment`. It **audits** the existing template's override-field coverage in `templates-data.ts` and extends if needed. Estimated work: 0-1 line in templates-data.ts. Documented in plan §1 Step 5.

---

## 2 — Scope (lifted from C-B-DECISIONS §3 C-08, re-framed for code reality)

### 2.1 New template `client_assigned_therapist` (audience: customer)

**Trigger:** every time an assignment changes (assign, reassign, claim) — fires `client_assigned_therapist` to the booking's client.

**Code wire:** 3 server actions need the hook:
- `claimBookingAssignment` (`bookings/actions.ts:239-365`) — after the existing `sendStaffAssignmentEmail` call (line 348-355), add `sendClientAssignedTherapistEmail(bookingId, supabase)`.
- `updateBookingAssignment` (line 449-562) — after the existing assignment-email send (line 542-551), same addition.
- (And for the unassign-then-reassign flow — same hook.)

**Default copy** (override-able via admin UI):
- Subject: "Your therapist for {bookingDate}"
- Body: "Hi {clientName}, your appointment at {bookingDate} {startTime} will be with {therapistName}. They'll arrive at {address}. If anything changes, we'll let you know."

**Re-fire on reassign:** if the assignment changes again (A → B), a second `client_assigned_therapist` email fires with the new therapist's name. Client always has the current state.

### 2.2 New template `booking_confirmed_client` (audience: customer)

**Trigger:** `bookings.status` transitions `pending → confirmed`. Two paths:
- `quickUpdateBooking` action=`confirm` (`bookings/actions.ts:387-401`).
- `updateBookingManagement` Status form changes status (`bookings/actions.ts:118-237` lines 213-227).

**Code wire:** in both paths, after the existing audit log + `sendAssignedStaffBookingChangeEmails`, add:

```ts
if (beforeState.status === "pending" && updatedBooking.status === "confirmed") {
  await sendBookingConfirmedClientEmail(bookingId, adminClient).catch((error) => {
    console.error("Unable to send booking-confirmed client email.", error);
  });
}
```

**Default copy:**
- Subject: "Your booking is confirmed"
- Body: "Hi {clientName}, your appointment at {bookingDate} {startTime} is confirmed. We'll send a reminder closer to the day. If you need to reschedule or cancel, manage your booking here: {manageUrl}."

**Idempotency:** no sentinel needed for now — pending→confirmed is admin-driven, not a cron loop. If admin re-saves the form without changing status, the predicate (`before.status === "pending"`) returns false → no duplicate.

### 2.3 New template `staff_unassignment` (audience: staff)

**Trigger:** practitioner removed from a booking. Two paths:
- `updateBookingAssignment` action=`unassign` — `bookings/actions.ts:485-489` UPDATE sets `assigned_staff_id=null`. Hook AFTER the UPDATE, BEFORE recompute.
- `updateBookingAssignment` action=`assign` with a different `assignedStaffId` than the current — reassign A → B. The previous A needs notification.

**Code wire:** capture the `beforeState.assigned_staff_id` BEFORE the UPDATE. If non-null AND (action=unassign OR new staff_id differs), send `sendStaffUnassignmentEmail(bookingId, previousStaffId, supabase)`.

**Default copy:**
- Subject: "Booking assignment removed"
- Body: "Hi {therapistName}, you've been unassigned from the {bookingDate} {startTime} booking ({clientName}). Reach out to admin if you have questions."

### 2.4 New template `claim` (audience: admin_internal)

**Trigger:** practitioner claims an unassigned slot via `claimBookingAssignment` (`bookings/actions.ts:239-365`).

**Code wire:** after the existing `sendStaffAssignmentEmail` (line 348-355), send `sendClaimNotificationEmail(bookingId, claimingStaffId, supabase)` to the admin recipient (per `getAdminRecipient(settings)` pattern).

**Default copy:**
- Subject: "Slot claimed: {therapistName} → {bookingDate}"
- Body: "{therapistName} just claimed the {bookingDate} {startTime} {serviceName} slot ({clientName}). The booking is now {assignmentStatus}."

**Why admin gets notified:** operational awareness. If Sara claims a slot Mahmoud was also considering, admin can see who got it.

### 2.5 Existing template `staff_assignment` — verification pass

Existing infrastructure confirmed (§1.4). C-08 verifies:
- `templates-data.ts:115` field list covers all override-able strings (subject, body_intro, body_cta, signoff).
- `sendStaffAssignmentEmail` fires on both `claimBookingAssignment` AND `updateBookingAssignment` (already confirmed via W05 §1 walks).
- The recipient resolution honours `can_take_bookings` — practitioner-mode Owner/Admin/Coord assigned to a booking gets this email correctly. Verify the existing logic.

Estimated work: 0-1 line in templates-data.ts + a vitest spec confirming the capability-keyed recipient resolution. Documented in plan §1 Step 5.

### 2.6 Per-row Resend tooling

**New server action:** `src/app/admin/emails/actions.ts` (extend existing) — `resendEmail(deliveryEventId)`:

```ts
export async function resendEmail(deliveryEventId: string): Promise<{ ok: boolean; newEventId?: string; error?: string }> {
  // 1. RBAC: requirePermission(RESEND_BOOKING_EMAILS).
  // 2. Fetch the original delivery event row + linked booking.
  // 3. Look up the template via event_type → renderer dispatch.
  // 4. Re-render with CURRENT resolveTemplateOverrides values (so admin edits since the
  //    original send apply on resend).
  // 5. Send via sendTrackedEmail (logs a new email_delivery_events row).
  // 6. Set new event's metadata.resent_from_event_id = deliveryEventId.
  // 7. Audit log row: action_type='email_resent', target_id=newEventId,
  //    after_state={ resent_from: deliveryEventId, event_type, recipient_email }.
}
```

**Schema note:** the existing `email_delivery_events` table likely already has a `metadata jsonb` column (verify in pre-flight). If not, add it OR add a dedicated `resent_from_event_id uuid` column. Plan §6 confirms.

**Rate-limit consideration:** prevent spam — same `(booking_id, event_type, recipient_email)` tuple resent within 60 seconds rejected with "Recently sent — try again in N seconds." Defensive. Plan locks the threshold.

**UI button:** new component `ResendButton.tsx` in `src/app/admin/emails/components/`. Renders inside each delivery row. Only visible when actor has `RESEND_BOOKING_EMAILS` AND the event is non-`skipped` status (skipped events don't have content to resend).

Includes a `ConfirmActionModal` for the click (lift the existing pattern from C-04a Restore button work):

> "Resend this email?
>
> A new copy of `{event_type}` will be sent to `{recipient_email}` using the current template settings. The original send is preserved."

---

## 3 — RBAC matrix (C-08 actions × roles)

| Action | Owner | Admin | Booking Coord | Therapist |
|---|---|---|---|---|
| Receive `client_assigned_therapist` (recipient) | n/a — client only | — | — | — |
| Receive `booking_confirmed_client` | n/a — client only | — | — | — |
| Receive `staff_unassignment` | ✅ if practitioner-mode + previously assigned | ✅ same | ✅ same | ✅ if previously assigned |
| Receive `claim` notification | ✅ if opted in via business-notification prefs (§2.9; skip-self applies) | ✅ same | ❌ | ❌ |
| Receive `enquiry_logged` notification | ✅ if opted in (skip-self applies) | ✅ same | ❌ | ❌ |
| See + edit own "Notifications" section on `/admin/me` | ✅ (own row only) | ✅ (own row only) | ❌ section hidden | ❌ section hidden |
| Invoke `saveNotificationSettings` | ✅ self-only | ✅ self-only | ❌ | ❌ |
| Edit any new template via `/admin/emails` Templates tab | ✅ via `MANAGE_EMAIL_TEMPLATES` | ✅ same | ❌ | ❌ |
| See Resend button on `/admin/emails` Delivery rows | ✅ via `RESEND_BOOKING_EMAILS` | ✅ same | ❌ (unless granted) | ❌ |
| Invoke `resendEmail` server action | same as button visibility | same | ❌ | ❌ |

**Capability-keyed cross-cut (per Q10):** the assignment-side emails (`assignment` existing + `client_assigned_therapist` + `staff_unassignment`) fire to **any practitioner with `can_take_bookings=true`** based on the booking_assignments row, not role-keyed. Owner assigned to a booking they're taking gets the same emails a Therapist would.

---

## 4 — Layout strategy

### 4.1 New templates in `/admin/emails` Templates tab

The new 4 entries appear in `TemplateBrowser` alongside the existing 9. Sorted by audience: customer / staff / admin_internal (existing AUDIENCE_GROUPS at templates-data.ts:156). The new templates' shape:

```
CUSTOMER
  Booking confirmation (existing)
  Booking cancellation - customer (existing)
  Booking reminder (existing)
  Booking confirmed - client (NEW)
  Client assigned to therapist (NEW)

STAFF
  Booking assignment (existing — verified)
  Booking change - staff (existing)
  Booking unassignment (NEW)

ADMIN INTERNAL
  New booking - admin notification (existing)
  Booking cancellation - admin (existing)
  Reschedule request - admin (existing)
  Slot claimed - admin notification (NEW)
```

Each new template's edit form has the standard fields: subject, body_intro, body_cta_label, body_cta_url (where applicable), body_signoff. Optional advanced overrides per template (e.g., `client_assigned_therapist` may have a `therapist_intro` field if we want the admin to customise the "your therapist will be" framing per service).

### 4.2 Resend button on delivery rows

Existing delivery log layout (per audit #19): grouped by date, each row shows event_type, recipient, delivery_status, error_message. Add a small `Resend` button to the right of each row:

```
[ Thursday 21 May ]
┌───────────────────────────────────────────────────────────────┐
│ ✅ booking_confirmation · sara@example.com · sent 10:34       │
│   [ Resend ↻ ]                                                │
├───────────────────────────────────────────────────────────────┤
│ ❌ staff_assignment · failed · sara@example.com · 10:36       │
│   "5xx server error from Resend API"                          │
│   [ Resend ↻ ]                                                │
└───────────────────────────────────────────────────────────────┘
```

Button renders compact at desktop (icon + label inline), icon-only at mobile (375). Click opens `ConfirmActionModal` with copy per §2.6.

**Skipped events** (`delivery_status = 'skipped'`) — Resend button NOT rendered. Skipped means no payload was generated (e.g., booking has no client email). Resending makes no sense.

### 2.7 New template `enquiry_logged` (audience: admin_internal) — 2026-07-16 amendment

**Why:** verified 2026-07-16 — enquiries are created only via the admin `createEnquiry` action (`src/app/admin/enquiries/actions.ts:49`; there is **no public enquiry endpoint**), and that action sends **no email of any kind**. The owner has no signal that a query came in unless they happen to open `/admin/enquiries`.

**Trigger:** `createEnquiry` succeeds. Hook fires `sendEnquiryLoggedEmail(enquiryId, actorStaffId, adminClient)` after the insert + audit row, wrapped in the standard catch-and-continue pattern (enquiry creation never rolls back on email failure).

**Recipients:** via `resolveBusinessNotificationRecipients` (§2.9) with `type: 'enquiry_logged'` and `excludeStaffId: actor.id` — **the staff member who logged the enquiry is never emailed about it** (user decision 2026-07-16). If the actor is the only opted-in recipient, no email fires and a `skipped` delivery row records why.

**Default copy** (override-able via admin UI):
- Subject: "New enquiry: {clientName}"
- Body: "{staffName} logged a new enquiry from {clientName} ({contactDetail}) interested in {serviceInterest}. View it here: {enquiryUrl}."

**Delivery logging:** `email_delivery_events.event_type = 'enquiry_logged'`, `recipient_role = 'admin'`, one row per recipient. `booking_id` stays null (enquiries aren't bookings) — pre-flight verifies the column is nullable; if NOT NULL, log with `metadata.enquiry_id` linkage instead and flag to the user.

### 2.8 Personal notification email + per-type preferences on `/admin/me` — 2026-07-16 amendment

**Why:** today every internal alert goes to `business_settings.contact_email` — the clinic's **public** contact address (`getAdminRecipient`, `notifications.ts:209`). The owner asked for a personal, per-profile notification email, self-managed, with a clear hint of what it's for — and control over which alerts arrive ("not literally everything, only most important things").

**Schema (Zone-2, folded into the C-08 migration):**
- `staff_profiles.notification_email text NULL` — empty = fall back to the login email.
- `staff_profiles.business_notification_prefs jsonb NULL` — `NULL` = not opted in. When set: `{ "enabled": true, "types": { "<type>": false, ... } }` — a type absent from `types` defaults to **on**; the map only stores explicit opt-outs.
- Seed: the Owner profile gets `{"enabled": true}` (all types on) so alerts flow from day one. Admin profiles start `NULL` (opted out until they toggle on).

**Alert types (the per-type preference list, locked 2026-07-16):**
| Key | Fires when |
|---|---|
| `new_booking_request` | public booking request arrives (`admin_booking_notification`) |
| `booking_cancelled` | booking is cancelled (`admin_booking_cancellation`) |
| `reschedule_request` | client requests a reschedule (`admin_reschedule_request`) |
| `enquiry_logged` | an enquiry is logged (§2.7) |
| `slot_claimed` | a practitioner claims a slot (`claim`, §2.4) |

**UI — "Notifications" section on `/admin/me`:** a settings card visible to **Owner + Admin roles only** (each edits their own row; no cross-editing). Contents:
- Notification email input with hint: *"Business alerts (new bookings, enquiries, cancellations) are sent to this address. Leave empty to use your login email ({login email})."* Format-validated; empty allowed.
- Master toggle: "Receive business alerts".
- Five per-type checkboxes (labels above), disabled while the master toggle is off.
- Save via new server action `saveNotificationSettings` (self-only: writes the actor's own row; role-gated Owner/Admin; audit row `notification_settings_updated`).

**Coordination:** C-07 mounts its Quick-links panel on the same `/admin/me` page — whichever ships second slots below the other; both are self-contained cards (noted in C-07 plan §Phase A1 Step 3).

### 2.9 `resolveBusinessNotificationRecipients` — recipient resolver — 2026-07-16 amendment

New function in `notifications.ts` replacing `getAdminRecipient` for all admin_internal sends:

```ts
interface BusinessNotificationQuery {
  type: "new_booking_request" | "booking_cancelled" | "reschedule_request" | "enquiry_logged" | "slot_claimed";
  excludeStaffId?: string | null;  // skip-self: the actor who caused the event
}

async function resolveBusinessNotificationRecipients(
  supabase: SupabaseClient,
  query: BusinessNotificationQuery
): Promise<{ staffId: string; email: string }[]> {
  // 1. Fetch active staff_profiles whose role is Owner or Admin
  //    AND business_notification_prefs->>'enabled' = 'true'.
  // 2. Filter out rows where prefs.types[query.type] === false.
  // 3. Filter out query.excludeStaffId (skip-self).
  // 4. Map to notification_email ?? email.
  // 5. Fallback: if step 1 found ZERO opted-in profiles at all,
  //    return [{ staffId: null, email: getAdminRecipient(settings) }]
  //    so alerts can never silently vanish. NOTE: the fallback does NOT
  //    apply when opted-in profiles exist but skip-self / per-type prefs
  //    emptied the list — that emptiness is intentional.
}
```

**Rerouting (one edit per send-fn):** `sendBookingCreatedEmails` (admin leg), `sendBookingCancellationEmails` (admin leg), `sendBookingRescheduleRequestEmails` (admin leg), `sendClaimNotificationEmail` (§2.4), `sendEnquiryLoggedEmail` (§2.7). Each sends **one tracked email per resolved recipient** (one delivery row each). Public-initiated events (customer books / cancels / reschedules) have no staff actor → no exclusion → all opted-in recipients get them. Staff-initiated events pass the actor's id → skip-self.

**Supersession notes:**
- §5.6's "admin claiming themselves still gets the claim email — harmless" lock is **superseded**: skip-self now excludes the claiming admin. (A different opted-in admin still gets it.)
- Q9.3's "claim → `getAdminRecipient(settings)`" lock is **superseded** by the resolver (fallback aside).

### 4.3 Mobile (375) considerations

Delivery rows already mobile-responsive per audit. Resend button gets `min-h-11` tap target. Confirm modal fills viewport.

Templates tab edit form already mobile-tested per audit PE-51.

---

## 5 — States & edge cases

### 5.1 Client has no email on file

`sendClientAssignedTherapistEmail` + `sendBookingConfirmedClientEmail` follow the existing pattern from `sendBookingCreatedEmails`: throw `"Booking client has no email address."` from the lookup. The catch-block in the calling server action logs to console + continues (booking update isn't rolled back).

`email_delivery_events` gets a `delivery_status='skipped'` row with the reason. Resend button on that row is hidden (per §4.2).

### 5.2 Practitioner has no email on file

`sendStaffAssignmentEmail` / `sendStaffUnassignmentEmail` already follow this pattern. Skipped delivery row written.

### 5.3 `client_assigned_therapist` race with reassignment

Admin reassigns A → B. The hook fires `sendClientAssignedTherapistEmail`. Before the email lands, admin reassigns B → C. Now two emails are queued: one says "your therapist is B", the next says "your therapist is C". Client receives them in order; latest wins.

Acceptable. The client sees the chronological history; current state is whatever the booking has now. If this becomes annoying, debounce at the send-fn layer (only send if no other change in the last 30 seconds). Out of scope for C-08; flag for C-12+ if observed.

### 5.4 `staff_unassignment` AND `staff_assignment` race

Admin reassigns A → B. The hook fires `sendStaffUnassignmentEmail(previousStaffId=A)` AND `sendStaffAssignmentEmail(newStaffId=B)`. Both succeed independently. Two delivery rows written. Acceptable — the operations team can see both.

### 5.5 `booking_confirmed_client` on a cancelled-then-restored booking

C-04a's restore (`restoreBooking`) doesn't transition through pending. A booking goes `cancelled → confirmed` directly. The `booking_confirmed_client` hook fires only on `pending → confirmed`. So restored bookings DON'T re-send the confirmation email. Correct — C-04a's `sendBookingRestoredClientEmail` covers the restore case with its own template.

If the user wants restored bookings to also get the confirmation, that's a future enhancement — not in C-08 scope.

### 5.6 `claim` notification when admin claims (vs therapist claims) — SUPERSEDED 2026-07-16

~~**Locked decision:** yes, fire it.~~ **Superseded by the skip-self rule (§2.9, user direction 2026-07-16):** the claiming staff member is excluded from the `claim` alert via `excludeStaffId`. Other opted-in Owner/Admin recipients still receive it. If the claimer was the only opted-in recipient, no email fires (intentional — no fallback in the excluded-actor case).

### 5.6b Skip-self semantics across all internal alerts — 2026-07-16 amendment

The skip-self rule is general: any internal alert whose triggering action has a known staff actor passes `excludeStaffId: actor.id` to the resolver. Applies to: `enquiry_logged` (staff logged it), `slot_claimed` (staff claimed), `booking_cancelled` **when cancelled by staff** (admin cancel path), `reschedule/new-booking` never (customer-initiated, no actor). The customer-initiated legs pass no exclusion — every opted-in recipient hears about them.

### 5.6c Zero-recipient outcomes — 2026-07-16 amendment

Three distinct cases, handled differently:
1. **No profile has ever opted in** → resolver falls back to `getAdminRecipient(settings)` (today's behaviour). Alerts never silently vanish during rollout.
2. **Opted-in profiles exist but per-type prefs turned this type off everywhere** → no email; `skipped` delivery row with reason `all_recipients_opted_out`.
3. **Skip-self emptied the list** → no email; `skipped` delivery row with reason `actor_excluded`. Intentional.

### 5.7 Resend rate-limit

Same `(booking_id, event_type, recipient_email)` tuple resent within 60 seconds rejected with structured error. Admin sees: "Recently sent. Try again in 30 seconds." Prevents accidental double-clicks; doesn't block legitimate retry after a real failure.

### 5.8 Resend for an event whose underlying booking has changed since the original send

E.g., booking_confirmation sent at 10:00 with start_time=14:00. Admin reschedules to 15:00 at 11:00. Admin clicks Resend on the original 10:00 confirmation at 12:00. **The resend uses the CURRENT booking state** (15:00), not the historical state at original send-time.

This is intentional — admins typically resend because the original failed or the client lost it. They expect the new send to reflect current data. Document in the modal copy: *"the resend uses the current template + booking values"*.

### 5.9 Template-data.ts new entries hidden from non-eligible audiences

The Templates tab already groups by AUDIENCE_GROUPS. The new templates fall under existing groups (customer, staff, admin_internal). No new UI infrastructure needed.

### 5.10 What if a template has 0 historical sends (new template just shipped)?

The Delivery tab shows nothing. The Templates tab still shows the entry editable. As soon as the first send fires, the delivery row appears. No special empty-state needed.

---

## 6 — Migration footprint

**No new tables. No CHECK constraint changes for `email_delivery_events.event_type`** — verified during plan-writing that the only CHECK on the table is for `delivery_status`. New event_type values (`client_assigned_therapist`, `booking_confirmed_client`, `staff_unassignment`, `claim`, `enquiry_logged`) are pure code constants.

**One Zone-2 migration (2026-07-16 amendment — now definite, not conditional):**
- `staff_profiles.notification_email text NULL` (§2.8)
- `staff_profiles.business_notification_prefs jsonb NULL` (§2.8)
- Seed: Owner profile → `business_notification_prefs = '{"enabled": true}'`
- `email_delivery_events.metadata jsonb DEFAULT '{}'::jsonb` — **still conditional**: included only if pre-flight finds it missing (stores `resent_from_event_id` linkage).

**Audit log:** new action_types `email_resent` + `notification_settings_updated` — code constants only; no schema change.

**No new permissions.** `MANAGE_EMAIL_TEMPLATES` covers editing the new templates. `RESEND_BOOKING_EMAILS` covers the Resend button (already exists per `rbac.ts:33`). The `/admin/me` Notifications section is gated by role (Owner/Admin) + self-only writes — no permission row needed.

---

## 7 — Files touched (preview — full list in plan)

### NEW (~10 files)
- `src/app/admin/emails/components/ResendButton.tsx` — per-row Resend UI
- `src/app/admin/me/NotificationSettingsCard.tsx` — Notifications section UI (§2.8)
- `src/app/admin/me/actions.ts` — `saveNotificationSettings` server action (§2.8)
- `src/lib/email/__tests__/sendClientAssignedTherapistEmail.test.ts`
- `src/lib/email/__tests__/sendBookingConfirmedClientEmail.test.ts`
- `src/lib/email/__tests__/sendStaffUnassignmentEmail.test.ts`
- `src/lib/email/__tests__/sendClaimNotificationEmail.test.ts`
- `src/lib/email/__tests__/resolveBusinessNotificationRecipients.test.ts` — resolver + skip-self + fallback coverage (§2.9)
- `src/app/admin/emails/__tests__/resendEmail.test.ts`
- `supabase/migrations/<ts>_c08_notification_email_and_metadata.sql` — §6 migration (now definite)

### EDITED (~11 files)
| File | Change |
|---|---|
| `src/lib/email/templates.ts` | + 5 new render functions (`renderClientAssignedTherapistEmail`, `renderBookingConfirmedClientEmail`, `renderStaffUnassignmentEmail`, `renderClaimNotificationEmail`, `renderEnquiryLoggedEmail`) with `resolveTemplateOverrides` integration. Verify `renderStaffAssignmentEmail` field coverage. |
| `src/lib/email/notifications.ts` | + 5 new send functions + `resolveBusinessNotificationRecipients` resolver; reroute the 3 existing admin-leg sends through it (§2.9) |
| `src/app/admin/email-templates/actions.ts` | + 5 entries in SUBJECTS map |
| `src/app/admin/emails/components/templates-data.ts` | + 5 new TemplateMeta entries with field lists |
| `src/app/admin/emails/actions.ts` | + `resendEmail(deliveryEventId)` server action |
| `src/app/admin/emails/page.tsx` | Render `<ResendButton>` on each delivery row |
| `src/app/admin/bookings/actions.ts` | Wire `client_assigned_therapist` + `booking_confirmed_client` + `staff_unassignment` + `claim` hooks into the appropriate paths |
| `src/app/admin/enquiries/actions.ts` | Wire `enquiry_logged` hook into `createEnquiry` (§2.7) |
| `src/app/admin/me/page.tsx` | Mount `<NotificationSettingsCard>` for Owner/Admin (§2.8) |
| `src/lib/auth/rbac.ts` | + `notification_email` + `business_notification_prefs` on the `StaffProfile` type + profile fetch |
| `src/app/admin/clients/[clientId]/page.tsx` | + new entries in `AUDIT_PHRASING` (`email_resent`, `notification_settings_updated`) |

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- Existing email templates `booking_confirmation`, `booking_cancellation_*`, `booking_reminder` etc. — NO changes.
- Existing `sendStaffAssignmentEmail` — verified, NOT modified beyond templates-data.ts field list audit.

---

## 8 — Sequencing and dependencies

**No hard dependencies on prior C-NN plans.** C-08 ships independently:
- C-04a's `sendBookingRestoredClientEmail` is parallel infrastructure work — same patterns, separate templates.
- C-01's `sendReviewRequestEmail` is parallel — same patterns.
- C-FIELDWORK's capability-keyed model — C-08 aligns (`can_take_bookings`-based recipient resolution for assignment emails).

**Coordination with C-04a + C-01:**
- C-08 doesn't ship `booking_restored_client` (C-04a does).
- C-08 doesn't ship `review_request_client` (C-01 does).
- All three plans converge on the same `resolveTemplateOverrides` + `email_template_overrides` infrastructure.

**No coordination with C-11:** the new templates inherit theme styling from existing email templates (which are HTML-only, not theme-aware — emails render in the recipient's email client, not the admin tree). Email templates and admin-tree dark mode are independent.

**Coordination with C-15 (2026-07-16):** C-15 (email template studio) ships immediately after C-08 and overhauls the Templates tab UX — gallery, live preview, chip variables, reset-to-default, test send. C-08 registers its 5 new templates the current way (`templates-data.ts` entries); C-15's registry stays backward-compatible, so C-08's templates inherit the studio automatically. C-15's test-send button uses C-08's `notification_email` column as its recipient. Do not gold-plate C-08's template registration — C-15 owns the editor UX.

**Coordination with C-07 (2026-07-16):** both plans add a card to `/admin/me` (C-07: Quick links; C-08: Notifications). Whichever ships second mounts below the other; both are self-contained.

---

## 9 — Open questions

**Q9.1 — `staff_assignment` template — does its current templates-data.ts field list cover all override-able strings?**

Plan §1 Step 5 verifies during impl. Adjust `templates-data.ts:115` entry if any field is missing (e.g., body_signoff). Estimated work: 0-1 lines.

**Q9.2 — `client_assigned_therapist` — fire on every assignment change OR only when therapist's identity changes?**

Locked: **fire on every assignment change**. Includes reassignment (A → B), claim of previously-unassigned (null → A), unassign (A → null — but then there's no therapist to name; skip in this case).

For unassign with no replacement: don't fire `client_assigned_therapist` (no new therapist to name). Client gets `client_assigned_therapist` again when the next practitioner is assigned/claims.

**Q9.3 — `claim` notification — to which admin email? — SUPERSEDED 2026-07-16**

~~Locked: `getAdminRecipient(settings)`.~~ Superseded by §2.9: all opted-in Owner/Admin recipients via `resolveBusinessNotificationRecipients` (skip-self applies; `getAdminRecipient` survives only as the zero-opt-in fallback).

**Q9.4 — Resend button rate-limit — 60 seconds appropriate?**

Locked at 60s. Tuneable code constant. If admins complain about being too restrictive, lower to 30s. If accidental double-clicks are a problem, raise to 120s. Impl-time tuning expected.

**Q9.5 — Should resend include the original `error_message` in the resent email's metadata?**

Locked: no. Resend is a fresh send; the new event row has its own delivery_status + error_message. The `resent_from_event_id` linkage lets admin trace back to the original if needed.

**Q9.6 — `staff_unassignment` — include the reason if available?**

The existing audit log captures the reassignment reason if admin provided one. The template can interpolate `{unassignment_reason}` from the latest audit_log row's `after_state`. Optional default override-able field. Plan §2.3 default copy doesn't include it; admin can add via the override UI.

**Q9.7 — Per-template "send to admin too" toggle?**

Not in C-08 scope. The 4 new templates have hardcoded recipient logic (client / staff / admin_internal per audience). Adding a toggle to also CC admin is C-12+ feature.

**Q9.8 — Resend for `booking_cancellation_admin` — does it re-notify the original recipient or send to current admin recipient?**

Locked: **current admin recipient** (per `getAdminRecipient(settings)`). If admin email changed since the original send, the resend goes to the new address. Acceptable — operator intent is "I need this delivered now."

**Q9.9 — Should `resent_from_event_id` linkage be queryable from the UI?**

Optional polish — show "↻ Resent from <earlier event ID>" inline. Plan locks: include the linkage in the metadata column for forensic data; UI surfacing is C-12+ enhancement.

**Q9.10 — Resending an old event whose template content has been deleted (e.g., admin emptied the body_intro override after the original send)?**

Resend renders with CURRENT overrides. If admin emptied a field, the default copy fills in (per `resolveTemplateOverrides` behaviour — missing override falls back to the renderer's default). Acceptable.

---

## 10 — Acceptance criteria (what "done" looks like)

A C-08 implementation is complete when:

1. **4 new templates registered** in `templates-data.ts` and visible in the Templates tab.
2. **4 new send fns implemented** with override-aware rendering.
3. **SUBJECTS map extended** with 4 new entries.
4. **Trigger hooks wired** in the right server actions (claimBookingAssignment, updateBookingAssignment, quickUpdateBooking, updateBookingManagement).
5. **`client_assigned_therapist` fires** on assign + reassign + claim (not on unassign without replacement).
6. **`booking_confirmed_client` fires** on `pending → confirmed` only (verified for both `quickUpdateBooking` and `updateBookingManagement` paths).
7. **`staff_unassignment` fires** on reassign-away AND unassign-to-null (when there was a previous assigned_staff_id).
8. **`claim` admin notification fires** on every claim.
9. **Capability-keyed recipients verified** — Owner with `can_take_bookings=true` claiming a slot themselves gets the `staff_assignment` email AND admin gets the `claim` notification.
10. **`staff_assignment` template verified** in templates-data.ts; any missing fields added.
11. **Per-row Resend button visible** on every delivery row except `skipped` events.
12. **Rate-limit works** — same (booking, event, recipient) within 60s rejected with structured error.
13. **Resend uses current template + booking values** (verified by editing a template field, then resending an older event — new send reflects the edit).
14. **`resent_from_event_id` recorded** in new event's metadata.
15. **Audit log entry** `email_resent` written on every resend.
16. **All static gates pass** — lint, tsc, vitest, build, bundle delta within budget.
17. **Playwright role × event sweep** — Owner + Admin can edit + resend; Coord/Therapist blocked per RBAC.
18. **No regressions** on existing 9 templates + existing 7 delivery event types.
19. **(2026-07-16) `enquiry_logged` fires** on `createEnquiry`, and the logging staff member is never among the recipients (skip-self verified).
20. **(2026-07-16) Notifications section works** — Owner/Admin sees it on `/admin/me`, saves a notification email + per-type prefs, hint text present; Coord/Therapist never sees it.
21. **(2026-07-16) Resolver verified** — alerts go to opted-in Owner/Admin at `notification_email ?? email`; per-type opt-outs respected; zero-opt-in falls back to `getAdminRecipient`; one delivery row per recipient.
22. **(2026-07-16) Skip-self verified** — staff-initiated cancel / claim / enquiry never emails the actor.
23. **(2026-07-16) Migration applied + verified** — 2 staff_profiles columns + Owner seed (+ conditional metadata column); `generate_typescript_types` re-run.

---

## 11 — References

| Source | What it gives |
|---|---|
| `C-B-DECISIONS.md` §2 Q7 + §3 C-08 | 5-template scope (1 existing) + Resend tooling + capability-keyed audience |
| `19-emails-audit.md` B-83 + B-84 | Missing templates + missing Resend |
| `19-emails-audit.md` PE-51 | Existing template editor is exemplary — additive only |
| `W03-booking-lifecycle-flow.md` §2 B-115 | `booking_confirmed_client` gap |
| `W05-assignment-claim-reassign-flow.md` §2 B-127 | `staff_unassignment` gap |
| `bookings/actions.ts:239-365` | claimBookingAssignment — claim trigger site |
| `bookings/actions.ts:449-562` | updateBookingAssignment — assign/reassign/unassign trigger site |
| `bookings/actions.ts:387-401` | quickUpdateBooking — confirm trigger site |
| `bookings/actions.ts:118-237` | updateBookingManagement — Status form confirm trigger site |
| `lib/email/notifications.ts:471` | Existing `sendStaffAssignmentEmail` pattern |
| `lib/email/templates.ts:326` | Existing `renderStaffAssignmentEmail` |
| `lib/email/templates.ts:430` | `resolveTemplateOverrides` (lift target) |
| `email-templates/actions.ts:68-78` | SUBJECTS map |
| `emails/components/templates-data.ts` | TemplateMeta registration |

---

## 12 — Out of scope (explicit non-goals)

- **`review_request_client` template** — ships in C-01.
- **`booking_restored_client` template** — ships in C-04a.
- **`refund_issued` template** — C-04b dropped (no in-app refund tracking).
- **`booking_completed_client` template** — redundant with C-01 review email (intro paragraph carries the completion thanks).
- **Per-template CC admin toggle** — Q9.7, C-12+.
- **`resent_from_event_id` UI surfacing in delivery log** — Q9.9, C-12+.
- **Debouncing rapid reassignment emails** — §5.3, C-12+ if observed.
- **Resend rate-limit configurability via admin UI** — code constant only.
- **Email click tracking / open tracking beyond Resend's standard** — out of scope.
- **Multi-language template variants** — English-only.
- **Customer opt-out mechanism / unsubscribe link** — UK GDPR + PECR consideration for the broader compliance band; out of C-08 scope per master plan §130.
- **Reorganising existing AUDIENCE_GROUPS or template categorisation** — additive only; no restructure.
- **Adding `metadata.resent_from_event_id` column if not already present** — minor migration, but if existing column suffices, no schema change.

---

*End of C-08 brief. Plan file follows: `redesign/plans/C-phase/C-08-email-automation-expansion-plan.md`.*
