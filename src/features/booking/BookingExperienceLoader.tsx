"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const BookingExperience = dynamic(
  () =>
    import("./BookingExperience").then((mod) => ({
      default: mod.BookingExperience,
    })),
  { ssr: false }
);

function hasBookingParam() {
  return new URL(window.location.href).searchParams.get("booking") === "1";
}

export function BookingExperienceLoader() {
  const [shouldLoad, setShouldLoad] = useState(
    () => typeof window !== "undefined" && hasBookingParam()
  );

  useEffect(() => {
    if (shouldLoad) {
      return undefined;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest<HTMLElement>("[data-booking-trigger='true']");
      if (!trigger) return;

      event.preventDefault();

      if (trigger instanceof HTMLAnchorElement) {
        const url = new URL(trigger.href, window.location.href);
        window.history.replaceState(null, "", url);
      }

      setShouldLoad(true);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [shouldLoad]);

  return shouldLoad ? <BookingExperience /> : null;
}
