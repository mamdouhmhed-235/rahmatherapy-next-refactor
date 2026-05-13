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
          "bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)] px-2.5 py-1",
        pending:
          "bg-[oklch(96%_0.038_75)] text-[oklch(28%_0.12_55)] px-2.5 py-1",
        cancelled:
          "bg-[oklch(95.5%_0.028_20)] text-[oklch(26%_0.14_25)] px-2.5 py-1",
        completed:
          "bg-[oklch(94%_0.03_200)] text-[oklch(28%_0.095_200)] px-2.5 py-1",
        attention:
          "bg-[oklch(95%_0.05_65)] text-[oklch(26%_0.13_55)] px-2.5 py-1",
        restricted:
          "bg-[oklch(94%_0.008_280)] text-[oklch(30%_0.02_280)] px-2.5 py-1",

        // ── Compact (2px×8px) — dense table contexts only ─────────────────
        "confirmed-sm":
          "bg-[oklch(93.5%_0.038_155)] text-[oklch(22%_0.085_155)] px-2 py-0.5 text-[11px]",
        "pending-sm":
          "bg-[oklch(96%_0.038_75)] text-[oklch(28%_0.12_55)] px-2 py-0.5 text-[11px]",
        "cancelled-sm":
          "bg-[oklch(95.5%_0.028_20)] text-[oklch(26%_0.14_25)] px-2 py-0.5 text-[11px]",
        "completed-sm":
          "bg-[oklch(94%_0.03_200)] text-[oklch(28%_0.095_200)] px-2 py-0.5 text-[11px]",
        "attention-sm":
          "bg-[oklch(95%_0.05_65)] text-[oklch(26%_0.13_55)] px-2 py-0.5 text-[11px]",
        "restricted-sm":
          "bg-[oklch(94%_0.008_280)] text-[oklch(30%_0.02_280)] px-2 py-0.5 text-[11px]",

        // ── Legacy / non-admin surfaces ────────────────────────────────────
        default:
          "border border-transparent bg-[var(--admin-primary)]/12 text-[var(--admin-primary)] px-2.5 py-1",
        secondary:
          "border border-transparent bg-[var(--admin-panel-muted)] text-[var(--admin-body)] px-2.5 py-1",
        outline:
          "border border-[var(--admin-border)] bg-transparent text-[var(--admin-body)] px-2.5 py-1",
        accent:
          "border border-transparent bg-[oklch(96%_0.038_75)] text-[oklch(28%_0.12_55)] px-2.5 py-1",
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
