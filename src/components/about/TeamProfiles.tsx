import { CheckCircle2 } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { cn } from "@/lib/utils";
import { teamMembers } from "@/content/pages/about";
import { AboutImage } from "./AboutImage";

// Minhaj's source photo is off-center with a blurry background filling the
// lower portion of frame; biasing the crop toward the top keeps his face
// centered instead of the geometric middle of the square source image.
const imageFramingByName: Record<string, string> = {
  Minhaj: "object-[center_25%]",
};

export function TeamProfiles() {
  return (
    <SectionContainer tone="charcoal" width="wide">
      <SectionHeading
        align="center"
        title="Meet the team"
        description="Qualified therapists who understand that privacy, communication and respect aren't optional."
        inverse
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {teamMembers.map((member) => (
          <article
            key={member.name}
            className="overflow-hidden rounded-3xl border border-rahma-border bg-white shadow-card"
          >
            <div className="relative h-72 overflow-hidden bg-rahma-charcoal">
              <AboutImage
                src={member.image}
                alt={member.alt}
                imageType={member.imageType}
                className={cn(
                  "transition-transform duration-700 hover:scale-105",
                  imageFramingByName[member.name]
                )}
              />
            </div>
            <div className="p-6">
              <h3 className="font-display text-2xl font-semibold text-rahma-charcoal">
                {member.name}
              </h3>
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
