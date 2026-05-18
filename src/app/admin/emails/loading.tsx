import { AdminPageHeader, AdminPanel, AdminSkeleton } from "../components/admin-ui";

// Brief §6 Key States — Loading:
// "AdminSkeleton bars approximating: tab strip (instant, no skeleton),
//  filter strip (instant), 3 per-day panels with 4 row skeletons each."
//
// The tab strip and filter strip are rendered as static structure (so the
// operator can see where they'll be) but without count badges or current
// values. Three day panels each carry four row skeletons.
export default function EmailsLoading() {
  return (
    <div className="grid gap-6">
      <AdminPageHeader
        title="Email"
        description="Delivery status, manual reminders, and template library."
      />

      <div aria-hidden="true" className="flex gap-1.5 overflow-hidden">
        <AdminSkeleton className="h-10 w-28 rounded-full" />
        <AdminSkeleton className="h-10 w-32 rounded-full" />
        <AdminSkeleton className="h-10 w-28 rounded-full" />
      </div>

      <div
        aria-hidden="true"
        className="rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-3"
      >
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-end">
          <AdminSkeleton className="h-10 w-full rounded-[var(--admin-radius-control)]" />
          <AdminSkeleton className="h-10 w-full rounded-[var(--admin-radius-control)]" />
          <AdminSkeleton className="h-10 w-full rounded-[var(--admin-radius-control)]" />
          <AdminSkeleton className="h-10 w-full rounded-[var(--admin-radius-control)]" />
          <AdminSkeleton className="h-10 w-28 rounded-[var(--admin-radius-control)]" />
        </div>
      </div>

      <div className="grid gap-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading email events</span>
        {[0, 1, 2].map((groupIndex) => (
          <AdminPanel
            key={groupIndex}
            title={groupIndex === 0 ? "Today" : groupIndex === 1 ? "Yesterday" : "Earlier"}
            density="compact"
          >
            <div className="grid gap-2.5">
              {[0, 1, 2, 3].map((rowIndex) => (
                <div
                  key={rowIndex}
                  aria-hidden="true"
                  className="flex items-start gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 py-3"
                >
                  <AdminSkeleton className="mt-0.5 size-9 shrink-0 rounded-full" />
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <div className="flex gap-1.5">
                      <AdminSkeleton className="h-5 w-24 rounded-full" />
                      <AdminSkeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <AdminSkeleton className="h-4 w-2/3" />
                    <AdminSkeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </AdminPanel>
        ))}
      </div>
    </div>
  );
}
