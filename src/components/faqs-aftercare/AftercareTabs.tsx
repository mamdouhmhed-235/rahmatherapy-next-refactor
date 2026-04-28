"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { aftercareTabs } from "@/content/pages/faqsAftercare";
import { cn } from "@/lib/utils";
import { FaqsAftercareIcon } from "./FaqsAftercareIcon";
import { FaqsAftercareImage } from "./FaqsAftercareImage";

type AftercareTabId = (typeof aftercareTabs)[number]["id"];

export function AftercareTabs() {
  const [activeTabId, setActiveTabId] = React.useState<AftercareTabId>(aftercareTabs[0].id);
  const reduceMotion = useReducedMotion();
  const activeTab =
    aftercareTabs.find((tab) => tab.id === activeTabId) ?? aftercareTabs[0];

  return (
    <SectionContainer tone="surface" width="wide">
      <SectionHeading
        align="center"
        title="Aftercare by treatment type"
        description="Your therapist will give personalised aftercare, but these are the simple basics most clients want to know."
        className="mx-auto"
      />
      <div
        role="tablist"
        aria-label="Aftercare treatment types"
        className="mt-10 flex gap-3 overflow-x-auto pb-2"
      >
        {aftercareTabs.map((tab) => {
          const isActive = tab.id === activeTab.id;

          return (
            <button
              key={tab.id}
              id={`aftercare-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`aftercare-panel-${tab.id}`}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue",
                isActive
                  ? "border-rahma-gold bg-rahma-gold text-rahma-green"
                  : "border-rahma-border bg-white text-rahma-green hover:border-rahma-green"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <motion.div
        key={activeTab.id}
        id={`aftercare-panel-${activeTab.id}`}
        role="tabpanel"
        aria-labelledby={`aftercare-tab-${activeTab.id}`}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start"
      >
        <div className="relative min-h-[400px] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <FaqsAftercareImage
            src={activeTab.image}
            alt={activeTab.imageAlt}
            imageType={activeTab.imageType}
            className="h-full min-h-full rounded-none border-0"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-black/6 to-transparent" />
          <span className="absolute bottom-6 left-6 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rahma-green shadow-sm">
            {activeTab.imageOverlay}
          </span>
        </div>
        <div>
          <p className="text-base leading-7 text-rahma-muted">{activeTab.intro}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {activeTab.items.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-rahma-border bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-rahma-ivory text-rahma-green">
                  <FaqsAftercareIcon name={item.icon} />
                </div>
                <h3 className="text-lg font-semibold text-rahma-charcoal">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-rahma-muted">{item.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 rounded-3xl border border-rahma-border bg-rahma-ivory p-5 text-sm leading-7 text-rahma-muted">
            {activeTab.note}
          </p>
        </div>
      </motion.div>
    </SectionContainer>
  );
}
