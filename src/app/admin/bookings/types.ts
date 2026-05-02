export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "paid" | "unpaid";
export type PaymentMethod = "cash" | "card";
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

export interface BookingRecord {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_duration_mins: number | null;
  total_price: number | string | null;
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
  customer_notes: string | null;
  customer_manage_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  clients: BookingClient | null;
  booking_participants: BookingParticipant[];
  booking_items: BookingItem[];
  booking_assignments: BookingAssignment[];
}
