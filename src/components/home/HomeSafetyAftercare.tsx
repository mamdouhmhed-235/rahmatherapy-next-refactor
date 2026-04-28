import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import { homeSafetyItems } from "@/content/pages/home";
import { HomeImage } from "./HomeImage";

export function HomeSafetyAftercare() {
  return (
    <SectionContainer tone="surface" width="wide">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1fr] lg:items-center">
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <HomeImage
            src="/images/home/safety-home.webp"
            alt="Clean equipment for Rahma Therapy home treatment"
            imageType="Clean equipment, cups, towels, gloves. No graphic content."
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/68 via-black/12 to-transparent" />
          <span className="absolute bottom-6 left-6 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rahma-green shadow-sm">
            Clean setup
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            Safety & aftercare
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-tight text-rahma-charcoal sm:text-4xl lg:text-5xl">
            Clean, careful and explained clearly.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-rahma-muted sm:text-lg">
            Before treatment begins, your therapist checks suitability, explains what will
            happen and gives aftercare guidance based on your session.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {homeSafetyItems.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-rahma-border bg-rahma-ivory px-4 py-3"
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-rahma-green text-white">
                  <Check aria-hidden="true" size={15} />
                </span>
                <span className="text-sm font-medium leading-6 text-rahma-charcoal">
                  {item}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-2xl border border-rahma-border bg-white px-5 py-4 text-sm leading-6 text-rahma-muted">
            Rahma Therapy provides complementary wellness treatments and does not diagnose
            or replace medical care.
          </p>
          <Link
            href="/faqs-aftercare"
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue sm:w-auto"
          >
            Read FAQs & aftercare
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </div>
    </SectionContainer>
  );
}
