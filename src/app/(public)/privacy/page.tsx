import type { Metadata } from "next";
import Link from "next/link";
import { SectionContainer, SectionHeading } from "@/components/shared";
import { contactLinks } from "@/content/site/contact";
import { siteUrl } from "@/content/site/site-url";

// C-19 — privacy policy page.
//
// STANDING NOTES for whoever edits this next:
//   1. Section 2 ("What we collect") describes the booking form's fields as
//      they actually are (src/app/api/bookings/route.ts,
//      src/features/booking/schemas/booking-schema.ts). It is hand-written,
//      not generated from the schema — if the collected fields change, this
//      page needs a matching edit.
//   2. The international-transfers paragraph in section 5 is written
//      swap-ready between the UK Extension to the EU-US Data Privacy
//      Framework and UK-approved standard contractual terms, because the
//      framework was under legal challenge at the time of writing. Review
//      it at least annually.
export const metadata: Metadata = {
  title: "Privacy Policy — Rahma Therapy",
  description:
    "How Rahma Therapy collects, uses and protects your personal information when you visit this site or book a treatment.",
  alternates: {
    canonical: siteUrl("/privacy/"),
  },
};

const LAST_UPDATED = "9 August 2026";

const bodyText = "text-sm leading-7 text-rahma-muted sm:text-base";
const listClass = `grid list-disc gap-2 pl-5 marker:text-rahma-green ${bodyText}`;
const headingClass = "font-display text-xl font-semibold text-rahma-charcoal sm:text-2xl";
const linkClass = "font-semibold text-rahma-green underline underline-offset-2";

export default function PrivacyPolicyPage() {
  return (
    <>
      <SectionContainer tone="ivory" width="narrow">
        <SectionHeading
          eyebrow="Privacy policy"
          title="How we look after your information"
          description="This notice explains what personal information we collect when you book with us or get in touch, why we use it, who we share it with, and the choices and rights you have."
        />
        <p className={`mt-4 text-sm text-rahma-muted`}>Last updated: {LAST_UPDATED}</p>
      </SectionContainer>

      <SectionContainer tone="surface" width="narrow">
        <div className="mx-auto flex max-w-[65ch] flex-col gap-12">
          <section id="who-we-are" className="flex flex-col gap-3">
            <h3 className={headingClass}>1. Who we are</h3>
            <p className={bodyText}>
              This website and our booking service are run by RAHMATHERAPY LIMITED (company
              number 16769945), trading as Rahma Therapy. We are the data controller
              responsible for your personal information — the organisation that decides how
              and why it&apos;s used.
            </p>
            <p className={bodyText}>
              You can reach us by email at{" "}
              <a href={contactLinks.email.href} className={linkClass}>
                {contactLinks.email.value}
              </a>{" "}
              or by phone on{" "}
              <a href={contactLinks.phone.href} className={linkClass}>
                {contactLinks.phone.value}
              </a>
              .
            </p>
          </section>

          <section id="what-we-collect" className="flex flex-col gap-3">
            <h3 className={headingClass}>2. What we collect</h3>
            <p className={bodyText}>
              When you make a booking or get in touch with us, we collect:
            </p>
            <ul className={listClass}>
              <li>Your name, phone number and email address.</li>
              <li>
                Your address, town or city, area and postcode, plus any access or parking
                notes, so we can find and reach you.
              </li>
              <li>
                Whether the booking is for yourself, someone else, or a group, plus the gender
                of the person being treated — including your own if the booking is for you —
                and the names and genders of anyone else included.
              </li>
              <li>The treatments you choose and your preferred date and time.</li>
              <li>Any treatment notes you add about what you&apos;d like help with.</li>
              <li>
                Any health or safety notes you choose to share — for example allergies,
                medication, pregnancy, recent surgery, injuries or skin concerns. This is
                optional, used only to help us deliver your treatment safely, given with your
                consent, and you can ask us to remove it at any time.
              </li>
              <li>
                If you book for other people, any notes you add about them. Those notes are
                about someone else, not you, and may include information about that person&apos;s
                health too.
              </li>
            </ul>
          </section>

          <section id="why-we-use-it" className="flex flex-col gap-3">
            <h3 className={headingClass}>3. Why we use it</h3>
            <ul className={listClass}>
              <li>
                To provide the treatment and booking service you ask us for — necessary to
                fulfil our agreement with you.
              </li>
              <li>
                To handle any health or safety information you choose to share — only with
                your explicit permission, given when you confirm your booking, which you can
                withdraw at any time.
              </li>
              <li>
                To send you booking-related emails, such as confirmations and reminders —
                necessary to fulfil our agreement with you.
              </li>
              <li>
                For analytics, but only once you&apos;ve given us your consent through the
                cookie banner. See our{" "}
                <Link href="/cookies/" className={linkClass}>
                  cookies page
                </Link>{" "}
                for what we use and how to change your choice.
              </li>
              <li>
                To keep records for insurance and legal purposes — our legitimate business
                interest in protecting the company and meeting our legal obligations.
              </li>
            </ul>
          </section>

          <section id="who-helps-us-run-the-site" className="flex flex-col gap-3">
            <h3 className={headingClass}>4. Who helps us run the site</h3>
            <p className={bodyText}>
              We use a small number of trusted providers to run our site and booking service.
              They only process personal information on our instructions, for these purposes:
            </p>
            <ul className={listClass}>
              <li>Supabase — stores our booking and client database.</li>
              <li>Resend — sends booking and service emails on our behalf.</li>
              <li>Cloudflare — hosts the site and protects it from abuse.</li>
              <li>
                Sentry — reports technical errors so we can fix problems; personal information
                is scrubbed before it reaches Sentry.
              </li>
              <li>
                Google — provides website analytics, but only runs once you&apos;ve given
                cookie consent for it.
              </li>
            </ul>
          </section>

          <section id="where-data-goes" className="flex flex-col gap-3">
            <h3 className={headingClass}>5. Where your data goes</h3>
            <p className={bodyText}>
              Some of the providers above may process data outside the UK, including in the
              United States. Where that happens, the transfer is protected either by the UK
              Extension to the EU-US Data Privacy Framework or by UK-government-approved
              standard contractual terms, whichever applies to that provider.
            </p>
          </section>

          <section id="how-long-we-keep-it" className="flex flex-col gap-3">
            <h3 className={headingClass}>6. How long we keep it</h3>
            <p className={bodyText}>
              Our policy is to keep booking and treatment records for 7 years after your last
              visit with us. If you make an enquiry that doesn&apos;t turn into a booking, we
              keep it for around 12 months. Analytics information, where you&apos;ve given
              consent for it, is kept according to Google&apos;s own retention settings.
            </p>
          </section>

          <section id="your-rights" className="flex flex-col gap-3">
            <h3 className={headingClass}>7. Your rights</h3>
            <p className={bodyText}>You have the right to:</p>
            <ul className={listClass}>
              <li>ask to see the personal information we hold about you;</li>
              <li>ask us to correct anything that&apos;s wrong;</li>
              <li>ask us to delete your information;</li>
              <li>ask us to restrict how we use it, or object to us using it;</li>
              <li>ask for a copy of your information in a portable format; and</li>
              <li>
                withdraw your consent at any time, for anything we rely on your consent for,
                such as health information you&apos;ve shared.
              </li>
            </ul>
            <p className={bodyText}>
              To use any of these rights, contact us using the details in &ldquo;Who we
              are&rdquo; above.
            </p>
          </section>

          <section id="concerns" className="flex flex-col gap-3">
            <h3 className={headingClass}>8. Concerns and complaints</h3>
            <p className={bodyText}>
              If you&apos;re unhappy with how we&apos;ve handled your personal information,
              please contact us first so we can try to put things right. If you&apos;re still
              not satisfied, you also have the right to complain to the Information
              Commissioner&apos;s Office (ICO), the UK&apos;s independent regulator for data
              protection:{" "}
              <a href="https://ico.org.uk" className={linkClass}>
                ico.org.uk
              </a>{" "}
              · 0303 123 1113.
            </p>
          </section>

          <section id="no-automated-decisions" className="flex flex-col gap-3">
            <h3 className={headingClass}>9. No automated decision-making</h3>
            <p className={bodyText}>
              We do not use automated decision-making or profiling to make decisions about
              you. Every booking is reviewed and handled by a member of our team.
            </p>
          </section>
        </div>
      </SectionContainer>
    </>
  );
}
