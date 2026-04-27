import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import { AboutImage } from "./AboutImage";

export function BrandStory() {
  return (
    <SectionContainer tone="ivory" width="wide">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1fr] lg:items-center">
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-rahma-green shadow-card">
          <AboutImage
            src="/images/about/home-treatment-setup.webp"
            alt="Private mobile therapy setup for hijama and massage at home"
            imageType="Home treatment setup with massage bed, cups, towels, oils or tools. Calm and professional. No graphic imagery."
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/10 to-transparent" />
          <span className="absolute bottom-6 left-6 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rahma-green shadow-sm">
            Mobile care across Luton
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            Our story
          </p>
          <h2 className="mt-4 font-display text-3xl font-medium leading-tight text-rahma-charcoal sm:text-4xl lg:text-5xl">
            Care that comes to you.
          </h2>
          <div className="mt-6 space-y-5 text-base leading-8 text-rahma-muted sm:text-lg">
            <p>
              Rahma Therapy started in Luton in 2020 with a simple purpose: make
              professional cupping and massage easier to access for people who value
              privacy, convenience and clear care.
            </p>
            <p>
              Today, Nadimur Rahman, Minhaj Rahman and our female therapist provide
              mobile sessions across Luton, combining hijama, dry cupping, fire cupping,
              massage and IASTM-style soft-tissue work.
            </p>
            <p>
              Clients usually come to us because their back feels tight, their shoulders
              carry stress, training has left them stiff, or they want a private wellness
              session at home.
            </p>
          </div>
          <Link
            href="/services"
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
          >
            Explore our services
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </div>
    </SectionContainer>
  );
}
