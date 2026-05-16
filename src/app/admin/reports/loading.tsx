// Per brief §6 K7 (Loading): "AdminSkeleton: filter strip (instant), 4 stat-tile
// skeletons, then section-by-section: panel headers + chart skeleton (minHeight:
// 288 placeholder rectangle) + 4 row skeletons in each list panel."
//
// Rendered automatically by Next.js App Router during route transitions into
// /admin/reports. Filter strip is omitted from the skeleton because it stays
// instant (brief: "filter strip (instant)").

import { AdminPageScaffold, AdminPanel, AdminSkeleton } from "../components/admin-ui";

export default function ReportsLoading() {
  return (
    <AdminPageScaffold className="gap-8 pb-10 md:pb-0">
      {/* Header */}
      <header className="grid gap-2">
        <AdminSkeleton className="h-9 w-36" />
        <AdminSkeleton className="h-4 w-2/3 max-w-md" />
      </header>

      {/* 4 stat tile skeletons */}
      <section
        aria-label="Headline summary loading"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-5 py-4"
          >
            <AdminSkeleton className="h-3 w-1/2" />
            <AdminSkeleton className="mt-3 h-9 w-2/3" />
            <AdminSkeleton className="mt-2 h-3 w-3/4" />
          </div>
        ))}
      </section>

      {/* Section A — Activity */}
      <SectionSkeleton chartCount={2} />

      {/* Section B — Workload */}
      <SectionSkeleton rowCount={4} />

      {/* Section C — Money (rendered conservatively; gated server-side when
          revenueAllowed === false, but the skeleton mirrors the worst-case
          surface to avoid a layout shift on hydration) */}
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
