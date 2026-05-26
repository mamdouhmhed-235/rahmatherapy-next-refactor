/**
 * Admin-segment loading fallback.
 *
 * Catches any nested admin route that doesn't ship its own `loading.tsx`.
 * Per-route overrides (e.g. `clients/loading.tsx`, `emails/loading.tsx`,
 * `reports/loading.tsx`) take precedence over this generic skeleton.
 */
import { AdminSkeleton } from "./components/admin-ui";

export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
      className="grid gap-5 pb-20 lg:pb-0"
    >
      <span className="sr-only">Loading…</span>
      <div className="grid gap-2">
        <AdminSkeleton className="h-9 w-44" />
        <AdminSkeleton className="h-4 w-72" />
      </div>
      <AdminSkeleton className="h-[78px] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)]" />
      <ul className="grid list-none gap-1.5 p-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <li
            key={index}
            className="flex min-h-[56px] items-center gap-3 rounded-[var(--admin-radius-control)] px-3 py-2.5 md:gap-4 md:px-4"
          >
            <AdminSkeleton className="size-8 shrink-0 rounded-full" />
            <div className="grid min-w-0 flex-1 gap-1.5">
              <AdminSkeleton className="h-3.5 w-44 rounded" />
              <AdminSkeleton className="h-3 w-32 rounded" />
            </div>
            <AdminSkeleton className="hidden h-8 w-24 rounded-full md:inline-block" />
          </li>
        ))}
      </ul>
    </div>
  );
}
