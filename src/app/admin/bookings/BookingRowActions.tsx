"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, MoreHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmActionModal } from "../components/admin-ui-interactions";
import {
  claimBookingAssignment,
  quickUpdateBooking,
} from "./actions";
import { isBookingMomentPastLondon, isRestoreWindowExpired } from "./_helpers";

type Role = "full" | "therapist";

export type BookingRowAction =
  | "confirm"
  | "mark_paid"
  | "cancel"
  | "complete"
  | "no_show"
  | "restore"
  | "send_reminder";

type Props = {
  bookingId: string;
  clientName: string;
  role: Role;
  status: string;
  paymentStatus: string;
  assignmentStatus: string;
  mapUrl: string | null;
  claimableAssignmentId: string | null;
  /**
   * C-04a Phase G — the restore guards read real booking data, so the row has to
   * carry it. Every one of these four must also be named in the `.select(...)`
   * that produced the row (`BOOKING_SELECT` / `CLAIMABLE_BOOKING_SELECT` in
   * ./page.tsx): the admin client is untyped, so a column present on the type
   * but missing from the projection reads `undefined` with tsc, lint and vitest
   * all green — and `isRestoreWindowExpired` fails closed, which silently
   * removes the Restore item from every row.
   */
  bookingDate: string;
  startTime: string;
  cancelledAt: string | null;
  customerCancelledAt: string | null;
};

// Map server error strings (from src/app/admin/bookings/actions.ts) to the
// brief's operator-friendly copy. Unknown errors fall through to the server
// message so we never lie about what went wrong.
function friendlyError(raw: string, context: "claim" | "quick"): string {
  const msg = raw.toLowerCase();
  if (msg.includes("already been claimed")) {
    return context === "claim"
      ? "Someone got there first. The booking has been claimed."
      : "Someone just updated this one. Refresh to see the latest.";
  }
  if (msg.includes("booking not found") || msg.includes("assignment not found")) {
    return "This booking is no longer available. Refresh the list.";
  }
  if (msg.includes("insufficient permissions")) {
    return "You don't have permission for that action.";
  }
  if (msg.includes("another therapist gender")) {
    return "This booking needs a different-gender therapist.";
  }
  if (msg.includes("unsupported booking action")) {
    return "That action isn't available for this booking.";
  }
  return raw;
}

export function BookingRowActions({
  bookingId,
  clientName,
  role,
  status,
  paymentStatus,
  assignmentStatus,
  mapUrl,
  claimableAssignmentId,
  bookingDate,
  startTime,
  cancelledAt,
  customerCancelledAt,
}: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = React.useState<BookingRowAction | "claim" | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  // Track whether the last close happened via Escape so we only return focus
  // to the trigger in that case (click-outside should leave focus alone).
  const closedByEscape = React.useRef(false);

  // Click-outside + Escape close handlers.
  React.useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closedByEscape.current = true;
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  // Focus management — move focus into the menu on open, return it to the
  // trigger after Escape close. Click-outside closes without yanking focus.
  React.useEffect(() => {
    if (menuOpen) {
      const first = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([disabled])'
      );
      first?.focus();
      return;
    }
    if (closedByEscape.current) {
      closedByEscape.current = false;
      triggerRef.current?.focus();
    }
  }, [menuOpen]);

  async function runQuickAction(action: BookingRowAction) {
    if (action === "send_reminder") {
      toast.message("Manual reminders are coming soon.", {
        description: "For now, send from the Emails page.",
      });
      router.push(`/admin/emails?booking=${bookingId}`);
      return;
    }
    // S6 short-circuit. The menu already hides Restore once the appointment
    // moment has gone, but the row was rendered at some earlier instant and the
    // modal can sit open across the boundary, so re-check at the point of fire
    // rather than round-tripping to the server's refusal.
    if (
      action === "restore" &&
      isBookingMomentPastLondon({ booking_date: bookingDate, start_time: startTime })
    ) {
      toast.error("This booking's appointment time has already passed.");
      return;
    }
    // Block concurrent fires — the Cancel path goes through a modal whose
    // onConfirm could be reached while another action is already in flight.
    if (pendingAction !== null) {
      toast.message("Another action is in progress.", {
        description: "Wait for it to finish, then try again.",
      });
      return;
    }
    setPendingAction(action);
    try {
      const formData = new FormData();
      formData.set("booking_id", bookingId);
      formData.set("action", action);
      const result = await quickUpdateBooking(formData);
      if (result.error) {
        toast.error(friendlyError(result.error, "quick"));
        return;
      }
      if (action === "confirm") toast.success("Booking confirmed.");
      else if (action === "mark_paid") toast.success("Booking marked paid.");
      else if (action === "cancel")
        toast.success("Booking cancelled. The client has been notified.");
      else if (action === "complete") toast.success("Booking marked complete.");
      else if (action === "no_show") toast.success("Booking marked no-show.");
      else if (action === "restore")
        toast.success("Booking restored. The client has been notified.");
      router.refresh();
    } catch (error) {
      console.error("[bookings] quick action failed", { action, bookingId, error });
      toast.error("Couldn't update that booking. Try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function runClaim() {
    if (!claimableAssignmentId) return;
    if (pendingAction !== null) {
      toast.message("Another action is in progress.", {
        description: "Wait for it to finish, then try again.",
      });
      return;
    }
    setPendingAction("claim");
    try {
      const formData = new FormData();
      formData.set("assignment_id", claimableAssignmentId);
      const result = await claimBookingAssignment(formData);
      if (result.error) {
        toast.error(friendlyError(result.error, "claim"));
        return;
      }
      toast.success("Booking claimed.");
      router.refresh();
    } catch (error) {
      console.error("[bookings] claim failed", {
        assignmentId: claimableAssignmentId,
        error,
      });
      toast.error("Couldn't claim that booking. Try again.");
    } finally {
      setPendingAction(null);
    }
  }

  const showConfirm =
    role === "full" && status === "pending" && pendingAction !== "cancel";
  const showAssign =
    role === "full" &&
    !["cancelled", "no_show"].includes(status) &&
    assignmentStatus !== "fully_assigned";
  const showSendReminder =
    role === "full" && (status === "confirmed" || status === "pending");
  const showMarkPaid =
    role === "full" &&
    paymentStatus !== "paid" &&
    !["cancelled", "no_show"].includes(status);
  const showComplete =
    role === "full" &&
    status === "confirmed" &&
    assignmentStatus === "fully_assigned";
  const showCancel =
    role === "full" && !["cancelled", "completed", "no_show"].includes(status);
  const showClaim = Boolean(claimableAssignmentId);

  // C-04a Phase G — an inert row has exactly one action and it is Restore.
  // Every other menu item already excluded these two statuses, so this branch
  // replaces the "No further actions." fallback rather than removing anything.
  const isInertStatus = status === "cancelled" || status === "no_show";
  // The two guards `restoreBooking` enforces, read from the same helpers the
  // server and the detail page read, so the menu cannot offer what the action
  // refuses. S7 is scoped to `cancelled` deliberately: a no-show booking carries
  // no cancellation stamp, so `isRestoreWindowExpired` fails closed on every one
  // of them — and neither the server nor the detail-page strip applies the
  // window to a no-show source.
  const restoreBlockedReason = !isInertStatus
    ? null
    : isBookingMomentPastLondon({
          booking_date: bookingDate,
          start_time: startTime,
        })
      ? "No actions available (appointment time has passed)"
      : status === "cancelled" &&
          isRestoreWindowExpired({
            cancelled_at: cancelledAt,
            customer_cancelled_at: customerCancelledAt,
          })
        ? "No actions available (28-day restore window has passed)"
        : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {mapUrl ? (
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          title="Open in Google Maps"
          aria-label={`Open service location for ${clientName} in Google Maps`}
          className="inline-flex size-11 items-center justify-center rounded-[var(--admin-radius-control)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:size-9"
        >
          <MapPin className="size-4" aria-hidden="true" />
        </a>
      ) : null}

      {showClaim ? (
        <button
          type="button"
          onClick={runClaim}
          disabled={pendingAction === "claim"}
          aria-busy={pendingAction === "claim" || undefined}
          aria-label={`Claim booking for ${clientName}`}
          className="inline-flex h-11 appearance-none items-center gap-1.5 rounded-[var(--admin-radius-control)] border-0 bg-[var(--admin-primary)] px-4 text-xs font-semibold text-[var(--admin-on-primary)] outline-none transition-colors hover:bg-[var(--admin-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 md:h-9 md:px-3"
        >
          {pendingAction === "claim" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          Claim
        </button>
      ) : null}

      {showConfirm ? (
        <button
          type="button"
          onClick={() => runQuickAction("confirm")}
          disabled={pendingAction === "confirm"}
          aria-busy={pendingAction === "confirm" || undefined}
          aria-label={`Confirm booking for ${clientName}`}
          className="inline-flex h-11 appearance-none items-center gap-1.5 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-4 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:opacity-60 md:h-9 md:px-3"
        >
          {pendingAction === "confirm" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          Confirm
        </button>
      ) : null}

      {showAssign ? (
        <Link
          href={`/admin/bookings/${bookingId}#assignment`}
          aria-label={`Assign therapist for ${clientName}`}
          className="hidden h-9 items-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] px-3 text-xs font-semibold text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:inline-flex"
        >
          Assign
        </Link>
      ) : null}

      {role === "full" ? (
        <div ref={menuRef} className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`More actions for ${clientName}`}
            className="inline-flex size-11 appearance-none items-center justify-center rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] text-[var(--admin-text-muted)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 md:size-9"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="rahma-pop-in absolute right-0 z-30 mt-1.5 grid min-w-52 gap-0.5 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1.5 shadow-[var(--admin-shadow-overlay)]"
            >
              {isInertStatus ? (
                restoreBlockedReason ? (
                  <MenuButton role="menuitem" disabled>
                    {restoreBlockedReason}
                  </MenuButton>
                ) : (
                  <ConfirmActionModal
                    title="Restore this booking?"
                    description="The booking goes back to confirmed, the client is emailed to say it's back on, and assigned staff are notified."
                    confirmLabel="Restore booking"
                    cancelLabel="Cancel"
                    destructive={false}
                    onConfirm={() => runQuickAction("restore")}
                    trigger={
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => setMenuOpen(false)}
                        className="flex min-h-9 w-full appearance-none items-center gap-2 rounded-[var(--admin-radius-control)] border-0 bg-transparent px-3 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                      >
                        <RotateCcw className="size-4" aria-hidden="true" />
                        Restore booking
                      </button>
                    }
                  />
                )
              ) : (
                <>
                  {showSendReminder ? (
                    <MenuButton
                      role="menuitem"
                      data-backend-fake="manual-send-reminder"
                      onClick={() => {
                        setMenuOpen(false);
                        runQuickAction("send_reminder");
                      }}
                    >
                      Send reminder
                    </MenuButton>
                  ) : null}
                  {showMarkPaid ? (
                    <MenuButton
                      role="menuitem"
                      disabled={pendingAction === "mark_paid"}
                      onClick={() => {
                        setMenuOpen(false);
                        runQuickAction("mark_paid");
                      }}
                    >
                      Mark paid
                    </MenuButton>
                  ) : null}
                  {showComplete ? (
                    <MenuButton
                      role="menuitem"
                      disabled={pendingAction === "complete"}
                      onClick={() => {
                        setMenuOpen(false);
                        runQuickAction("complete");
                      }}
                    >
                      Mark complete
                    </MenuButton>
                  ) : null}
                  {showCancel ? (
                    <ConfirmActionModal
                      title="Cancel this booking?"
                      description="The client will be notified by email. This cannot be undone from the booking page."
                      confirmLabel="Cancel booking"
                      cancelLabel="Keep it"
                      destructive
                      onConfirm={() => runQuickAction("cancel")}
                      trigger={
                        <button
                          role="menuitem"
                          type="button"
                          onClick={() => setMenuOpen(false)}
                          className="flex min-h-9 w-full appearance-none items-center rounded-[var(--admin-radius-control)] border-0 bg-transparent px-3 text-left text-sm font-medium text-[oklch(26%_0.14_25)] outline-none transition-colors hover:bg-[oklch(95.5%_0.028_20)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
                        >
                          Cancel booking
                        </button>
                      }
                    />
                  ) : null}
                  {!showSendReminder &&
                  !showMarkPaid &&
                  !showComplete &&
                  !showCancel ? (
                    <span className="px-3 py-2 text-xs text-[var(--admin-text-muted)]">
                      No further actions.
                    </span>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  children,
  disabled,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex min-h-9 w-full appearance-none items-center rounded-[var(--admin-radius-control)] border-0 bg-transparent px-3 text-left text-sm font-medium text-[var(--admin-body)] outline-none transition-colors hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
