import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { Accordion } from "@/components/ui/accordion";
import { miniFaqs } from "@/content/pages/services";

export function ServicesMiniFAQ() {
  return (
    <SectionContainer tone="surface" width="narrow">
      <SectionHeading
        align="center"
        title="Questions before choosing?"
        description="Here are the quick answers most clients want before booking a package."
        className="mx-auto"
      />
      <Accordion items={miniFaqs} className="mt-10 shadow-sm" />
      <div className="mt-8 flex justify-center">
        <Link
          href="/faqs-aftercare"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-rahma-green/30 bg-white px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
        >
          View FAQs & Aftercare
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </SectionContainer>
  );
}
