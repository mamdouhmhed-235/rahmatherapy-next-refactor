import { CheckCircle2 } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";

const themes = [
  {
    title: "Explained clearly",
    description: "Many first-time clients mention that the therapist explained each step before starting.",
  },
  {
    title: "Professional and prepared",
    description: "Reviews repeatedly mention punctuality, equipment, knowledge and a calm approach.",
  },
  {
    title: "Comfortable at home",
    description: "Clients value being treated privately in the comfort of their own home.",
  },
  {
    title: "Female therapist option",
    description: "Female clients mention feeling comfortable with female therapist appointments.",
  },
  {
    title: "Hijama and cupping trust",
    description: "Many reviews specifically mention hijama, wet cupping, dry cupping and clear guidance.",
  },
  {
    title: "Repeat clients",
    description:
      "Many reviewers say they would book again, have booked again or recommend Rahma Therapy to family and friends.",
  },
] as const;

export function ReviewThemeHighlights() {
  return (
    <SectionContainer tone="ivory">
      <SectionHeading
        title="What clients keep saying"
        description="Across the reviews, a few trust themes repeat again and again."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => (
          <article
            key={theme.title}
            className="rounded-3xl border border-rahma-border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <CheckCircle2 aria-hidden="true" className="text-rahma-gold" size={26} />
            <h3 className="mt-5 text-xl font-semibold text-rahma-charcoal">{theme.title}</h3>
            <p className="mt-3 text-base leading-7 text-rahma-muted">{theme.description}</p>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
