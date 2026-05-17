// Action verb phrases + 8-family taxonomy for the /admin/audit timeline.
// Covers every action_type from RECON §6.2 plus the 4 password-reset types from Brief 10.

export type ActionFamily =
  | "bookings_and_assignments"
  | "clients_and_enquiries"
  | "staff_and_roles"
  | "services_and_settings"
  | "availability"
  | "operations_and_email"
  | "reports_and_exports"
  | "account_security";

export type ChipTone = "confirmed" | "pending" | "cancelled" | "restricted" | "none";

interface ActionEntry {
  phrase: string;
  family: ActionFamily;
  chip: ChipTone;
}

const ACTIONS: Record<string, ActionEntry> = {
  // Bookings & assignments
  booking_management_updated: { phrase: "updated booking", family: "bookings_and_assignments", chip: "pending" },
  booking_quick_confirm: { phrase: "confirmed booking", family: "bookings_and_assignments", chip: "confirmed" },
  booking_quick_mark_paid: { phrase: "marked booking paid", family: "bookings_and_assignments", chip: "pending" },
  booking_quick_cancel: { phrase: "cancelled booking", family: "bookings_and_assignments", chip: "cancelled" },
  booking_quick_complete: { phrase: "completed booking", family: "bookings_and_assignments", chip: "pending" },
  booking_assignment_claimed: { phrase: "claimed assignment for booking", family: "bookings_and_assignments", chip: "confirmed" },
  booking_assignment_unassigned: { phrase: "unassigned therapist from booking", family: "bookings_and_assignments", chip: "cancelled" },
  booking_assignment_reassigned: { phrase: "reassigned therapist for booking", family: "bookings_and_assignments", chip: "pending" },
  booking_assignment_completed: { phrase: "completed assignment for booking", family: "bookings_and_assignments", chip: "pending" },
  booking_assignment_no_show: { phrase: "marked assignment no-show for booking", family: "bookings_and_assignments", chip: "cancelled" },
  manual_admin_booking_created: { phrase: "created booking", family: "bookings_and_assignments", chip: "confirmed" },
  enquiry_converted_to_booking: { phrase: "converted enquiry to booking", family: "bookings_and_assignments", chip: "confirmed" },

  // Clients & enquiries
  client_created: { phrase: "created client", family: "clients_and_enquiries", chip: "confirmed" },
  client_updated: { phrase: "updated client", family: "clients_and_enquiries", chip: "pending" },
  client_note_added: { phrase: "added a note to client", family: "clients_and_enquiries", chip: "pending" },
  client_privacy_request_created: { phrase: "opened a privacy request for client", family: "clients_and_enquiries", chip: "pending" },
  client_privacy_request_status_updated: { phrase: "updated privacy-request status for client", family: "clients_and_enquiries", chip: "pending" },
  enquiry_created: { phrase: "created enquiry", family: "clients_and_enquiries", chip: "confirmed" },
  enquiry_status_updated: { phrase: "updated enquiry status", family: "clients_and_enquiries", chip: "pending" },

  // Staff & roles
  staff_member_created: { phrase: "created staff member", family: "staff_and_roles", chip: "confirmed" },
  staff_profile_updated: { phrase: "updated staff profile", family: "staff_and_roles", chip: "pending" },
  staff_member_deactivated: { phrase: "deactivated staff member", family: "staff_and_roles", chip: "cancelled" },
  staff_member_reactivated: { phrase: "reactivated staff member", family: "staff_and_roles", chip: "confirmed" },
  staff_role_assigned: { phrase: "assigned role to staff member", family: "staff_and_roles", chip: "pending" },
  staff_availability_rules_updated: { phrase: "updated availability rules for staff", family: "staff_and_roles", chip: "pending" },
  staff_permission_overrides_updated: { phrase: "updated permission overrides for staff", family: "staff_and_roles", chip: "pending" },
  role_created: { phrase: "created role", family: "staff_and_roles", chip: "confirmed" },
  role_metadata_updated: { phrase: "updated role metadata", family: "staff_and_roles", chip: "pending" },
  role_permission_toggled: { phrase: "toggled permission on role", family: "staff_and_roles", chip: "pending" },

  // Services & settings
  service_created: { phrase: "created service", family: "services_and_settings", chip: "confirmed" },
  service_updated: { phrase: "updated service", family: "services_and_settings", chip: "pending" },
  service_archived: { phrase: "archived service", family: "services_and_settings", chip: "cancelled" },
  service_restored: { phrase: "restored service", family: "services_and_settings", chip: "confirmed" },
  service_deleted: { phrase: "deleted service", family: "services_and_settings", chip: "cancelled" },
  business_settings_updated: { phrase: "updated business settings", family: "services_and_settings", chip: "pending" },

  // Availability (global)
  availability_rule_created: { phrase: "created availability rule", family: "availability", chip: "confirmed" },
  availability_rule_updated: { phrase: "updated availability rule", family: "availability", chip: "pending" },
  availability_rule_deleted: { phrase: "deleted availability rule", family: "availability", chip: "cancelled" },
  blocked_date_created: { phrase: "added a closure date", family: "availability", chip: "pending" },
  blocked_date_deleted: { phrase: "removed a closure date", family: "availability", chip: "cancelled" },
  availability_override_upserted: { phrase: "saved an availability override", family: "availability", chip: "pending" },
  availability_override_deleted: { phrase: "removed an availability override", family: "availability", chip: "cancelled" },

  // Operations & email
  operational_event_status_updated: { phrase: "updated operations event status", family: "operations_and_email", chip: "pending" },
  manual_booking_reminder_sent: { phrase: "sent a booking reminder", family: "operations_and_email", chip: "pending" },

  // Reports & exports
  report_exported: { phrase: "exported report", family: "reports_and_exports", chip: "restricted" },

  // Account security (Brief 10)
  password_reset_requested: { phrase: "submitted a password-reset request", family: "account_security", chip: "restricted" },
  password_reset_request_lookup_failed: { phrase: "submitted a password-reset request (no matching account)", family: "account_security", chip: "restricted" },
  password_reset_completed: { phrase: "completed password reset", family: "account_security", chip: "restricted" },
  password_reset_token_rejected: { phrase: "rejected an expired or invalid reset token", family: "account_security", chip: "restricted" },
  password_reset_approved: { phrase: "approved a password-reset request", family: "account_security", chip: "confirmed" },
  password_reset_rejected: { phrase: "rejected a password-reset request", family: "account_security", chip: "cancelled" },
};

export function describeAction(actionType: string): ActionEntry {
  const known = ACTIONS[actionType];
  if (known) return known;
  // Defensive fallback for action types added between brief and runtime.
  // Renders the raw label without underscores so the UI stays legible.
  return {
    phrase: actionType.replace(/_/g, " "),
    family: "operations_and_email",
    chip: "none",
  };
}

export interface ActionFamilyOption {
  key: ActionFamily;
  label: string;
}

export const ACTION_FAMILY_OPTIONS: ActionFamilyOption[] = [
  { key: "bookings_and_assignments", label: "Bookings & assignments" },
  { key: "clients_and_enquiries", label: "Clients & enquiries" },
  { key: "staff_and_roles", label: "Staff & roles" },
  { key: "services_and_settings", label: "Services & settings" },
  { key: "availability", label: "Availability" },
  { key: "operations_and_email", label: "Operations & email" },
  { key: "reports_and_exports", label: "Reports & exports" },
  { key: "account_security", label: "Account security" },
];

export const TARGET_TYPE_OPTIONS = [
  { key: "booking", label: "Booking" },
  { key: "client", label: "Client" },
  { key: "staff", label: "Staff" },
  { key: "role", label: "Role" },
  { key: "service", label: "Service" },
  { key: "setting", label: "Setting" },
  { key: "enquiry", label: "Enquiry" },
  { key: "privacy_request", label: "Privacy request" },
  { key: "operational_event", label: "Operational event" },
  { key: "email", label: "Email" },
  { key: "password_reset", label: "Password reset" },
];

export const DATE_RANGE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "last_30_days", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
] as const;

export type DateRangePresetKey = (typeof DATE_RANGE_PRESETS)[number]["key"];

// Maps both singular (brief contract) and plural (legacy seed) target_type values
// to the singular, lowercased label rendered in the timeline target chip.
const TARGET_TYPE_ALIASES: Record<string, string> = {
  bookings: "booking",
  booking_assignments: "booking",
  clients: "client",
  staff: "staff",
  roles: "role",
  services: "service",
  settings: "setting",
  enquiries: "enquiry",
  privacy_requests: "privacy_request",
  operational_events: "operational_event",
  emails: "email",
  password_resets: "password_reset",
};

export function targetTypeLabel(targetType: string | null | undefined): string {
  if (!targetType) return "unknown";
  const canonical = TARGET_TYPE_ALIASES[targetType] ?? targetType;
  return (
    TARGET_TYPE_OPTIONS.find((t) => t.key === canonical)?.label.toLowerCase() ?? canonical.replace(/_/g, " ")
  );
}

export function truncateUuid(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 13) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

const RELATIVE = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto", style: "long" });
const ABSOLUTE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
  timeZoneName: "short",
});

const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
  { unit: "second", ms: 1000 },
];

export function formatRelative(timestamp: string): string {
  const diffMs = new Date(timestamp).getTime() - Date.now();
  for (const { unit, ms } of UNITS) {
    if (Math.abs(diffMs) >= ms || unit === "second") {
      return RELATIVE.format(Math.round(diffMs / ms), unit);
    }
  }
  return RELATIVE.format(0, "second");
}

export function formatAbsolute(timestamp: string): string {
  return ABSOLUTE.format(new Date(timestamp));
}

const DAY_KEY = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/London",
});

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/London",
});

export function dayKey(timestamp: string): string {
  return DAY_KEY.format(new Date(timestamp));
}

export function dayLabel(timestamp: string): string {
  const today = DAY_KEY.format(new Date());
  const yesterday = DAY_KEY.format(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const target = dayKey(timestamp);
  if (target === today) return "Today";
  if (target === yesterday) return "Yesterday";
  return DAY_LABEL.format(new Date(timestamp));
}

export interface AuditFilterState {
  q: string;
  actor: string;
  family: string;
  target_type: string;
  range: string;
  from: string;
  to: string;
}

export function buildFilterHref(
  current: AuditFilterState,
  overrides: Partial<AuditFilterState>
): string {
  const next = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.actor) params.set("actor", next.actor);
  if (next.family) params.set("family", next.family);
  if (next.target_type) params.set("target_type", next.target_type);
  if (next.range && next.range !== "last_30_days") params.set("range", next.range);
  if (next.range === "custom") {
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
  }
  const qs = params.toString();
  return qs ? `/admin/audit?${qs}` : "/admin/audit";
}

export function buildTargetHref(
  targetType: string | null | undefined,
  targetId: string | null | undefined
): string | null {
  if (!targetType || !targetId) return null;
  const canonical = TARGET_TYPE_ALIASES[targetType] ?? targetType;
  switch (canonical) {
    case "booking":
      return `/admin/bookings/${targetId}`;
    case "client":
      return `/admin/clients/${targetId}`;
    case "staff":
      return `/admin/staff/${targetId}`;
    case "role":
      return `/admin/roles/${targetId}`;
    case "service":
      return `/admin/services`;
    default:
      return null;
  }
}

export function buildTargetLabel(targetType: string | null | undefined): string {
  if (!targetType) return "Open target";
  const canonical = TARGET_TYPE_ALIASES[targetType] ?? targetType;
  switch (canonical) {
    case "booking":
      return "Open booking";
    case "client":
      return "Open client";
    case "staff":
      return "Open staff member";
    case "role":
      return "Open role";
    case "service":
      return "Open services";
    default:
      return "Open target";
  }
}
