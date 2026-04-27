import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import { comfortCards } from "@/content/pages/about";
import { AboutImage } from "./AboutImage";

export function ComfortSection() {
  return (
    <SectionContainer tone="ivory" width="wide">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            Why clients feel comfortable
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-tight text-rahma-charcoal sm:text-4xl lg:text-5xl">
            Respect, privacy and clear communication.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-rahma-muted sm:text-lg">
            Booking treatment at home can feel personal. We make it simple: respectful
            communication, clear boundaries, a clean setup and a therapist option you
            feel comfortable with.
          </p>
          <figure className="mt-8 rounded-3xl border border-rahma-border bg-white p-6 shadow-sm">
            <blockquote className="text-xl font-semibold leading-8 text-rahma-charcoal">
              “Everything was explained clearly and I felt comfortable throughout.”
            </blockquote>
            <figcaption className="mt-4 text-sm font-medium text-rahma-muted">
              Rahma Therapy client
            </figcaption>
          </figure>
          <Link
            href="/reviews"
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
          >
            Read client reviews
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative min-h-[360px] overflow-hidden rounded-3xl bg-rahma-green shadow-card sm:col-span-2">
            <AboutImage
              src="/images/about/client-comfort.webp"
              alt="Private at-home massage and cupping session for client comfort"
              imageType="Calm client receiving massage/cupping in a private relaxed setting."
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-black/10 to-transparent" />
          </div>
          {comfortCards.map((card) => (
            <article
              key={card.title}
              className="rounded-3xl border border-rahma-border bg-white p-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-rahma-charcoal">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-rahma-muted">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}
