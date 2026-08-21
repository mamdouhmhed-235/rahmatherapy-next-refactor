
-- ============================================================
-- GROUP 3: Services
-- ============================================================

CREATE TABLE services (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text NOT NULL UNIQUE,
  name                    text NOT NULL,
  group_category          text,
  short_description       text,
  full_description        text,
  suitable_for_notes      text,
  gender_restrictions     gender_restrictions_type NOT NULL DEFAULT 'any',
  price                   numeric(10,2) NOT NULL,
  duration_mins           int NOT NULL CHECK (duration_mins > 0),
  is_active               boolean NOT NULL DEFAULT true,
  is_visible_on_frontend  boolean NOT NULL DEFAULT true,
  display_order           int NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
