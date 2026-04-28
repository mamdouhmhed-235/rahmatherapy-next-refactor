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
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const activeCategory =
    faqCategories.find((category) => category.id === activeCategoryId) ??
    faqCategories[0];

  function moveToCategory(index: number) {
    const category = faqCategories[index];

    if (!category) {
      return;
    }

    setActiveCategoryId(category.id);
    tabRefs.current[index]?.focus();
  }

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveToCategory((currentIndex + 1) % faqCategories.length);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveToCategory((currentIndex - 1 + faqCategories.length) % faqCategories.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      moveToCategory(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      moveToCategory(faqCategories.length - 1);
    }
  }

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
        aria-orientation="horizontal"
        className="mt-10 flex gap-3 overflow-x-auto pb-2"
      >
        {faqCategories.map((category, index) => {
          const isActive = activeCategory.id === category.id;

          return (
            <button
              key={category.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`faq-category-${category.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`faq-panel-${category.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveCategoryId(category.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
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
