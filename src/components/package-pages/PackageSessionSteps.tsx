import { SectionContainer, SectionHeading } from "@/components/shared";
import { packageSessionSteps } from "@/content/pages/packagePages";
import { PackageImage } from "./PackageImage";

export function PackageSessionSteps() {
  return (
    <SectionContainer tone="ivory" width="wide">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <SectionHeading
            title="What to expect at your home appointment"
            description="Rahma Therapy brings the treatment setup to you, so the session feels private, simple and clearly explained."
          />
          <div className="mt-8 grid gap-4">
            {packageSessionSteps.map((step) => (
              <article
                key={step.number}
                className="grid gap-4 rounded-3xl border border-rahma-border bg-white p-5 shadow-sm sm:grid-cols-[4.5rem_1fr]"
              >
                <div className="flex size-14 items-center justify-center rounded-2xl bg-rahma-green text-sm font-semibold text-white">
                  {step.number}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-rahma-charcoal">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-rahma-muted">{step.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <PackageImage
            src="/images/packages/home-session.webp"
            alt="Private home therapy setup with Rahma Therapy"
            imageType="Home treatment setup with couch, towels, cups."
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/10 to-transparent" />
        </div>
      </div>
    </SectionContainer>
  );
}
