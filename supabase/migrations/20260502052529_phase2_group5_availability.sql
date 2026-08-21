
-- ============================================================
-- GROUP 5: Availability — Global & Per-Staff
-- ============================================================

-- Global: weekly repeating rules
CREATE TABLE availability_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week    int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     time NOT NULL,
  end_time       time NOT NULL,
  is_working_day boolean NOT NULL DEFAULT true,
  CONSTRAINT availability_rules_time_check CHECK (end_time > start_time)
);

-- Global: specific blocked dates (business fully closed)
CREATE TABLE blocked_dates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date date NOT NULL UNIQUE,
  reason       text
);

-- Global: date-specific hour overrides
CREATE TABLE availability_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_date date NOT NULL UNIQUE,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  reason        text,
  CONSTRAINT availability_overrides_time_check CHECK (end_time > start_time)
);

-- Staff: custom weekly rules
CREATE TABLE staff_availability_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  day_of_week    int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     time NOT NULL,
  end_time       time NOT NULL,
  is_working_day boolean NOT NULL DEFAULT true,
  CONSTRAINT staff_availability_rules_time_check CHECK (end_time > start_time)
);

-- Staff: personal blocked dates (PTO, personal days)
CREATE TABLE staff_blocked_dates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  reason       text,
  UNIQUE (staff_id, blocked_date)
);

-- Staff: date-specific overrides
CREATE TABLE staff_availability_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  override_type text,
  reason        text,
  UNIQUE (staff_id, override_date),
  CONSTRAINT staff_availability_overrides_time_check CHECK (end_time > start_time)
);
