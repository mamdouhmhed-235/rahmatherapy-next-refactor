# Backend Plan: Booking Create — Inline Therapist Assignment

**Zone:** 2 (new form fields + extended server action logic)
**Priority:** Non-blocking — booking-new session can ship without this; the inline assignment section simply doesn't render for any role until this lands
**Depended on by:** booking-new Step 4 (high-permission role variant)
**Depends on:** None (uses existing `getStaffAssignmentPreviews` and `booking_assignments` table)

---

## 1. Problem

When a high-permission user (Owner / Admin / role with `manage_bookings_all` + `assign_staff_roles`) creates a booking via booking-new, they currently cannot assign a therapist during the creation flow. The booking is always created unassigned (REQUEST state) and then requires a second trip to booking-detail to assign. For coordinators or owners who already know which therapist is taking the booking (e.g. a regular client of a specific therapist), this is an unnecessary extra step.

---

## 2. Scope of change

### 2a. `page.tsx` — pre-fetch available staff for step 4

Add a staff pre-fetch for the inline assignment section. Only runs when the current user has `manage_bookings_all` + `assign_staff_roles` (checked via existing `canManageAllBookings` + `canAssignBookings` helpers):

```typescript
// Only fetch staff for assignment-eligible users
const staffForAssignment = canAssign
  ? await adminClient
      .from("staff_profiles")
      .select("id, full_name, gender, profile_photo_path, can_take_bookings, active")
      .eq("active", true)
      .eq("can_take_bookings", true)
      .order("full_name")
  : { data: [] };
```

Pass as prop: `staffForAssignment={staffForAssignment.data ?? []}` to `ManualBookingForm`.

### 2b. `ManualBookingForm.tsx` — Step 4 inline assignment section

New props:
```typescript
staffForAssignment: Array<{
  id: string;
  full_name: string;
  gender: "male" | "female";
  profile_photo_path: string | null;
  can_take_bookings: boolean;
}>;
canAssign: boolean;
```

Step 4 conditional section (renders only when `canAssign && staffForAssignment.length > 0`):

```tsx
<AdminPanel title="Assign therapist now" description="Optional — you can assign later from the booking detail page.">
  {participants.map((p, i) => (
    <div key={i}>
      <p className="...">{p.name || `Person ${i + 1}`} — {p.gender} therapist required</p>
      <select name={`therapist_assignment_${i}`} ...>
        <option value="">Leave unassigned</option>
        {staffForAssignment
          .filter(s => s.gender === p.gender)
          .map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
      </select>
    </div>
  ))}
</AdminPanel>
```

Add `therapist_assignment_N` to the hidden inputs block so values are submitted for all steps:
```tsx
{participants.map((_, i) => (
  <input key={`ta${i}`} type="hidden" name={`therapist_assignment_${i}`} value={participantAssignments[i] ?? ""} />
))}
```

New state:
```typescript
const [participantAssignments, setParticipantAssignments] = useState<string[]>(
  () => participants.map(() => "")
);
```

### 2c. `actions.ts` — parse and apply inline assignments in `createManualBooking`

After the booking is created successfully, parse `therapist_assignment_N` fields and apply assignments:

```typescript
// After createBookingTransaction succeeds:
const assignmentStaffIds = participantIndexes.map((index) =>
  String(formData.get(`therapist_assignment_${index}`) ?? "").trim()
);

// Apply any pre-assignments
for (let i = 0; i < assignmentStaffIds.length; i++) {
  const staffId = assignmentStaffIds[i];
  if (!staffId) continue;

  // Find the booking_assignment for this participant index
  const { data: assignments } = await adminClient
    .from("booking_assignments")
    .select("id, required_therapist_gender")
    .eq("booking_id", result.bookingId)
    .order("id") // deterministic order matching participant insertion order
    .returns<Array<{ id: string; required_therapist_gender: string }>>();

  if (!assignments?.[i]) continue;

  // Validate gender match
  const { data: staff } = await adminClient
    .from("staff_profiles")
    .select("gender")
    .eq("id", staffId)
    .single<{ gender: string }>();

  if (staff?.gender !== assignments[i].required_therapist_gender) continue; // silently skip invalid

  await adminClient
    .from("booking_assignments")
    .update({ assigned_staff_id: staffId, status: "assigned" })
    .eq("id", assignments[i].id);

  await adminClient.from("audit_logs").insert({
    actor_staff_id: actor.id,
    action_type: "booking_assignment_reassigned",
    target_type: "booking_assignments",
    target_id: assignments[i].id,
    after_state: { assigned_staff_id: staffId, status: "assigned" },
  });
}

// Recompute booking assignment_status
await recomputeBookingAssignmentStatus(result.bookingId, adminClient);
```

Add `therapist_assignment_N` to the `manualBookingSchema` as optional string fields (outside the main schema since count is dynamic — parsed separately, same pattern as `participantServiceSlugs`).

---

## 3. RBAC

The inline assignment section only renders when the user has both:
- `canManageAllBookings(profile)` — can create bookings
- `canAssignBookings(profile)` — can assign staff (uses existing `canAssignBookings` from `rbac.ts`)

Both checks run in `page.tsx`. Staff list is only pre-fetched and the section only renders when both are true.

---

## 4. Gender enforcement

The assignment silently skips any staff who don't gender-match the participant's `required_therapist_gender`. This enforces the same-gender clinical requirement without throwing an error — the booking is created, the participant remains unassigned, and the coordinator can assign from the detail page.

---

## 5. Audit log

Each inline assignment writes a `booking_assignment_reassigned` audit event (same type as a manual reassignment). The `manual_admin_booking_created` event already fires for the whole booking — no duplicate.

---

## 6. Fallback (before this plan ships)

The inline assignment section does not render for any user. All bookings created via booking-new arrive as REQUEST state (unassigned). Assignment happens from the booking-detail page as before. No regression.

---

## 7. Status

`[ ]` Not started
