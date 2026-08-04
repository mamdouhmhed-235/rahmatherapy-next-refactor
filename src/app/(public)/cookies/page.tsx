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

// The preferences panel is mounted for every public page by CookieBanner in
// src/app/(public)/layout.tsx, and it answers this link two ways, exactly as
// the Phase C seam comment here anticipated: a delegated click listener for any
// `[data-cookie-settings-trigger="true"]` element, and a `?cookie-settings=1`
// check on load for anyone arriving with JavaScript still catching up. So this
// page stays a server component — it needs no client island of its own, and
// Phase F's footer link will need neither.
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
              How we record your choice
            </h2>
            <p className="mt-3 text-sm leading-7 text-rahma-muted sm:text-base">
              Choosing Accept all, Reject all, or saving your own settings stores that answer
              in a small cookie on your device — a random reference number that isn&apos;t
              linked to your name, the version of this page that was shown to you, and what
              you chose. It stays for six months and then we ask you again. We also keep an
              internal record of that same choice — the reference number, the version shown,
              and what you chose — for as long as we rely on it as evidence of your consent.
              Neither the cookie nor that record ever includes your IP address, your name, or
              anything else that identifies you.
            </p>
          </article>
          <article className="rounded-2xl border border-rahma-border bg-rahma-ivory p-6">
            <h2 className="font-display text-xl font-semibold text-rahma-charcoal sm:text-2xl">
              How to change your choices
            </h2>
            <p className="mt-3 text-sm leading-7 text-rahma-muted sm:text-base">
              Open your cookie settings below, whenever you like. Essential items aren&apos;t
              switchable off, because the site can&apos;t do what you&apos;ve asked without
              them. Everything else has its own switch that is off until you turn it on,
              and each group below tells you exactly what turning it on or off does.
            </p>
            <a
              href={COOKIE_SETTINGS_HREF}
              data-cookie-settings-trigger="true"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-rahma-green/30 px-6 text-sm font-semibold text-rahma-green transition hover:border-rahma-green hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rahma-blue"
            >
              Cookie settings
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
