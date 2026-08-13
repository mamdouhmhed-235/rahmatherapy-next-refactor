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
        title="Every question, answered"
        description="Pick a topic and open the questions that matter to you."
        className="mx-auto"
      />
      <div
        role="tablist"
        aria-label="FAQ categories"
        aria-orientation="horizontal"
        className="mt-10 grid gap-2 sm:flex sm:gap-3 sm:overflow-x-auto sm:pb-2"
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
                "min-h-11 rounded-full border px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue sm:shrink-0",
                isActive
                  ? "border-rahma-gold bg-rahma-gold text-rahma-charcoal-strong"
                  : "border-rahma-border bg-white text-rahma-green hover:border-rahma-green"
              )}
            >
              {category.label}
            </button>
          );
        })}
      </div>
      {/*
        Every category's panel is rendered, and the inactive ones are hidden
        rather than omitted. Previously only the active panel existed in the
        DOM, so just 4 of the site's 31 FAQs reached the served HTML — the other
        27 appeared only after a tab click. No major AI crawler except Googlebot
        executes JavaScript, and Google does not click tabs either, so those 27
        answers were invisible to search and to answer engines alike.

        `hidden` (not a visual-only class) keeps inactive panels out of the
        accessibility tree too, so screen readers announce one panel at a time
        exactly as before. The visible behaviour is unchanged: same tabs, same
        clicks, same appearance.
      */}
      {faqCategories.map((category) => (
        <div
          key={category.id}
          id={`faq-panel-${category.id}`}
          role="tabpanel"
          aria-labelledby={`faq-category-${category.id}`}
          className="mt-8"
          hidden={category.id !== activeCategory.id}
        >
          <Accordion items={category.faqs} defaultOpenIndex={null} />
        </div>
      ))}
    </SectionContainer>
  );
}
