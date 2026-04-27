import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { Home, Users } from "lucide-react";
import { SectionContainer, SectionHeading } from "@/components/shared";

function publicAssetExists(src: string) {
  return existsSync(path.join(process.cwd(), "public", src.replace(/^\//, "")));
}

function LogoBadge({ src, label, placeholder }: { src: string; label: string; placeholder: string }) {
  const exists = publicAssetExists(src);

  return (
    <article className="flex min-h-36 flex-col items-center justify-center rounded-3xl border border-rahma-border bg-white p-5 text-center shadow-sm">
      {exists ? (
        <Image src={src} alt={label} width={130} height={64} className="max-h-14 w-auto" />
      ) : (
        <div
          role="img"
          aria-label={`${placeholder}. Intended file: ${src}`}
          className="flex min-h-16 w-full items-center justify-center rounded-2xl border border-dashed border-rahma-border bg-rahma-ivory px-4 text-sm font-semibold text-rahma-green"
        >
          {placeholder}
        </div>
      )}
      <p className="mt-4 text-sm font-semibold text-rahma-charcoal">{label}</p>
    </article>
  );
}

export function CredentialsBand() {
  return (
    <SectionContainer tone="surface">
      <SectionHeading
        align="center"
        title="Qualified care, local to Luton."
        description="Rahma Therapy is a CMA and IPHM qualified mobile therapy team offering private hijama, cupping and massage appointments across Luton."
        className="mx-auto"
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LogoBadge
          src="/logos/cma-logo.svg"
          label="CMA qualified"
          placeholder="CMA logo placeholder"
        />
        <LogoBadge
          src="/logos/iphm-logo.svg"
          label="IPHM qualified"
          placeholder="IPHM logo placeholder"
        />
        <article className="flex min-h-36 flex-col items-center justify-center rounded-3xl border border-rahma-border bg-white p-5 text-center shadow-sm">
          <Home aria-hidden="true" size={34} className="text-rahma-green" />
          <p className="mt-4 text-sm font-semibold text-rahma-charcoal">
            Fully mobile service
          </p>
        </article>
        <article className="flex min-h-36 flex-col items-center justify-center rounded-3xl border border-rahma-border bg-white p-5 text-center shadow-sm">
          <Users aria-hidden="true" size={34} className="text-rahma-green" />
          <p className="mt-4 text-sm font-semibold text-rahma-charcoal">
            Male & female therapists
          </p>
        </article>
      </div>
    </SectionContainer>
  );
}
