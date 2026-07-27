"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import * as AdminPopover from "../components/admin-popover";
import { DeleteClientButton } from "./components/DeleteClientButton";

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

/**
 * The delete confirmation portals to `<body>`, so Radix reads every click and
 * focus move inside it as happening outside the popover and would close the
 * menu — unmounting the dialog mid-confirm. Keep the menu open whenever the
 * interaction lands inside a dialog.
 */
function keepMenuOpenForDialog(
  event: CustomEvent<{ originalEvent: Event }> & { preventDefault: () => void }
) {
  const target = event.detail.originalEvent.target;
  if (target instanceof Element && target.closest('[role="dialog"]')) {
    event.preventDefault();
  }
}

export function ClientRowMenu({
  clientId,
  clientName,
  lastBooking,
  canDelete = false,
  deleted = false,
}: {
  clientId: string;
  clientName: string;
  lastBooking: LastBookingSummary;
  /** Actor holds `manage_client_destructive_ops` and the row is still live. */
  canDelete?: boolean;
  /** Soft-deleted rows offer viewing and audit history only (brief §5.3). */
  deleted?: boolean;
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
      <AdminPopover.Content
        className="w-[min(calc(100vw-1rem),22rem)] p-0"
        onInteractOutside={keepMenuOpenForDialog}
        onFocusOutside={keepMenuOpenForDialog}
      >
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
          {deleted ? null : (
            <Link
              href={`/admin/bookings/new?clientId=${clientId}`}
              className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-semibold text-[var(--admin-heading)] outline-none transition-colors hover:bg-[var(--admin-hover-mist)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:hidden"
            >
              Start new booking
            </Link>
          )}
          {/* A soft-deleted client 404s on the detail route, so the row stops
              offering the profile link rather than pointing at a dead page
              (brief §5.3). Audit history below stays reachable either way. */}
          {deleted ? null : (
            <Link
              href={`/admin/clients/${clientId}`}
              className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-hover-mist)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            >
              View client profile
            </Link>
          )}
          {/* Filter by id, not by `target_type`: the audit page matches
              `target_type` with an exact `eq` and only accepts the singular keys
              in `TARGET_TYPE_OPTIONS`, while client rows are written as
              `target_type: "clients"` — so `?target_type=client` returned
              nothing, and `target_id` was never a filter the page reads. `q` is
              the audit query's full-UUID lookup across
              `id / target_id / actor_staff_id`, so it finds this client's rows
              however `target_type` ends up spelled. */}
          <Link
            href={`/admin/audit?q=${clientId}`}
            className="inline-flex h-9 items-center rounded-[var(--admin-radius-control)] px-3 text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-hover-mist)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            View audit history
          </Link>
          {canDelete ? (
            <DeleteClientButton
              clientId={clientId}
              clientName={clientName}
              variant="menu-item"
            />
          ) : null}
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
