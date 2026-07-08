import { CheckCircle2 } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";

const themes = [
  {
    title: "Explained clearly",
    description: "First-timers mention the therapist walking them through every step.",
  },
  {
    title: "Professional and prepared",
    description: "Punctual, well-equipped, calm. Said again and again.",
  },
  {
    title: "Comfortable at home",
    description: "Private treatment, in your own space, on your own terms.",
  },
  {
    title: "Female therapist option",
    description: "Female clients comfortable, modest care confirmed.",
  },
  {
    title: "Hijama and cupping trust",
    description: "Wet cupping, dry cupping, fire cupping — done cleanly.",
  },
  {
    title: "They book again",
    description: "Repeat clients. Recommendations to family and friends.",
  },
] as const;

export function ReviewThemeHighlights() {
  return (
    <SectionContainer tone="ivory">
      <SectionHeading
        title="What people keep saying"
        description="Trust themes that repeat across every review."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => (
          <article
            key={theme.title}
            className="rounded-3xl border border-rahma-border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-card motion-reduce:transform-none motion-reduce:transition-none"
          >
            <CheckCircle2 aria-hidden="true" className="text-rahma-gold" size={26} />
            <h3 className="mt-5 font-display text-xl font-semibold text-rahma-charcoal">{theme.title}</h3>
            <p className="mt-3 text-base leading-7 text-rahma-muted">{theme.description}</p>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
