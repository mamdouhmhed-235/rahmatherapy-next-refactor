// SERVER COMPONENT — Recent activity stripe (C-11 block; brief §4.1
// "RecentActivityStripe").
//
// Business variant's activity feed. Render-only — consumes the existing
// `NotificationItem[]` shape already produced by `buildNotifications()`
// (`reports/reporting.ts`), so wiring this block up in a later phase is a
// direct pass-through rather than a new data shape. `reporting.ts` is a
// RECON §5 untouchable — this file only imports its existing exported type,
// it does not modify it.

import Link from "next/link";
import { Activity } from "lucide-react";
import {
  AdminDashboardPanel,
  AdminIconBadge,
  AdminPanelHeader,
} from "../../components/admin-ui";
import { EmptyState } from "../../components/EmptyState";
import { severityTone } from "../dashboard-helpers";
import type { NotificationItem } from "../../reports/reporting";

export interface RecentActivityStripeProps {
  items: NotificationItem[];
  maxItems?: number;
}

export function RecentActivityStripe({
  items,
  maxItems = 6,
}: RecentActivityStripeProps) {
  const visible = items.slice(0, maxItems);

  return (
    <AdminDashboardPanel ariaLabel="Recent activity">
      <AdminPanelHeader icon={Activity} title="Recent activity" />

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Activity}
            title="Nothing to report"
            message="New activity across bookings, enquiries, and emails will appear here."
            tone="muted"
          />
        </div>
      ) : (
        <ul className="m-0 mt-4 grid list-none gap-2 p-0">
          {visible.map((item) => {
            const tone = severityTone(item.severity);
            const content = (
              <div className="flex items-start gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-2.5">
                <AdminIconBadge icon={Activity} tone={tone} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">
                    {item.title}
                  </p>
                  <p className="truncate text-xs text-[var(--admin-text-muted)]">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block rounded-[var(--admin-radius-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length > maxItems ? (
        <p className="mt-3 text-right text-xs text-[var(--admin-text-muted)]">
          Showing {maxItems} of {items.length}.
        </p>
      ) : null}
    </AdminDashboardPanel>
  );
}
