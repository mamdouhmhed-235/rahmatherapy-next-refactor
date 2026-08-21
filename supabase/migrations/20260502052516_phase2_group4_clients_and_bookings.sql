
-- ============================================================
-- GROUP 4: Clients, Bookings, Participants, Items, Assignments
-- ============================================================

-- clients
CREATE TABLE clients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         text NOT NULL,
  phone             text,
  email             text UNIQUE,
  gender_preference gender_preference_type NOT NULL DEFAULT 'no_preference',
  address           text,
  postcode          text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- bookings
CREATE TABLE bookings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL REFERENCES clients(id),
  booking_date            date NOT NULL,
  start_time              time NOT NULL,
  end_time                time NOT NULL,
  total_duration_mins     int,
  total_price             numeric(10,2),
  payment_method          payment_method_type,
  payment_status          payment_status_type NOT NULL DEFAULT 'unpaid',
  status                  booking_status_type NOT NULL DEFAULT 'pending',
  assignment_status       booking_assignment_status_type NOT NULL DEFAULT 'unassigned',
  group_booking           boolean NOT NULL DEFAULT false,
  manage_token_hash       text,
  manage_token_expires_at timestamptz,
  customer_cancelled_at   timestamptz,
  customer_manage_notes   text,
  service_address_line1   text,
  service_address_line2   text,
  service_city            text,
  service_postcode        text,
  access_notes            text,
  customer_notes          text,
  admin_notes             text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_time_check CHECK (end_time > start_time)
);

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- booking_participants
CREATE TABLE booking_participants (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id               uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  participant_gender       staff_gender_type NOT NULL,
  required_therapist_gender staff_gender_type NOT NULL,
  is_main_contact          boolean NOT NULL DEFAULT false
);

-- booking_items
CREATE TABLE booking_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  booking_participant_id    uuid REFERENCES booking_participants(id) ON DELETE SET NULL,
  service_id                uuid NOT NULL REFERENCES services(id),
  service_name_snapshot     text NOT NULL,
  service_price_snapshot    numeric(10,2) NOT NULL,
  service_duration_snapshot int NOT NULL CHECK (service_duration_snapshot > 0)
);

-- booking_assignments
CREATE TABLE booking_assignments (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  participant_id            uuid NOT NULL REFERENCES booking_participants(id) ON DELETE CASCADE,
  assigned_staff_id         uuid REFERENCES staff_profiles(id) ON DELETE SET NULL,
  required_therapist_gender staff_gender_type NOT NULL,
  status                    assignment_status_type NOT NULL DEFAULT 'unassigned',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER booking_assignments_updated_at
  BEFORE UPDATE ON booking_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
