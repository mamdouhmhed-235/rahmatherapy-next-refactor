export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function safeDivide(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

export function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function appointmentStyle(startTime: string, endTime?: string) {
  const start = parseTimeToMinutes(startTime);
  const end = endTime ? parseTimeToMinutes(endTime) : start + 60;
  const dayStart = 8 * 60;
  const dayEnd = 20 * 60;
  const left = clampPercent(safeDivide(start - dayStart, dayEnd - dayStart));
  const width = Math.max(9, clampPercent(safeDivide(end - start, dayEnd - dayStart)));
  return {
    left: `${left}%`,
    width: `${Math.min(width, 100 - left)}%`,
  };
}

export type AttentionSeverity = "critical" | "warning" | "info";

export interface AttentionSummaryRow {
  key: string;
  label: string;
  detail: string;
  count: number;
  severity: AttentionSeverity | "clear";
  href?: string | null;
}

export function severityTone(severity: AttentionSummaryRow["severity"]) {
  if (severity === "critical") return "danger" as const;
  if (severity === "warning") return "warning" as const;
  if (severity === "clear") return "success" as const;
  return "info" as const;
}

export function severityLabel(severity: AttentionSummaryRow["severity"]) {
  if (severity === "critical") return "Critical";
  if (severity === "warning") return "Warning";
  if (severity === "clear") return "All clear";
  return "Info";
}

export function severityMeterValue(row: AttentionSummaryRow) {
  if (row.severity === "clear" || row.count === 0) return 0;
  if (row.severity === "critical") return Math.min(5, Math.max(3, row.count));
  if (row.severity === "warning") return Math.min(4, Math.max(2, row.count));
  return Math.min(3, Math.max(1, row.count));
}

export interface Booking {
  booking_date: string;
}

import { format, parseISO, eachDayOfInterval } from "date-fns";

export function buildDemandTrendData(
  bookings: Booking[],
  from: string,
  to: string
) {
  const start = parseISO(from);
  const end = parseISO(to);
  if (start > end) return [];

  const days = eachDayOfInterval({ start, end });

  const counts = new Map<string, number>();
  for (const booking of bookings) {
    counts.set(booking.booking_date, (counts.get(booking.booking_date) ?? 0) + 1);
  }

  return days.map((day) => {
    const dateKey = format(day, "yyyy-MM-dd");
    return {
      date: dateKey,
      label: format(day, "d MMM"),
      bookings: counts.get(dateKey) ?? 0,
    };
  });
}
