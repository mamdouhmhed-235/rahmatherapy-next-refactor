"use client";

import { useEffect, type RefObject } from "react";
import {
  isBookingPackageId,
  type BookingPackageId,
} from "../data/booking-packages";
import type { BookingStep } from "../types";

function uniquePackageIds(ids: BookingPackageId[]) {
  return Array.from(new Set(ids));
}

function getSafeUrlPackageIds(searchParams: URLSearchParams) {
  return uniquePackageIds(
    (searchParams.get("services") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(isBookingPackageId)
  );
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

    if (packageIds.length > 0) {
      setSelectedPackageIds(packageIds);
    }

    const shouldOpen =
      url.searchParams.get("booking") === "1" || url.hash === "#book-now";

    if (shouldOpen) {
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
      setOpen(true);
      if (currentStep === "prepared") {
        setCurrentStep("packages");
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [currentStep, lastTriggerRef, setCurrentStep, setOpen]);

  useEffect(() => {
    const url = new URL(window.location.href);

    if (open) {
      url.hash = "book-now";
      url.searchParams.set("booking", "1");
      if (selectedPackageIds.length > 0) {
        url.searchParams.set("services", selectedPackageIds.join(","));
      } else {
        url.searchParams.delete("services");
      }
    } else {
      if (url.hash === "#book-now") {
        url.hash = "";
      }
      url.searchParams.delete("booking");
      url.searchParams.delete("services");
    }

    window.history.replaceState(null, "", url);
  }, [open, selectedPackageIds]);
}
