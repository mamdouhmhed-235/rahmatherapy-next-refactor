// SERVER COMPONENT — Claim queue stripe (C-11 block; brief §4.2
// "ClaimQueueStripe").
//
// Coordinator + practitioner-mode: surfaces bookings without an assigned
// therapist so the viewer can jump straight to claiming/assigning one.
// Render-only — the caller derives this slim `ClaimQueueBooking[]` view
// model from `data.bookings.filter(unassigned)` (plan §1 Phase A lift note),
// mirroring the existing `SnapshotAppointment` mapping pattern already used
// by `dashboard-cards.tsx`.

import Link from "next/link";
import { ArrowRight, UserX } from "lucide-react";
import {
  AdminDashboardPanel,
  AdminIconBadge,
  AdminPanelHeader,
  AdminStatusBadge,
} from "../../components/admin-ui";
import { EmptyState } from "../../components/EmptyState";

export interface ClaimQueueBooking {
  id: string;
  contactName: string | null;
  /** Pre-formatted date label, e.g. "Mon 3 Aug". */
  bookingDate: string;
  /** Pre-formatted time label, e.g. "09:00". */
  time: string | null;
  city: string | null;
  requiredGender?: string | null;
}

export interface ClaimQueueStripeProps {
  bookings: ClaimQueueBooking[];
  viewAllHref?: string;
}

export function ClaimQueueStripe({
  bookings,
  viewAllHref = "/admin/bookings?view=unassigned",
}: ClaimQueueStripeProps) {
  const visible = bookings.slice(0, 5);

  return (
    <AdminDashboardPanel ariaLabel="Claim queue">
      <AdminPanelHeader
        icon={UserX}
        title="Claim queue"
        description={
          bookings.length > 0
            ? `${bookings.length} booking${bookings.length === 1 ? "" : "s"} need${bookings.length === 1 ? "s" : ""} a therapist.`
            : undefined
        }
        tone={bookings.length > 0 ? "warning" : "default"}
      />

      {bookings.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={UserX}
            title="Nothing in the queue"
            message="Every booking currently has a therapist assigned."
            tone="muted"
          />
        </div>
      ) : (
        <ul className="m-0 mt-4 grid list-none gap-2 p-0">
          {visible.map((booking) => (
            <li key={booking.id}>
              <Link
                href={`/admin/bookings/${booking.id}`}
                className="flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 py-2.5 outline-none transition-colors hover:bg-[var(--admin-panel-muted)]/60 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/35"
              >
                <AdminIconBadge icon={UserX} tone="warning" className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--admin-heading)]">
                    {booking.contactName ?? "Unknown contact"}
                  </p>
                  <p className="truncate text-xs text-[var(--admin-text-muted)]">
                    {[booking.bookingDate, booking.time, booking.city]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {booking.requiredGender && booking.requiredGender !== "any" ? (
                  <AdminStatusBadge value="Same-gender" tone="warning" compact />
                ) : null}
              </Link>
            </li>
          ))}
          {bookings.length > 5 ? (
            <li className="pt-1">
              <Link
                href={viewAllHref}
                className="admin-link-action inline-flex items-center gap-1 text-sm"
              >
                See all {bookings.length} unassigned
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </AdminDashboardPanel>
  );
}
