import Link from "next/link";
import type { ActionLink } from "@/types/content";
import { cn } from "@/lib/utils";

type CTAAlign = "left" | "center";

interface CTAButtonsProps {
  primary?: ActionLink;
  secondary?: ActionLink;
  align?: CTAAlign;
  inverse?: boolean;
  className?: string;
}

function isBookingHref(href: string) {
  return href.includes("booking=1") || href === "#book-now";
}

function linkClassName(variant: "primary" | "secondary" | "ghost" | "link", inverse: boolean) {
  if (variant === "secondary") {
    return inverse
      ? "border border-white/35 text-white hover:bg-white/10"
      : "border border-rahma-border bg-white text-rahma-green hover:border-rahma-green/35";
  }

  if (variant === "ghost" || variant === "link") {
    return inverse
      ? "text-white underline-offset-4 hover:underline"
      : "text-rahma-green underline-offset-4 hover:underline";
  }

  return inverse
    ? "bg-white text-rahma-green hover:bg-white/90"
    : "bg-rahma-green text-white hover:bg-rahma-charcoal";
}

function CTALink({ link, inverse }: { link: ActionLink; inverse: boolean }) {
  const variant = link.variant ?? "primary";

  return (
    <Link
      href={link.href}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue",
        linkClassName(variant, inverse)
      )}
      data-booking-trigger={isBookingHref(link.href) ? "true" : undefined}
    >
      {link.label}
    </Link>
  );
}

export function CTAButtons({
  primary,
  secondary,
  align = "left",
  inverse = false,
  className,
}: CTAButtonsProps) {
  if (!primary && !secondary) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row",
        align === "center" ? "items-stretch justify-center sm:items-center" : "items-stretch sm:items-center",
        className
      )}
    >
      {primary ? <CTALink link={primary} inverse={inverse} /> : null}
      {secondary ? <CTALink link={secondary} inverse={inverse} /> : null}
    </div>
  );
}
