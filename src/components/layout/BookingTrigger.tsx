import Link from "next/link";
import type { CSSProperties } from "react";
import type { BookingPackageId } from "@/features/booking/data/booking-packages";
import { cn } from "@/lib/utils";

interface BookingTriggerProps {
  label?: string;
  className?: string;
  style?: CSSProperties;
  serviceId?: BookingPackageId;
}

export function BookingTrigger({
  label = "Book Now",
  className,
  style,
  serviceId,
}: BookingTriggerProps) {
  const href = serviceId ? `?booking=1&services=${serviceId}` : "?booking=1";

  return (
    <Link
      href={href}
      className={cn("button w-button", className)}
      data-booking-trigger="true"
      style={style}
    >
      {label}
    </Link>
  );
}
