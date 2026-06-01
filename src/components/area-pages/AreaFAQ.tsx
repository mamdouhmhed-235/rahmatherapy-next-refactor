import { SectionContainer, SectionHeading } from "@/components/shared";
import { Accordion } from "@/components/ui/accordion";
import type { AreaPage } from "@/content/pages/areaPages";
import { homeFaqs } from "@/content/pages/home";

export function AreaFAQ({ area }: { area: AreaPage }) {
  const sharedSubset = homeFaqs.filter((faq) => /hurt|suitable/i.test(faq.question));
  const items = [...area.faqs, ...sharedSubset];

  return (
    <SectionContainer tone="surface" width="narrow">
      <SectionHeading
        align="center"
        className="mx-auto"
        title={`${area.name} — your questions`}
        description="Quick answers before you book a home visit."
      />
      <Accordion items={items} className="mt-10" />
    </SectionContainer>
  );
}
