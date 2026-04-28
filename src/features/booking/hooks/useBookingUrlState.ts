"use client";

import { useEffect, type RefObject } from "react";
import {
  isBookingPackageId,
  type BookingPackageId,
} from "../data/booking-packages";
import type { BookingStep } from "../types";

function getSafeUrlPackageIds(searchParams: URLSearchParams) {
  const serviceId = searchParams.get("services")?.trim();

  return serviceId && isBookingPackageId(serviceId) ? [serviceId] : [];
}

interface UseBookingUrlStateOptions {
  open: boolean;
  currentStep: BookingStep;
  selectedPackageIds: BookingPackageId[];
  lastTriggerRef: RefObject<HTMLElement | null>;
  setOpen: (open: boolean) => void;
  setCurrentStep: (step: BookingStep) => void;
  setSelectedPackageIds: (ids: BookingPackageId[]) => void;
}

export function useBookingUrlState({
  open,
  currentStep,
  selectedPackageIds,
  lastTriggerRef,
  setOpen,
  setCurrentStep,
  setSelectedPackageIds,
}: UseBookingUrlStateOptions) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const packageIds = getSafeUrlPackageIds(url.searchParams);
    const shouldOpen = url.searchParams.get("booking") === "1";

    if (shouldOpen) {
      setSelectedPackageIds(packageIds);
      const timer = window.setTimeout(() => setOpen(true), 0);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [setOpen, setSelectedPackageIds]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const trigger = target.closest<HTMLElement>("[data-booking-trigger='true']");
      if (!trigger) {
        return;
      }

      event.preventDefault();
      lastTriggerRef.current = trigger;

      if (trigger instanceof HTMLAnchorElement) {
        const url = new URL(trigger.href, window.location.href);
        const packageIds = getSafeUrlPackageIds(url.searchParams);

        setSelectedPackageIds(packageIds);
      }

      setOpen(true);
      if (currentStep === "prepared") {
        setCurrentStep("packages");
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [currentStep, lastTriggerRef, setCurrentStep, setOpen, setSelectedPackageIds]);

  useEffect(() => {
    const url = new URL(window.location.href);

    if (open) {
      url.searchParams.set("booking", "1");
      if (selectedPackageIds.length > 0) {
        url.searchParams.set("services", selectedPackageIds[0]);
      } else {
        url.searchParams.delete("services");
      }
    } else {
      url.searchParams.delete("booking");
      url.searchParams.delete("services");
    }

    window.history.replaceState(null, "", url);
  }, [open, selectedPackageIds]);
}
