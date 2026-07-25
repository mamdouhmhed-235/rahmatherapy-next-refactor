import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { homeProcessSteps } from "@/content/pages/home";
import { HomeImage } from "./HomeImage";

export function HomeAppointmentProcess() {
  return (
    <SectionContainer tone="sand" width="wide">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <SectionHeading
            title="How it works"
            description="Simple, private and explained from start to finish."
          />
          <div className="relative mt-10 grid gap-8">
            <div
              aria-hidden="true"
              className="absolute top-7 bottom-7 left-7 w-0.5 bg-rahma-border"
            />
            {homeProcessSteps.map((step) => (
              <div key={step.number} className="relative flex gap-5">
                <div className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full bg-rahma-green font-display text-base font-semibold text-white ring-8 ring-rahma-sand">
                  {step.number}
                </div>
                <div className="pt-2.5">
                  <h3 className="text-lg font-semibold text-rahma-charcoal">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-rahma-muted">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="?booking=1"
            data-booking-trigger="true"
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rahma-gold px-6 text-sm font-semibold text-rahma-charcoal-strong transition hover:bg-[#ffc252] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue sm:w-auto"
          >
            Start your booking
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <HomeImage
            src="/images/home/home-session-process.jpg"
            alt="Rahma Therapy home appointment setup"
            imageType="Therapist setting up couch/equipment in home."
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/10 to-transparent" />
          <span className="absolute bottom-6 left-6 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rahma-green shadow-soft">
            We come to you
          </span>
        </div>
      </div>
    </SectionContainer>
  );
}
