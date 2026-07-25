"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  getPackageById,
  getSelectedPackages,
  isBookingPackageId,
  type BookingPackageId,
} from "../data/booking-packages";
import type { BookingStage } from "../types";

interface BookingDraftState {
  selectedPackageIds: BookingPackageId[];
  currentStep: BookingStage;
  preferredDate: string | null;
  preferredTime: string | null;
}

interface BookingDraftActions {
  setSelectedPackageIds: (ids: BookingPackageId[]) => void;
  togglePackage: (id: BookingPackageId) => void;
  clearPackages: () => void;
  setCurrentStep: (step: BookingStage) => void;
  setPreferredDate: (date: string | null) => void;
  setPreferredTime: (time: string | null) => void;
  resetDraft: () => void;
}

export type BookingDraftStore = BookingDraftState & BookingDraftActions;

const initialState: BookingDraftState = {
  selectedPackageIds: [],
  currentStep: "service",
  preferredDate: null,
  preferredTime: null,
};

export const useBookingDraftStore = create<BookingDraftStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      setSelectedPackageIds: (ids) => set({ selectedPackageIds: ids }),
      togglePackage: (id) => {
        const selected = get().selectedPackageIds;
        const existing = selected.includes(id);

        if (existing) {
          set({ selectedPackageIds: selected.filter((item) => item !== id) });
          return;
        }

        const nextPackage = getPackageById(id);
        if (!nextPackage) {
          return;
        }

        const nextSelection = getSelectedPackages(selected)
          .filter((item) => item.group !== nextPackage.group)
          .map((item) => item.id);

        set({ selectedPackageIds: [...nextSelection, id] });
      },
      clearPackages: () => set({ selectedPackageIds: [] }),
      setCurrentStep: (step) => set({ currentStep: step }),
      setPreferredDate: (date) =>
        set({
          preferredDate: date,
          preferredTime: date ? get().preferredTime : null,
        }),
      setPreferredTime: (time) => set({ preferredTime: time }),
      resetDraft: () => set(initialState),
    }),
    {
      name: "zam-therapy-booking-draft-v3",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPackageIds: state.selectedPackageIds,
      }),
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<BookingDraftState>),
        };

        // Rehydration is async and can land after a ?booking=1 deep link has
        // already applied its service selection — the deep link must win
        // over a stale saved draft, so resolve the conflict here.
        if (typeof window !== "undefined") {
          const params = new URL(window.location.href).searchParams;
          if (params.get("booking") === "1") {
            const serviceId = params.get("services")?.trim();
            merged.selectedPackageIds =
              serviceId && isBookingPackageId(serviceId) ? [serviceId] : [];
          }
        }

        return merged;
      },
    }
  )
);
