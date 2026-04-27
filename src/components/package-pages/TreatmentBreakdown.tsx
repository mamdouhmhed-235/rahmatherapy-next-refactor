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
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <PackageImage
            src={page.breakdownImage}
            alt={page.breakdownAlt}
            imageType={page.breakdownImageType}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/14 to-transparent" />
          <div className="absolute bottom-6 left-6 max-w-sm text-white">
            <p className="text-lg font-semibold">{page.title}</p>
            <p className="mt-2 text-sm leading-6 text-white/78">
              Clean setup, clear explanation and private home treatment.
            </p>
          </div>
        </div>
        <div className="grid gap-4">
          {page.treatmentBreakdown.map((method) => (
            <article
              key={method.title}
              className="rounded-3xl border border-rahma-border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
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
                  <p className="mt-4 rounded-2xl bg-rahma-ivory px-4 py-3 text-sm font-semibold leading-6 text-rahma-green">
                    {method.persuasivePhrase}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}
