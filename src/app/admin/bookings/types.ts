export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "paid" | "unpaid";
export type PaymentMethod = "cash" | "card";
export type RescheduleStatus =
  | "none"
  | "requested"
  | "reviewed"
  | "declined"
  | "completed";
export type AssignmentStatus =
  | "unassigned"
  | "assigned"
  | "completed"
  | "cancelled"
  | "no_show";

export interface BookingClient {
  full_name: string;
  phone: string | null;
  email: string | null;
}

export interface BookingParticipant {
  id: string;
  participant_gender: "male" | "female";
  required_therapist_gender: "male" | "female";
  is_main_contact: boolean;
  display_name: string | null;
  participant_notes: string | null;
  health_notes: string | null;
  consent_acknowledged: boolean;
}

export interface BookingItem {
  id: string;
  booking_participant_id: string | null;
  service_name_snapshot: string;
  service_price_snapshot: number | string;
  service_duration_snapshot: number;
}

export interface BookingAssignment {
  id: string;
  participant_id: string;
  assigned_staff_id: string | null;
  required_therapist_gender: "male" | "female";
  status: AssignmentStatus;
  staff_profiles: { name: string } | null;
}

export interface AuditLogEvent {
  id: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string;
  staff_profiles: { name: string } | null;
}

export interface EmailDeliveryEvent {
  id: string;
  event_type: string;
  recipient_email: string | null;
  recipient_role: string | null;
  /**
   * Mirrors the live `email_delivery_events_delivery_status_check` constraint as
   * extended by C-04a's Phase F migration. The first three are the original
   * send-site outcomes; `queued`/`sent` are the delayed-send lifecycle, and the
   * two `cancelled_*` values are queued rows killed before they went out.
   * Rendering falls through to a muted badge for anything it has no case for, so
   * the narrower union was a lie rather than a guard.
   */
  delivery_status:
    | "accepted"
    | "failed"
    | "skipped"
    | "queued"
    | "sent"
    | "cancelled_by_restore"
    | "cancelled_manual";
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface BookingRecord {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_duration_mins: number | null;
  total_price: number | string | null;
  contact_full_name: string;
  contact_email: string;
  contact_phone: string;
  booking_source: string;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  paid_at: string | null;
  payment_note: string | null;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  assignment_status: "unassigned" | "partially_assigned" | "fully_assigned";
  group_booking: boolean;
  service_address_line1: string | null;
  service_address_line2: string | null;
  service_city: string | null;
  service_postcode: string | null;
  access_notes: string | null;
  consent_acknowledged: boolean;
  customer_notes: string | null;
  health_notes: string | null;
  customer_manage_notes: string | null;
  /**
   * C-04a — the unified admin+customer cancellation stamp (Phase F migration),
   * and the key the S7 restore window is measured from.
   *
   * Required, not optional, and that is the point. Rows arrive through unchecked
   * `.returns<BookingRecord[]>()` / `.single<>()` casts, so the type cannot
   * police the `.select(...)` strings — but it CAN police the places a record is
   * built by hand. Every projection that produces a `BookingRecord` names this
   * column (`BOOKING_SELECT`, `CLAIMABLE_BOOKING_SELECT` in ./page.tsx;
   * `BOOKING_DETAIL_SELECT`, `CLAIMABLE_BOOKING_DETAIL_SELECT` in
   * ./[bookingId]/page.tsx), and making the field required means the next
   * omission at a construction site is a compile error rather than an
   * `undefined` that quietly fails `isRestoreWindowExpired` closed and removes
   * the Restore affordance from every surface.
   */
  cancelled_at: string | null;
  customer_cancelled_at: string | null;
  customer_cancellation_note: string | null;
  last_customer_manage_action_at: string | null;
  reschedule_requested_at: string | null;
  reschedule_preferred_date: string | null;
  reschedule_preferred_time: string | null;
  reschedule_note: string | null;
  reschedule_status: RescheduleStatus;
  admin_notes: string | null;
  treatment_notes: string | null;
  created_at: string;
  /**
   * C-02 Phase H (plan Step 23) — required for the same reason as
   * `cancelled_at` above: every projection that produces a `BookingRecord`
   * (`BOOKING_SELECT`, `CLAIMABLE_BOOKING_SELECT` in ./page.tsx) must name
   * this column, or the Series filter and row icon read `undefined` and
   * silently render nothing.
   */
  recurring_template_id: string | null;
  clients: BookingClient | null;
  booking_participants: BookingParticipant[];
  booking_items: BookingItem[];
  booking_assignments: BookingAssignment[];
  email_delivery_events?: EmailDeliveryEvent[];
  audit_logs?: AuditLogEvent[];
}
