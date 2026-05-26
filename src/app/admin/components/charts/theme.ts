/**
 * Semantic colour + theme map for chart and tile primitives (B-1).
 *
 * Every chart primitive in src/app/admin/components/charts/ and every tile
 * primitive in src/app/admin/components/tiles/ imports from here. Keeps the
 * "every chart looks identical" promise (B-1 brief §3 scene sentence) by
 * removing the temptation to hardcode tokens inline.
 */

export type StatusName =
  | "Confirmed"
  | "Pending"
  | "Completed"
  | "Cancelled"
  | "NoShow";

const STATUS_FILL: Record<StatusName, string> = {
  Confirmed: "var(--admin-status-confirmed-text)",
  Pending: "var(--admin-status-pending-text)",
  Completed: "var(--admin-status-completed-text)",
  Cancelled: "var(--admin-status-cancelled-text)",
  NoShow: "var(--admin-status-attention-text)",
};

const UNKNOWN_FILL = "var(--admin-text-muted)";

/**
 * Canonical chart-fill colour for a booking status name. Unknown names fall
 * back to Soft Slate so a bad input never produces a garish surprise.
 */
export function statusFillForName(name: string): string {
  if (name in STATUS_FILL) {
    return STATUS_FILL[name as StatusName];
  }
  return UNKNOWN_FILL;
}

export type DeltaTone = "positive" | "negative" | "neutral";

/**
 * Maps a delta value to a tone for `<DeltaChip>` / sparkline accent.
 *
 * - `auto` (default): positive = good (success family); negative = bad
 *   (cancelled family).
 * - `invert`: flips both. Use for metrics where smaller is better
 *   (no-show rate, time-to-first-contact).
 *
 * Null / undefined / NaN / 0 always return `neutral`, regardless of tone.
 */
export function severityForDelta(
  value: number | null | undefined,
  tone: "auto" | "invert" = "auto"
): DeltaTone {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "neutral";
  }
  if (value === 0) return "neutral";
  const isPositiveSign = value > 0;
  if (tone === "invert") {
    return isPositiveSign ? "negative" : "positive";
  }
  return isPositiveSign ? "positive" : "negative";
}

/**
 * Recharts theming. Every chart primitive spreads selected fields onto its
 * `<CartesianGrid>` / `<XAxis>` / `<YAxis>` / `<Tooltip>` props.
 */
export const defaultChartTheme = {
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  axisTickFill: "var(--admin-text-muted)",
  axisStroke: "var(--admin-border)",
  gridStroke: "var(--admin-border)",
  gridStrokeDasharray: "3 3",
  tooltipBg: "var(--admin-panel)",
  tooltipBorder: "var(--admin-border)",
  tooltipRadius: 4,
  primaryStroke: "var(--admin-primary)",
} as const;
