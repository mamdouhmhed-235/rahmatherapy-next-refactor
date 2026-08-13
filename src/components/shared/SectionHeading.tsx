import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type HeadingAlign = "left" | "center";
type HeadingSize = "default" | "large" | "compact";
type HeadingWeight = "medium" | "semibold";
type HeadingLevel = "h1" | "h2";

const alignClasses: Record<HeadingAlign, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
};

const sizeClasses: Record<HeadingSize, string> = {
  default: "text-3xl sm:text-4xl lg:text-5xl",
  large: "text-4xl sm:text-5xl lg:text-6xl",
  compact: "text-2xl sm:text-3xl",
};

const weightClasses: Record<HeadingWeight, string> = {
  medium: "font-medium",
  semibold: "font-semibold",
};

interface SectionHeadingProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: HeadingAlign;
  size?: HeadingSize;
  weight?: HeadingWeight;
  inverse?: boolean;
  /**
   * Heading element to render. Defaults to `h2`, because this is a SECTION
   * heading and ~30 files rely on that — changing the default would move
   * heading levels across the whole site. Pages with no hero (the two legal
   * pages) pass `as="h1"` so they are not left without an h1 at all.
   * Styling is unaffected: every class lives on the tag itself.
   */
  as?: HeadingLevel;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  size = "default",
  weight = "medium",
  inverse = false,
  as: Heading = "h2",
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div
      className={cn("flex max-w-3xl flex-col gap-4", alignClasses[align], className)}
      {...props}
    >
      {eyebrow ? (
        <p
          className={cn(
            "text-sm font-semibold uppercase tracking-[0.18em]",
            inverse ? "text-rahma-gold" : "text-rahma-green"
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <Heading
        className={cn(
          "font-display leading-[1.04] tracking-normal",
          sizeClasses[size],
          weightClasses[weight],
          inverse ? "text-white" : "text-rahma-charcoal"
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p
          className={cn(
            "max-w-2xl text-base leading-7 sm:text-lg",
            inverse ? "text-white/75" : "text-rahma-muted"
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
