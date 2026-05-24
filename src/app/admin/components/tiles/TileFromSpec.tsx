"use client";

// B-3 client adapter: bridges server-built TileSpec[] → client KpiTile /
// ScorecardRing without passing function props across the RSC boundary
// (B-1 progress logged that constraint). `formatKey` resolves to a closure
// here, on the client side. Pure presentational; no state.

import { KpiTile } from "./KpiTile";
import { ScorecardRing } from "./ScorecardRing";
import type {
  TileSpec,
  KpiTileSpec,
  RingTileSpec,
  TileFormatKey,
} from "../performance-helpers";

const FORMATTERS: Record<TileFormatKey, (n: number) => string> = {
  count: (n) => String(Math.round(n)),
  money: (n) => `£${Math.round(n).toLocaleString("en-GB")}`,
  percent: (n) => `${Math.round(n)}%`,
  hours: (n) => `${(Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "")}h`,
  minutes: (n) => `${Math.round(n)} min`,
};

export function TileFromSpec({ spec }: { spec: TileSpec }) {
  if (spec.kind === "ring") return <RingTileAdapter spec={spec} />;
  return <KpiTileAdapter spec={spec} />;
}

function KpiTileAdapter({ spec }: { spec: KpiTileSpec }) {
  const formatValue = spec.formatKey ? FORMATTERS[spec.formatKey] : undefined;
  return (
    <KpiTile
      label={spec.label}
      value={spec.value}
      delta={spec.delta ?? undefined}
      series={spec.series}
      tone={spec.tone}
      href={spec.href}
      hint={spec.hint}
      formatValue={formatValue}
    />
  );
}

function RingTileAdapter({ spec }: { spec: RingTileSpec }) {
  return (
    <div className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-6">
      <ScorecardRing
        label={spec.label}
        value={spec.value}
        target={spec.target}
        unit={spec.unit}
      />
      {spec.hint ? (
        <p className="mt-3 text-center text-sm text-[var(--admin-text-muted)]">{spec.hint}</p>
      ) : null}
    </div>
  );
}
