import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { homeAppointmentSteps } from "@/content/pages/services";
import { ServicesImage } from "./ServicesImage";

export function HomeAppointmentProcess() {
  return (
    <SectionContainer tone="ivory" width="wide">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <SectionHeading
            title="How your home appointment works"
            description="No clinic travel. No waiting room. Rahma Therapy brings the setup to you."
          />
          <div className="mt-8 grid gap-4">
            {homeAppointmentSteps.map((step) => (
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
          <Link
            href="?booking=1"
            data-booking-trigger="true"
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue sm:w-auto"
          >
            Start your booking
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <ServicesImage
            src="/images/services/home-appointment.webp"
            alt="Private home therapy appointment setup"
            imageType="Massage couch and clean setup inside a home environment."
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/10 to-transparent" />
          <span className="absolute bottom-6 left-6 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rahma-green shadow-sm">
            We come to you
          </span>
        </div>
      </div>
    </SectionContainer>
  );
}
