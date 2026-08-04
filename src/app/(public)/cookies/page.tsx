import type { Metadata } from "next";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { CONSENT_BANNER_VERSION, formatBannerVersionDate } from "@/lib/consent/cookie-registry";
import { siteUrl } from "@/content/site/site-url";
import { CookieRegistryGroups } from "./CookieRegistryGroups";

export const metadata: Metadata = {
  title: "Cookies & Site Storage | Rahma Therapy",
  description:
    "How Rahma Therapy uses cookies and browser storage on rahmatherapy.uk — what each one is for and how long it lasts.",
  alternates: {
    canonical: siteUrl("/cookies/"),
  },
};

// Phase C seam (documented per C-18 plan §1 Step 6): the preferences panel
// does not exist yet. When it ships, it is expected to mirror
// BookingExperienceLoader's pattern (src/features/booking/BookingExperienceLoader.tsx) —
// watch for `?cookie-settings=1` in the URL on mount, AND listen for clicks
// on any `[data-cookie-settings-trigger="true"]` element via event
// delegation, so this link (and the future SiteFooter link from Phase F)
// need no changes when the panel lands. Until then, this link is a
// documented no-op.
const COOKIE_SETTINGS_HREF = "?cookie-settings=1";

export default function CookiesPage() {
  return (
    <>
      <SectionContainer tone="ivory" width="narrow">
        <SectionHeading
          eyebrow="Cookies & site storage"
          title="What we store on your device, and why"
          description="This page lists every cookie and browser-storage item our own code sets on rahmatherapy.uk, or that a service we use (such as Google Analytics or Sentry) sets on our behalf, when you visit as a member of the public or use our booking system — what it does and how long it lasts. We keep this list in one place so it stays consistent wherever it's shown."
        />
      </SectionContainer>

      <SectionContainer tone="surface" width="narrow">
        <div className="grid gap-6 sm:grid-cols-2">
          <article className="rounded-2xl border border-rahma-border bg-rahma-ivory p-6">
            <h2 className="font-display text-xl font-semibold text-rahma-charcoal sm:text-2xl">
              How we&apos;ll record your consent
            </h2>
            <p className="mt-3 text-sm leading-7 text-rahma-muted sm:text-base">
              There&apos;s no cookie banner on this site yet, so no consent choice is being
              recorded today. Once one ships, choosing Accept all, Reject all, or saving your
              own choices will create a record of that choice: a random reference number that
              isn&apos;t linked to your name, the version of this page that was shown to you,
              and what you chose. We&apos;ll keep that record for as long as we rely on it as
              evidence of your consent. It will never include your IP address, your name, or
              anything else that identifies you.
            </p>
          </article>
          <article className="rounded-2xl border border-rahma-border bg-rahma-ivory p-6">
            <h2 className="font-display text-xl font-semibold text-rahma-charcoal sm:text-2xl">
              How you&apos;ll change your choices
            </h2>
            <p className="mt-3 text-sm leading-7 text-rahma-muted sm:text-base">
              There&apos;s no live control for this yet — non-essential items currently run
              automatically, without asking, as explained above. Once our cookie preferences
              panel ships, you&apos;ll be able to change your choices at any time: essential
              items still won&apos;t be switchable off, because the site can&apos;t do what
              you&apos;ve asked without them, but everything else will stay off unless you say
              yes.
            </p>
            <a
              href={COOKIE_SETTINGS_HREF}
              data-cookie-settings-trigger="true"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-rahma-green/30 px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              Not available yet
            </a>
          </article>
        </div>
      </SectionContainer>

      <SectionContainer tone="ivory" width="narrow">
        <SectionHeading title="What we store" className="mb-8" />
        <CookieRegistryGroups />
      </SectionContainer>

      <SectionContainer tone="surface" width="narrow">
        <p className="text-sm text-rahma-muted">
          Last updated: {formatBannerVersionDate(CONSENT_BANNER_VERSION)} (policy version{" "}
          {CONSENT_BANNER_VERSION}).
        </p>
      </SectionContainer>
    </>
  );
}
