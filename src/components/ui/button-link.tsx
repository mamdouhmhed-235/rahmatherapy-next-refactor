"use client";

import * as React from "react";
import Link, { type LinkProps } from "next/link";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "./button";
import { cn } from "@/lib/utils";

export type ButtonLinkProps = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
  VariantProps<typeof buttonVariants> & {
    fullWidth?: boolean;
    disabled?: boolean;
  };

export function ButtonLink({
  className,
  variant,
  size,
  fullWidth,
  disabled = false,
  onClick,
  tabIndex,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      data-slot="button-link"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : tabIndex}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }

        onClick?.(event);
      }}
      {...props}
    />
  );
}
