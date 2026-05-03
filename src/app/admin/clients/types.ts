export interface ClientRecord {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  postcode: string | null;
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
  service_city: string | null;
  service_postcode: string | null;
  created_at: string;
  booking_items: ClientBookingItem[];
}
