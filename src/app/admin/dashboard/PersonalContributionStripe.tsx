// SERVER COMPONENT — Personal Contribution stripe (B-5 brief §5.1).
//
// Renders 4 <MetricRow> tiles per role variant + a segmented period picker
// (today / this_week / this_month) wired to `?contribStripeRange=` URL param.
// Tile composition is owned by `tilesForVariant` in `dashboard-helpers-b5.ts`;
// this component only handles layout + the picker chrome.
//
// A11y: per SHARED-IMPLEMENTATION-NOTES §3, the period picker is a <fieldset>
// with an sr-only <legend>; active chip carries `aria-current="page"`.
//
// Mobile: tiles collapse from 4-up to a 2×2 grid below md.
//
// The component is render-only — values come pre-formatted as strings to
// avoid the server→client function-prop boundary (B-1 lesson).

import Link from "next/link";
import { MetricRow } from "../components/tiles/MetricRow";
import type {
  PersonalStripeTile,
  StripeRange,
  StripeVariant,
} from "./dashboard-helpers-b5";

export type { StripeRange };

export const STRIPE_RANGES: StripeRange[] = ["today", "this_week", "this_month"];

const RANGE_LABELS: Record<StripeRange, string> = {
  today: "Today",
  this_week: "This week",
  this_month: "This month",
};

export interface PersonalContributionStripeProps {
  tiles: PersonalStripeTile[];
  activeRange: StripeRange;
  variant: StripeVariant;
  /**
   * Other URL params to preserve when the period picker navigates. Pass the
   * page-level `searchParams` minus `contribStripeRange` itself.
   */
  preservedSearchParams?: Record<string, string>;
}

/** Convert any string back to a valid StripeRange, defaulting to this_week. */
export function parseStripeRange(value: string | undefined | null): StripeRange {
  if (value === "today" || value === "this_month") return value;
  return "this_week";
}

function buildPickerHref(
  range: StripeRange,
  preserved: Record<string, string> | undefined
): string {
  const params = new URLSearchParams();
  if (preserved) {
    for (const [key, val] of Object.entries(preserved)) {
      if (val) params.set(key, val);
    }
  }
  // Default range stays in URL so the active chip's link still navigates;
  // page-side parsing tolerates both presence and absence.
  params.set("contribStripeRange", range);
  const query = params.toString();
  return query ? `/admin/dashboard?${query}` : "/admin/dashboard";
}

export function PersonalContributionStripe({
  tiles,
  activeRange,
  variant,
  preservedSearchParams,
}: PersonalContributionStripeProps) {
  // Single source of truth for the eyebrow label — the picker label matches.
  const eyebrow = `My contribution · ${RANGE_LABELS[activeRange]}`;

  return (
    <section
      aria-labelledby="personal-stripe-heading"
      data-variant={variant}
      className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="personal-stripe-heading"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]"
        >
          {eyebrow}
        </h2>

        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">My contribution period</legend>
          {STRIPE_RANGES.map((range) => {
            const isActive = range === activeRange;
            return (
              <Link
                key={range}
                href={buildPickerHref(range, preservedSearchParams)}
                aria-current={isActive ? "page" : undefined}
                scroll={false}
                className={
                  isActive
                    ? "inline-flex h-7 items-center rounded-full bg-[var(--admin-primary)] px-3 text-xs font-semibold text-[var(--admin-on-primary)] outline-none transition-colors duration-150 ease-out focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
                    : "inline-flex h-7 items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-xs font-medium text-[var(--admin-body)] outline-none transition-colors duration-150 ease-out hover:bg-[var(--admin-panel-muted)] focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[var(--admin-focus)]/55 motion-reduce:transition-none"
                }
              >
                {RANGE_LABELS[range]}
              </Link>
            );
          })}
        </fieldset>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="min-w-0 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)]/60 bg-[var(--admin-panel-muted)]/40 px-3 py-2.5"
          >
            <MetricRow
              label={tile.label}
              value={tile.value}
              delta={tile.delta}
              series={tile.series}
              tone={tile.tone}
              className="flex-wrap"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
