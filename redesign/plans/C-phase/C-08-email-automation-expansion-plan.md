# C-08 — Email automation expansion — **PLAN**

> **Refinement 2026-07-26** — verified against `master` @ `ea97932` (post-merge single source of truth).
> Dependencies: none — C-08 ships independently (brief §8). See §1 Step 15 and §1 Sub-step 3 below for same-file coordination notes (not blocking sequencing; confirmed programme order runs C-04a before C-08).
> Decisions: C-B-DECISIONS.md §3 C-08 (2026-07-16 amendment supersedes the "no schema migration" lock — reconfirmed 2026-07-26, D6/C08-F4). Findings applied: see refinement changelog.

**Type:** Band C plan-writing output (C-B phase)
**Date written:** 2026-05-26
**Amended:** 2026-07-16 — business-notifications bundle (user direction): new Phase D (steps 13–18) — `staff_profiles.notification_email` + per-type prefs migration, `resolveBusinessNotificationRecipients` resolver with skip-self, `enquiry_logged` template, `/admin/me` Notifications section. Migration is now definite Zone-2 (was conditional). See brief §2.7–§2.9.
**Brief:** `redesign/briefs/C-08-email-automation-expansion-brief.md` (companion — read first)
**Progress (filled in C-C):** `redesign/per-page-progress/C-08-email-automation-expansion-progress.md`
**Operating discipline:** per `redesign/plans/C-phase/BAND-C-MASTER-PLAN.md#part-0-operating-discipline`

---

## 0 — Pre-flight

1. **Branch + clean tree.** On `master`; HEAD at or descended from `ea97932` — verify with `git branch --show-current` + `git merge-base --is-ancestor ea97932 HEAD`. `git status --porcelain -- src/lib/email/ src/app/admin/emails/ src/app/admin/email-templates/ src/app/admin/bookings/actions.ts src/app/admin/enquiries/actions.ts src/app/admin/me/ src/lib/auth/rbac.ts src/app/admin/clients/` returns empty (path-scoped to this plan's touched files — the wider tree is intentionally dirty: untracked photo/design folders, deleted `.playwright-mcp/` logs; never stage broadly, never stash/restore/checkout to "clean" it).
2. **Dev server reachable.** `curl -I http://localhost:3000/admin/login/` → 200.
3. **Baseline tests.** `pnpm vitest run` shows 485 / 491 passing.
4. **Static gates green.** `npx tsc --noEmit` — 0 errors. `pnpm lint` — no NEW errors vs the verified 59-error baseline (55 from untracked `design_handoff_area_pages/prototype/*.jsx` + 4 pre-existing in `src/features/booking/`).
5. **DB verification:**

   ```sql
   -- (a) CHECK constraint inventory on email_delivery_events
   SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c
   JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'email_delivery_events' AND c.contype = 'c';
   -- Expected: only delivery_status CHECK; event_type unconstrained.

   -- (b) metadata column inventory
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'email_delivery_events' AND column_name IN ('metadata', 'resent_from_event_id');
   -- If metadata exists (jsonb) → use it. If absent → migration needed.

   -- (c) Production event_type histogram (verify current state baseline)
   SELECT event_type, COUNT(*) FROM email_delivery_events GROUP BY event_type ORDER BY event_type;
   -- Capture for §3.2 post-deploy delta.
   ```

6. **Existing template inventory:**

   ```bash
   grep -n "id:" src/app/admin/emails/components/templates-data.ts | head -15
   # Expected: 9 templates registered; staff_assignment confirmed at line ~115.

   grep -nE "^export (async )?function (send|render)" src/lib/email/notifications.ts src/lib/email/templates.ts
   # Confirm sendStaffAssignmentEmail + renderStaffAssignmentEmail exist.
   ```

7. **`getAdminRecipient(settings)` location:**

   ```bash
   grep -rn "getAdminRecipient" src/lib/email/ src/lib/booking/
   # Confirm function exists and returns the admin email(s) for new email recipients.
   ```

8. **RBAC permission check:**

   ```sql
   SELECT role_name, permission FROM (
     SELECT r.name AS role_name, p.name AS permission
     FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE p.name IN ('manage_email_templates', 'resend_booking_emails')
   ) sub
   ORDER BY role_name, permission;
   -- Expected: Owner + Admin have both. Coord + Therapist don't.
   ```

9. **Test fixture inventory:**
   - At least one test booking with assigned_staff_id set (for resend testing).
   - At least one test booking with status='pending' (for booking_confirmed_client testing).
   - At least one test booking with 2+ assignments (for unassignment testing).
   - Test client emails ending in `.example.test`.

10. **DO-NOT-TOUCH list:** Badar's `9d55ce2a`, any real customer booking.

    DO-NOT-TOUCH (live data): booking 9d55ce2a (Badar — real customer email); Owner account rahmatherapy@outlook.com in email-test paths; any client whose email isn't *.example.test or name isn't Phase10*/Audit Test* test patterns.

11. **(2026-07-16) Notification-infrastructure verification:**

    ```sql
    -- (a) staff_profiles columns must NOT pre-exist (migration adds them)
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'staff_profiles'
      AND column_name IN ('notification_email', 'business_notification_prefs');
    -- Expected: 0 rows. If present, reconcile with C-11's theme_preference migration ordering.

    -- (b) email_delivery_events.booking_id nullability (enquiry_logged has no booking)
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'email_delivery_events' AND column_name = 'booking_id';
    -- If 'NO': log enquiry_logged with metadata.enquiry_id instead and flag to user (brief §2.7).

    -- (c) Owner + Admin role ids for the seed + resolver role filter
    SELECT id, name FROM roles WHERE name IN ('Owner', 'Admin');
    ```

12. **(2026-07-16) Enquiry action inventory:** `grep -n "createEnquiry" src/app/admin/enquiries/actions.ts` — confirm the insert + audit shape before wiring the `enquiry_logged` hook; confirm no existing email send in the action.

If pre-flight fails (especially #5b — metadata column absence — or #11b), surface to user before proceeding.

---

## 1 — Safe implementation order (4 phases — pattern repeats across templates)

Each template ships through the same 7-step pattern (per decisions doc §3 C-08). Phase A handles all 4 net-new booking-lifecycle templates as separate commits; Phase B handles the existing-template verification; Phase C ships the Resend tooling; **Phase D (2026-07-16 amendment) ships the business-notification bundle** — migration, resolver, rerouting, `enquiry_logged`, and the `/admin/me` Notifications section. Phase D lands last because the resolver rerouting touches the same send functions Phases A–C stabilise.

### Phase A — Net-new templates (per template, one commit each — 4 commits)

**Template ordering — easiest to hardest:**
1. `booking_confirmed_client` (commit 1) — simplest hook (one condition in two server actions)
2. `staff_unassignment` (commit 2) — requires beforeState capture
3. `claim` (commit 3) — single trigger site
4. `client_assigned_therapist` (commit 4) — fires from 3+ trigger sites, most complex

**Per-template sub-steps (7 per template, repeating):**

**Sub-step 1 — Renderer in `templates.ts`.**

For `booking_confirmed_client`:

```ts
// src/lib/email/templates.ts — add after renderBookingReminderEmail (~line 380)

export function renderBookingConfirmedClientEmail(
  input: BookingEmailTemplateInput
): Promise<string> {
  return (async () => {
    const overrides = await resolveTemplateOverrides("booking_confirmed_client");
    const vars = buildVarMap(input);

    // NOTE (2026-07-26 refinement, F1): subject is NOT a templates-data.ts override
    // field in the real schema — no existing template exposes a "subject" override
    // key; email-templates/actions.ts's SUBJECTS map (Sub-step 2) is the sole
    // subject-line source, matching all 9 existing templates.
    const subject = "Your booking is confirmed";
    const body_intro = substituteVars(
      overrides.body_intro ??
        "Hi {clientName}, your appointment on {bookingDate} at {startTime} is confirmed. We'll send a reminder closer to the day.",
      vars
    );
    const body_cta_label = overrides.body_cta_label ?? "Manage your booking";
    const body_signoff = substituteVars(
      overrides.body_signoff ?? "Thank you,\nThe Rahma Therapy team",
      vars
    );

    return renderLayout(subject, `
      <p>${escapeHtml(body_intro)}</p>
      ${input.manageUrl ? `
        <p style="margin:24px 0;">
          <a href="${escapeHtml(input.manageUrl)}" style="display:inline-block;background:#0f5e8e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            ${escapeHtml(body_cta_label)}
          </a>
        </p>
      ` : ""}
      <p style="white-space:pre-line;">${escapeHtml(body_signoff)}</p>
    `);
  })();
}
```

Plain-text variant (for fallback):

```ts
export function renderBookingConfirmedClientPlainText(
  input: BookingEmailTemplateInput
): string {
  return `Your booking is confirmed

Hi ${input.clientName}, your appointment on ${input.bookingDate} at ${input.startTime} is confirmed. We'll send a reminder closer to the day.

${input.manageUrl ? `Manage your booking: ${input.manageUrl}\n\n` : ""}Thank you,
The Rahma Therapy team`;
}
```

For each subsequent template (`staff_unassignment`, `claim`, `client_assigned_therapist`), follow the same shape. Default copy per brief §2.

**Sub-step 2 — SUBJECTS map.**

Edit `src/app/admin/email-templates/actions.ts:68-78`:

```ts
const SUBJECTS: Record<string, string> = {
  booking_confirmation: "Booking request received",
  // ... existing entries ...
  booking_confirmed_client: "Your booking is confirmed",
  client_assigned_therapist: "Your therapist for {bookingDate}",
  staff_unassignment: "Booking assignment removed",
  claim: "Slot claimed",
};
```

**Sub-step 3 — `templates-data.ts` registration.**

> **(2026-07-26 refinement, F1 — high severity, confirmed)** The sample originally here did not compile against the real schema: `TemplateMeta` requires `{ id, audience, cardName, trigger, rendersAs: "html"|"plain_text", fields: SafeField[] }` — there is no `description` property (fold that prose into `trigger`). `SafeFieldKind` is a closed union of exactly `greeting_intro | footer_contact | group_copy | intro | wrapper_change_summary | plain_text_intro` (verified `templates-data.ts:8-32`), and `fields` are `SafeField` objects (`kind`, `label`, `placeholder`, `helper`, `maxLength`, optional `multiline`) drawn from shared consts — not ad hoc `{kind, label, maxLength}` shapes. Corrected below per D7 (decisions-resolved.md): extend `SafeFieldKind` minimally; C-15 owns the fuller registry rework later, this extension is additive only.

Edit `src/app/admin/emails/components/templates-data.ts`. First, extend the closed union (minimal, additive — 3 new kinds covering what these templates need; no existing kind fits):

```ts
export type SafeFieldKind =
  | "greeting_intro"
  | "footer_contact"
  | "group_copy"
  | "intro"
  | "wrapper_change_summary"
  | "plain_text_intro"
  | "body_intro"       // NEW — intro paragraph, C-08's 5 templates
  | "body_cta_label"    // NEW — CTA button label (templates with a manage/action link)
  | "body_signoff";     // NEW — closing signoff line
```

Add matching shared `SafeField` consts alongside `FOOTER_CONTACT`/`GREETING_INTRO` etc.:

```ts
const BODY_INTRO: SafeField = {
  kind: "body_intro",
  label: "Intro paragraph",
  placeholder: "Hi {clientName}, your appointment on {bookingDate} at {startTime} is confirmed.",
  helper: "Variables in curly braces are filled automatically.",
  maxLength: 500,
  multiline: true,
};

const BODY_CTA_LABEL: SafeField = {
  kind: "body_cta_label",
  label: "CTA button label",
  placeholder: "Manage your booking",
  helper: "Text on the action button, where the template has one.",
  maxLength: 80,
};

const BODY_SIGNOFF: SafeField = {
  kind: "body_signoff",
  label: "Signoff",
  placeholder: "Thank you,\nThe Rahma Therapy team",
  helper: "Closing line above the footer contact line.",
  maxLength: 200,
  multiline: true,
};
```

Then add the TemplateMeta entry (no `subject` field — subject stays SUBJECTS-map-only, matching all 9 existing templates; no `description` property):

```ts
{
  id: "booking_confirmed_client",
  audience: "customer",
  cardName: "Booking confirmed - client",
  trigger: "Sent when admin confirms a pending booking with the client. Fires on pending→confirmed transitions in quickUpdateBooking and updateBookingManagement.",
  rendersAs: "html",
  fields: [BODY_INTRO, BODY_CTA_LABEL, BODY_SIGNOFF, FOOTER_CONTACT],
},
```

(Mirror for each of the 4 templates using this corrected shape — `id`/`audience`/`cardName`/`trigger`/`rendersAs`/`fields`, drawing from `BODY_INTRO`/`BODY_CTA_LABEL`/`BODY_SIGNOFF`/`FOOTER_CONTACT`; omit `BODY_CTA_LABEL` for templates with no action link, e.g. `staff_unassignment`/`claim`. `audience` values per brief §3. Step 16's `enquiry_logged` registration follows this same corrected shape under `admin_internal`.)

> **Coordination (rubric §10 / collision-map §7):** `templates-data.ts`'s `TemplateMeta`/`SafeFieldKind` schema is also edited by C-01, C-02, C-13, and (primarily) C-15. Before this step, re-grep the file's `SafeFieldKind` union — if C-01 (or another plan) has already landed a compatible extension, reuse it rather than adding a second, incompatible one. Any new field's `maxLength` must stay ≤500 chars (`email_template_overrides.value` CHECK constraint — D13).

**Sub-step 4 — Send fn in `notifications.ts`.**

For `booking_confirmed_client`:

```ts
// src/lib/email/notifications.ts — add after sendBookingReminderEmail (~line 520)

export async function sendBookingConfirmedClientEmail(
  bookingId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { booking, input } = await getBookingTemplateInput(bookingId, supabase, {
    includeManageUrl: true,
  });
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) throw new Error("Booking client has no email address.");

  const html = await renderBookingConfirmedClientEmail(input);

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "booking_confirmed_client",
    recipientRole: "customer",
    to: customerEmail,
    subject: "Your booking is confirmed",  // SUBJECTS map authoritative
    html,
    text: renderBookingConfirmedClientPlainText(input),
  });
}
```

Same shape for the other 3 templates. **`sendClaimNotificationEmail` and `sendStaffUnassignmentEmail`** differ in recipient resolution:

```ts
export async function sendStaffUnassignmentEmail(
  bookingId: string,
  previousStaffId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { booking, input } = await getBookingTemplateInput(bookingId, supabase);

  // Look up the previous staff's email
  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("email, name")
    .eq("id", previousStaffId)
    .maybeSingle();
  if (!staff?.email) {
    console.warn(`Staff ${previousStaffId} has no email; skipping unassignment notification.`);
    return;
  }

  const html = await renderStaffUnassignmentEmail({ ...input, therapistName: staff.name });

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "staff_unassignment",
    recipientRole: "staff",
    to: staff.email,
    subject: "Booking assignment removed",
    html,
    text: renderStaffUnassignmentPlainText({ ...input, therapistName: staff.name }),
  });
}

export async function sendClaimNotificationEmail(
  bookingId: string,
  claimingStaffId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { booking, settings, input } = await getBookingTemplateInput(bookingId, supabase);
  const { data: claimingStaff } = await supabase
    .from("staff_profiles")
    .select("name")
    .eq("id", claimingStaffId)
    .maybeSingle();

  // NOTE (2026-07-16): getAdminRecipient here is Phase-A-interim only.
  // Phase D Step 15 reroutes this send through resolveBusinessNotificationRecipients
  // (multi-recipient, per-type prefs, skip-self via the claiming staff id).
  const adminRecipient = getAdminRecipient(settings);
  if (!adminRecipient) return;  // no admin email configured

  const html = await renderClaimNotificationEmail({
    ...input,
    therapistName: claimingStaff?.name ?? "(unknown)",
    bookingId,
  });

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "claim",
    recipientRole: "admin",
    to: adminRecipient,
    subject: `Slot claimed: ${claimingStaff?.name ?? "(unknown)"} → ${input.bookingDate}`,
    html,
    text: renderClaimNotificationPlainText({ ...input, therapistName: claimingStaff?.name ?? "(unknown)" }),
  });
}
```

`sendClientAssignedTherapistEmail`:

```ts
export async function sendClientAssignedTherapistEmail(
  bookingId: string,
  assignedStaffId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { booking, input } = await getBookingTemplateInput(bookingId, supabase, {
    includeManageUrl: true,
  });
  const customerEmail = booking.contact_email || booking.clients?.email;
  if (!customerEmail) throw new Error("Booking client has no email address.");

  const { data: assignedStaff } = await supabase
    .from("staff_profiles")
    .select("name")
    .eq("id", assignedStaffId)
    .maybeSingle();

  const html = await renderClientAssignedTherapistEmail({
    ...input,
    therapistName: assignedStaff?.name ?? "your therapist",
  });

  await sendTrackedEmail(supabase, {
    bookingId,
    eventType: "client_assigned_therapist",
    recipientRole: "customer",
    to: customerEmail,
    subject: `Your therapist for ${input.bookingDate}`,
    html,
    text: renderClientAssignedTherapistPlainText({ ...input, therapistName: assignedStaff?.name ?? "your therapist" }),
  });
}
```

**Sub-step 5 — Wire into trigger server actions.**

For `booking_confirmed_client` — edit `src/app/admin/bookings/actions.ts`:

In `quickUpdateBooking` (around line 423-437, after the existing branched email sends):

```ts
// C-08: booking_confirmed_client on pending → confirmed
if (beforeState.status === "pending" && updatedBooking.status === "confirmed") {
  await sendBookingConfirmedClientEmail(bookingId, adminClient).catch((error) => {
    console.error("Unable to send booking_confirmed_client email.", error);
  });
}
```

Same hook in `updateBookingManagement` (around line 213-227).

For `claim` — in `claimBookingAssignment` (line 348-355, after the existing `sendStaffAssignmentEmail`):

```ts
// C-08: claim notification to admin
await sendClaimNotificationEmail(claimedAssignment.booking_id, actor.id, adminClient).catch((error) => {
  console.error("Unable to send claim notification email.", error);
});

// C-08: client_assigned_therapist (NEW assignment from claim = client notified)
await sendClientAssignedTherapistEmail(claimedAssignment.booking_id, actor.id, adminClient).catch((error) => {
  console.error("Unable to send client_assigned_therapist email.", error);
});
```

For `staff_unassignment` AND `client_assigned_therapist` (reassign) — in `updateBookingAssignment` (line 449-562):

Capture `beforeState.assigned_staff_id` BEFORE the UPDATE:

```ts
const previousStaffId = beforeState.assigned_staff_id;
// ... existing UPDATE logic ...
const newStaffId = updatedAssignment.assigned_staff_id;

// C-08: staff_unassignment if previous existed AND (unassigned OR reassigned away)
if (previousStaffId && previousStaffId !== newStaffId) {
  await sendStaffUnassignmentEmail(bookingId, previousStaffId, adminClient).catch((error) => {
    console.error("Unable to send staff_unassignment email.", error);
  });
}

// C-08: client_assigned_therapist on new assignment (assign or reassign-to-different)
if (newStaffId && newStaffId !== previousStaffId) {
  await sendClientAssignedTherapistEmail(bookingId, newStaffId, adminClient).catch((error) => {
    console.error("Unable to send client_assigned_therapist email.", error);
  });
}
```

**Sub-step 6 — Vitest spec.**

Per send-fn, new test file `src/lib/email/__tests__/send{Name}Email.test.ts`:
- Happy path: renders correctly, calls sendTrackedEmail with expected args.
- No email on file: throws or returns without sending.
- Override applied: edit `email_template_overrides` row, verify the override appears in rendered HTML.

Per trigger site, extend existing booking-action tests to assert the new send-fn is called when the predicate holds.

**Sub-step 7 — AUDIT_PHRASING entry.**

The new send-fns don't write directly to audit_logs (the existing email-send pattern logs via `email_delivery_events` only). But the Resend feature writes `action_type='email_resent'`. Defer the AUDIT_PHRASING change to Phase C.

**Phase A verify checkpoints (one per template):**
- `pnpm lint` + `tsc` green
- New send-fn test passes
- Trigger hooks verified via Playwright walk:
  - For `booking_confirmed_client`: confirm a pending booking → verify email_delivery_events row + Resend dashboard entry
  - For `staff_unassignment`: reassign A → B on a booking → verify A's email
  - For `claim`: claim an unassigned slot → verify admin notification
  - For `client_assigned_therapist`: same trigger paths → verify client email

### Phase B — Existing template verification (work area 2.5)

**Step 5 — Audit `staff_assignment` template's templates-data.ts entry.**

Read `templates-data.ts:115`. Compare its field list against what `renderStaffAssignmentEmail` actually overrides via `resolveTemplateOverrides("staff_assignment")`:

```bash
grep -n "resolveTemplateOverrides" src/lib/email/templates.ts | head -10
# Find the resolve call inside renderStaffAssignmentEmail. Identify all overrides[<key>] reads.
```

For each override key the renderer reads (subject, body_intro, body_signoff, etc.), confirm it's listed in the templates-data.ts entry. If a key is missing, add it.

Expected: most fields already covered. Documented as a verification + tiny patch.

**Step 6 — Capability-keyed recipient verification.**

Verify `sendStaffAssignmentEmail` uses the assignment's `assigned_staff_id` (not role-keyed). Look at the function body in `notifications.ts:471`:

```bash
sed -n '471,491p' src/lib/email/notifications.ts
```

If it queries `staff_profiles` by `id = assigned_staff_id`, it's already capability-keyed (any role with `can_take_bookings=true` who got assigned gets the email). Document as confirmed.

**Phase B verify checkpoint:**
- staff_assignment templates-data.ts entry covers all override-able fields
- Capability-keyed recipient verified
- No code change beyond templates-data.ts field-list additions

### Phase C — Per-row Resend tooling (work area 3)

**Step 7 — `email_delivery_events.metadata` column (Zone-2 if needed). — ABSORBED INTO STEP 13 (2026-07-16)**

The conditional metadata column now ships inside Phase D Step 13's single migration; no separate Phase C migration. If Phase C is implemented before Phase D in the same C-C window (expected), either apply Step 13's migration early at this point or defer Resend-linkage writes until Step 13 lands — implementer's call, surfaced to the user. Original conditional migration (reference):

```sql
-- supabase/migrations/<ts>_c08_email_delivery_metadata.sql

BEGIN;
ALTER TABLE public.email_delivery_events
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
COMMIT;
```

Apply via `mcp__supabase__apply_migration`. **Zone-2 — explicit user confirmation.** Capture migration_name.

Post-migration: `mcp__supabase__generate_typescript_types`.

**Step 8 — `resendEmail` server action.**

Edit `src/app/admin/emails/actions.ts`. Add:

```ts
const RESEND_RATE_LIMIT_SECONDS = 60;

interface ResendEmailResult {
  ok: boolean;
  newEventId?: string;
  error?: string;
}

export async function resendEmail(
  _previousState: ResendEmailResult | null,
  formData: FormData
): Promise<ResendEmailResult> {
  // RBAC
  const supabase = await createSupabaseServerClient();
  let actor;
  try {
    actor = await requirePermission(PERMISSIONS.RESEND_BOOKING_EMAILS, supabase);
  } catch (error) {
    if (error instanceof PermissionError) return { ok: false, error: "Insufficient permissions." };
    throw error;
  }

  const deliveryEventId = String(formData.get("delivery_event_id") ?? "").trim();
  if (!deliveryEventId) return { ok: false, error: "Delivery event is required." };

  const adminClient = createSupabaseAdminClient();

  // Fetch original event
  const { data: original, error: fetchErr } = await adminClient
    .from("email_delivery_events")
    .select("id, booking_id, event_type, recipient_email, recipient_role, delivery_status, created_at")
    .eq("id", deliveryEventId)
    .maybeSingle();

  if (fetchErr || !original) {
    return { ok: false, error: "Delivery event not found." };
  }

  if (original.delivery_status === "skipped") {
    return { ok: false, error: "Skipped events have no content to resend." };
  }

  // Rate-limit check
  const cutoff = new Date(Date.now() - RESEND_RATE_LIMIT_SECONDS * 1000).toISOString();
  const { data: recent } = await adminClient
    .from("email_delivery_events")
    .select("id")
    .eq("booking_id", original.booking_id)
    .eq("event_type", original.event_type)
    .eq("recipient_email", original.recipient_email)
    .gte("created_at", cutoff)
    .limit(1)
    .maybeSingle();
  if (recent) {
    return { ok: false, error: `Recently sent. Try again in ${RESEND_RATE_LIMIT_SECONDS} seconds.` };
  }

  // Re-send via the appropriate send-fn dispatched by event_type
  try {
    await dispatchResend(original.event_type, original.booking_id, original.recipient_email, adminClient);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Resend failed." };
  }

  // Fetch the newest event row for this booking+event_type (the resend just wrote)
  const { data: newest } = await adminClient
    .from("email_delivery_events")
    .select("id")
    .eq("booking_id", original.booking_id)
    .eq("event_type", original.event_type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (newest) {
    // Mark linkage in metadata
    await adminClient
      .from("email_delivery_events")
      .update({ metadata: { resent_from_event_id: deliveryEventId } })
      .eq("id", newest.id);

    // Audit log row
    await adminClient.from("audit_logs").insert({
      actor_staff_id: actor.id,
      action_type: "email_resent",
      target_type: "email_delivery_events",
      target_id: newest.id,
      after_state: {
        resent_from: deliveryEventId,
        event_type: original.event_type,
        recipient_email: original.recipient_email,
      },
    });
  }

  revalidatePath("/admin/emails");
  return { ok: true, newEventId: newest?.id };
}

async function dispatchResend(
  eventType: string,
  bookingId: string,
  recipientEmail: string,
  supabase: SupabaseClient
): Promise<void> {
  switch (eventType) {
    case "booking_confirmation":
      return sendBookingCreatedEmails(bookingId, supabase).then(() => undefined);
    case "booking_cancellation_customer":
    case "booking_cancellation_admin":
      return sendBookingCancellationEmails(bookingId, supabase, { initiatedBy: "admin" });
    case "booking_reminder":
      return sendBookingReminderEmail(bookingId, supabase);
    case "staff_assignment":
      return sendStaffAssignmentEmail(bookingId, recipientEmail, supabase, /* staffId tbd */).then(() => undefined);
    case "staff_booking_change":
      return sendAssignedStaffBookingChangeEmails(bookingId, supabase, "Resent change notification.");
    case "client_assigned_therapist":
      // Need to look up the current assigned staff_id
      // ... derive from booking_assignments + recipient_email
      return; // simplified — full impl looks up assigned staff
    case "booking_confirmed_client":
      return sendBookingConfirmedClientEmail(bookingId, supabase);
    case "staff_unassignment":
      // Need the previousStaffId — for resend, look up by recipient_email
      return; // simplified
    case "claim":
      // Need the claimingStaffId — for resend, look up the most recent claim audit row
      return; // simplified
    default:
      throw new Error(`Cannot resend event type: ${eventType}`);
  }
}
```

**Note on dispatchResend complexity:** some event types (`staff_assignment`, `staff_unassignment`, `claim`, `client_assigned_therapist`) need additional context (which staff ID). For resend, recovery strategies:
- Look up the staff_profile by recipient_email (works for `staff_assignment` / `staff_unassignment`)
- Look up the claiming staff from the most recent `booking_assignment_claimed` audit_log row for this booking (for `claim`)
- Look up the current assigned_staff_id (for `client_assigned_therapist`)

Plan §9.1 + §9.2 surface this complexity for impl-time decision. Conservative approach: implement basic resend for the simpler templates first; mark complex-dispatch ones as "not yet resendable" with a structured error.

**Step 9 — `ResendButton.tsx` component.**

New file `src/app/admin/emails/components/ResendButton.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionModal } from "../../components/admin-ui-interactions";
import { resendEmail } from "../actions";

interface ResendButtonProps {
  deliveryEventId: string;
  eventType: string;
  recipientEmail: string;
}

export function ResendButton({ deliveryEventId, eventType, recipientEmail }: ResendButtonProps) {
  const [state, formAction, pending] = useActionState(resendEmail, null);

  // Toast on response
  if (state?.ok) {
    toast.success(`Resent ${eventType} to ${recipientEmail}.`);
  } else if (state?.error) {
    toast.error(state.error);
  }

  return (
    <ConfirmActionModal
      title="Resend this email?"
      description={`A new copy of ${eventType} will be sent to ${recipientEmail} using the current template settings. The original send is preserved.`}
      confirmLabel="Resend"
      cancelLabel="Cancel"
      onConfirm={() => {
        const form = new FormData();
        form.set("delivery_event_id", deliveryEventId);
        formAction(form);
      }}
      trigger={
        <button
          type="button"
          disabled={pending}
          className="inline-flex h-9 sm:h-8 items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-form)] bg-transparent px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-50"
          aria-label={`Resend ${eventType} to ${recipientEmail}`}
        >
          <Repeat2 className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Resend</span>
        </button>
      }
    />
  );
}
```

**Step 10 — Wire button into delivery rows.**

Edit `src/app/admin/emails/page.tsx` — locate the delivery-row rendering (search for `event_type` JSX rendering). For each row where `delivery_status !== 'skipped'` AND the actor has `RESEND_BOOKING_EMAILS`, render `<ResendButton ... />`.

The RBAC check can be done server-side at the page level (`canResendBookingEmails(profile)`) — pass a `canResend` boolean to the row renderer.

**Step 11 — Vitest spec for `resendEmail`.**

New file `src/app/admin/emails/__tests__/resendEmail.test.ts`:
- RBAC: Coord without permission → "Insufficient permissions."
- Event not found → error.
- Skipped event → error "Skipped events have no content to resend."
- Rate-limit: same (booking, event, recipient) within 60s → rejected.
- Happy path: dispatches to the right send-fn, writes metadata.resent_from_event_id, writes audit_logs `email_resent`.

**Step 12 — AUDIT_PHRASING entry.**

Edit `src/app/admin/clients/[clientId]/page.tsx:127-138`:

```ts
email_resent: "Email resent",
```

**Phase C verify checkpoint:**
- New tests pass.
- Manual: as Owner on `/admin/emails`, click Resend on a booking_confirmation row → modal opens → confirm → toast + new delivery row appears.
- As Coord (without RESEND_BOOKING_EMAILS), buttons hidden.
- Rate-limit verified: re-click within 60s → toast with rate-limit error.

### Phase D — Business-notification bundle (2026-07-16 amendment; brief §2.7–§2.9)

> ⛔ **HARD-STOP — ZONE-2: USER CONFIRMATION REQUIRED** ⛔
> An executing agent MUST pause here and obtain explicit user approval in chat before proceeding.
> Action: apply migration `<ts>_c08_notification_email_and_metadata.sql` to production — adds `staff_profiles.notification_email` + `staff_profiles.business_notification_prefs`, seeds the active Owner row(s), and conditionally adds `email_delivery_events.metadata` if pre-flight #5b found it absent.
> Exact SQL / change: verbatim in the Step 13 body below.
> Post-action verification: re-run pre-flight #11a (expect the 2 new `staff_profiles` columns present) + confirm exactly the active Owner row(s) were seeded (seeded row count matches active-Owner-profile count) + no other rows touched.
> Never auto-apply. Approval is per-action and does not carry forward.

**Step 13 — Migration (Zone-2 — explicit user confirmation).**

```sql
-- supabase/migrations/<ts>_c08_notification_email_and_metadata.sql
BEGIN;

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS notification_email text,
  ADD COLUMN IF NOT EXISTS business_notification_prefs jsonb;

-- Seed: Owner opted in from day one (all alert types default on).
UPDATE public.staff_profiles sp
SET business_notification_prefs = '{"enabled": true}'::jsonb
FROM public.roles r
WHERE sp.role_id = r.id AND r.name = 'Owner' AND sp.active = true
  AND sp.business_notification_prefs IS NULL;

-- Conditional (pre-flight #5b): resend linkage storage.
ALTER TABLE public.email_delivery_events
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMIT;
```

Apply via `mcp__supabase__apply_migration`; then `mcp__supabase__generate_typescript_types`. Post-migration verification: columns exist; exactly the Owner row(s) seeded; no other rows touched.

*(This step absorbs the old Phase C Step 7 conditional migration — one migration, not two.)*

**Step 14 — `resolveBusinessNotificationRecipients` in `notifications.ts`.**

Implement per brief §2.9 (contract reproduced there): active Owner/Admin profiles with `business_notification_prefs->>'enabled' = 'true'` → filter per-type opt-outs (`prefs.types[type] === false`) → filter `excludeStaffId` (skip-self) → map to `notification_email ?? email` → **zero-opted-in-anywhere fallback** to `getAdminRecipient(settings)` (fallback does NOT apply when prefs/skip-self emptied a non-empty opt-in list — write `skipped` delivery rows with reasons `all_recipients_opted_out` / `actor_excluded` instead).

Alert-type keys (locked): `new_booking_request`, `booking_cancelled`, `reschedule_request`, `enquiry_logged`, `slot_claimed`.

**Step 15 — Reroute all admin_internal sends through the resolver.**

> **Coordination (rubric §10 / D26):** `sendBookingCancellationEmails` (`notifications.ts`, currently `:409-422`) is also edited by C-04a (adds a `delaySeconds`-based deferred send). Per the confirmed programme order, C-04a lands before C-08 — re-grep the function body before this step; expect C-04a's deferred-send changes already present in this region, and thread this step's `actorStaffId` param into whatever shape C-04a leaves the function in, rather than trusting the line numbers cited above.

One edit per send-fn — each loops the resolved recipients and writes one tracked email per recipient:
- `sendBookingCreatedEmails` admin leg (`notifications.ts:366-379`) — type `new_booking_request`, no exclusion (customer-initiated).
- `sendBookingCancellationEmails` admin leg (`notifications.ts:409-422`) — type `booking_cancelled`; pass the cancelling staff id when `initiatedBy: "admin"` (thread an optional `actorStaffId` through the options param); customer-initiated passes none.
- `sendBookingRescheduleRequestEmails` admin leg — type `reschedule_request`, no exclusion.
- `sendClaimNotificationEmail` (Phase A Step 4) — type `slot_claimed`, `excludeStaffId: claimingStaffId`. Removes the Phase-A-interim `getAdminRecipient` call.

**Step 16 — `enquiry_logged` template + hook.**

Follows the standard 7-sub-step template pattern (renderer + plain-text + SUBJECTS entry `"New enquiry: {clientName}"` + templates-data registration under admin_internal + send fn + trigger + tests). Trigger: `createEnquiry` (`src/app/admin/enquiries/actions.ts:49`) after the insert + audit row, catch-and-continue. Send fn resolves recipients with `type: 'enquiry_logged'`, `excludeStaffId: actor.id`. Delivery rows: `event_type='enquiry_logged'`, `recipient_role='admin'`, `booking_id` null (or `metadata.enquiry_id` per pre-flight #11b).

**Step 17 — `/admin/me` Notifications section.**

- New `src/app/admin/me/NotificationSettingsCard.tsx` (client component): notification-email input with the locked hint copy — *"Business alerts (new bookings, enquiries, cancellations) are sent to this address. Leave empty to use your login email ({login email})."* — master toggle "Receive business alerts", five per-type checkboxes (disabled while master off), save button with pending state + success/error toast. Mobile-first at 375; `min-h-11` controls; CSS variables only (C-11 dark-mode-safe).
- New `src/app/admin/me/actions.ts` — `saveNotificationSettings` server action: role gate (Owner/Admin), **writes the actor's own row only**, email format validation (empty allowed), audit row `notification_settings_updated` with before/after state.
- Edit `src/app/admin/me/page.tsx`: mount the card below `PerformanceSurface` for Owner/Admin roles only. Coordination: C-07's Quick-links panel mounts on the same page — whichever ships second slots below the other.
- Extend `StaffProfile` type + profile fetch in `rbac.ts` with the two new fields.
- `AUDIT_PHRASING`: + `notification_settings_updated: "Notification settings updated"`.

**Step 18 — Phase D tests.**

- `resolveBusinessNotificationRecipients.test.ts`: opted-in resolution, per-type opt-out, skip-self, notification_email fallback to login email, zero-opt-in fallback to `getAdminRecipient`, excluded-actor ≠ fallback.
- `saveNotificationSettings` spec: role gate, self-only write, email validation, audit row.
- `sendEnquiryLoggedEmail` spec: happy path, skip-self exclusion, no-recipients skip row.
- Extend the 3 rerouted send-fn specs for multi-recipient loops.

**Phase D verify checkpoint:**
- Migration applied + types regenerated; Owner seed verified by SQL.
- As Owner: set a notification email on `/admin/me`, log an enquiry as Admin → Owner receives `enquiry_logged` at the notification address; the Admin who logged it does not.
- As Owner: log an enquiry yourself → no email to yourself; `skipped` row written with `actor_excluded`.
- Public booking request (test fixture) → every opted-in Owner/Admin gets `admin_booking_notification`; one delivery row per recipient.
- Untick "Slot claimed" as Owner → claim fires no email to Owner; delivery row reason `all_recipients_opted_out` when no one else is opted in.
- Coord/Therapist: Notifications card absent from `/admin/me`.

---

## 2 — Files touched (final list)

### NEW (~11 files)
| File | Purpose |
|---|---|
| `src/app/admin/emails/components/ResendButton.tsx` | Per-row resend UI |
| `src/app/admin/me/NotificationSettingsCard.tsx` | (2026-07-16) Notifications section UI |
| `src/app/admin/me/actions.ts` | (2026-07-16) `saveNotificationSettings` action |
| `src/lib/email/__tests__/sendBookingConfirmedClientEmail.test.ts` | Send-fn coverage |
| `src/lib/email/__tests__/sendStaffUnassignmentEmail.test.ts` | Send-fn coverage |
| `src/lib/email/__tests__/sendClaimNotificationEmail.test.ts` | Send-fn coverage |
| `src/lib/email/__tests__/sendClientAssignedTherapistEmail.test.ts` | Send-fn coverage |
| `src/lib/email/__tests__/resolveBusinessNotificationRecipients.test.ts` | (2026-07-16) Resolver coverage |
| `src/app/admin/emails/__tests__/resendEmail.test.ts` | Resend action coverage |
| `supabase/migrations/<ts>_c08_notification_email_and_metadata.sql` | (2026-07-16) Step 13 migration — now definite |

### EDITED (~11 files)
| File | Change |
|---|---|
| `src/lib/email/templates.ts` | + 5 new render fns (`render{Name}Email` + plain-text variants, incl. `renderEnquiryLoggedEmail`); audit `renderStaffAssignmentEmail` |
| `src/lib/email/notifications.ts` | + 5 new send fns + `resolveBusinessNotificationRecipients`; reroute 3 existing admin-leg sends (Step 15) |
| `src/app/admin/email-templates/actions.ts` | + 5 entries in SUBJECTS |
| `src/app/admin/emails/components/templates-data.ts` | + 5 new TemplateMeta entries; audit existing staff_assignment entry |
| `src/app/admin/emails/actions.ts` | + `resendEmail` server action + `dispatchResend` helper |
| `src/app/admin/emails/page.tsx` | Render `<ResendButton>` per delivery row (RBAC-gated) |
| `src/app/admin/bookings/actions.ts` | Wire hooks in `quickUpdateBooking` + `updateBookingManagement` + `claimBookingAssignment` + `updateBookingAssignment`; thread `actorStaffId` into the admin-cancel email options (Step 15) |
| `src/app/admin/enquiries/actions.ts` | (2026-07-16) Wire `enquiry_logged` hook into `createEnquiry` |
| `src/app/admin/me/page.tsx` | (2026-07-16) Mount `<NotificationSettingsCard>` for Owner/Admin |
| `src/lib/auth/rbac.ts` | (2026-07-16) + `notification_email` + `business_notification_prefs` on `StaffProfile` + profile fetch |
| `src/app/admin/clients/[clientId]/page.tsx` | + `email_resent` + `notification_settings_updated` in AUDIT_PHRASING |

### UNCHANGED (do NOT touch)
- `reporting.ts`, `dashboard-helpers.ts`, RBAC matrix, middleware, B-1 primitives.
- Existing 9 templates' code (additive only).
- `sendStaffAssignmentEmail` body — only templates-data.ts field-list audit.

---

## 3 — Verification gate

### 3.1 Static gates

```bash
pnpm lint                       # no NEW errors vs the 59-error baseline (55 untracked prototype JSX + 4 pre-existing in src/features/booking/)
npx tsc --noEmit                # 0 errors
pnpm vitest run                 # new specs pass; baseline preserved
pnpm build                      # clean
node scripts/measure-admin-bundles.mjs  # bundle delta within budget
```

**Bundle budget:** new ResendButton (~1 kB client), new send-fns + renderers (~5 kB server module — no client impact). NotificationSettingsCard (~2-3 kB client on `/admin/me`, 2026-07-16). **Plan ceiling: +2 kB on `/admin/emails` client bundle, +3 kB on `/admin/me`. 0 on other pages.**

### 3.2 Production event_type histogram (post-deploy delta)

```sql
-- Pre-deploy:
SELECT event_type, COUNT(*) FROM email_delivery_events GROUP BY event_type;
-- Expected: 7 active types (per W03 audit).

-- Post-deploy + a week of activity:
SELECT event_type, COUNT(*) FROM email_delivery_events GROUP BY event_type;
-- Expected: 12 active types (7 + 5 new, incl. enquiry_logged — 2026-07-16).
```

Document the new event_type rows appearing as bookings flow through the system.

### 3.3 Playwright role × resend sweep

Per role × viewport (4 viewports):
- Sign in.
- Navigate `/admin/emails` Delivery tab.
- Verify Resend button visibility per RBAC:
  - Owner / Admin: visible on every non-skipped row.
  - Coord / Therapist: hidden (no `RESEND_BOOKING_EMAILS` by default).
- (Owner / Admin) Click Resend on a booking_confirmation → confirm modal → confirm → toast success + new delivery row.
- Rate-limit test: click again within 60s → toast error.
- Edit the template via Templates tab → resend → verify new send uses the edited content.

### 3.4 Trigger-hook end-to-end tests

For each of the 4 new templates, exercise the trigger:

1. `booking_confirmed_client`: as Owner, confirm a pending test booking via quick-action → verify email_delivery_events row + Resend dashboard delivery.
2. `staff_unassignment`: as Owner, reassign an assignment A → B on a test booking → verify A's `staff_unassignment` row + B's `staff_assignment` row.
3. `claim`: as Therapist (with active assignment slot), claim an unassigned booking → verify admin's `claim` row + own `staff_assignment` row + client's `client_assigned_therapist` row.
4. `client_assigned_therapist`: as Owner, assign a previously-unassigned booking → verify client's row.
5. (2026-07-16) `enquiry_logged`: as Admin, log an enquiry → verify opted-in Owner's row at the notification email; verify the logging Admin has NO row (skip-self). Plus the full Phase D verify checkpoint (§1 Phase D).

### 3.5 Screenshot evidence

- 1280 × Owner Templates tab showing 4 new entries
- 1280 × edit form for one new template (e.g., client_assigned_therapist) with 4 editable fields
- 1280 × Delivery tab with Resend buttons visible
- 1280 × ConfirmActionModal for resend
- 375 × Delivery tab on mobile with icon-only Resend button
- 1280 × edited template content reflected in resend
- 1280 + 375 × (2026-07-16) `/admin/me` Notifications card — email field with hint, master toggle, 5 per-type checkboxes
- 1280 × (2026-07-16) received `enquiry_logged` email (Resend dashboard)

Store in `redesign/evidence/C-08/` (rubric §8 — `redesign/audits/**` is read-only historical record, not a writable evidence target).

---

## 4 — Risks and mitigations

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Migration for `metadata` column needed but disruptive | low | low | Single ALTER ADD COLUMN with default — no downtime. Pre-flight verifies. |
| Resend dispatcher complexity for context-needing templates (staff_*, claim, client_*) | medium | medium | Plan §1 Step 8 documents the recovery strategies. Conservative impl: simpler templates resendable first; complex ones marked "Resend not supported for this event type" with structured error. C-12+ polish to fill in the gaps. |
| Rate-limit too aggressive | low | low | Code constant; tunable. 60s is conservative starting point. |
| Resend with edited template surprises the admin | low | low | Confirm modal copy explicitly says "uses current template settings". |
| Trigger hook fires when it shouldn't | low | medium | Predicates strict — `before.status === "pending" && after.status === "confirmed"`. No false positives in normal flow. |
| Email send failures cascade (e.g., Resend API outage) | low | medium | Existing pattern: all sends wrapped in try/catch with console.error. Server actions don't roll back on email failure. Skipped delivery row written. |
| `dispatchResend` for legacy event types not in C-08 scope (e.g., admin_reschedule_request) | low | low | Switch statement handles all 11 expected types. Default case throws "Cannot resend event type" — admin sees structured error. |
| Resend for booking that's been deleted (post-C-06) | low | low | `getBookingTemplateInput` will return null or throw → caught → audit shows failure. Acceptable. |
| `templates-data.ts` audit for staff_assignment reveals missing fields | low | low | Add the missing fields; backward-compatible (existing overrides for known fields still work). |
| Capability-keyed recipient resolution mismatch | low | medium | Verify in Phase B Step 6 — existing `sendStaffAssignmentEmail` already capability-keyed. Document in progress file. |
| `getAdminRecipient(settings)` returns null when settings has no admin email | low | low | `sendClaimNotificationEmail` returns early with no error. Acceptable — admin opted into no notifications. |
| (2026-07-16) Resolver bug silently drops ALL internal alerts | low | high | Zero-opt-in fallback to `getAdminRecipient` + `skipped` delivery rows with reasons for every intentional non-send — absence is always visible in the delivery log. Dedicated resolver test file. |
| (2026-07-16) Multi-recipient loop double-sends on partial failure | low | medium | One tracked send per recipient, each with its own delivery row + try/catch; no retry loop inside the resolver path. |
| (2026-07-16) Owner mistypes notification_email → alerts vanish to a bad address | medium | low | Format validation on save; delivery failures land as failed rows in `/admin/emails`; login-email fallback only applies when the field is empty, so a typo'd address fails visibly rather than silently rerouting. |
| (2026-07-16) `notification_settings_updated` audit reveals personal email in logs | low | low | Notification email is business data entered by the staff member themselves; audit access is already permission-gated. |

### 4.1 Real risk: Resend complexity for context-needing templates

Per §1 Step 8: `sendStaffAssignmentEmail`, `sendStaffUnassignmentEmail`, `sendClaimNotificationEmail`, `sendClientAssignedTherapistEmail` all need additional context (which staff ID) beyond `bookingId` + `recipientEmail`. The simpler `dispatchResend` switch needs lookups.

**Conservative approach for first C-08 ship:** dispatch the 4 new event types (and `staff_assignment`) with full-context resends; mark other context-needing types as "Resend not supported in this initial release" with structured error.

**Future iteration:** plan §9.1 + §9.2 surface the per-event-type complexity for C-C impl-time decision.

---

## 5 — Undo procedure

### 5.1 Undo code (3 phases)

Per-template phase A reverts cleanly:
1. `git revert <phase-C-resend>` — Resend button + action removed.
2. `git revert <phase-A-template-N>` (×4) — each new template removed. Trigger hooks unwired.
3. `git revert <phase-B-verify>` — templates-data.ts entry tweaks reverted (likely no-op).

If only one template needs unshipping, revert just its commit.

### 5.2 Undo migration

```sql
ALTER TABLE public.email_delivery_events DROP COLUMN IF EXISTS metadata;
ALTER TABLE public.staff_profiles
  DROP COLUMN IF EXISTS notification_email,
  DROP COLUMN IF EXISTS business_notification_prefs;
```

Loses any `resent_from_event_id` linkage plus every staff member's notification email + preferences (they'd re-enter after a re-ship). Acceptable. Internal alerts revert to `getAdminRecipient(settings)` once the code revert lands (revert code FIRST, then columns, or the resolver reads missing columns).

### 5.3 Undo DB state

`email_delivery_events` rows from the new event types remain. Orphaned but harmless (Templates tab no longer references them). Optional cleanup:

```sql
DELETE FROM email_delivery_events WHERE event_type IN
  ('booking_confirmed_client', 'client_assigned_therapist', 'staff_unassignment', 'claim');
```

Audit_logs rows for `email_resent` also remain. Orphaned but harmless.

---

## 6 — Test fixture guidance

**Safe for C-08 E2E:**
- Test bookings with `*.example.test` recipient emails.
- Test clients (Audit Test Client *) with email + phone populated.
- Test Therapist accounts for claim trigger.

**DO NOT trigger reviews against:**
- Badar's `9d55ce2a`.
- Owner test account (real email).
- Any client whose email doesn't end in `.example.test`.

**Pre-trigger check:**

```sql
SELECT id, contact_email, status FROM bookings WHERE id = '<test-booking>';
```

Confirm `.example.test` recipient before exercising any send hook.

---

## 7 — Commit cadence in C-C (recommendation)

| Commit | Coverage |
|---|---|
| 1 | Phase A template 1 — `booking_confirmed_client` (renderer + send-fn + SUBJECTS + templates-data + hooks + tests) |
| 2 | Phase A template 2 — `staff_unassignment` |
| 3 | Phase A template 3 — `claim` |
| 4 | Phase A template 4 — `client_assigned_therapist` |
| 5 | Phase B verification — `staff_assignment` templates-data.ts audit (small or no-op) |
| 6 | Phase C Steps 8-12 — `resendEmail` action + `ResendButton` + page wiring + tests + AUDIT_PHRASING |
| 7 | (2026-07-16) Phase D Step 13 — migration applied (staff_profiles columns + Owner seed + conditional metadata) |
| 8 | (2026-07-16) Phase D Steps 14-15 — resolver + reroute the 4 admin_internal sends + tests |
| 9 | (2026-07-16) Phase D Step 16 — `enquiry_logged` template + hook + tests |
| 10 | (2026-07-16) Phase D Steps 17-18 — `/admin/me` Notifications section + action + tests |
| 11 | Verification — Playwright screenshots + progress file + master plan checklist → ✅ |

Each commit `feat(redesign): C-08 {phase/template}` prefix during C-C. Migration commit uses `chore(supabase): C-08 migration applied {migration_name}`.

---

## 8 — Hand-off to C-C

1. Read brief + plan end-to-end.
2. Run §0 Pre-flight. Confirm metadata column status, capture event_type baseline.
3. Execute Phase A (4 templates) → B (verification) → C (Resend tooling) in order.
4. Migration in Phase C is Zone-2 — show SQL to user; await approval.
5. Verification gate (§3) non-negotiable.
6. Update progress file per commit.
7. Final commit updates master plan checklist C-08 row → ✅ with shipped date + commit SHA.

---

## 9 — Open questions remaining

1. **`dispatchResend` for context-needing event types** — Step 8 + §4.1. Conservative first ship; full coverage in a follow-up if needed.
2. **Rate-limit threshold (60s)** — code constant; tunable.
3. **Resend with template-edits-since-original** — locked: use current template. Confirm modal explicit.
4. **Capability-keyed recipient verification result** — Phase B Step 6; document outcome.
5. **`metadata` column type if already exists** — pre-flight catches; conditional migration.
6. **AUDIT_PHRASING location** — currently `clients/[clientId]/page.tsx`. Could move to a shared lib (§9.4 of C-04a plan). Defer.
7. **Resend UI for skipped events** — hidden per design. Could show "Why was this skipped?" disclosure. C-12+.
8. **Admin recipient configuration changes since original send** — `dispatchResend` uses the current recipient resolution (post-Phase-D: the resolver). Document.
9. **(2026-07-16) Resend of multi-recipient internal alerts** — a resent `admin_booking_notification` re-resolves recipients at resend time (current opt-ins, not historical). Consistent with Q9.8's "current state" posture.
10. **(2026-07-16) Should Coordinators ever receive business alerts?** — Locked out for now (Owner/Admin only, user decision). If needed later: extend the resolver's role filter; the prefs column already supports any profile.

---

*End of C-08 plan. Brief: `redesign/briefs/C-08-email-automation-expansion-brief.md`. Progress: `redesign/per-page-progress/C-08-email-automation-expansion-progress.md` (filled during C-C).*
