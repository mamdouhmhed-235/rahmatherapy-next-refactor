import * as React from "react";
import { cn } from "@/lib/utils";
import { Container, type ContainerSize } from "./container";

export type SectionSpacing = "none" | "xs" | "sm" | "md" | "lg";
export type SectionSurface = "default" | "muted" | "accent";

const spacingClasses: Record<SectionSpacing, string> = {
  none: "py-0",
  xs: "py-[var(--section-space-xs)]",
  sm: "py-[var(--section-space-sm)]",
  md: "py-[var(--section-space-md)]",
  lg: "py-[var(--section-space-lg)]",
};

const surfaceClasses: Record<SectionSurface, string> = {
  default: "bg-transparent",
  muted: "bg-muted/55",
  accent: "bg-accent/35",
};

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article" | "aside";
  spacing?: SectionSpacing;
  surface?: SectionSurface;
  containerSize?: ContainerSize | "none";
  containerClassName?: string;
}

export function Section({
  as: Component = "section",
  className,
  children,
  spacing = "md",
  surface = "default",
  containerSize = "lg",
  containerClassName,
  ...props
}: SectionProps) {
  return (
    <Component
      data-slot="section"
      className={cn(spacingClasses[spacing], surfaceClasses[surface], className)}
      {...props}
    >
      {containerSize === "none" ? (
        children
      ) : (
        <Container size={containerSize} className={containerClassName}>
          {children}
        </Container>
      )}
    </Component>
  );
}
