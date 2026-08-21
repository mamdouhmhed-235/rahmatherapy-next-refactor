
-- ============================================================
-- GROUP 6: Business Settings & Audit Logs
-- ============================================================

-- business_settings (single-row table, id must always = 1)
CREATE TABLE business_settings (
  id                     int PRIMARY KEY CHECK (id = 1),
  company_name           text NOT NULL DEFAULT 'Rahma Therapy',
  contact_email          text,
  contact_phone          text,
  booking_window_days    int NOT NULL DEFAULT 30 CHECK (booking_window_days > 0),
  buffer_time_mins       int NOT NULL DEFAULT 30 CHECK (buffer_time_mins >= 0),
  minimum_notice_hours   int NOT NULL DEFAULT 24 CHECK (minimum_notice_hours >= 0),
  allowed_cities         jsonb NOT NULL DEFAULT '[]'::jsonb,
  booking_status_enabled boolean NOT NULL DEFAULT true
);

-- Seed the one and only settings row
INSERT INTO business_settings (
  id,
  company_name,
  booking_window_days,
  buffer_time_mins,
  minimum_notice_hours,
  allowed_cities,
  booking_status_enabled
) VALUES (
  1,
  'Rahma Therapy',
  30,
  30,
  24,
  '["Luton", "Dunstable", "Harpenden", "St Albans", "Hemel Hempstead", "Watford", "Bedford"]'::jsonb,
  true
);

-- audit_logs
CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_staff_id  uuid REFERENCES staff_profiles(id) ON DELETE SET NULL,
  action_type     text NOT NULL,
  target_type     text,
  target_id       uuid,
  before_state    jsonb,
  after_state     jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
