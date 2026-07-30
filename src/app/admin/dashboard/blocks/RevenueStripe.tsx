// SERVER COMPONENT — Revenue snapshot stripe (C-11 block; brief §4.1
// "RevenueStripe").
//
// Compact period-tile row (e.g. Today / Week / Month / Lifetime) for the
// Business variant's revenue KPI cluster. Render-only: every tile value
// arrives pre-formatted from the caller, matching the established
// pre-formatted-string convention used by `PersonalContributionStripe`'s
// tiles (server→client function-prop boundary — B-1 lesson). Owner sees the
// full tile set; Admin's scoped variant (brief §9.2 Q9.2 — no lifetime
// totals) is a caller-side decision made when building the `tiles` prop.
// This block only renders whatever tiles it is given.

import { PoundSterling } from "lucide-react";
import { AdminDashboardPanel, AdminPanelHeader } from "../../components/admin-ui";

export interface RevenueStripeTile {
  label: string;
  value: string;
}

export interface RevenueStripeProps {
  tiles: RevenueStripeTile[];
  /** Optional caller-provided context line, e.g. "Scoped to your reporting range". */
  scopeNote?: string | null;
}

export function RevenueStripe({ tiles, scopeNote }: RevenueStripeProps) {
  // Coordinator has no revenue access at all (brief §9.2) — caller passes an
  // empty tile list rather than mounting the block.
  if (tiles.length === 0) return null;

  return (
    <AdminDashboardPanel ariaLabel="Revenue">
      <AdminPanelHeader
        icon={PoundSterling}
        title="Revenue"
        description={scopeNote ?? undefined}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            data-tile-label={tile.label}
            className="flex min-w-0 flex-col gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)]/60 bg-[var(--admin-panel-muted)]/40 px-3 py-2.5"
          >
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-[var(--admin-text-muted)]">
              {tile.label}
            </p>
            <p className="break-words text-base font-semibold leading-tight tabular-nums text-[var(--admin-heading)] sm:text-lg">
              {tile.value}
            </p>
          </div>
        ))}
      </div>
    </AdminDashboardPanel>
  );
}
