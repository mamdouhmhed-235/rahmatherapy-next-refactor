import * as React from "react";
import { cn } from "@/lib/utils";

export type ContainerSize = "sm" | "md" | "lg" | "xl" | "full";
export type ContainerPadding = "none" | "sm" | "md" | "lg";

const sizeClasses: Record<ContainerSize, string> = {
  sm: "max-w-[var(--content-width-sm)]",
  md: "max-w-[var(--content-width-md)]",
  lg: "max-w-[var(--content-width-lg)]",
  xl: "max-w-[var(--content-width-xl)]",
  full: "max-w-none",
};

const paddingClasses: Record<ContainerPadding, string> = {
  none: "px-0",
  sm: "px-4 sm:px-5",
  md: "px-5 sm:px-6 lg:px-8",
  lg: "px-6 sm:px-8 lg:px-10",
};

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  padding?: ContainerPadding;
}

export function Container({
  className,
  size = "lg",
  padding = "md",
  ...props
}: ContainerProps) {
  return (
    <div
      data-slot="container"
      className={cn("mx-auto w-full", sizeClasses[size], paddingClasses[padding], className)}
      {...props}
    />
  );
}
