import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { Accordion } from "@/components/ui/accordion";
import { homeFaqs } from "@/content/pages/home";

export function HomeFAQPreview() {
  return (
    <SectionContainer tone="ivory" width="narrow">
      <SectionHeading
        align="center"
        title="Questions before booking?"
        description="Here are the quick answers most clients want before choosing a package."
        className="mx-auto"
      />
      <Accordion items={homeFaqs} className="mt-10" />
      <div className="mt-8 flex justify-center">
        <Link
          href="/faqs-aftercare"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-rahma-green/30 bg-white px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
        >
          View all FAQs
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </SectionContainer>
  );
}
