// B-4 — Headline tile strip.
//
// 6 tiles for Owner/Admin, 4 for Coordinator + Therapist (per brief §4).
// Pure render layer over `tilesForScope` from reports-helpers.ts — the page
// composer does all the data fetching + computation, this component maps the
// serializable TileSpec[] onto KpiTile.
//
// Equal min-height (14rem) per brief §5; auto-fill grid so the row reflows
// at small viewports. Tiles render in document order = keyboard order.
//
// Plan: redesign/plans/B-phase/B4-reports-rebuild-plan.md (step 4).

import { KpiTile } from "../components/tiles/KpiTile";
import type { TileSpec } from "./reports-helpers";

interface HeadlineTileStripProps {
  tiles: TileSpec[];
}

export function HeadlineTileStrip({ tiles }: HeadlineTileStripProps) {
  return (
    <section
      aria-label="Headline metrics"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {tiles.map((tile) => (
        <KpiTile
          key={tile.key}
          label={tile.label}
          value={tile.value}
          delta={tile.delta}
          tone={tile.deltaTone}
          series={tile.series}
          href={tile.href}
          hint={tile.hint}
          className="min-h-[14rem]"
        />
      ))}
    </section>
  );
}
