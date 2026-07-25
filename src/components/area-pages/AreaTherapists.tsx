import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";
import type { AreaPage } from "@/content/pages/areaPages";
import { teamMembers } from "@/content/pages/about";
import { AreaImage } from "./AreaImage";

// Real area-page portraits (per the design handoff IMAGE_MAP), keyed by name so
// the shared about-page copy is reused without touching about.ts.
const TEAM_IMAGE: Record<string, string> = {
  "Nadimur Rahman": "/images/about/nadimur-rahman.png",
  // -v2 = cache-bust: the fixed square composite (full head + chest + logo). New
  // URL forces every browser past the old cached crop.
  "Minhaj Rahman": "/images/about/minhaj-rahman-v2.jpg",
  "Female Therapist": "/images/about/female-therapist.jpg",
};

// All three portraits are now square source images (Nadimur, female therapist) or
// a square composite (Minhaj — his head/shoulders + polo logo centred on canvas with
// margin all round). In the landscape card box, object-cover centres them and only
// trims the spare top/bottom margin, so each subject stays fully framed without a
// per-portrait focus override.
// TODO: revisit once proper front-facing studio portraits replace these.
const TEAM_OBJECT_POSITION: Record<string, string> = {};

export function AreaTherapists({ area }: { area: AreaPage }) {
  return (
    <SectionContainer tone="charcoal" width="wide">
      <SectionHeading
        align="center"
        className="mx-auto"
        eyebrow="Who treats you"
        title={`Qualified therapists serving ${area.name}`}
        description="Every visit is carried out by a CMA & IPHM qualified therapist who explains the treatment, checks suitability and works to professional hygiene standards. Female clients are always treated by our female therapist."
        inverse
      />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {teamMembers.map((member) => (
          <article
            key={member.name}
            className="flex flex-col overflow-hidden rounded-3xl border border-rahma-border bg-white shadow-card"
          >
            <div className="relative h-[340px] overflow-hidden bg-rahma-green">
              <AreaImage
                src={TEAM_IMAGE[member.name] ?? member.image}
                alt={member.alt}
                imageType={member.imageType}
                objectPosition={TEAM_OBJECT_POSITION[member.name]}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h3 className="text-lg font-semibold text-rahma-charcoal">{member.name}</h3>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-rahma-green">
                <BadgeCheck aria-hidden="true" size={15} />
                {member.role}
              </p>
              <p className="mt-3 text-sm leading-7 text-rahma-muted">{member.body}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-9 flex flex-col items-center gap-4 rounded-3xl border border-rahma-border bg-rahma-ivory px-6 py-7 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="max-w-2xl text-sm leading-7 text-rahma-muted sm:text-base">
          Qualified with the{" "}
          <strong className="text-rahma-charcoal">Complementary Medical Association (CMA)</strong> and the{" "}
          <strong className="text-rahma-charcoal">International Practitioners of Holistic Medicine (IPHM)</strong>, and
          serving Luton since 2020.
        </p>
        <Link
          href="/about"
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-rahma-green px-6 text-sm font-semibold text-white transition hover:bg-rahma-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
        >
          Meet the team
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </SectionContainer>
  );
}
