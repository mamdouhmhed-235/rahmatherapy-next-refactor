import Link from "next/link";
import type { CSSProperties } from "react";
import type { BookingPackageId } from "@/features/booking/data/booking-packages";
import { cn } from "@/lib/utils";

interface BookingTriggerProps {
  label?: string;
  className?: string;
  style?: CSSProperties;
  serviceId?: BookingPackageId;
  serviceIds?: readonly BookingPackageId[];
}

export function BookingTrigger({
  label = "Book Now",
  className,
  style,
  serviceId,
  serviceIds,
}: BookingTriggerProps) {
  const selectedServiceIds = serviceIds ?? (serviceId ? [serviceId] : []);
  const href =
    selectedServiceIds.length > 0
      ? `?booking=1&services=${selectedServiceIds.join(",")}`
      : "?booking=1";

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
