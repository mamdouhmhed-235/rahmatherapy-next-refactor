import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowLeftRight,
  Bell,
  CalendarPlus,
  CalendarX,
  CheckCheck,
  Inbox,
  MailWarning,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

// Known event types are sourced from src/lib/email/notifications.ts (the only writer
// of email_delivery_events). Keep this list in sync if new templates ship — the
// filter strip uses it as the dropdown source-of-truth.
export const EMAIL_EVENT_TYPES = [
  "booking_confirmation",
  "admin_booking_notification",
  "booking_reminder",
  "booking_cancellation_customer",
  "booking_cancellation_admin",
  "booking_reschedule_request_admin",
  "staff_assignment",
  "staff_booking_change",
  "failed_email_send",
] as const;

export type EmailEventType = (typeof EMAIL_EVENT_TYPES)[number];

export const DELIVERY_STATUSES = [
  "accepted",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "failed",
  "complained",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const RECIPIENT_ROLES = ["customer", "staff", "admin"] as const;
export type RecipientRole = (typeof RECIPIENT_ROLES)[number];

export const DATE_RANGE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "last_7_days", label: "Last 7 days" },
  { key: "last_30_days", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
] as const;

export type DateRangePresetKey = (typeof DATE_RANGE_PRESETS)[number]["key"];

export const FAILED_BADGE_WINDOW_HOURS = 24;

// ── Event-type display ──────────────────────────────────────────────────────

const EVENT_TYPE_LABEL: Record<string, string> = {
  booking_confirmation: "Booking confirmation",
  admin_booking_notification: "New booking (admin)",
  booking_reminder: "Reminder",
  booking_cancellation_customer: "Cancellation (customer)",
  booking_cancellation_admin: "Cancellation (admin)",
  booking_reschedule_request_admin: "Reschedule request",
  staff_assignment: "Staff assignment",
  staff_booking_change: "Booking change (staff)",
  failed_email_send: "Send failure",
};

const EVENT_TYPE_ICON: Record<string, LucideIcon> = {
  booking_confirmation: CheckCheck,
  admin_booking_notification: Inbox,
  booking_reminder: Bell,
  booking_cancellation_customer: CalendarX,
  booking_cancellation_admin: CalendarX,
  booking_reschedule_request_admin: ArrowLeftRight,
  staff_assignment: UserCheck,
  staff_booking_change: CalendarPlus,
  failed_email_send: MailWarning,
};

export function labelForEventType(value: string): string {
  return EVENT_TYPE_LABEL[value] ?? toSentenceCase(value.replace(/_/g, " "));
}

export function iconForEventType(value: string): LucideIcon {
  return EVENT_TYPE_ICON[value] ?? AlertCircle;
}

// ── Delivery-status display ─────────────────────────────────────────────────

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  bounced: "Bounced",
  failed: "Failed",
  complained: "Complained",
};

export function labelForDeliveryStatus(value: string): string {
  return DELIVERY_STATUS_LABEL[value] ?? toSentenceCase(value);
}

// Maps delivery-status to the named AdminStatusBadge tone — the Status Families
// from DESIGN.md §5.
export function toneForDeliveryStatus(
  value: string
): "success" | "info" | "warning" | "danger" | "restricted" | "muted" {
  switch (value) {
    case "accepted":
    case "delivered":
      return "success";
    case "opened":
    case "clicked":
      return "info";
    case "bounced":
    case "failed":
      return "danger";
    case "complained":
      return "restricted";
    default:
      return "muted";
  }
}

export const RECIPIENT_ROLE_LABEL: Record<string, string> = {
  customer: "Customer",
  staff: "Staff",
  admin: "Admin",
};

export function labelForRecipientRole(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return RECIPIENT_ROLE_LABEL[value] ?? toSentenceCase(value);
}

// ── Day grouping (London business date matches the rest of the admin) ───────

// We intentionally group on the en-GB calendar day — most operators are in the UK
// and the audit timeline uses the same grouping. For events near midnight the
// label still matches what the operator clicked.
export function dayKey(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function dayLabel(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.toLocaleDateString("en-GB", { timeZone: "Europe/London" }) ===
    b.toLocaleDateString("en-GB", { timeZone: "Europe/London" });

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function relativeTime(isoTimestamp: string, nowMs: number = Date.now()): string {
  const then = new Date(isoTimestamp).getTime();
  const diffMs = nowMs - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
  }).format(new Date(isoTimestamp));
}

export function absoluteTimestamp(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoTimestamp));
}

// ── Booking-reminder helpers ────────────────────────────────────────────────

export function formatReminderDateTime(bookingDate: string, startTime: string): string {
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${bookingDate}T00:00:00`));
  return `${dateLabel} at ${startTime.slice(0, 5)}`;
}

export function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "the client";
  const trimmed = fullName.trim();
  if (!trimmed) return "the client";
  return trimmed.split(/\s+/)[0];
}

export function initialsFromName(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function lastReminderLine(
  lastReminderAt: string | null | undefined
): { display: string; absolute: string } | null {
  if (!lastReminderAt) return null;
  const absolute = absoluteTimestamp(lastReminderAt);
  const display = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(lastReminderAt));
  return { display, absolute };
}

// ── String utility ──────────────────────────────────────────────────────────

function toSentenceCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ── Filter state ────────────────────────────────────────────────────────────

export interface DeliveryFilters {
  q: string;
  event_type: string;
  delivery_status: string;
  recipient_role: string;
  range: DateRangePresetKey;
  from: string;
  to: string;
}

export const DEFAULT_DELIVERY_FILTERS: DeliveryFilters = {
  q: "",
  event_type: "",
  delivery_status: "",
  recipient_role: "",
  range: "last_30_days",
  from: "",
  to: "",
};

export function resolveRange(range: string | undefined): DateRangePresetKey {
  switch (range) {
    case "today":
    case "last_7_days":
    case "last_30_days":
    case "custom":
      return range;
    default:
      return "last_30_days";
  }
}

export function hasAnyDeliveryFilter(filters: DeliveryFilters): boolean {
  return Boolean(
    filters.q ||
      filters.event_type ||
      filters.delivery_status ||
      filters.recipient_role ||
      (filters.range && filters.range !== "last_30_days")
  );
}

export const SEARCH_MIN_CHARS = 4;
