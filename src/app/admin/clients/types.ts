export interface ClientRecord {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  postcode: string | null;
  client_source: string;
  source_detail: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientBookingItem {
  service_name_snapshot: string;
  service_price_snapshot: number | string;
  service_duration_snapshot: number;
}

export interface ClientBookingRecord {
  id: string;
  client_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  assignment_status: string;
  group_booking: boolean;
  total_price: number | string | null;
  amount_due?: number | string | null;
  amount_paid?: number | string | null;
  booking_source?: string;
  contact_full_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  service_city: string | null;
  service_postcode: string | null;
  service_address_line1?: string | null;
  health_notes?: string | null;
  customer_notes?: string | null;
  created_at: string;
  booking_items: ClientBookingItem[];
  booking_participants?: ClientParticipantRecord[];
}

export interface ClientParticipantRecord {
  display_name: string | null;
  participant_gender: string;
  health_notes: string | null;
  participant_notes: string | null;
  consent_acknowledged: boolean;
}

export interface ClientNoteRecord {
  id: string;
  note: string;
  is_sensitive: boolean;
  created_at: string;
  staff_profiles: { name: string } | null;
}

export interface ClientPrivacyRequestRecord {
  id: string;
  request_type: string;
  status: string;
  request_note: string | null;
  created_at: string;
  updated_at?: string;
}
