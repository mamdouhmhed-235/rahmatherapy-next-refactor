"use client";

import * as React from "react";
import type { TabPanelContent } from "@/types/content";
import { cn } from "@/lib/utils";

interface AftercareTabsSectionProps {
  title: string;
  description?: string;
  tabs: readonly TabPanelContent[];
}

export function AftercareTabsSection({ title, description, tabs }: AftercareTabsSectionProps) {
  const [activeTab, setActiveTab] = React.useState(tabs[0]?.id ?? "");
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  if (!active) {
    return null;
  }

  return (
    <section className="bg-background py-16 md:py-24">
      <div className="padding-global">
        <div className="container-large">
          <div className="mb-8 max-w-3xl">
            <h2 className="heading-style-h2">{title}</h2>
            {description ? <p className="mt-4 text-size-medium">{description}</p> : null}
          </div>

          <div role="tablist" aria-label={title} className="mb-6 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`${tab.id}-tab`}
                type="button"
                role="tab"
                aria-selected={tab.id === active.id}
                aria-controls={`${tab.id}-panel`}
                className={cn(
                  "rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors",
                  tab.id === active.id
                    ? "bg-primary text-white"
                    : "bg-white text-foreground hover:bg-muted"
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <article
            id={`${active.id}-panel`}
            role="tabpanel"
            aria-labelledby={`${active.id}-tab`}
            className="rounded-[0.5rem] border border-border bg-white p-6 md:p-8"
          >
            <h3 className="text-2xl font-semibold">{active.title}</h3>
            <p className="mt-3 text-sm leading-6 text-foreground/72">{active.description}</p>
            <ul className="mt-6 grid gap-3 text-sm leading-6 text-foreground/78">
              {active.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
