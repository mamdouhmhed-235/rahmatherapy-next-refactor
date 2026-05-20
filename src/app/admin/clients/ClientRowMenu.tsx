"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import * as AdminPopover from "../components/admin-popover";

export interface LastVisitSummary {
  serviceLabel: string | null;
  bookingDate: string;
  paidLabel: string;
}

export interface NextBookingSummary {
  serviceLabel: string | null;
  bookingDate: string;
  timeLabel: string | null;
}

export interface LastBookingSummary {
  lastVisit: LastVisitSummary | null;
  nextBooking: NextBookingSummary | null;
}

export function ClientRowMenu({
  clientId,
  clientName,
  lastBooking,
}: {
  clientId: string;
  clientName: string;
  lastBooking: LastBookingSummary;
}) {
  const hasAny = lastBooking.lastVisit || lastBooking.nextBooking;
  return (
    <AdminPopover.Root>
      <AdminPopover.Trigger
        className="relative z-10 inline-flex size-11 sm:size-9 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-selected-sky)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
        aria-label={`More actions for ${clientName}`}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </AdminPopover.Trigger>
      <AdminPopover.Content className="w-[min(calc(100vw-1rem),22rem)] p-0">
        {hasAny ? (
          <div className="grid divide-y divide-[var(--admin-border)]">
            {lastBooking.lastVisit ? (
              <SummarySection
                heading="Last visit"
                service={lastBooking.lastVisit.serviceLabel}
                primary={lastBooking.lastVisit.bookingDate}
                secondary={lastBooking.lastVisit.paidLabel}
              />
            ) : null}
            {lastBooking.nextBooking ? (
              <SummarySection
                heading="Next booking"
                service={lastBooking.nextBooking.serviceLabel}
                primary={lastBooking.nextBooking.bookingDate}
                secondary={lastBooking.nextBooking.timeLabel}
              />
            ) : null}
          </div>
        ) : (
          <div className="p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
              No bookings yet
            </p>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
              This client hasn&apos;t booked a session.
            </p>
          </div>
        )}
        <div className="grid border-t border-[var(--admin-border)] p-1.5">
          <Link
            href={`/admin/bookings/new?clientId=${clientId}`}
            className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-hover-mist)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:hidden"
          >
            Start new booking
          </Link>
          <Link
            href={`/admin/clients/${clientId}`}
            className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-hover-mist)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            View client profile
          </Link>
          <Link
            href={`/admin/audit?target_type=client&target_id=${clientId}`}
            className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-hover-mist)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            View audit history
          </Link>
        </div>
      </AdminPopover.Content>
    </AdminPopover.Root>
  );
}

function SummarySection({
  heading,
  service,
  primary,
  secondary,
}: {
  heading: string;
  service: string | null;
  primary: string;
  secondary: string | null;
}) {
  return (
    <div className="grid gap-1 p-4">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
        {heading}
      </p>
      <p className="text-sm font-medium text-[var(--admin-heading)]">
        {service ?? "Service unrecorded"}
      </p>
      <p className="font-mono text-xs text-[var(--admin-text-muted)]">
        {primary}
        {secondary ? ` · ${secondary}` : ""}
      </p>
    </div>
  );
}
