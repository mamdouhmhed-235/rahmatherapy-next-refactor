
-- ============================================================
-- GROUP 1: All custom enum types + RBAC foundation
-- ============================================================

-- Enums (created here so all subsequent migrations can reference them)
CREATE TYPE staff_gender_type AS ENUM ('male', 'female');
CREATE TYPE availability_mode_type AS ENUM ('use_global', 'custom', 'global_with_overrides');
CREATE TYPE gender_restrictions_type AS ENUM ('any', 'male_only', 'female_only');
CREATE TYPE gender_preference_type AS ENUM ('male', 'female', 'no_preference');
CREATE TYPE payment_method_type AS ENUM ('cash', 'card');
CREATE TYPE payment_status_type AS ENUM ('paid', 'unpaid');
CREATE TYPE booking_status_type AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE booking_assignment_status_type AS ENUM ('unassigned', 'partially_assigned', 'fully_assigned');
CREATE TYPE assignment_status_type AS ENUM ('unassigned', 'assigned', 'completed', 'cancelled', 'no_show');

-- roles
CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- permissions
CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- role_permissions (junction)
CREATE TABLE role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ---- Seeds ----

-- Default roles
INSERT INTO roles (name, description) VALUES
  ('Owner',     'Full system access. Can manage all aspects of the business and team.'),
  ('Admin',     'Can manage bookings, clients, services, and availability.'),
  ('Therapist', 'Can view and claim eligible booking assignments.'),
  ('Inactive',  'Deactivated account. Cannot log in or take bookings.');

-- Default permissions (16)
INSERT INTO permissions (name, description) VALUES
  ('manage_users',               'Create, edit, and deactivate staff accounts.'),
  ('manage_roles',               'Create, edit, and delete roles and their permissions.'),
  ('manage_services',            'Create, edit, and delete services/packages.'),
  ('manage_availability_global', 'Edit global business availability rules and blocked dates.'),
  ('manage_availability_own',    'Edit own personal availability rules.'),
  ('manage_bookings_all',        'View, edit, and manage all bookings.'),
  ('manage_bookings_own',        'View and manage own assigned bookings.'),
  ('claim_bookings',             'Claim unassigned booking assignments matching gender eligibility.'),
  ('reassign_bookings',          'Reassign booking assignments to other staff.'),
  ('manage_clients',             'View and edit client profiles.'),
  ('manage_payments',            'Record and update payment status on bookings.'),
  ('view_dashboard',             'Access the admin dashboard and metrics.'),
  ('manage_settings',            'Edit global business settings.'),
  ('manage_staff',               'View and manage staff profiles and schedules.'),
  ('view_reports',               'Access reports and analytics.'),
  ('manage_emails',              'Configure email templates and notification settings.');

-- Assign ALL permissions to Owner role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Owner';
