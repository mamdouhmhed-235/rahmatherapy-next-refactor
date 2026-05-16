"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type TabKey = "hours" | "closed" | "adjustments";

interface AvailabilityManagersTabsProps {
  hoursSlot: React.ReactNode;
  closedSlot: React.ReactNode;
  adjustmentsSlot: React.ReactNode;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "hours", label: "Hours" },
  { key: "closed", label: "Closed dates" },
  { key: "adjustments", label: "Adjustments" },
];

export function AvailabilityManagersTabs({
  hoursSlot,
  closedSlot,
  adjustmentsSlot,
}: AvailabilityManagersTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("hours");

  return (
    <div className="grid gap-6">
      <nav
        aria-label="Availability sections"
        className="-mx-4 overflow-x-auto px-4 md:hidden"
      >
        <ul
          role="tablist"
          className="inline-flex min-w-full gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <li key={tab.key} className="flex-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`availability-panel-${tab.key}`}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-[0.375rem] px-3 text-sm font-medium outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                    isActive
                      ? "bg-[var(--admin-primary)] text-white shadow-sm"
                      : "text-[var(--admin-text-muted)] hover:bg-[var(--admin-canvas)] hover:text-[var(--admin-heading)]"
                  )}
                >
                  {tab.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section
        id="availability-panel-hours"
        role="tabpanel"
        aria-labelledby="availability-tab-hours"
        className={cn(activeTab === "hours" ? "block" : "hidden md:block")}
      >
        {hoursSlot}
      </section>
      <section
        id="availability-panel-closed"
        role="tabpanel"
        aria-labelledby="availability-tab-closed"
        className={cn(activeTab === "closed" ? "block" : "hidden md:block")}
      >
        {closedSlot}
      </section>
      <section
        id="availability-panel-adjustments"
        role="tabpanel"
        aria-labelledby="availability-tab-adjustments"
        className={cn(activeTab === "adjustments" ? "block" : "hidden md:block")}
      >
        {adjustmentsSlot}
      </section>
    </div>
  );
}
