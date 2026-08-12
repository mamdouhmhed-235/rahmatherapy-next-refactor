import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * AdminStatusBadge — six named status families.
 * Every badge requires text label + icon in the caller; colour alone is never
 * the only signal (DESIGN.md Named Status Rule).
 *
 * variant aliases match DESIGN.md §2 Status Families:
 *   confirmed  → Confirmed / Active
 *   pending    → Pending / Unconfirmed
 *   cancelled  → Cancelled / Void
 *   completed  → Completed
 *   attention  → Unassigned / Attention
 *   restricted → Restricted / Inactive
 *
 * The legacy "default / secondary / outline / accent" variants are preserved
 * for non-admin surfaces that import this component.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full text-xs font-medium leading-none transition-colors duration-[var(--motion-duration-fast,160ms)] ease-gentle",
  {
    variants: {
      variant: {
        // ── Status families ────────────────────────────────────────────────
        confirmed:
          "bg-[var(--admin-status-confirmed-bg)] text-[var(--admin-status-confirmed-text)] px-2.5 py-1",
        pending:
          "bg-[var(--admin-status-pending-bg)] text-[var(--admin-status-pending-text)] px-2.5 py-1",
        cancelled:
          "bg-[var(--admin-status-cancelled-bg)] text-[var(--admin-status-cancelled-text)] px-2.5 py-1",
        completed:
          "bg-[var(--admin-status-completed-bg)] text-[var(--admin-status-completed-text)] px-2.5 py-1",
        attention:
          "bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-attention-text)] px-2.5 py-1",
        restricted:
          "bg-[var(--admin-status-restricted-bg)] text-[var(--admin-status-restricted-text)] px-2.5 py-1",

        // ── Compact (2px×8px) — dense table contexts only ─────────────────
        "confirmed-sm":
          "bg-[var(--admin-status-confirmed-bg)] text-[var(--admin-status-confirmed-text)] px-2 py-0.5 text-[11px]",
        "pending-sm":
          "bg-[var(--admin-status-pending-bg)] text-[var(--admin-status-pending-text)] px-2 py-0.5 text-[11px]",
        "cancelled-sm":
          "bg-[var(--admin-status-cancelled-bg)] text-[var(--admin-status-cancelled-text)] px-2 py-0.5 text-[11px]",
        "completed-sm":
          "bg-[var(--admin-status-completed-bg)] text-[var(--admin-status-completed-text)] px-2 py-0.5 text-[11px]",
        "attention-sm":
          "bg-[var(--admin-status-attention-bg)] text-[var(--admin-status-attention-text)] px-2 py-0.5 text-[11px]",
        "restricted-sm":
          "bg-[var(--admin-status-restricted-bg)] text-[var(--admin-status-restricted-text)] px-2 py-0.5 text-[11px]",

        // ── Legacy / non-admin surfaces ────────────────────────────────────
        default:
          "border border-transparent bg-[var(--admin-primary)]/12 text-[var(--admin-primary)] px-2.5 py-1",
        secondary:
          "border border-transparent bg-[var(--admin-panel-muted)] text-[var(--admin-body)] px-2.5 py-1",
        outline:
          "border border-[var(--admin-border)] bg-transparent text-[var(--admin-body)] px-2.5 py-1",
        accent:
          "border border-transparent bg-[var(--admin-status-pending-bg)] text-[var(--admin-status-pending-text)] px-2.5 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
