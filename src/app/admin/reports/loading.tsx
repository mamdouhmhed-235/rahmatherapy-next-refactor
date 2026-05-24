// B-4 — Reports route skeleton. Mirrors the new page composition:
// Insights stripe (2 rows) → filter strip (instant, omitted) → 6-tile
// headline grid (Owner/Admin worst-case — 4-tile Coord/Therapist scopes
// also render fine in a 3-col grid; minor padding at the right is the
// only visual delta) → Activity / Workload / Money section skeletons.
//
// Rendered automatically by Next.js App Router during route transitions
// into /admin/reports. Shimmer inherited from `<AdminSkeleton>` (B-1).

import { AdminPageScaffold, AdminPanel, AdminSkeleton } from "../components/admin-ui";

export default function ReportsLoading() {
  return (
    <AdminPageScaffold className="gap-8 pb-10 md:pb-0">
      {/* Header */}
      <header className="grid gap-2">
        <AdminSkeleton className="h-9 w-36" />
        <AdminSkeleton className="h-4 w-2/3 max-w-md" />
      </header>

      {/* Scope pill */}
      <AdminSkeleton className="h-7 w-48 rounded-full" />

      {/* Insights stripe — render 2 row placeholders (the stripe hides
          server-side when there are zero insights; skeleton stays
          conservative so the layout doesn't jitter) */}
      <div className="grid gap-2">
        <AdminSkeleton className="h-12 rounded-md" />
        <AdminSkeleton className="h-12 rounded-md" />
      </div>

      {/* 6-tile headline grid (3-col on xl; equal min-h-[14rem]) */}
      <section
        aria-label="Headline metrics loading"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <AdminSkeleton key={i} className="h-[14rem] rounded-[var(--admin-radius-card)]" />
        ))}
      </section>

      {/* Section A — Activity */}
      <SectionSkeleton chartCount={2} />

      {/* Section B — Workload */}
      <SectionSkeleton rowCount={4} />

      {/* Section C — Money (gated server-side when revenueAllowed=false; the
          skeleton mirrors the worst-case surface to avoid a layout jolt on
          hydration). */}
      <SectionSkeleton chartCount={1} rowCount={4} />
    </AdminPageScaffold>
  );
}

function SectionSkeleton({
  chartCount = 0,
  rowCount = 0,
}: {
  chartCount?: number;
  rowCount?: number;
}) {
  return (
    <section className="grid gap-4">
      <header className="grid gap-2">
        <AdminSkeleton className="h-7 w-32" />
        <AdminSkeleton className="h-3 w-72 max-w-full" />
      </header>
      {chartCount > 0 ? (
        <div className={chartCount > 1 ? "grid gap-4 xl:grid-cols-2" : "grid gap-4"}>
          {Array.from({ length: chartCount }).map((_, i) => (
            <AdminPanel key={i} title=" ">
              <AdminSkeleton className="min-h-[288px] w-full" />
            </AdminPanel>
          ))}
        </div>
      ) : null}
      {rowCount > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <AdminPanel title=" ">
            <div className="grid gap-3">
              {Array.from({ length: rowCount }).map((_, i) => (
                <AdminSkeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </AdminPanel>
          <AdminPanel title=" ">
            <div className="grid gap-3">
              {Array.from({ length: rowCount }).map((_, i) => (
                <AdminSkeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </AdminPanel>
        </div>
      ) : null}
    </section>
  );
}
