import * as React from "react";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-[var(--motion-duration-normal)] ease-snappy outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        // ── Public-site variants ────────────────────────────────────────────
        primary:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border border-border bg-background text-foreground hover:bg-muted",
        ghost:
          "text-foreground hover:bg-muted",
        link:
          "rounded-none px-0 text-primary underline-offset-4 hover:underline",

        // ── Admin variants — DESIGN.md §5 ──────────────────────────────────
        // Primary: --admin-primary fill, --admin-action-primary-text label.
        // That label token is #ffffff in light and near-black in dark, because
        // the fill inverts to a pale blue — a hardcoded white read 2.11:1 on it.
        "admin-primary":
          "bg-[var(--admin-primary)] text-[var(--admin-action-primary-text)] hover:bg-[var(--admin-primary-hover)] active:bg-[var(--admin-primary-active)] focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-[var(--admin-canvas)]",
        // Secondary: Form Seam border, transparent fill.
        "admin-secondary":
          "border border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-button-subtle-hover)] active:bg-[var(--admin-button-subtle-active)] focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-[var(--admin-canvas)]",
        // Destructive: Cancelled-family fill. Use only for explicit destructive confirmed actions.
        "admin-destructive":
          "bg-[var(--admin-danger-solid)] text-[var(--admin-action-primary-text)] hover:bg-[var(--admin-danger-solid-hover)] active:bg-[var(--admin-danger-solid-active)] focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-[var(--admin-canvas)]",
        // Ghost: no border, no fill. Hover Moss on hover.
        "admin-ghost":
          "bg-transparent text-[var(--admin-body)] hover:bg-[var(--admin-button-subtle-hover)] active:bg-[var(--admin-button-subtle-active)] focus-visible:ring-[var(--admin-focus)]/55 focus-visible:ring-offset-[var(--admin-canvas)]",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

export type ButtonProps = React.ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Leading icon slot. Pass a Lucide icon element (not a component — pass the
     * rendered element so it appears before children).
     * When `loading` is true, the spinner renders here instead of the icon,
     * so the button text does not shift.
     */
    icon?: React.ReactNode;
    /**
     * Loading state. When true:
     * - If `icon` is provided: spinner replaces icon (§12.6 fix — never shows both).
     * - If no `icon`: spinner is prepended before children.
     * - Button is disabled and `aria-busy="true"` is set.
     * - Button text is unchanged.
     */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  fullWidth,
  type = "button",
  icon,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // §12.6 icon-slot: spinner replaces icon when loading, never alongside it.
  const leadingSlot = loading ? (
    <Loader2
      className="size-4 animate-spin"
      aria-hidden="true"
    />
  ) : icon ? (
    <>{icon}</>
  ) : null;

  return (
    <button
      data-slot="button"
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {leadingSlot}
      {children}
    </button>
  );
}
