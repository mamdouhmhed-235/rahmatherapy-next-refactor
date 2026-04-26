import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface BookingTriggerProps {
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function BookingTrigger({
  label = "Schedule a visit",
  className,
  style,
}: BookingTriggerProps) {
  return (
    <Link
      href="#book-now"
      className={cn("button w-button", className)}
      data-booking-trigger="true"
      style={style}
    >
      {label}
    </Link>
  );
}
