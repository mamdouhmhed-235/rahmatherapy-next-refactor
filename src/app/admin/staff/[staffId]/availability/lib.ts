export function formatDateLong(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateFull(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTime(value: string): string {
  return value.slice(0, 5);
}

export const DAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Cancelled-family text colour token (replaces repeated raw oklch literals). */
export const CANCELLED_TEXT = "text-[oklch(26%_0.14_25)]";
export const CANCELLED_BORDER = "border-[oklch(26%_0.14_25)]";
export const CANCELLED_BG_SOFT = "bg-[oklch(95.5%_0.028_20)]";

/** Pending-family tokens (overrides soft warning). */
export const PENDING_TEXT = "text-[oklch(28%_0.120_55)]";
export const PENDING_BORDER = "border-[oklch(80%_0.07_75)]";
export const PENDING_BG_SOFT = "bg-[oklch(96.0%_0.038_75)]";

/** Restricted-family tokens (inactive banner). */
export const RESTRICTED_TEXT = "text-[oklch(30%_0.020_280)]";
export const RESTRICTED_BG_SOFT = "bg-[oklch(94.0%_0.008_280)]";

/** Confirmed-family soft tint (new-row highlight). */
export const CONFIRMED_BG_SOFT = "bg-[oklch(93.5%_0.038_155)]";
