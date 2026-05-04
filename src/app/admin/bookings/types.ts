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
  delivery_status: "accepted" | "failed" | "skipped";
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
  clients: BookingClient | null;
  booking_participants: BookingParticipant[];
  booking_items: BookingItem[];
  booking_assignments: BookingAssignment[];
  email_delivery_events?: EmailDeliveryEvent[];
  audit_logs?: AuditLogEvent[];
}
