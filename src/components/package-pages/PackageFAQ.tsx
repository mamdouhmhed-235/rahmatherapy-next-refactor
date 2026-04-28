import { SectionContainer, SectionHeading } from "@/components/shared";
import { Accordion } from "@/components/ui/accordion";
import type { PackagePage } from "@/content/pages/packagePages";

export function PackageFAQ({ page }: { page: PackagePage }) {
  return (
    <SectionContainer tone="surface" width="narrow">
      <SectionHeading
        align="center"
        title={`${page.title} FAQs`}
        description="Quick answers before you book this package."
        className="mx-auto"
      />
      <Accordion items={page.faqs} className="mt-10" />
    </SectionContainer>
  );
}
