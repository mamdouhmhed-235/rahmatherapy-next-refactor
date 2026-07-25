import { SectionContainer, SectionHeading } from "@/components/shared";
import type { PackagePage } from "@/content/pages/packagePages";
import { PackageIcon } from "./PackageIcon";
import { PackageImage } from "./PackageImage";

export function TreatmentBreakdown({ page }: { page: PackagePage }) {
  return (
    <SectionContainer tone="surface" width="wide">
      <SectionHeading
        align="center"
        title="Treatment breakdown"
        description="Here is what each part means, why it is included and what clients usually choose it for."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card lg:h-full lg:self-stretch">
          <PackageImage
            src={page.breakdownImage}
            alt={page.breakdownAlt}
            imageType={page.breakdownImageType}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
          <div className="absolute bottom-6 left-6 max-w-sm text-white">
            <p className="text-lg font-semibold">{page.title}</p>
            <p className="mt-2 text-sm leading-6 text-white/80">
              Clean setup, clear explanation and private home treatment.
            </p>
          </div>
        </div>
        <div className="divide-y divide-rahma-border">
          {page.treatmentBreakdown.map((method) => (
            <div key={method.title} className="flex items-start gap-4 py-5 first:pt-0">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rahma-ivory text-rahma-green">
                <PackageIcon name={method.icon} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-rahma-charcoal">
                  {method.title}
                </h3>
                <dl className="mt-3 grid gap-3 text-sm leading-7 text-rahma-muted">
                  <div>
                    <dt className="font-semibold text-rahma-charcoal">What it is:</dt>
                    <dd>{method.whatItIs}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-rahma-charcoal">
                      Why it is included:
                    </dt>
                    <dd>{method.whyIncluded}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-rahma-charcoal">Client use:</dt>
                    <dd>{method.clientUse}</dd>
                  </div>
                </dl>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}
