import { AdminSkeleton } from "../components/admin-ui";

export default function ClientsLoading() {
  return (
    <div className="grid gap-5 pb-20 lg:pb-0">
      <div className="grid gap-2">
        <AdminSkeleton className="h-9 w-32" />
        <AdminSkeleton className="h-4 w-72" />
      </div>
      <AdminSkeleton className="h-[78px] rounded-[var(--admin-radius-card)] border border-[var(--admin-border)]" />
      <ul className="grid list-none gap-1.5 p-0">
        {Array.from({ length: 8 }).map((_, index) => (
          <li
            key={index}
            className="flex min-h-[56px] items-center gap-3 rounded-[var(--admin-radius-control)] px-3 py-2.5 md:gap-4 md:px-4"
          >
            <AdminSkeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 grid gap-1.5">
              <AdminSkeleton className="h-3.5 w-40 rounded" />
              <AdminSkeleton className="h-3 w-28 rounded" />
            </div>
            <AdminSkeleton className="hidden h-8 w-24 rounded-full md:inline-block" />
          </li>
        ))}
      </ul>
    </div>
  );
}
