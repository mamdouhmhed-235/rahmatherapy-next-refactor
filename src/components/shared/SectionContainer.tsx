import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionTone = "ivory" | "surface" | "green" | "charcoal";
type SectionWidth = "default" | "wide" | "narrow" | "full";

const toneClasses: Record<SectionTone, string> = {
  ivory: "bg-rahma-ivory text-rahma-charcoal",
  surface: "bg-rahma-surface text-rahma-charcoal",
  green: "bg-rahma-green text-white",
  charcoal: "bg-rahma-charcoal text-white",
};

const widthClasses: Record<SectionWidth, string> = {
  default: "max-w-7xl",
  wide: "max-w-[88rem]",
  narrow: "max-w-5xl",
  full: "max-w-none",
};

interface SectionContainerProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "div";
  tone?: SectionTone;
  width?: SectionWidth;
  bleed?: boolean;
  children: ReactNode;
}

export function SectionContainer({
  as = "section",
  tone = "ivory",
  width = "default",
  bleed = false,
  className,
  children,
  ...props
}: SectionContainerProps) {
  const Component = as;

  return (
    <Component
      className={cn(
        toneClasses[tone],
        bleed ? "px-0" : "px-5 sm:px-6 lg:px-8",
        "py-16 sm:py-20 lg:py-24",
        className
      )}
      {...props}
    >
      <div className={cn("mx-auto w-full", widthClasses[width])}>{children}</div>
    </Component>
  );
}
