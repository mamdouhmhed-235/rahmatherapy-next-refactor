import Link from "next/link";
import { AlertTriangle, ArrowRight, MessageCircle } from "lucide-react";
import { SectionContainer } from "@/components/shared";
import { adviceItems } from "@/content/pages/faqsAftercare";

export function WhenToGetAdvice() {
  return (
    <SectionContainer tone="surface">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rahma-green">
            When to get advice
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-tight text-rahma-charcoal sm:text-4xl lg:text-5xl">
            If something feels wrong, do not ignore it.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-rahma-muted sm:text-lg">
            Most clients feel fine after treatment, but you should contact Rahma Therapy
            or seek medical advice if something feels unusual, severe or does not settle.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="https://wa.me/447798897222?text=Assalamu%20alaykum%2C%20I%20have%20an%20aftercare%20question%20after%20my%20Rahma%20Therapy%20session."
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              <MessageCircle aria-hidden="true" size={17} />
              Message Rahma Therapy
            </Link>
            <Link
              href="?booking=1"
              data-booking-trigger="true"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-rahma-green/30 px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green hover:bg-rahma-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              View booking options
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>
        <article className="rounded-3xl border border-rahma-border bg-rahma-ivory p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-rahma-gold text-rahma-charcoal">
              <AlertTriangle aria-hidden="true" size={22} />
            </span>
            <h3 className="text-xl font-semibold text-rahma-charcoal">
              Get advice if you notice:
            </h3>
          </div>
          <ul className="mt-6 grid gap-3">
            {adviceItems.map((item) => (
              <li key={item} className="text-sm leading-7 text-rahma-muted">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </SectionContainer>
  );
}
