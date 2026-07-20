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

function preloadBookingExperience() {
  void import("./BookingExperience");
}

function hasBookingParam() {
  return new URL(window.location.href).searchParams.get("booking") === "1";
}

export function BookingExperienceLoader() {
  const [shouldLoad, setShouldLoad] = useState(false);

  // Deep-link check happens in an effect (not a state initializer) so the
  // server and client render identical empty markup — no hydration mismatch
  // when the page loads with ?booking=1.
  useEffect(() => {
    if (hasBookingParam()) {
      setShouldLoad(true);
    }
  }, []);

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

    // Warm the booking chunk the moment a visitor shows intent (hover,
    // keyboard focus, or first touch on any Book button) so opening feels
    // instant even on slow connections.
    const handleIntent = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-booking-trigger='true']")) return;

      preloadBookingExperience();
      removeIntentListeners();
    };

    const removeIntentListeners = () => {
      document.removeEventListener("pointerover", handleIntent);
      document.removeEventListener("focusin", handleIntent);
      document.removeEventListener("touchstart", handleIntent);
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("pointerover", handleIntent, { passive: true });
    document.addEventListener("focusin", handleIntent);
    document.addEventListener("touchstart", handleIntent, { passive: true });

    return () => {
      document.removeEventListener("click", handleClick);
      removeIntentListeners();
    };
  }, [shouldLoad]);

  return shouldLoad ? <BookingExperience /> : null;
}
