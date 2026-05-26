"use client";

import { useRef, useState } from "react";
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
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    hours: null,
    closed: null,
    adjustments: null,
  });

  function moveFocus(targetKey: TabKey) {
    setActiveTab(targetKey);
    // Defer focus so React renders the active styles before we steal focus.
    requestAnimationFrame(() => {
      tabRefs.current[targetKey]?.focus();
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    const currentIndex = TABS.findIndex((t) => t.key === activeTab);
    if (currentIndex < 0) return;
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        break;
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % TABS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = TABS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    moveFocus(TABS[nextIndex].key);
  }

  return (
    <div className="grid gap-6">
      <nav
        aria-label="Availability sections"
        className="-mx-4 overflow-x-auto px-4 md:hidden"
      >
        <ul
          role="tablist"
          onKeyDown={handleKeyDown}
          className="inline-flex min-w-full gap-1 rounded-[var(--admin-radius-control)] border border-[var(--admin-border)] bg-[var(--admin-panel)] p-1"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <li key={tab.key} className="flex-1">
                <button
                  type="button"
                  id={`availability-tab-${tab.key}`}
                  ref={(el) => {
                    tabRefs.current[tab.key] = el;
                  }}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`availability-panel-${tab.key}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-[0.375rem] px-3 text-sm font-medium outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
                    isActive
                      ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)] shadow-sm"
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
