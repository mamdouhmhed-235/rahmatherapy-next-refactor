"use client";

import * as React from "react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { Accordion } from "@/components/ui/accordion";
import { faqCategories } from "@/content/pages/faqsAftercare";
import { cn } from "@/lib/utils";

type FaqCategoryId = (typeof faqCategories)[number]["id"];

export function FaqCategoryAccordions() {
  const [activeCategoryId, setActiveCategoryId] = React.useState<FaqCategoryId>(
    faqCategories[0].id
  );
  const activeCategory =
    faqCategories.find((category) => category.id === activeCategoryId) ??
    faqCategories[0];

  return (
    <SectionContainer tone="ivory" width="narrow">
      <SectionHeading
        align="center"
        title="Frequently asked questions"
        description="Choose a topic and open the questions that matter to you."
        className="mx-auto"
      />
      <div
        role="tablist"
        aria-label="FAQ categories"
        className="mt-10 flex gap-3 overflow-x-auto pb-2"
      >
        {faqCategories.map((category) => {
          const isActive = activeCategory.id === category.id;

          return (
            <button
              key={category.id}
              id={`faq-category-${category.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`faq-panel-${category.id}`}
              onClick={() => setActiveCategoryId(category.id)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue",
                isActive
                  ? "border-rahma-gold bg-rahma-gold text-rahma-green"
                  : "border-rahma-border bg-white text-rahma-green hover:border-rahma-green"
              )}
            >
              {category.label}
            </button>
          );
        })}
      </div>
      <div
        id={`faq-panel-${activeCategory.id}`}
        role="tabpanel"
        aria-labelledby={`faq-category-${activeCategory.id}`}
        className="mt-8"
      >
        <Accordion
          key={activeCategory.id}
          items={activeCategory.faqs}
          defaultOpenIndex={null}
          className="shadow-sm"
        />
      </div>
    </SectionContainer>
  );
}
