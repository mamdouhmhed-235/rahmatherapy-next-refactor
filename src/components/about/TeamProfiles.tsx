import { CheckCircle2 } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { teamMembers } from "@/content/pages/about";
import { AboutImage } from "./AboutImage";

export function TeamProfiles() {
  return (
    <SectionContainer tone="green" width="wide">
      <SectionHeading
        align="center"
        title="Meet the Rahma Therapy team"
        description="Your session is delivered by qualified therapists who understand the importance of privacy, clear communication and respectful care at home."
        inverse
        className="mx-auto"
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {teamMembers.map((member) => (
          <article
            key={member.name}
            className="overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-[0_22px_70px_rgba(0,0,0,0.2)]"
          >
            <div className="relative h-72 overflow-hidden bg-rahma-charcoal">
              <AboutImage
                src={member.image}
                alt={member.alt}
                imageType={member.imageType}
                className="transition-transform duration-700 hover:scale-105"
              />
            </div>
            <div className="p-6 text-white">
              <h3 className="text-2xl font-semibold">{member.name}</h3>
              <p className="mt-1 text-sm font-semibold text-rahma-gold">{member.role}</p>
              <p className="mt-4 text-sm leading-7 text-white/76">{member.body}</p>
              <ul className="mt-5 grid gap-3">
                {member.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3 text-sm text-white/82">
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
      <div className="mt-10 flex justify-center">
        <p className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-center text-sm font-semibold text-white">
          All Rahma Therapy therapists are CMA and IPHM qualified.
        </p>
      </div>
    </SectionContainer>
  );
}
