// B-4 — Reports chart wrappers around B-1 primitives.
//
// Re-exports the legacy names (`RevenueChart`, `CountBarChart`) so the page
// imports keep working through the wholesale page.tsx restructure in step 7,
// and ADDS `StatusDonutChart` for the new semantic-colored status breakdown
// (brief §4 Activity section). Internals route to B-1's chart primitives
// (themed Recharts wrappers) so every chart shares the same axis / tooltip /
// reduced-motion treatment per SHARED-NOTES §7.
//
// Color strategy per brief §3:
//   - Revenue trend → AreaChart with semantic series tints (primary, success,
//     warning) matching the legacy palette so the visual handoff is seamless.
//   - Status donut → DonutChart with per-slice `statusFillForName` so
//     Confirmed=mint, Pending=amber, Cancelled=coral, Completed=slate,
//     NoShow=mauve. Unknown statuses fall back to soft slate via the theme
//     helper (never produces a garish surprise).
//   - Source bar → BarChart single-series (uniform admin-primary). Per-source
//     OKLCH palette is V1.1 — getting per-Cell coloring through the B-1
//     primitive requires extending it (RECON §5 untouchable here).
//
// Plan: redesign/plans/B-phase/B4-reports-rebuild-plan.md (step 6).

import { AreaChart } from "../components/charts/AreaChart";
import { DonutChart, type DonutSlice } from "../components/charts/DonutChart";
import { StackedBarChart } from "../components/charts/StackedBarChart";

// Booking status values arrive lowercase from the DB enum
// ('pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show').
// Earlier attempt bridged to theme.statusFillForName but that returns the
// *-text token variants which are designed for accessible text (lightness
// ~30%) — visually muted on a chart. The user explicitly asked for bright,
// obviously distinguishable colours. We bypass the theme helper here with
// a chart-tuned palette: 5 hues spread around the OKLCH wheel at L=55-70%,
// chroma 0.16-0.22 so each slice POPS on the light cream panel.
//
// Hue choices keep semantic intent:
//   Confirmed → mint-green   (155° — go/positive)
//   Pending   → amber        (70°  — waiting)
//   Completed → ocean blue   (230° — done/neutral-positive)
//   Cancelled → coral red    (25°  — negative)
//   NoShow    → magenta      (330° — negative variant, kept distinct from cancelled)
//
// C-11 Phase E (Step 11b / plan §4.3): the palette moved to --admin-chart-status-*
// in tokens.css so it gains dark-theme counterparts. The :root values are the
// literals that used to sit here verbatim, so the light rendering is unchanged;
// the dark arm lifts each hue into the 68-82% band to keep the same "pop"
// against a dark panel that the originals had against cream. Passing var()
// through Recharts' fill/stroke props is this codebase's established idiom
// (components/charts/theme.ts does it for every axis, grid and slice).
const STATUS_CHART_FILL: Record<string, string> = {
  Confirmed: "var(--admin-chart-status-confirmed)",
  Pending: "var(--admin-chart-status-pending)",
  Completed: "var(--admin-chart-status-completed)",
  Cancelled: "var(--admin-chart-status-cancelled)",
  NoShow: "var(--admin-chart-status-noshow)",
};
const UNKNOWN_CHART_FILL = "var(--admin-chart-status-unknown)"; // soft mauve-grey for unrecognised status

/**
 * Bright chart-fill colour for a booking-status key. Bypasses theme's
 * text-tuned palette for the donut + stacked-bar use cases where the
 * panel-background visual differentiation matters more than text contrast.
 */
export function statusChartFillForKey(key: string): string {
  return STATUS_CHART_FILL[key] ?? UNKNOWN_CHART_FILL;
}

/**
 * Maps DB lowercase enum values to PascalCase StatusName keys + a humanised
 * display label for tooltips ("No-show", not "no_show"). Without this bridge,
 * lookups against the chart-fill palette would all fall through to
 * UNKNOWN_CHART_FILL and the donut would render all the same colour.
 */
export function normaliseStatusName(raw: string): { display: string; key: string } {
  const lower = (raw ?? "").trim().toLowerCase();
  if (lower === "confirmed") return { display: "Confirmed", key: "Confirmed" };
  if (lower === "pending") return { display: "Pending", key: "Pending" };
  if (lower === "completed") return { display: "Completed", key: "Completed" };
  if (lower === "cancelled") return { display: "Cancelled", key: "Cancelled" };
  if (lower === "no_show" || lower === "noshow") return { display: "No-show", key: "NoShow" };
  return { display: raw || "Other", key: raw };
}

// Type aliases (not interfaces) so the rows satisfy the B-1 charts' generic
// `T extends Record<string, unknown>` constraint without manual index signatures.
type RevenuePoint = {
  period: string;
  booked: number;
  collected: number;
  outstanding: number;
};

type CountPoint = {
  name: string;
  value: number;
};

const REVENUE_SERIES = [
  { dataKey: "booked", label: "Booked", stroke: "var(--admin-primary)" },
  { dataKey: "collected", label: "Collected", stroke: "var(--admin-success)" },
  { dataKey: "outstanding", label: "Outstanding", stroke: "var(--admin-warning)" },
];

/**
 * Revenue trend chart — 3 series (Booked / Collected / Outstanding) over
 * the report period. Wraps B-1's themed AreaChart so the empty + error
 * states render via `ChartEmpty` / `ChartError`.
 */
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <AreaChart
      data={data}
      categoryKey="period"
      series={REVENUE_SERIES}
      height={288}
      ariaLabel="Revenue by period chart"
    />
  );
}

/**
 * Single-series bar chart used for source counts. Mid-truncation at 8
 * categories preserves the legacy behaviour. Vertical layout (categories
 * on the y-axis) so long labels never overlap regardless of viewport.
 * The previous horizontal layout with `interval={0}` crashed labels like
 * "whatsapp"/"instagram"/"website" into each other on the desktop panel
 * and was unreadable on mobile — user-flagged during the pre-commit audit.
 */
export function CountBarChart({ data, label }: { data: CountPoint[]; label: string }) {
  // Sort descending so the biggest bar reads first (top-down y-axis convention).
  const rows = [...data].slice(0, 8).sort((a, b) => b.value - a.value);
  const height = Math.max(160, rows.length * 36 + 48);
  return (
    <StackedBarChart
      data={rows}
      categoryKey="name"
      series={[{ dataKey: "value", label: "Bookings", fill: "var(--admin-primary)" }]}
      height={height}
      layout="vertical"
      ariaLabel={label}
    />
  );
}

/**
 * Status-breakdown donut. Slices coloured semantically via the B-1 theme
 * helper so Confirmed always reads as mint, Cancelled as coral, etc.,
 * regardless of the rendering order. Optional `centerLabel` slot for the
 * total-bookings count.
 */
export function StatusDonutChart({
  data,
  centerLabel,
}: {
  data: CountPoint[];
  /** Optional override; defaults to the in-built "{total} bookings" stack. */
  centerLabel?: React.ReactNode;
}) {
  const slices: DonutSlice[] = data.map((point) => {
    const norm = normaliseStatusName(point.name);
    return {
      name: norm.display,
      value: point.value,
      fill: statusChartFillForKey(norm.key),
    };
  });
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  // Center "{total} bookings" by default — the donut hole was wasted.
  const defaultCenter =
    total > 0 ? (
      <div className="grid gap-0.5">
        <p
          className="font-[var(--font-admin-serif),Georgia,serif] text-[1.778rem] font-bold leading-none tracking-[-0.015em] text-[var(--admin-heading)]"
          style={{ fontFamily: "var(--font-admin-serif), Georgia, serif" }}
        >
          {total}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
          {total === 1 ? "booking" : "bookings"}
        </p>
      </div>
    ) : null;

  return (
    <div className="grid gap-4">
      <DonutChart
        data={slices}
        height={224}
        ariaLabel="Bookings by status donut"
        centerLabel={centerLabel ?? defaultCenter}
      />
      {total > 0 ? <DonutLegend slices={slices} total={total} /> : null}
    </div>
  );
}

function DonutLegend({
  slices,
  total,
}: {
  slices: DonutSlice[];
  total: number;
}) {
  // Sort descending by value so the biggest slice reads first — also keeps
  // the legend order independent of input order so the tooltip-via-hover
  // flow stays honest about what each slice represents.
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  return (
    <ul className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
      {sorted.map((slice) => {
        const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
        return (
          <li
            key={slice.name}
            className="flex items-center justify-between gap-3 rounded-[var(--admin-radius-control)] px-2 py-1.5 hover:bg-[var(--admin-panel-muted)]/60"
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <span
                aria-hidden="true"
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: slice.fill }}
              />
              <span className="truncate text-[var(--admin-body)]">{slice.name}</span>
            </span>
            <span className="tabular-nums text-[var(--admin-text-muted)]">
              {slice.value} <span className="text-[var(--admin-text-muted)]/80">({pct}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
