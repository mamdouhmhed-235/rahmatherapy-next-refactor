import { SectionContainer, SectionHeading } from "@/components/shared";
import { quickAnswers } from "@/content/pages/faqsAftercare";
import { FaqsAftercareIcon } from "./FaqsAftercareIcon";

export function QuickAnswersStrip() {
  return (
    <SectionContainer tone="surface" className="py-12 sm:py-14 lg:py-16">
      <SectionHeading
        align="center"
        title="The quick answers most clients look for first."
        className="mx-auto"
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickAnswers.map((item) => (
          <article
            key={item.title}
            className="rounded-3xl border border-rahma-border bg-white p-6 shadow-sm"
          >
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-rahma-ivory text-rahma-green">
              <FaqsAftercareIcon name={item.icon} />
            </div>
            <h2 className="text-lg font-semibold text-rahma-charcoal">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-rahma-muted">{item.body}</p>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
