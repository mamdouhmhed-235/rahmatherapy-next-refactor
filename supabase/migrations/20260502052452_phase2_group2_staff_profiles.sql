
-- ============================================================
-- GROUP 2: Staff Profiles
-- ============================================================

CREATE TABLE staff_profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name              text NOT NULL,
  email             text NOT NULL UNIQUE,
  role_id           uuid NOT NULL REFERENCES roles(id),
  gender            staff_gender_type NOT NULL,
  active            boolean NOT NULL DEFAULT true,
  can_take_bookings boolean NOT NULL DEFAULT false,
  availability_mode availability_mode_type NOT NULL DEFAULT 'use_global',
  created_by        uuid,
  updated_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Staff-level permission overrides (bypass or supplement role permissions)
CREATE TABLE staff_permission_overrides (
  staff_id      uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  is_granted    boolean NOT NULL,
  PRIMARY KEY (staff_id, permission_id)
);

-- Auto-update updated_at on staff_profiles
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_profiles_updated_at
  BEFORE UPDATE ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
