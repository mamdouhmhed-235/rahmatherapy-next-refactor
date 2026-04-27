import { SectionContainer, SectionHeading } from "@/components/shared";
import { treatmentMethods } from "@/content/pages/services";
import { ServicesIcon } from "./ServicesIcon";
import { ServicesImage } from "./ServicesImage";

export function TreatmentMethods() {
  return (
    <SectionContainer tone="surface" width="wide">
      <SectionHeading
        align="center"
        title="What the treatments mean"
        description="Each package combines different treatment methods. Here’s the simple version before you choose."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <ServicesImage
            src="/images/services/treatment-methods.webp"
            alt="Hijama cupping massage and IASTM treatment methods"
            imageType="Collage of cups, oils, towels and IASTM tool."
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/14 to-transparent" />
          <div className="absolute bottom-6 left-6 text-white">
            <p className="text-lg font-semibold">Treatment methods</p>
            <p className="mt-2 text-sm text-white/78">
              Hijama • Dry cupping • Fire cupping • Massage • IASTM
            </p>
          </div>
        </div>
        <div className="grid gap-4">
          {treatmentMethods.map((method) => (
            <article
              key={method.title}
              className="rounded-3xl border border-rahma-border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rahma-ivory text-rahma-green">
                  <ServicesIcon name={method.icon} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-rahma-charcoal">
                    {method.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-rahma-muted">{method.body}</p>
                  <p className="mt-3 text-sm font-semibold text-rahma-green">
                    {method.includedIn}
                  </p>
                </div>
              </div>
            </article>
          ))}
          <p className="rounded-3xl border border-rahma-border bg-rahma-ivory p-5 text-sm leading-7 text-rahma-muted">
            All treatments are subject to suitability. If a treatment is not appropriate
            for you, your therapist will explain why and guide you to a safer option.
          </p>
        </div>
      </div>
    </SectionContainer>
  );
}
