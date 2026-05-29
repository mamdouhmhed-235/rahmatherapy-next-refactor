import { CheckCircle2 } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { teamMembers } from "@/content/pages/about";
import { AboutImage } from "./AboutImage";

export function TeamProfiles() {
  return (
    <SectionContainer tone="sand" width="wide">
      <SectionHeading
        align="center"
        title="Meet the team"
        description="Qualified therapists who understand that privacy, communication and respect aren't optional."
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {teamMembers.map((member) => (
          <article
            key={member.name}
            className="overflow-hidden rounded-3xl border border-rahma-border bg-white shadow-sm"
          >
            <div className="relative h-72 overflow-hidden bg-rahma-charcoal">
              <AboutImage
                src={member.image}
                alt={member.alt}
                imageType={member.imageType}
                className="transition-transform duration-700 hover:scale-105"
              />
            </div>
            <div className="p-6">
              <h3 className="text-2xl font-semibold text-rahma-charcoal">{member.name}</h3>
              <p className="mt-1 text-sm font-semibold text-rahma-muted">{member.role}</p>
              <p className="mt-4 text-sm leading-7 text-rahma-muted">{member.body}</p>
              <ul className="mt-5 grid gap-3">
                {member.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3 text-sm text-rahma-muted">
                    <CheckCircle2
                      aria-hidden="true"
                      size={17}
                      className="mt-0.5 shrink-0 text-rahma-gold"
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </SectionContainer>
  );
}
