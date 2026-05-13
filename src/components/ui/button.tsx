import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-[var(--motion-duration-normal)] ease-snappy outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border border-border bg-background text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        link: "rounded-none px-0 text-primary underline-offset-4 hover:underline",
        "admin-primary":
          "bg-[var(--admin-primary)] text-white hover:bg-[var(--admin-primary-hover)] active:bg-[oklch(15%_0.065_155)] focus-visible:ring-[var(--admin-focus)]/55",
        "admin-secondary":
          "border border-[var(--admin-border-form)] bg-transparent text-[var(--admin-body)] hover:bg-[oklch(95.5%_0.012_155)] active:bg-[oklch(92%_0.022_155)] focus-visible:ring-[var(--admin-focus)]/55",
        "admin-destructive":
          "bg-[oklch(40%_0.14_25)] text-white hover:bg-[oklch(33%_0.14_25)] focus-visible:ring-[var(--admin-focus)]/55",
        "admin-ghost":
          "bg-transparent text-[var(--admin-body)] hover:bg-[oklch(95.5%_0.012_155)] active:bg-[oklch(92%_0.022_155)] focus-visible:ring-[var(--admin-focus)]/55",
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
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  fullWidth,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}
