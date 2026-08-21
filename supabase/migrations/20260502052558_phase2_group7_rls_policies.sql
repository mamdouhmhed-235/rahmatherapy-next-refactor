
-- ============================================================
-- GROUP 7: Enable RLS + Base Policies on all tables
-- ============================================================

-- Enable RLS on every table
ALTER TABLE roles                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_permission_overrides  ENABLE ROW LEVEL SECURITY;
ALTER TABLE services                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_blocked_dates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                  ENABLE ROW LEVEL SECURITY;

-- ----
-- RBAC & Staff tables: authenticated read only, no public access
-- Write goes through service role (admin client) only
-- ----

CREATE POLICY "Authenticated users can read roles"
  ON roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read permissions"
  ON permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read role_permissions"
  ON role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read staff_profiles"
  ON staff_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read staff_permission_overrides"
  ON staff_permission_overrides FOR SELECT TO authenticated USING (true);

-- ----
-- services: public read for active+visible; writes via service role only
-- ----

CREATE POLICY "Public can read active visible services"
  ON services FOR SELECT TO anon, authenticated
  USING (is_active = true AND is_visible_on_frontend = true);

-- ----
-- clients: no public read; authenticated read only; writes via service role
-- ----

CREATE POLICY "Authenticated users can read clients"
  ON clients FOR SELECT TO authenticated USING (true);

-- ----
-- bookings & booking sub-tables: authenticated read; writes via service role
-- ----

CREATE POLICY "Authenticated users can read bookings"
  ON bookings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read booking_participants"
  ON booking_participants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read booking_items"
  ON booking_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read booking_assignments"
  ON booking_assignments FOR SELECT TO authenticated USING (true);

-- ----
-- Availability tables: public read (needed for slot engine); writes via service role
-- ----

CREATE POLICY "Public can read availability_rules"
  ON availability_rules FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public can read blocked_dates"
  ON blocked_dates FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public can read availability_overrides"
  ON availability_overrides FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Authenticated users can read staff_availability_rules"
  ON staff_availability_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read staff_blocked_dates"
  ON staff_blocked_dates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read staff_availability_overrides"
  ON staff_availability_overrides FOR SELECT TO authenticated USING (true);

-- ----
-- business_settings: public read; writes via service role only
-- ----

CREATE POLICY "Public can read business_settings"
  ON business_settings FOR SELECT TO anon, authenticated USING (true);

-- ----
-- audit_logs: authenticated read; writes via service role only (no public access)
-- ----

CREATE POLICY "Authenticated users can read audit_logs"
  ON audit_logs FOR SELECT TO authenticated USING (true);
